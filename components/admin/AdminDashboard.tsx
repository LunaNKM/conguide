"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
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
import { mergeGeneratedGuide, parseOrientSheetFile, type ParsedOrientSheet } from "@/lib/guide-import";
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

interface ExcelCreateState {
  fileName: string;
  parsed: ParsedOrientSheet | null;
  campaignName: string;
  brandColor: string;
  status: CampaignStatus;
}

const emptyExcelCreate: ExcelCreateState = {
  fileName: "",
  parsed: null,
  campaignName: "",
  brandColor: "#2D5A3D",
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
    .split(/[\s,，、]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith("#") ? item : `#${item}`));
}

function formatDate(date?: Date) {
  if (!date) return "-";
  return date.toISOString().slice(0, 10);
}

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function makeBlankGuide(params: {
  tabId: string;
  campaignId: string;
  shareToken: string;
  brandName: string;
  productName: string;
  skuName: string;
  brandColor: string;
  status: CampaignStatus;
}): GuideTab {
  const { tabId, campaignId, shareToken, brandName, productName, skuName, brandColor, status } = params;
  return {
    id: tabId,
    campaignId,
    shareToken,
    skuName,
    productName,
    brandName,
    brandColor,
    heroTitle: brandName,
    heroSubtitle: productName,
    status,
    hashtags: [],
    sections: [
      {
        id: `${tabId}_basic`,
        sectionType: "basic",
        titleJa: "基本情報",
        sortOrder: 1,
        isCollapsible: false,
        items: []
      },
      {
        id: `${tabId}_product`,
        sectionType: "product",
        titleJa: "商品紹介および訴求ポイント",
        sortOrder: 2,
        isCollapsible: true,
        items: []
      },
      {
        id: `${tabId}_content`,
        sectionType: "content",
        titleJa: "コンテンツの必須事項",
        sortOrder: 3,
        isCollapsible: true,
        items: []
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
            bodyJa: "投稿時の注意事項を管理画面で入力してください。",
            itemType: "notice",
            sortOrder: 2,
            media: []
          }
        ]
      }
    ]
  };
}

function rewriteGuideIds(guide: GuideTab, tabId: string, campaignId: string, shareToken: string): GuideTab {
  return {
    ...guide,
    id: tabId,
    campaignId,
    shareToken,
    sections: guide.sections.map((section, sectionIndex) => {
      const sectionId = `${tabId}_${section.sectionType}`;
      return {
        ...section,
        id: sectionId,
        sortOrder: sectionIndex + 1,
        items: section.items.map((item, itemIndex) => ({
          ...item,
          id: `${sectionId}_item_${itemIndex + 1}`,
          sortOrder: itemIndex + 1,
          media: (item.media ?? []).map((media, mediaIndex) => ({
            ...media,
            id: `${sectionId}_item_${itemIndex + 1}_media_${mediaIndex + 1}`
          }))
        }))
      } satisfies GuideSection;
    })
  };
}

function ensureFixedNotice(guide: GuideTab): GuideTab {
  const clone: GuideTab = JSON.parse(JSON.stringify(guide));
  let notice = clone.sections.find((section) => section.sectionType === "notice");
  if (!notice) {
    notice = {
      id: `${clone.id}_notice`,
      sectionType: "notice",
      titleJa: "注意事項",
      sortOrder: 4,
      isCollapsible: true,
      items: []
    };
    clone.sections.push(notice);
  }

  const shooting = notice.items.find((item) => item.titleJa.includes("撮影") || item.id.includes("notice_shooting"));
  if (shooting) {
    shooting.titleKo = "촬영 시 주의사항";
    shooting.bodyKo = "고정 촬영 주의사항";
    shooting.titleJa = "撮影時の注意事項";
    shooting.bodyJa = FIXED_SHOOTING_NOTICE_JA;
    shooting.itemType = "notice";
  } else {
    notice.items.unshift({
      id: `${clone.id}_notice_shooting`,
      titleKo: "촬영 시 주의사항",
      bodyKo: "고정 촬영 주의사항",
      titleJa: "撮影時の注意事項",
      bodyJa: FIXED_SHOOTING_NOTICE_JA,
      itemType: "notice",
      sortOrder: 1,
      media: []
    });
  }

  clone.sections = clone.sections.map((section, sectionIndex) => ({
    ...section,
    sortOrder: sectionIndex + 1,
    items: section.items.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex + 1 }))
  }));

  return clone;
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
        media: item.media ?? [],
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
  const [createState, setCreateState] = useState<ExcelCreateState>(emptyExcelCreate);
  const [createBusy, setCreateBusy] = useState(false);
  const [createPreview, setCreatePreview] = useState<GuideTab | null>(null);

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

  async function readGlossary() {
    if (!isFirebaseClientConfigured()) return [];
    try {
      const db = getFirebaseDb();
      const snapshot = await getDocs(collection(db, "glossaryGlobal"));
      return snapshot.docs.map((item) => {
        const data = item.data() as Record<string, unknown>;
        return {
          korean: String(data.korean ?? ""),
          japanese: String(data.japanese ?? ""),
          category: String(data.category ?? "")
        };
      }).filter((item) => item.korean && item.japanese);
    } catch {
      return [];
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

  function openCreateModal() {
    setCreateState(emptyExcelCreate);
    setCreatePreview(null);
    setError("");
    setMessage("오리엔시트 XLSX를 업로드하면 캠페인 초안을 자동 생성합니다.");
    setIsCreateOpen(true);
  }

  async function generatePreviewFromParsed(parsed: ParsedOrientSheet, options?: { fileName?: string }) {
    setCreateBusy(true);
    setError("");
    setMessage("오리엔시트 내용을 바탕으로 일본어 가이드 초안을 자동 생성 중입니다...");

    try {
      const campaignId = createId("campaign");
      const tabId = createId("tab");
      const baseBrand = parsed.fields.brandName || "Brand";
      const baseProduct = parsed.fields.productName || parsed.sheetName.replace(/^KOR_/, "") || "Product";
      const shareToken = `guide-${slugify(baseBrand)}-${slugify(baseProduct)}-${Date.now()}-jp`;
      const blank = makeBlankGuide({
        tabId,
        campaignId,
        shareToken,
        brandName: baseBrand,
        productName: baseProduct,
        skuName: baseProduct,
        brandColor: createState.brandColor,
        status: createState.status
      });
      const glossary = await readGlossary();
      const response = await fetch("/api/generate/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsed, glossary })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "GPT 가이드 생성에 실패했습니다.");

      const merged = ensureFixedNotice(rewriteGuideIds(mergeGeneratedGuide(blank, result.guide), tabId, campaignId, shareToken));
      const guide: GuideTab = {
        ...merged,
        brandColor: createState.brandColor,
        status: createState.status,
        campaignId,
        id: tabId,
        shareToken
      };
      setCreatePreview(guide);
      setCreateState((current) => ({
        ...current,
        parsed,
        fileName: options?.fileName ?? current.fileName,
        campaignName: current.campaignName || `${guide.brandName} ${guide.productName}`.trim()
      }));
      setMessage(result.mode === "openai" ? "GPT 초안을 자동 생성했습니다. 캠페인 저장을 누르면 등록됩니다." : "임시 초안을 자동 생성했습니다. OPENAI_API_KEY 설정 후 더 자연스럽게 생성할 수 있습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "초안 생성 중 오류가 발생했습니다.");
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleCreateExcelUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCreateBusy(true);
    setCreatePreview(null);
    setError("");

    try {
      const parsed = await parseOrientSheetFile(file);
      const detectedBrand = parsed.fields.brandName || "";
      const detectedProduct = parsed.fields.productName || parsed.sheetName.replace(/^KOR_/, "");
      setCreateState((current) => ({
        ...current,
        fileName: file.name,
        parsed,
        campaignName: current.campaignName || [detectedBrand, detectedProduct].filter(Boolean).join(" ") || file.name.replace(/\.xlsx?$/i, "")
      }));
      setMessage(`${parsed.sheetName} 시트를 읽었습니다. GPT 초안을 자동 생성합니다.`);
      await generatePreviewFromParsed(parsed, { fileName: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "엑셀 파일을 읽는 중 오류가 발생했습니다.");
      setCreateBusy(false);
    }
  }

  async function generateCreatePreview() {
    if (!createState.parsed) {
      setError("먼저 오리엔시트 XLSX 파일을 선택해 주세요.");
      return;
    }
    await generatePreviewFromParsed(createState.parsed, { fileName: createState.fileName });
  }

  async function createCampaignFromPreview() {
    if (!createPreview) {
      setError("먼저 XLSX 파일로 초안을 생성해 주세요.");
      return;
    }
    if (!isFirebaseClientConfigured()) {
      setError("Firebase 환경변수가 설정되어 있지 않습니다.");
      return;
    }

    setCreateBusy(true);
    setError("");
    setMessage("생성된 초안을 캠페인으로 저장 중입니다...");

    try {
      const db = getFirebaseDb();
      const now = serverTimestamp();
      const campaignName = createState.campaignName.trim() || `${createPreview.brandName} ${createPreview.productName}`.trim() || "Untitled Campaign";
      const guide = { ...createPreview, status: createState.status, brandColor: createState.brandColor };

      const batch = writeBatch(db);
      batch.set(doc(db, "campaigns", guide.campaignId), {
        campaignName,
        brandName: guide.brandName,
        status: guide.status,
        archivedAt: null,
        createdAt: now,
        updatedAt: now
      });
      batch.set(doc(db, "campaignTabs", guide.id), {
        campaignId: guide.campaignId,
        shareToken: guide.shareToken,
        skuName: guide.skuName,
        productName: guide.productName,
        brandName: guide.brandName,
        brandColor: guide.brandColor,
        heroTitle: guide.heroTitle,
        heroSubtitle: guide.heroSubtitle,
        status: guide.status,
        hashtags: guide.hashtags,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      });
      await batch.commit();
      await writeTopLevelGuideData({ campaignId: guide.campaignId, tabId: guide.id, guide });

      setMessage(`캠페인 생성 완료. 편집 화면에서 최종 확인해 주세요: /admin/tabs/${guide.shareToken}/edit`);
      setIsCreateOpen(false);
      setCreatePreview(null);
      setCreateState(emptyExcelCreate);
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "캠페인 저장 중 오류가 발생했습니다.");
    } finally {
      setCreateBusy(false);
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
              media: Array.isArray(item.media) ? item.media : []
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

      const guide = ensureFixedNotice({
        id: tabDoc.id,
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
      const sourceGuideSnapshot = await getDoc(doc(db, "publicGuides", sourceGuideToken));
      const guideBase = sourceGuideSnapshot.exists() ? sourceGuideSnapshot.data() as GuideTab : mockGuideTab;
      const newCampaignId = createId("campaign");
      const newTabId = createId("tab");
      const newShareToken = `guide-copy-${Date.now()}-jp`;
      const now = serverTimestamp();
      const newGuide = rewriteGuideIds({
        ...guideBase,
        id: newTabId,
        campaignId: newCampaignId,
        shareToken: newShareToken,
        status: "unpublished"
      }, newTabId, newCampaignId, newShareToken);

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
      await batch.commit();
      await writeTopLevelGuideData({ campaignId: newCampaignId, tabId: newTabId, guide: newGuide });

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
          <a className="nav-item active" href="/admin">대시보드</a>
          <a className="nav-item" href="#campaign-table">캠페인 목록</a>
          <div className="nav-label">Settings</div>
          <a className="nav-item" href="/admin/glossary">전사 공통 용어집</a>
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
            <button className="btn btn-primary" type="button" onClick={openCreateModal} disabled={loading}>새 캠페인</button>
          </div>
        </div>

        <div className="page">
          <div className="page-header">
            <h1>캠페인 목록</h1>
            <p>새 캠페인은 오리엔시트 XLSX 업로드를 기준으로 자동 초안을 생성합니다.</p>
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

          <section className="table-wrap" id="campaign-table">
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
                    <td colSpan={6}>표시할 캠페인이 없습니다. 상단의 새 캠페인을 눌러 오리엔시트 XLSX로 첫 캠페인을 만들어 주세요.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section className="editor-grid">
            <div className="editor-card">
              <h3>운영 흐름</h3>
              <div className="form-grid">
                <textarea className="form-textarea" readOnly value="1. 새 캠페인 클릭\n2. 오리엔시트 XLSX 업로드\n3. GPT 초안 자동 생성\n4. 캠페인 저장\n5. ✎ 버튼으로 세부 편집\n6. /guide/{token} 공유" />
                <button className="btn btn-primary" type="button" onClick={openCreateModal} disabled={loading}>오리엔시트로 새 캠페인 만들기</button>
              </div>
            </div>
            <div className="preview-phone" aria-label="휴대폰 크기 미리보기">
              <div className="preview-screen">
                <GuidePage guide={createPreview ?? mockGuideTab} embedded />
              </div>
            </div>
          </section>
        </div>
      </main>

      {isCreateOpen ? (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <strong>새 캠페인 생성</strong>
                <p style={{ margin: "4px 0 0", color: "#9E9890", fontSize: 12 }}>오리엔시트 XLSX를 업로드하면 기본 정보와 상품 소개 초안을 자동 작성합니다.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setIsCreateOpen(false)}>×</button>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div className="upload-zone" style={{ display: "grid", gap: 10, textAlign: "left" }}>
                <div className="upload-text">오리엔시트 XLSX 업로드</div>
                <div className="upload-sub">파일을 선택하면 KOR_ 시트를 읽고 GPT 초안을 자동 생성합니다.</div>
                <input
                  className="form-input"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleCreateExcelUpload}
                  disabled={createBusy}
                />
                {createState.fileName ? <div style={{ marginTop: 4, fontSize: 12 }}>선택됨: {createState.fileName}</div> : null}
              </div>

              {createState.parsed ? (
                <div className="parsed-summary">
                  <strong>읽은 시트:</strong> {createState.parsed.sheetName}
                  <span>브랜드: {createState.parsed.fields.brandName || "미감지"}</span>
                  <span>상품명: {createState.parsed.fields.productName || "미감지"}</span>
                  <span>소구 포인트: {createState.parsed.appealPoints.length}개</span>
                  <span>해시태그: {createState.parsed.hashtags.join(" ") || "미감지"}</span>
                </div>
              ) : null}

              <div style={twoColumnStyle}>
                <Field label="캠페인명" value={createState.campaignName} onChange={(value) => setCreateState({ ...createState, campaignName: value })} placeholder="업로드 후 자동 입력" />
                <label style={labelStyle}>
                  브랜드 컬러
                  <input className="form-input" type="color" value={createState.brandColor} onChange={(event) => setCreateState({ ...createState, brandColor: event.target.value })} />
                </label>
              </div>
              <label style={labelStyle}>
                상태
                <select className="form-input" value={createState.status} onChange={(event) => setCreateState({ ...createState, status: event.target.value as CampaignStatus })}>
                  <option value="unpublished">미공개</option>
                  <option value="published">공개</option>
                  <option value="error">오류</option>
                </select>
              </label>

              {createPreview ? (
                <div className="setup-banner success">
                  초안 생성 완료: {createPreview.brandName} · {createPreview.productName}
                </div>
              ) : null}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-ghost" type="button" onClick={() => setIsCreateOpen(false)}>취소</button>
                <button className="btn btn-ghost" type="button" onClick={generateCreatePreview} disabled={createBusy || !createState.parsed}>{createBusy ? "처리 중..." : "GPT 초안 다시 생성"}</button>
                <button className="btn btn-primary" type="button" onClick={createCampaignFromPreview} disabled={createBusy || !createPreview}>캠페인 저장</button>
              </div>
            </div>
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
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={labelStyle}>
      {label}
      <input className="form-input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
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
  width: "min(940px, 100%)",
  maxHeight: "92vh",
  overflow: "auto",
  background: "#FDFCFA",
  border: "1px solid #E2DDD5",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 20px 80px rgba(0,0,0,0.25)"
} as const;

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
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
