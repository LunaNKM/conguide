"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type DocumentData
} from "firebase/firestore";
import GuidePage from "@/components/guide/GuidePage";
import type { GuideItem, GuideMedia, GuideTab, SectionType } from "@/types/guide";
import { getFirebaseBrowserDb, isFirebaseConfigured } from "@/lib/firebase/browser";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; guide: GuideTab }
  | { status: "not-found" }
  | { status: "error"; message: string };

const SECTION_ORDER: SectionType[] = ["basic", "product", "content", "notice"];

export default function PublicGuideClient({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadGuide() {
      if (!isFirebaseConfigured()) {
        setState({
          status: "error",
          message: "Firebase 설정이 없습니다. Vercel 환경변수를 확인해주세요."
        });
        return;
      }

      try {
        const db = getFirebaseBrowserDb();
        const normalizedToken = decodeURIComponent(token).trim();

        const publishedDoc = await getDoc(doc(db, "publicGuides", normalizedToken));
        if (publishedDoc.exists()) {
          const guide = normalizePublicGuide(publishedDoc.data(), normalizedToken);
          if (guide && isPublishedLike(guide.status)) {
            if (!cancelled) setState({ status: "ready", guide });
            return;
          }
        }

        const fallbackGuide = await buildGuideFromRawCollections(normalizedToken);
        if (fallbackGuide) {
          if (!cancelled) setState({ status: "ready", guide: fallbackGuide });
          return;
        }

        if (!cancelled) setState({ status: "not-found" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
        if (!cancelled) setState({ status: "error", message });
      }
    }

    loadGuide();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === "loading") {
    return (
      <main className="not-found-page">
        <section className="auth-card">
          <p className="eyebrow">Loading</p>
          <h1>ガイドを読み込み中です</h1>
          <p>少々お待ちください。</p>
        </section>
      </main>
    );
  }

  if (state.status === "ready") {
    return <GuidePage guide={state.guide} />;
  }

  if (state.status === "error") {
    return (
      <main className="not-found-page">
        <section className="auth-card">
          <p className="eyebrow">Guide Error</p>
          <h1>ガイド読み込みエラー</h1>
          <p>{state.message}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="not-found-page">
      <section className="auth-card">
        <p className="eyebrow">Not Found</p>
        <h1>ガイドが見つかりません</h1>
        <p>リンクが間違っているか、まだ公開されていない可能性があります。</p>
      </section>
    </main>
  );
}

async function buildGuideFromRawCollections(shareToken: string): Promise<GuideTab | null> {
  const db = getFirebaseBrowserDb();

  const tabSnapshot = await getDocs(
    query(collection(db, "campaignTabs"), where("shareToken", "==", shareToken), limit(1))
  );

  if (tabSnapshot.empty) return null;

  const tabDoc = tabSnapshot.docs[0];
  const tabData = tabDoc.data();
  const campaignId = pickString(tabData, "campaignId", "campaign_id");
  let campaignData: DocumentData | null = null;

  if (campaignId) {
    const campaignDoc = await getDoc(doc(db, "campaigns", campaignId));
    if (campaignDoc.exists()) campaignData = campaignDoc.data();
  }

  const tabPublished = isPublishedLike(pickString(tabData, "status"));
  const campaignPublished = isPublishedLike(pickString(campaignData, "status"));

  if (!tabPublished && !campaignPublished) return null;

  const sectionsSnapshot = await getDocs(
    query(collection(db, "guideSections"), where("tabId", "==", tabDoc.id))
  );

  const mediaSnapshot = await getDocs(
    query(collection(db, "mediaAssets"), where("tabId", "==", tabDoc.id))
  );

  const mediaByItemId = new Map<string, Array<{ media: GuideMedia; order: number }>>();
  mediaSnapshot.docs.forEach((mediaDoc) => {
    const data = mediaDoc.data();
    const itemId = pickString(data, "itemId", "item_id");
    if (!itemId) return;
    const media: GuideMedia = {
      id: mediaDoc.id,
      mediaType: (pickString(data, "mediaType", "media_type") || "external_link") as GuideMedia["mediaType"],
      fileUrl: pickString(data, "fileUrl", "file_url"),
      externalUrl: pickString(data, "externalUrl", "external_url"),
      title: pickString(data, "title")
    };
    mediaByItemId.set(itemId, [
      ...(mediaByItemId.get(itemId) ?? []),
      { media, order: pickNumber(data, "sortOrder", "sort_order") }
    ]);
  });

  const sections = await Promise.all(
    sectionsSnapshot.docs.map(async (sectionDoc) => {
      const sectionData = sectionDoc.data();
      const itemsSnapshot = await getDocs(
        query(collection(db, "guideItems"), where("sectionId", "==", sectionDoc.id))
      );

      const items: GuideItem[] = itemsSnapshot.docs
        .map((itemDoc): GuideItem | null => {
          const data = itemDoc.data();
          const isDeleted = pickBoolean(data, "isDeleted", "is_deleted");
          if (isDeleted) return null;

          return {
            id: itemDoc.id,
            titleKo: pickString(data, "titleKo", "title_ko"),
            bodyKo: pickString(data, "bodyKo", "body_ko"),
            titleJa: pickString(data, "titleJa", "title_ja") || "項目",
            bodyJa: pickString(data, "bodyJa", "body_ja") || "",
            itemType: (pickString(data, "itemType", "item_type") || "text") as GuideItem["itemType"],
            sortOrder: pickNumber(data, "sortOrder", "sort_order"),
            textSize: pickString(data, "textSize", "text_size") as GuideItem["textSize"],
            emphasize: pickBoolean(data, "emphasize"),
            media: (mediaByItemId.get(itemDoc.id) ?? [])
              .sort((a, b) => a.order - b.order)
              .map((entry) => entry.media)
          };
        })
        .filter((item): item is GuideItem => item !== null)
        .sort(sortByOrder);

      return {
        id: sectionDoc.id,
        sectionType: (pickString(sectionData, "sectionType", "section_type") || "basic") as SectionType,
        titleJa: pickString(sectionData, "titleJa", "title_ja") || "",
        sortOrder: pickNumber(sectionData, "sortOrder", "sort_order"),
        isCollapsible: pickBoolean(sectionData, "isCollapsible", "is_collapsible"),
        items
      };
    })
  );

  const sortedSections = sections.sort((a, b) => {
    const orderA = SECTION_ORDER.indexOf(a.sectionType);
    const orderB = SECTION_ORDER.indexOf(b.sectionType);
    if (orderA !== orderB) return orderA - orderB;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  return {
    id: tabDoc.id,
    tabId: tabDoc.id,
    campaignId,
    shareToken,
    status: "published",
    skuName: pickString(tabData, "skuName", "sku_name") || pickString(tabData, "productName", "product_name") || "SKU",
    productName: pickString(tabData, "productName", "product_name") || "",
    brandName:
      pickString(tabData, "brandName", "brand_name") ||
      pickString(campaignData, "brandName", "brand_name") ||
      "",
    brandColor: pickString(tabData, "brandColor", "brand_color") || "#1F4A35",
    heroTitle:
      pickString(tabData, "heroTitle", "hero_title") ||
      pickString(tabData, "brandName", "brand_name") ||
      pickString(campaignData, "brandName", "brand_name") ||
      "Guide",
    heroSubtitle:
      pickString(tabData, "heroSubtitle", "hero_subtitle") ||
      pickString(tabData, "productName", "product_name") ||
      "",
    brandLogoUrl: pickString(tabData, "brandLogoUrl", "brand_logo_url"),
    brandLogoAlt: pickString(tabData, "brandLogoAlt", "brand_logo_alt"),
    hashtags: pickStringArray(tabData, "hashtags"),
    sections: sortedSections
  } as GuideTab;
}

function normalizePublicGuide(data: DocumentData, token: string): GuideTab | null {
  if (!data) return null;
  const sections = Array.isArray(data.sections) ? data.sections : [];

  return {
    id: pickString(data, "id") || token,
    tabId: pickString(data, "tabId", "tab_id") || token,
    campaignId: pickString(data, "campaignId", "campaign_id"),
    shareToken: pickString(data, "shareToken", "share_token") || token,
    status: pickString(data, "status") || "published",
    skuName: pickString(data, "skuName", "sku_name") || "",
    productName: pickString(data, "productName", "product_name") || "",
    brandName: pickString(data, "brandName", "brand_name") || "",
    brandColor: pickString(data, "brandColor", "brand_color") || "#1F4A35",
    heroTitle: pickString(data, "heroTitle", "hero_title") || pickString(data, "brandName", "brand_name") || "Guide",
    heroSubtitle: pickString(data, "heroSubtitle", "hero_subtitle") || pickString(data, "productName", "product_name") || "",
    brandLogoUrl: pickString(data, "brandLogoUrl", "brand_logo_url"),
    brandLogoAlt: pickString(data, "brandLogoAlt", "brand_logo_alt"),
    hashtags: pickStringArray(data, "hashtags"),
    sections
  } as GuideTab;
}

function isPublishedLike(value: unknown) {
  const status = String(value ?? "").trim().toLowerCase();
  return ["published", "public", "active", "open", "공개"].includes(status);
}

function pickString(data: DocumentData | null | undefined, ...keys: string[]) {
  if (!data) return "";
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

function pickNumber(data: DocumentData | null | undefined, ...keys: string[]) {
  if (!data) return 0;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  }
  return 0;
}

function pickBoolean(data: DocumentData | null | undefined, ...keys: string[]) {
  if (!data) return false;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
  }
  return false;
}

function pickStringArray(data: DocumentData | null | undefined, key: string) {
  if (!data) return [];
  const value = data[key];
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string") return value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function sortByOrder(a: { sortOrder?: number }, b: { sortOrder?: number }) {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
}
