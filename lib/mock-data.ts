import { CampaignSummary, GuideTab } from "@/types/guide";
import { FIXED_SHOOTING_NOTICE_JA } from "@/lib/constants";

export const mockCampaigns: CampaignSummary[] = [
  {
    id: "cmp_easydew_q2",
    campaignName: "Easydew 2026 Q2 メガワリ",
    brandName: "Easydew",
    productName: "EGF X ダウンタイム オイントゲル",
    status: "published",
    updatedAt: "2026-05-16",
    tabCount: 2,
    brandColor: "#2D5A3D"
  },
  {
    id: "cmp_sample_pop",
    campaignName: "Sample Pop-up Campaign",
    brandName: "Sample Brand",
    productName: "Popup Visit Guide",
    status: "unpublished",
    updatedAt: "2026-05-14",
    tabCount: 1,
    brandColor: "#7A4A1A"
  },
  {
    id: "cmp_error",
    campaignName: "Import Error Test",
    brandName: "Test Brand",
    productName: "Sheet Parse Error",
    status: "error",
    updatedAt: "2026-05-12",
    tabCount: 0,
    brandColor: "#7A1A1A"
  }
];

export const mockGuideTab: GuideTab = {
  id: "tab_easydew_ointgel",
  campaignId: "cmp_easydew_q2",
  shareToken: "guide-easydew-ointgel-jp",
  skuName: "EGF X ダウンタイム オイントゲル",
  productName: "EGF X ダウンタイム オイントゲル",
  brandName: "Easydew",
  brandColor: "#2D5A3D",
  heroTitle: "Easydew",
  heroSubtitle: "EGF X ダウンタイム オイントゲル",
  status: "published",
  hashtags: ["#Easydew", "#イージーデュー", "#スキンケア", "#PR"],
  sections: [
    {
      id: "sec_basic",
      sectionType: "basic",
      titleJa: "基本情報",
      sortOrder: 1,
      isCollapsible: false,
      items: [
        { id: "b1", titleJa: "ブランド情報", bodyJa: "韓国ダーマコスメブランド Easydew。肌悩みに寄り添うスキンケアを展開しています。", itemType: "text", sortOrder: 1 },
        { id: "b2", titleJa: "商品名", bodyJa: "EGF X ダウンタイム オイントゲル", itemType: "text", sortOrder: 2 },
        { id: "b3", titleJa: "提供品", bodyJa: "EGF X ダウンタイム オイントゲル 1点", itemType: "text", sortOrder: 3 },
        { id: "b4", titleJa: "ブランド公式URL", bodyJa: "https://www.qoo10.jp/g/1199148394", itemType: "link", sortOrder: 4 }
      ]
    },
    {
      id: "sec_product",
      sectionType: "product",
      titleJa: "商品紹介および訴求ポイント",
      sortOrder: 2,
      isCollapsible: true,
      items: [
        { id: "p1", titleJa: "商品の特長", bodyJa: "日常のさまざまな刺激を受けた肌をすこやかに整えるための集中ケアアイテムです。", itemType: "text", sortOrder: 1 },
        { id: "p2", titleJa: "訴求ポイント 01", bodyJa: "韓国の薬局で話題となったノウハウを活かし、ケア後の肌をしっとり整えます。", itemType: "appeal", sortOrder: 2 },
        { id: "p3", titleJa: "訴求ポイント 02", bodyJa: "もっちりとしたオイントゲル処方で、気になる部分に密着してケアできます。", itemType: "appeal", sortOrder: 3 },
        { id: "p4", titleJa: "必須ハッシュタグ", bodyJa: "#Easydew #イージーデュー #スキンケア #PR", itemType: "hashtag", sortOrder: 4 }
      ]
    },
    {
      id: "sec_content",
      sectionType: "content",
      titleJa: "コンテンツの必須事項",
      sortOrder: 3,
      isCollapsible: true,
      items: [
        { id: "c1", titleJa: "Scene 01. 冒頭フック", bodyJa: "商品を手に持ち、視聴者が気になる一言から始めてください。", itemType: "scene", sortOrder: 1 },
        { id: "c2", titleJa: "Scene 02. 使用シーン", bodyJa: "テクスチャーが分かるよう、手元や肌になじませるシーンを入れてください。", itemType: "scene", sortOrder: 2 },
        { id: "c3", titleJa: "Scene 03. CTA", bodyJa: "購入先やキャンペーン情報を自然に紹介してください。", itemType: "scene", sortOrder: 3 }
      ]
    },
    {
      id: "sec_notice",
      sectionType: "notice",
      titleJa: "注意事項",
      sortOrder: 4,
      isCollapsible: true,
      items: [
        { id: "n1", titleJa: "撮影時の注意事項", bodyJa: FIXED_SHOOTING_NOTICE_JA, itemType: "notice", sortOrder: 1 },
        { id: "n2", titleJa: "投稿時の注意事項", bodyJa: "投稿前に内容をご確認のうえ、指定されたハッシュタグを必ず含めてください。", itemType: "notice", sortOrder: 2 }
      ]
    }
  ]
};
