import { mockGuideTab } from "@/lib/mock-data";
import type { GuideItem, GuideMedia, GuideSection, GuideTab } from "@/types/guide";
import { getFirebaseAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { DocumentData } from "firebase-admin/firestore";

function normalizeMedia(id: string, value: DocumentData): GuideMedia {
  return {
    id,
    mediaType: value.mediaType ?? "external_link",
    title: value.title ?? "",
    fileUrl: value.fileUrl ?? undefined,
    externalUrl: value.externalUrl ?? undefined
  };
}

function normalizeItem(id: string, value: DocumentData, media: GuideMedia[]): GuideItem {
  return {
    id,
    titleKo: value.titleKo ?? "",
    bodyKo: value.bodyKo ?? "",
    titleJa: value.titleJa ?? "",
    bodyJa: value.bodyJa ?? "",
    itemType: value.itemType ?? "text",
    sortOrder: value.sortOrder ?? 0,
    media
  };
}

export async function getPublicGuideByToken(token: string): Promise<GuideTab | null> {
  if (!isFirebaseAdminConfigured()) {
    return token === mockGuideTab.shareToken ? mockGuideTab : { ...mockGuideTab, shareToken: token };
  }

  const db = getFirebaseAdminDb();
  const tabSnapshot = await db.collection("campaignTabs").where("shareToken", "==", token).limit(1).get();

  if (tabSnapshot.empty) {
    return token === mockGuideTab.shareToken ? mockGuideTab : null;
  }

  const tabDoc = tabSnapshot.docs[0];
  const tabData = tabDoc.data();

  if (tabData.status !== "published") return null;

  const sectionsSnapshot = await db
    .collection("campaignTabs")
    .doc(tabDoc.id)
    .collection("sections")
    .orderBy("sortOrder", "asc")
    .get();

  const sections: GuideSection[] = [];

  for (const sectionDoc of sectionsSnapshot.docs) {
    const sectionData = sectionDoc.data();
    const itemsSnapshot = await sectionDoc.ref.collection("items").orderBy("sortOrder", "asc").get();
    const items: GuideItem[] = [];

    for (const itemDoc of itemsSnapshot.docs) {
      const itemData = itemDoc.data();
      if (itemData.isDeleted) continue;

      const mediaSnapshot = await itemDoc.ref.collection("media").orderBy("sortOrder", "asc").get();
      const media = mediaSnapshot.docs.map((mediaDoc) => normalizeMedia(mediaDoc.id, mediaDoc.data()));
      items.push(normalizeItem(itemDoc.id, itemData, media));
    }

    sections.push({
      id: sectionDoc.id,
      sectionType: sectionData.sectionType,
      titleJa: sectionData.titleJa,
      sortOrder: sectionData.sortOrder ?? 0,
      isCollapsible: Boolean(sectionData.isCollapsible),
      items
    });
  }

  return {
    id: tabDoc.id,
    campaignId: tabData.campaignId ?? "",
    shareToken: tabData.shareToken,
    skuName: tabData.skuName ?? "",
    productName: tabData.productName ?? "",
    brandName: tabData.brandName ?? "",
    brandColor: tabData.brandColor ?? "#2D5A3D",
    heroTitle: tabData.heroTitle ?? tabData.brandName ?? "Influencer Guide",
    heroSubtitle: tabData.heroSubtitle ?? tabData.productName ?? "",
    status: tabData.status ?? "unpublished",
    hashtags: Array.isArray(tabData.hashtags) ? tabData.hashtags : [],
    sections
  };
}
