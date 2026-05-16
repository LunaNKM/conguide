export type CampaignStatus = "unpublished" | "published" | "error";
export type SectionType = "basic" | "product" | "content" | "notice";
export type MediaType = "image" | "video" | "external_link" | "youtube" | "google_drive";

export interface CampaignSummary {
  id: string;
  campaignName: string;
  brandName: string;
  productName: string;
  status: CampaignStatus;
  updatedAt: string;
  tabCount: number;
  brandColor: string;
}

export interface GuideMedia {
  id: string;
  mediaType: MediaType;
  title?: string;
  fileUrl?: string;
  externalUrl?: string;
}

export interface GuideItem {
  id: string;
  titleKo?: string;
  bodyKo?: string;
  titleJa: string;
  bodyJa: string;
  itemType: "text" | "appeal" | "scene" | "notice" | "hashtag" | "link";
  sortOrder: number;
  media?: GuideMedia[];
}

export interface GuideSection {
  id: string;
  sectionType: SectionType;
  titleJa: string;
  sortOrder: number;
  isCollapsible: boolean;
  items: GuideItem[];
}

export interface GuideTab {
  id: string;
  campaignId: string;
  shareToken: string;
  skuName: string;
  productName: string;
  brandName: string;
  brandColor: string;
  heroTitle: string;
  heroSubtitle: string;
  status: CampaignStatus;
  sections: GuideSection[];
  hashtags: string[];
}
