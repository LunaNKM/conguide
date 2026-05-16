"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import GuidePage from "@/components/guide/GuidePage";
import { getFirebaseDb, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { mockGuideTab } from "@/lib/mock-data";
import type { GuideItem, GuideMedia, GuideSection, GuideTab, MediaType, SectionType } from "@/types/guide";

interface PublicGuideClientProps {
  token: string;
}

type LoadState = "loading" | "ready" | "notFound" | "error";

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
        const tabQuery = query(collection(db, "campaignTabs"), where("shareToken", "==", token));
        const tabSnapshot = await getDocs(tabQuery);

        if (tabSnapshot.empty) {
          if (!cancelled) {
            setGuide(token === mockGuideTab.shareToken ? mockGuideTab : null);
            setState(token === mockGuideTab.shareToken ? "ready" : "notFound");
          }
          return;
        }

        const tabDoc = tabSnapshot.docs[0];
        const tabData = tabDoc.data();

        if (tabData.status !== "published") {
          if (!cancelled) setState("notFound");
          return;
        }

        const sectionsSnapshot = await getDocs(query(collection(db, "guideSections"), where("tabId", "==", tabDoc.id)));
        const sectionDocs = sectionsSnapshot.docs
          .map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }))
          .sort((a, b) => Number(a.data.sortOrder ?? 0) - Number(b.data.sortOrder ?? 0));

        const sections: GuideSection[] = [];

        for (const sectionDoc of sectionDocs) {
          const itemsSnapshot = await getDocs(query(collection(db, "guideItems"), where("sectionId", "==", sectionDoc.id)));
          const itemDocs = itemsSnapshot.docs
            .map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }))
            .filter((item) => item.data.isDeleted !== true)
            .sort((a, b) => Number(a.data.sortOrder ?? 0) - Number(b.data.sortOrder ?? 0));

          const items: GuideItem[] = [];

          for (const itemDoc of itemDocs) {
            const mediaSnapshot = await getDocs(query(collection(db, "mediaAssets"), where("itemId", "==", itemDoc.id)));
            const media: GuideMedia[] = mediaSnapshot.docs
              .map((mediaDoc) => {
                const mediaData = mediaDoc.data();
                return {
                  id: mediaDoc.id,
                  mediaType: (mediaData.mediaType ?? "external_link") as MediaType,
                  title: mediaData.title ?? "",
                  fileUrl: mediaData.fileUrl ?? undefined,
                  externalUrl: mediaData.externalUrl ?? undefined
                };
              })
              .sort((a, b) => String(a.id).localeCompare(String(b.id)));

            items.push({
              id: itemDoc.id,
              titleKo: itemDoc.data.titleKo ?? "",
              bodyKo: itemDoc.data.bodyKo ?? "",
              titleJa: itemDoc.data.titleJa ?? "",
              bodyJa: itemDoc.data.bodyJa ?? "",
              itemType: itemDoc.data.itemType ?? "text",
              sortOrder: Number(itemDoc.data.sortOrder ?? 0),
              media
            });
          }

          sections.push({
            id: sectionDoc.id,
            sectionType: (sectionDoc.data.sectionType ?? "basic") as SectionType,
            titleJa: sectionDoc.data.titleJa ?? "",
            sortOrder: Number(sectionDoc.data.sortOrder ?? 0),
            isCollapsible: Boolean(sectionDoc.data.isCollapsible),
            items
          });
        }

        const loadedGuide: GuideTab = {
          id: tabDoc.id,
          campaignId: tabData.campaignId ?? "",
          shareToken: tabData.shareToken ?? token,
          skuName: tabData.skuName ?? "",
          productName: tabData.productName ?? "",
          brandName: tabData.brandName ?? "",
          brandColor: tabData.brandColor ?? "#2D5A3D",
          heroTitle: tabData.heroTitle ?? tabData.brandName ?? "Influencer Guide",
          heroSubtitle: tabData.heroSubtitle ?? tabData.productName ?? "",
          status: tabData.status ?? "published",
          hashtags: Array.isArray(tabData.hashtags) ? tabData.hashtags : [],
          sections
        };

        if (!cancelled) {
          setGuide(loadedGuide);
          setState("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "ガイドの読み込み中にエラーが発生しました。");
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
