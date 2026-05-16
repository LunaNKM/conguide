"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { getFirebaseDb, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { FIXED_SHOOTING_NOTICE_JA } from "@/lib/constants";
import { mockCampaigns, mockGuideTab } from "@/lib/mock-data";
import GuidePage from "@/components/guide/GuidePage";
import type { CampaignStatus, CampaignSummary, GuideItem, GuideSection, GuideTab } from "@/types/guide";

const statusLabel: Record<CampaignStatus, string> = {
  unpublished: "미공개",
  published: "공개",
  error: "오류"
};

const statusClass: Record<CampaignStatus, string> = {
  unpublished: "badge-gray",
  published: "badge-green",
  error: "badge-red"
};

interface DashboardCampaign extends CampaignSummary {
  firstShareToken?: string;
  firstTabId?: string;
}

interface NewCampaignForm {
  campaignName: string;
  brandName: string;
  skuName: string;
  productName: string;
  brandColor: string;
  heroTitle: string;
  heroSubtitle: string;
  hashtags: string;
  status: CampaignStatus;
}

const emptyForm: NewCampaignForm = {
  campaignName: "",
  brandName: "",
  skuName: "",
  productName: "",
  brandColor: "#2D5A3D",
  heroTitle: "",
  heroSubtitle: "",
  hashtags: "#PR #メガワリ",
  status: "unpublished"
};

const SAMPLE_CAMPAIGN_ID = "sample-easydew-q2";
const SAMPLE_TAB_ID = "sample-easydew-ointgel";

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "_")}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣ぁ-んァ-ン一-龥]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "guide";
}

function splitHashtags(value: string) {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith("#") ? item : `#${item}`));
}

function formatDate(date?: Date) {
  if (!date) return "-";
  return date.toISOString().slice(0, 10);
}

function createDefaultSections(params: {
  tabId: string;
  brandName: string;
  productName: string;
  skuName: string;
  hashtags: string[];
}): GuideSection[] {
  const { tabId, brandName, productName, skuName, hashtags } = params;
  return [
    {
      id: `${tabId}_basic`,
      sectionType: "basic",
      titleJa: "基本情報",
      sortOrder: 1,
      isCollapsible: false,
      items: [
        {
          id: `${tabId}_basic_brand`,
          titleKo: "브랜드 정보",
          bodyKo: brandName,
          titleJa: "ブランド情報",
          bodyJa: `${brandName} のインフルエンサーガイドです。`,
          itemType: "text",
          sortOrder: 1,
          media: []
        },
        {
          id: `${tabId}_basic_product`,
          titleKo: "상품명",
          bodyKo: productName,
          titleJa: "商品名",
          bodyJa: productName,
          itemType: "text",
          sortOrder: 2,
          media: []
        },
        {
          id: `${tabId}_basic_sku`,
          titleKo: "SKU",
          bodyKo: skuName,
          titleJa: "SKU",
          bodyJa: skuName,
          itemType: "text",
          sortOrder: 3,
          media: []
        }
      ]
    },
    {
      id: `${tabId}_product`,
      sectionType: "product",
      titleJa: "商品紹介および訴求ポイント",
      sortOrder: 2,
      isCollapsible: true,
      items: [
        {
          id: `${tabId}_product_intro`,
          titleKo: "상품 소개",
          bodyKo: "관리자 화면에서 수정해 주세요.",
          titleJa: "商品の紹介",
          bodyJa: "商品の特徴や訴求ポイントを、ここに整理して記載してください。",
          itemType: "text",
          sortOrder: 1,
          media: []
        },
        {
          id: `${tabId}_product_hashtags`,
          titleKo: "필수 해시태그",
          bodyKo: hashtags.join(" "),
          titleJa: "必須ハッシュタグ",
          bodyJa: hashtags.join(" "),
          itemType: "hashtag",
          sortOrder: 2,
          media: []
        }
      ]
    },
    {
      id: `${tabId}_content`,
      sectionType: "content",
      titleJa: "コンテンツの必須事項",
      sortOrder: 3,
      isCollapsible: true,
      items: [
        {
          id: `${tabId}_content_scene1`,
          titleKo: "필수 장면 1",
          bodyKo: "관리자가 직접 작성합니다.",
          titleJa: "Scene 01. 必須シーン",
          bodyJa: "この項目は管理画面で内容を追加・修正してください。",
          itemType: "scene",
          sortOrder: 1,
          media: []
        }
      ]
    },
    {
      id: `${tabId}_notice`,
      sectionType: "notice",
      titleJa: "注意事項",
      sortOrder: 4,
      isCollapsible: true,
      items: [
        {
          id: `${tabId}_notice_shooting`,
          titleKo: "촬영 시 주의사항",
          bodyKo: "고정 촬영 주의사항",
          titleJa: "撮影時の注意事項",
          bodyJa: FIXED_SHOOTING_NOTICE_JA,
          itemType: "notice",
          sortOrder: 1,
          media: []
        },
        {
          id: `${tabId}_notice_posting`,
          titleKo: "투고 시 주의사항",
          bodyKo: "관리자가 직접 작성합니다.",
          titleJa: "投稿時の注意事項",
          bodyJa: "投稿前に内容をご確認のうえ、指定された内容に沿って投稿してください。",
          itemType: "notice",
          sortOrder: 2,
          media: []
        }
      ]
    }
  ];
}

function buildPublicGuide(params: {
  tabId: string;
  campaignId: string;
  shareToken: string;
  skuName: string;
  productName: string;
  brandName: string;
  brandColor: string;
  heroTitle: string;
  heroSubtitle: string;
  status: CampaignStatus;
  hashtags: string[];
  sections: GuideSection[];
}): GuideTab {
  return {
    id: params.tabId,
    campaignId: params.campaignId,
    shareToken: params.shareToken,
    skuName: params.skuName,
    productName: params.productName,
    brandName: params.brandName,
    brandColor: params.brandColor,
    heroTitle: params.heroTitle,
    heroSubtitle: params.heroSubtitle,
    status: params.status,
    hashtags: params.hashtags,
    sections: params.sections
  };
}

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function writeTopLevelGuideData(params: {
  campaignId: string;
  tabId: string;
  guide: GuideTab;
}) {
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  const now = serverTimestamp();
  const { campaignId, tabId, guide } = params;

  guide.sections.forEach((section) => {
    batch.set(doc(db, "guideSections", section.id), {
      tabId,
      sectionType: section.sectionType,
      titleJa: section.titleJa,
      sortOrder: section.sortOrder,
      isCollapsible: section.isCollapsible,
      updatedAt: now
    }, { merge: true });

    section.items.forEach((item) => {
      batch.set(doc(db, "guideItems", item.id), {
        sectionId: section.id,
        titleKo: item.titleKo ?? "",
        bodyKo: item.bodyKo ?? "",
        titleJa: item.titleJa,
        bodyJa: item.bodyJa,
        itemType: item.itemType,
        sortOrder: item.sortOrder,
        isDeleted: false,
        updatedAt: now
      }, { merge: true });
    });
  });

  batch.set(doc(db, "publicGuides", guide.shareToken), {
    ...stripUndefined(guide),
    campaignId,
    id: tabId,
    updatedAt: now
  }, { merge: true });

  await batch.commit();
}

export default function AdminDashboard() {
  const [queryText, setQueryText] = useState("");
  const [status, setStatus] = useState<"all" | CampaignStatus>("all");
  const [campaigns, setCampaigns] = useState<DashboardCampaign[]>(mockCampaigns);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Firebase 연결 대기 중");
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<NewCampaignForm>(emptyForm);

  async function loadCampaigns() {
    if (!isFirebaseClientConfigured()) {
      setMessage("Firebase 환경변수가 없어 샘플 데이터로 표시 중입니다.");
      setCampaigns(mockCampaigns);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const db = getFirebaseDb();
      const campaignSnapshot = await getDocs(collection(db, "campaigns"));
      const tabSnapshot = await getDocs(collection(db, "campaignTabs"));
      const tabsByCampaign = new Map<string, number>();
      const productByCampaign = new Map<string, string>();
      const colorByCampaign = new Map<string, string>();
      const shareTokenByCampaign = new Map<string, string>();
      const tabIdByCampaign = new Map<string, string>();

      tabSnapshot.docs.forEach((tabDoc) => {
        const tab = tabDoc.data();
        const campaignId = String(tab.campaignId ?? "");
        if (!campaignId) return;
        tabsByCampaign.set(campaignId, (tabsByCampaign.get(campaignId) ?? 0) + 1);
        if (!productByCampaign.has(campaignId)) productByCampaign.set(campaignId, String(tab.productName ?? tab.skuName ?? ""));
        if (!colorByCampaign.has(campaignId)) colorByCampaign.set(campaignId, String(tab.brandColor ?? "#2D5A3D"));
        if (!shareTokenByCampaign.has(campaignId)) shareTokenByCampaign.set(campaignId, String(tab.shareToken ?? ""));
        if (!tabIdByCampaign.has(campaignId)) tabIdByCampaign.set(campaignId, tabDoc.id);
      });

      const loaded = campaignSnapshot.docs
        .map((campaignDoc) => {
          const campaign = campaignDoc.data();
          return {
            id: campaignDoc.id,
            campaignName: String(campaign.campaignName ?? "Untitled Campaign"),
            brandName: String(campaign.brandName ?? ""),
            productName: productByCampaign.get(campaignDoc.id) ?? "",
            status: String(campaign.status ?? "unpublished") as CampaignStatus,
            updatedAt: formatDate(campaign.updatedAt?.toDate?.() ?? campaign.createdAt?.toDate?.()),
            tabCount: tabsByCampaign.get(campaignDoc.id) ?? 0,
            brandColor: colorByCampaign.get(campaignDoc.id) ?? "#2D5A3D",
            firstShareToken: shareTokenByCampaign.get(campaignDoc.id),
            firstTabId: tabIdByCampaign.get(campaignDoc.id)
          } satisfies DashboardCampaign;
        })
        .filter((campaign) => !campaign.campaignName.startsWith("__archived__"));

      setCampaigns(loaded);
      setMessage(loaded.length ? "Firestore에서 캠페인을 불러왔습니다." : "아직 캠페인이 없습니다. 새 캠페인을 생성해 주세요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "캠페인 로딩 중 오류가 발생했습니다.");
      setCampaigns(mockCampaigns);
    } finally {
      setLoading(false);
    }
  }

  async function createSampleData() {
    if (!isFirebaseClientConfigured()) {
      setError("Firebase 환경변수가 설정되어 있지 않습니다.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("샘플 데이터를 생성 중입니다...");

    try {
      const db = getFirebaseDb();
      const now = serverTimestamp();

      await setDoc(doc(db, "campaigns", SAMPLE_CAMPAIGN_ID), {
        campaignName: "Easydew 2026 Q2 Campaign",
        brandName: "Easydew",
        status: "published",
        archivedAt: null,
        createdAt: now,
        updatedAt: now
      }, { merge: true });

      await setDoc(doc(db, "campaignTabs", SAMPLE_TAB_ID), {
        campaignId: SAMPLE_CAMPAIGN_ID,
        shareToken: mockGuideTab.shareToken,
        skuName: mockGuideTab.skuName,
        productName: mockGuideTab.productName,
        brandName: mockGuideTab.brandName,
        brandColor: mockGuideTab.brandColor,
        heroTitle: mockGuideTab.heroTitle,
        heroSubtitle: mockGuideTab.heroSubtitle,
        status: "published",
        hashtags: mockGuideTab.hashtags,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      }, { merge: true });

      await writeTopLevelGuideData({ campaignId: SAMPLE_CAMPAIGN_ID, tabId: SAMPLE_TAB_ID, guide: mockGuideTab });
      setMessage("샘플 데이터와 publicGuides 공개 문서를 생성했습니다.");
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "샘플 데이터 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isFirebaseClientConfigured()) {
      setError("Firebase 환경변수가 설정되어 있지 않습니다.");
      return;
    }

    const campaignName = form.campaignName.trim();
    const brandName = form.brandName.trim();
    const skuName = form.skuName.trim();
    const productName = form.productName.trim();

    if (!campaignName || !brandName || !skuName || !productName) {
      setError("캠페인명, 브랜드명, SKU명, 상품명은 필수입니다.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("새 캠페인을 생성 중입니다...");

    try {
      const db = getFirebaseDb();
      const now = serverTimestamp();
      const campaignId = createId("campaign");
      const tabId = createId("tab");
      const shareToken = `guide-${slugify(brandName)}-${slugify(skuName)}-${Date.now()}-jp`;
      const hashtags = splitHashtags(form.hashtags);
      const brandColor = form.brandColor || "#2D5A3D";
      const heroTitle = form.heroTitle.trim() || brandName;
      const heroSubtitle = form.heroSubtitle.trim() || productName;
      const sections = createDefaultSections({ tabId, brandName, productName, skuName, hashtags });
      const guide = buildPublicGuide({
        tabId,
        campaignId,
        shareToken,
        skuName,
        productName,
        brandName,
        brandColor,
        heroTitle,
        heroSubtitle,
        status: form.status,
        hashtags,
        sections
      });

      const batch = writeBatch(db);
      batch.set(doc(db, "campaigns", campaignId), {
        campaignName,
        brandName,
        status: form.status,
        archivedAt: null,
        createdAt: now,
        updatedAt: now
      });
      batch.set(doc(db, "campaignTabs", tabId), {
        campaignId,
        shareToken,
        skuName,
        productName,
        brandName,
        brandColor,
        heroTitle,
        heroSubtitle,
        status: form.status,
        hashtags,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      });
      await batch.commit();

      await writeTopLevelGuideData({ campaignId, tabId, guide });

      setMessage(`새 캠페인 생성 완료. 공유 링크: /guide/${shareToken}`);
      setIsCreateOpen(false);
      setForm(emptyForm);
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "캠페인 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function syncPublicGuide(campaign: DashboardCampaign) {
    if (!isFirebaseClientConfigured() || !campaign.firstTabId || !campaign.firstShareToken) return;
    setLoading(true);
    setError("");
    setMessage("공개 가이드 데이터를 동기화 중입니다...");

    try {
      const db = getFirebaseDb();
      const tabSnapshot = await getDocs(query(collection(db, "campaignTabs"), where("campaignId", "==", campaign.id)));
      if (tabSnapshot.empty) throw new Error("동기화할 SKU 세부탭이 없습니다.");

      const tabDoc = tabSnapshot.docs[0];
      const tab = tabDoc.data();
      const sectionSnapshot = await getDocs(query(collection(db, "guideSections"), where("tabId", "==", tabDoc.id)));
      const sections: GuideSection[] = [];

      for (const sectionDoc of sectionSnapshot.docs) {
        const section = sectionDoc.data();
        const itemSnapshot = await getDocs(query(collection(db, "guideItems"), where("sectionId", "==", sectionDoc.id)));
        const items: GuideItem[] = itemSnapshot.docs
          .map((itemDoc) => {
            const item = itemDoc.data();
            return {
              id: itemDoc.id,
              titleKo: String(item.titleKo ?? ""),
              bodyKo: String(item.bodyKo ?? ""),
              titleJa: String(item.titleJa ?? ""),
              bodyJa: String(item.bodyJa ?? ""),
              itemType: String(item.itemType ?? "text") as GuideItem["itemType"],
              sortOrder: Number(item.sortOrder ?? 0),
              media: []
            };
          })
          .filter((item) => item.titleJa || item.bodyJa)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        sections.push({
          id: sectionDoc.id,
          sectionType: String(section.sectionType ?? "basic") as GuideSection["sectionType"],
          titleJa: String(section.titleJa ?? ""),
          sortOrder: Number(section.sortOrder ?? 0),
          isCollapsible: Boolean(section.isCollapsible),
          items
        });
      }

      const guide = buildPublicGuide({
        tabId: tabDoc.id,
        campaignId: campaign.id,
        shareToken: String(tab.shareToken ?? campaign.firstShareToken),
        skuName: String(tab.skuName ?? ""),
        productName: String(tab.productName ?? campaign.productName),
        brandName: String(tab.brandName ?? campaign.brandName),
        brandColor: String(tab.brandColor ?? campaign.brandColor),
        heroTitle: String(tab.heroTitle ?? campaign.brandName),
        heroSubtitle: String(tab.heroSubtitle ?? campaign.productName),
        status: String(tab.status ?? campaign.status) as CampaignStatus,
        hashtags: Array.isArray(tab.hashtags) ? tab.hashtags : [],
        sections: sections.sort((a, b) => a.sortOrder - b.sortOrder)
      });

      await setDoc(doc(db, "publicGuides", guide.shareToken), {
        ...stripUndefined(guide),
        updatedAt: serverTimestamp()
      }, { merge: true });

      setMessage("공개 가이드 데이터를 동기화했습니다. 공유 링크를 다시 열어보세요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "공개 가이드 동기화 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function setCampaignStatus(campaign: DashboardCampaign, nextStatus: CampaignStatus) {
    if (!isFirebaseClientConfigured()) return;
    setLoading(true);
    setError("");

    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, "campaigns", campaign.id), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });

      if (campaign.firstTabId) {
        await updateDoc(doc(db, "campaignTabs", campaign.firstTabId), {
          status: nextStatus,
          updatedAt: serverTimestamp()
        });
      }

      if (campaign.firstShareToken) {
        await setDoc(doc(db, "publicGuides", campaign.firstShareToken), {
          status: nextStatus,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      setMessage(`${campaign.campaignName} 상태를 ${statusLabel[nextStatus]}로 변경했습니다.`);
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태 변경 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function duplicateCampaign(campaign: DashboardCampaign) {
    if (!isFirebaseClientConfigured()) return;
    setLoading(true);
    setError("");

    try {
      const db = getFirebaseDb();
      const sourceGuideToken = campaign.firstShareToken;
      if (!sourceGuideToken) throw new Error("복제할 공유 링크가 없습니다.");
      const sourceGuideSnapshot = await getDocs(query(collection(db, "publicGuides"), where("shareToken", "==", sourceGuideToken)));
      const sourceGuide = sourceGuideSnapshot.empty ? null : sourceGuideSnapshot.docs[0].data() as GuideTab;
      const newCampaignId = createId("campaign");
      const newTabId = createId("tab");
      const newShareToken = `guide-copy-${Date.now()}-jp`;
      const now = serverTimestamp();
      const guideBase = sourceGuide ?? mockGuideTab;
      const newGuide: GuideTab = {
        ...guideBase,
        id: newTabId,
        campaignId: newCampaignId,
        shareToken: newShareToken,
        status: "unpublished"
      };

      const batch = writeBatch(db);
      batch.set(doc(db, "campaigns", newCampaignId), {
        campaignName: `${campaign.campaignName} copy`,
        brandName: campaign.brandName,
        status: "unpublished",
        archivedAt: null,
        createdAt: now,
        updatedAt: now
      });
      batch.set(doc(db, "campaignTabs", newTabId), {
        campaignId: newCampaignId,
        shareToken: newShareToken,
        skuName: newGuide.skuName,
        productName: newGuide.productName,
        brandName: newGuide.brandName,
        brandColor: newGuide.brandColor,
        heroTitle: newGuide.heroTitle,
        heroSubtitle: newGuide.heroSubtitle,
        status: "unpublished",
        hashtags: newGuide.hashtags,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      });
      batch.set(doc(db, "publicGuides", newShareToken), {
        ...stripUndefined(newGuide),
        updatedAt: now
      });
      await batch.commit();

      setMessage("캠페인을 미공개 상태로 복제했습니다.");
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "복제 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function archiveCampaign(campaign: DashboardCampaign) {
    if (!isFirebaseClientConfigured()) return;
    const ok = window.confirm(`${campaign.campaignName} 캠페인을 아카이브할까요? 목록에서 숨겨집니다.`);
    if (!ok) return;

    setLoading(true);
    setError("");

    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, "campaigns", campaign.id), {
        campaignName: `__archived__${campaign.campaignName}`,
        status: "unpublished",
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      if (campaign.firstTabId) {
        await updateDoc(doc(db, "campaignTabs", campaign.firstTabId), {
          status: "unpublished",
          updatedAt: serverTimestamp()
        });
      }
      if (campaign.firstShareToken) {
        await setDoc(doc(db, "publicGuides", campaign.firstShareToken), {
          status: "unpublished",
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      setMessage("캠페인을 아카이브했습니다.");
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "아카이브 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  const filtered = useMemo(() => {
    return campaigns.filter((campaign) => {
      const matchedQuery = [campaign.campaignName, campaign.brandName, campaign.productName]
        .join(" ")
        .toLowerCase()
        .includes(queryText.toLowerCase());
      const matchedStatus = status === "all" || campaign.status === status;
      return matchedQuery && matchedStatus;
    });
  }, [campaigns, queryText, status]);

  const counts = {
    total: campaigns.length,
    published: campaigns.filter((item) => item.status === "published").length,
    unpublished: campaigns.filter((item) => item.status === "unpublished").length,
    error: campaigns.filter((item) => item.status === "error").length
  };

  const firstGuideUrl = filtered.find((item) => item.firstShareToken)?.firstShareToken
    ? `/guide/${filtered.find((item) => item.firstShareToken)?.firstShareToken}`
    : `/guide/${mockGuideTab.shareToken}`;

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="wordmark">G-Futures Ops</div>
          <div className="sidebar-sub">Influencer Guide System</div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">Main</div>
          <div className="nav-item active">대시보드</div>
          <div className="nav-item">캠페인 목록</div>
          <div className="nav-item">SKU 세부탭</div>
          <div className="nav-label">Settings</div>
          <div className="nav-item">관리자 설정</div>
          <div className="nav-item">전사 공통 용어집</div>
        </nav>
        <div className="sidebar-footer">
          <div className="user-row">
            <div className="avatar">GF</div>
            <div>Firebase 연결</div>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <div className="topbar">
          <strong>캠페인 관리</strong>
          <div className="topbar-right">
            <button className="btn btn-ghost" type="button" onClick={loadCampaigns} disabled={loading}>새로고침</button>
            <button className="btn btn-ghost" type="button" onClick={createSampleData} disabled={loading}>샘플 데이터</button>
            <button className="btn btn-primary" type="button" onClick={() => setIsCreateOpen(true)} disabled={loading}>새 캠페인</button>
          </div>
        </div>

        <div className="page">
          <div className="page-header">
            <h1>캠페인 목록</h1>
            <p>캠페인과 SKU별 공유 링크를 생성·관리합니다.</p>
          </div>

          <div className={`setup-banner ${error ? "danger" : "success"}`}>
            {error ? `오류: ${error}` : message}
            <a className="mini-link" href={firstGuideUrl} target="_blank" rel="noreferrer">가이드 열기</a>
          </div>

          <section className="stats-grid">
            <StatCard label="총 캠페인" value={counts.total} sub="전체" />
            <StatCard label="공개" value={counts.published} sub="외부 접근 가능" />
            <StatCard label="미공개" value={counts.unpublished} sub="관리자만 확인" />
            <StatCard label="오류" value={counts.error} sub="재생성 필요" />
          </section>

          <section className="search-row">
            <input
              className="search-input"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="브랜드명, 상품명, 캠페인명으로 검색..."
            />
            <select
              className="filter-select"
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | CampaignStatus)}
            >
              <option value="all">전체 상태</option>
              <option value="unpublished">미공개</option>
              <option value="published">공개</option>
              <option value="error">오류</option>
            </select>
          </section>

          <section className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>캠페인</th>
                  <th>상태</th>
                  <th>SKU 탭</th>
                  <th>공유 링크</th>
                  <th>수정일</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((campaign) => {
                  const guideUrl = campaign.firstShareToken ? `/guide/${campaign.firstShareToken}` : "";
                  return (
                    <tr key={campaign.id}>
                      <td>
                        <div className="brand-cell">
                          <span className="brand-dot" style={{ background: campaign.brandColor }} />
                          <div>
                            <div className="brand-name">{campaign.campaignName}</div>
                            <div className="brand-product">{campaign.brandName} · {campaign.productName}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={`badge ${statusClass[campaign.status]}`}>{statusLabel[campaign.status]}</span></td>
                      <td>{campaign.tabCount}개</td>
                      <td>{guideUrl ? <code>{guideUrl}</code> : "-"}</td>
                      <td>{campaign.updatedAt}</td>
                      <td>
                        <div className="action-row">
                          {guideUrl ? <a className="icon-btn" title="공유 링크 열기" href={guideUrl} target="_blank" rel="noreferrer">↗</a> : null}
                          {campaign.firstShareToken ? <a className="icon-btn" title="편집" href={`/admin/tabs/${campaign.firstShareToken}/edit`}>✎</a> : null}
                          <button className="icon-btn" title="공개" type="button" onClick={() => setCampaignStatus(campaign, "published")}>✓</button>
                          <button className="icon-btn" title="미공개" type="button" onClick={() => setCampaignStatus(campaign, "unpublished")}>–</button>
                          <button className="icon-btn" title="공개 데이터 동기화" type="button" onClick={() => syncPublicGuide(campaign)}>⟳</button>
                          <button className="icon-btn" title="복제" type="button" onClick={() => duplicateCampaign(campaign)}>⧉</button>
                          <button className="icon-btn" title="아카이브" type="button" onClick={() => archiveCampaign(campaign)}>⌫</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={6}>표시할 캠페인이 없습니다. 상단의 새 캠페인을 눌러 첫 캠페인을 만들어 주세요.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section className="editor-grid">
            <div className="editor-card">
              <h3>이번 단계에서 가능한 작업</h3>
              <div className="form-grid">
                <textarea className="form-textarea" readOnly value="1. 실제 캠페인 생성\n2. SKU 세부탭 1개 자동 생성\n3. publicGuides 공개 문서 자동 생성\n4. 공개/미공개 변경\n5. 공유 링크 권한 오류 수정\n6. 기존 데이터는 ⟳ 버튼으로 동기화" />
                <button className="btn btn-primary" type="button" onClick={() => setIsCreateOpen(true)} disabled={loading}>새 캠페인 만들기</button>
              </div>
            </div>
            <div className="preview-phone" aria-label="휴대폰 크기 미리보기">
              <div className="preview-screen">
                <GuidePage guide={mockGuideTab} embedded />
              </div>
            </div>
          </section>
        </div>
      </main>

      {isCreateOpen ? (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <strong>새 캠페인 생성</strong>
              <button className="icon-btn" type="button" onClick={() => setIsCreateOpen(false)}>×</button>
            </div>
            <form onSubmit={createCampaign} style={{ display: "grid", gap: 14 }}>
              <div style={twoColumnStyle}>
                <Field label="캠페인명" value={form.campaignName} onChange={(value) => setForm({ ...form, campaignName: value })} placeholder="예: Easydew 2026 Q2" required />
                <Field label="브랜드명" value={form.brandName} onChange={(value) => setForm({ ...form, brandName: value })} placeholder="예: Easydew" required />
              </div>
              <div style={twoColumnStyle}>
                <Field label="SKU명" value={form.skuName} onChange={(value) => setForm({ ...form, skuName: value })} placeholder="예: ointgel" required />
                <Field label="상품명" value={form.productName} onChange={(value) => setForm({ ...form, productName: value })} placeholder="예: EGF X ダウンタイム オイントゲル" required />
              </div>
              <div style={twoColumnStyle}>
                <Field label="히어로 제목" value={form.heroTitle} onChange={(value) => setForm({ ...form, heroTitle: value })} placeholder="비우면 브랜드명 사용" />
                <Field label="히어로 부제목" value={form.heroSubtitle} onChange={(value) => setForm({ ...form, heroSubtitle: value })} placeholder="비우면 상품명 사용" />
              </div>
              <div style={twoColumnStyle}>
                <label style={labelStyle}>
                  브랜드 컬러
                  <input className="form-input" type="color" value={form.brandColor} onChange={(event) => setForm({ ...form, brandColor: event.target.value })} />
                </label>
                <label style={labelStyle}>
                  상태
                  <select className="form-input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CampaignStatus })}>
                    <option value="unpublished">미공개</option>
                    <option value="published">공개</option>
                    <option value="error">오류</option>
                  </select>
                </label>
              </div>
              <label style={labelStyle}>
                필수 해시태그
                <input className="form-input" value={form.hashtags} onChange={(event) => setForm({ ...form, hashtags: event.target.value })} placeholder="#PR #ブランド名" />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-ghost" type="button" onClick={() => setIsCreateOpen(false)}>취소</button>
                <button className="btn btn-primary" type="submit" disabled={loading}>생성</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label style={labelStyle}>
      {label}{required ? " *" : ""}
      <input className="form-input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} />
    </label>
  );
}

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24
} as const;

const modalStyle = {
  width: "min(760px, 100%)",
  background: "#FDFCFA",
  border: "1px solid #E2DDD5",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 20px 80px rgba(0,0,0,0.25)"
} as const;

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18
} as const;

const twoColumnStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12
} as const;

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 500,
  color: "#5C5751"
} as const;
