"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import GuidePage from "@/components/guide/GuidePage";
import { getFirebaseDb, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { mockGuideTab } from "@/lib/mock-data";
import type { CampaignStatus, GuideItem, GuideMedia, GuideSection, GuideTab, MediaType, SectionType } from "@/types/guide";

interface PublicGuideClientProps {
  token: string;
}

type LoadState = "loading" | "ready" | "notFound" | "error";

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeMedia(value: unknown): GuideMedia | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  return {
    id: asString(data.id, crypto.randomUUID?.() ?? String(Date.now())),
    mediaType: asString(data.mediaType, "external_link") as MediaType,
    title: asString(data.title),
    fileUrl: asString(data.fileUrl) || undefined,
    externalUrl: asString(data.externalUrl) || undefined
  };
}

function normalizeItem(value: unknown): GuideItem | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data.isDeleted === true) return null;
  const media = Array.isArray(data.media) ? data.media.map(normalizeMedia).filter(Boolean) as GuideMedia[] : [];
  return {
    id: asString(data.id, crypto.randomUUID?.() ?? String(Date.now())),
    titleKo: asString(data.titleKo),
    bodyKo: asString(data.bodyKo),
    titleJa: asString(data.titleJa, "項目"),
    bodyJa: asString(data.bodyJa),
    itemType: asString(data.itemType, "text") as GuideItem["itemType"],
    sortOrder: asNumber(data.sortOrder),
    media
  };
}

function normalizeSection(value: unknown): GuideSection | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const items = Array.isArray(data.items) ? data.items.map(normalizeItem).filter(Boolean) as GuideItem[] : [];
  return {
    id: asString(data.id, crypto.randomUUID?.() ?? String(Date.now())),
    sectionType: asString(data.sectionType, "basic") as SectionType,
    titleJa: asString(data.titleJa, "ガイド"),
    sortOrder: asNumber(data.sortOrder),
    isCollapsible: Boolean(data.isCollapsible),
    items: items.sort((a, b) => a.sortOrder - b.sortOrder)
  };
}

function normalizeGuide(token: string, raw: Record<string, unknown>): GuideTab {
  const sections = Array.isArray(raw.sections) ? raw.sections.map(normalizeSection).filter(Boolean) as GuideSection[] : [];

  return {
    id: asString(raw.id, token),
    campaignId: asString(raw.campaignId),
    shareToken: asString(raw.shareToken, token),
    skuName: asString(raw.skuName),
    productName: asString(raw.productName),
    brandName: asString(raw.brandName),
    brandColor: asString(raw.brandColor, "#2D5A3D"),
    heroTitle: asString(raw.heroTitle, asString(raw.brandName, "Influencer Guide")),
    heroSubtitle: asString(raw.heroSubtitle, asString(raw.productName)),
    status: asString(raw.status, "unpublished") as CampaignStatus,
    hashtags: asStringArray(raw.hashtags),
    sections: sections.sort((a, b) => a.sortOrder - b.sortOrder)
  };
}

export default function PublicGuideClient({ token }: PublicGuideClientProps) {
  const [state, setState] = useState<LoadState>("loading");
  const [guide, setGuide] = useState<GuideTab | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadGuide() {
      try {
        if (!isFirebaseClientConfigured()) {
          if (!cancelled) {
            setGuide(token === mockGuideTab.shareToken ? mockGuideTab : { ...mockGuideTab, shareToken: token });
            setState("ready");
          }
          return;
        }

        const db = getFirebaseDb();
        const guideRef = doc(db, "publicGuides", token);
        const guideSnapshot = await getDoc(guideRef);

        if (!guideSnapshot.exists()) {
          if (!cancelled) {
            setGuide(token === mockGuideTab.shareToken ? mockGuideTab : null);
            setState(token === mockGuideTab.shareToken ? "ready" : "notFound");
          }
          return;
        }

        const loadedGuide = normalizeGuide(token, guideSnapshot.data() as Record<string, unknown>);

        if (loadedGuide.status !== "published") {
          if (!cancelled) {
            setGuide(null);
            setState("notFound");
          }
          return;
        }

        if (!cancelled) {
          setGuide(loadedGuide);
          setState("ready");
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "ガイドの読み込み中にエラーが発生しました。";
          setError(message);
          setState("error");
        }
      }
    }

    loadGuide();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "loading") {
    return <Message title="読み込み中" body="ガイド情報を取得しています。" />;
  }

  if (state === "error") {
    return <Message title="ガイド読み込みエラー" body={error} />;
  }

  if (state === "notFound" || !guide) {
    return <Message title="ガイドが見つかりません" body="リンクが間違っているか、まだ公開されていない可能性があります。" />;
  }

  return <GuidePage guide={guide} />;
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="not-found-page">
      <div className="auth-card">
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
    </main>
  );
}
