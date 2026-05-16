"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import GuidePage from "@/components/guide/GuidePage";
import { getFirebaseDb, getFirebaseStorage, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { FIXED_SHOOTING_NOTICE_JA } from "@/lib/constants";
import { mergeGeneratedGuide, parseOrientSheetFile, type ParsedOrientSheet } from "@/lib/guide-import";
import { mockGuideTab } from "@/lib/mock-data";
import type { CampaignStatus, GuideItem, GuideMedia, GuideSection, GuideTab, MediaType, SectionType } from "@/types/guide";

const sectionLabels: Record<SectionType, string> = {
  basic: "基本情報",
  product: "商品紹介および訴求ポイント",
  content: "コンテンツの必須事項",
  notice: "注意事項"
};

const itemTypeLabels: Record<GuideItem["itemType"], string> = {
  text: "일반 텍스트",
  appeal: "소구 포인트",
  scene: "콘텐츠 필수 장면",
  notice: "주의사항",
  hashtag: "해시태그",
  link: "링크"
};

const mediaTypeLabels: Record<MediaType, string> = {
  image: "이미지",
  video: "영상 파일",
  external_link: "외부 URL",
  youtube: "YouTube",
  google_drive: "Google Drive"
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "_")}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneGuide(guide: GuideTab): GuideTab {
  return JSON.parse(JSON.stringify(guide));
}

function normalizeGuide(raw: Record<string, unknown>, token: string): GuideTab {
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  return {
    id: String(raw.id ?? token),
    campaignId: String(raw.campaignId ?? ""),
    shareToken: String(raw.shareToken ?? token),
    skuName: String(raw.skuName ?? ""),
    productName: String(raw.productName ?? ""),
    brandName: String(raw.brandName ?? ""),
    brandColor: String(raw.brandColor ?? "#2D5A3D"),
    heroTitle: String(raw.heroTitle ?? raw.brandName ?? "Influencer Guide"),
    heroSubtitle: String(raw.heroSubtitle ?? raw.productName ?? ""),
    brandLogoUrl: typeof raw.brandLogoUrl === "string" ? raw.brandLogoUrl : "",
    brandLogoAlt: typeof raw.brandLogoAlt === "string" ? raw.brandLogoAlt : "",
    status: String(raw.status ?? "unpublished") as CampaignStatus,
    hashtags: Array.isArray(raw.hashtags) ? raw.hashtags.filter((item): item is string => typeof item === "string") : [],
    sections: sections.map((section, sectionIndex) => {
      const sectionData = section as Record<string, unknown>;
      const sectionType = String(sectionData.sectionType ?? "basic") as SectionType;
      const items = Array.isArray(sectionData.items) ? sectionData.items : [];
      return {
        id: String(sectionData.id ?? createId("section")),
        sectionType,
        titleJa: String(sectionData.titleJa ?? sectionLabels[sectionType] ?? "セクション"),
        sortOrder: Number(sectionData.sortOrder ?? sectionIndex + 1),
        isCollapsible: Boolean(sectionData.isCollapsible),
        items: items.map((item, itemIndex) => {
          const itemData = item as Record<string, unknown>;
          const media = Array.isArray(itemData.media) ? itemData.media : [];
          return {
            id: String(itemData.id ?? createId("item")),
            titleKo: String(itemData.titleKo ?? ""),
            bodyKo: String(itemData.bodyKo ?? ""),
            titleJa: String(itemData.titleJa ?? "項目"),
            bodyJa: String(itemData.bodyJa ?? ""),
            itemType: String(itemData.itemType ?? "text") as GuideItem["itemType"],
            sortOrder: Number(itemData.sortOrder ?? itemIndex + 1),
            textSize: ["small", "normal", "large"].includes(String(itemData.textSize ?? "")) ? String(itemData.textSize) as GuideItem["textSize"] : "normal",
            emphasize: Boolean(itemData.emphasize),
            media: media.map((mediaItem) => {
              const mediaData = mediaItem as Record<string, unknown>;
              return {
                id: String(mediaData.id ?? createId("media")),
                mediaType: String(mediaData.mediaType ?? "external_link") as MediaType,
                title: String(mediaData.title ?? ""),
                fileUrl: typeof mediaData.fileUrl === "string" ? mediaData.fileUrl : undefined,
                externalUrl: typeof mediaData.externalUrl === "string" ? mediaData.externalUrl : undefined
              };
            })
          } satisfies GuideItem;
        }).sort((a, b) => a.sortOrder - b.sortOrder)
      } satisfies GuideSection;
    }).sort((a, b) => a.sortOrder - b.sortOrder)
  };
}

function splitHashtags(value: string) {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith("#") ? item : `#${item}`));
}


function extractFirstUrl(text: string) {
  const match = text.match(/https?:\/\/[^\s)"']+/i);
  return match?.[0] ?? "";
}

function domainFromUrl(url: string) {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function makeAvatarLogoUrl(name: string, brandColor: string) {
  const cleanColor = (brandColor || "#2D5A3D").replace("#", "");
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Brand")}&background=${cleanColor}&color=fff&size=256&bold=true&format=png`;
}

function findOfficialUrl(guide: GuideTab) {
  const haystack = [guide.brandName, guide.productName, guide.heroSubtitle, ...guide.sections.flatMap((section) => section.items.flatMap((item) => [item.titleKo, item.bodyKo, item.titleJa, item.bodyJa]))]
    .filter(Boolean)
    .join("\n");
  return extractFirstUrl(haystack);
}

function getSection(guide: GuideTab, sectionType: SectionType) {
  return guide.sections.find((section) => section.sectionType === sectionType);
}

function makeEmptyItem(sectionType: SectionType, sortOrder: number): GuideItem {
  const itemType: GuideItem["itemType"] = sectionType === "product" ? "appeal" : sectionType === "content" ? "scene" : sectionType === "notice" ? "notice" : "text";
  return {
    id: createId("item"),
    titleKo: "",
    bodyKo: "",
    titleJa: sectionType === "content" ? `Scene ${String(sortOrder).padStart(2, "0")}. 新規項目` : "新規項目",
    bodyJa: "",
    itemType,
    sortOrder,
    textSize: "normal",
    emphasize: false,
    media: []
  };
}

function restoreFixedNotice(guide: GuideTab): GuideTab {
  const next = cloneGuide(guide);
  const notice = getSection(next, "notice");
  if (!notice) return next;
  const existing = notice.items.find((item) => item.id.includes("notice_shooting") || item.titleJa.includes("撮影"));
  if (existing) {
    existing.titleKo = "촬영 시 주의사항";
    existing.bodyKo = "고정 촬영 주의사항";
    existing.titleJa = "撮影時の注意事項";
    existing.bodyJa = FIXED_SHOOTING_NOTICE_JA;
    existing.itemType = "notice";
  } else {
    notice.items.unshift({
      id: createId("notice_shooting"),
      titleKo: "촬영 시 주의사항",
      bodyKo: "고정 촬영 주의사항",
      titleJa: "撮影時の注意事項",
      bodyJa: FIXED_SHOOTING_NOTICE_JA,
      itemType: "notice",
      sortOrder: 1,
      media: []
    });
    notice.items = notice.items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
  }
  return next;
}

export default function TabEditor({ token }: { token: string }) {
  const [guide, setGuide] = useState<GuideTab | null>(null);
  const [draft, setDraft] = useState<GuideTab | null>(null);
  const [activeSection, setActiveSection] = useState<SectionType>("basic");
  const [deletedItems, setDeletedItems] = useState<{ sectionType: SectionType; item: GuideItem }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("가이드 데이터를 불러오는 중입니다.");
  const [error, setError] = useState("");
  const [translatingKey, setTranslatingKey] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [parsedSheet, setParsedSheet] = useState<ParsedOrientSheet | null>(null);
  const [importWarning, setImportWarning] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (!isFirebaseClientConfigured()) {
          const sample = token === mockGuideTab.shareToken ? mockGuideTab : { ...mockGuideTab, shareToken: token };
          if (!cancelled) {
            setGuide(sample);
            setDraft(cloneGuide(sample));
            setMessage("Firebase 미설정 상태라 샘플 데이터로 편집 화면을 표시합니다.");
          }
          return;
        }
        const db = getFirebaseDb();
        const snap = await getDoc(doc(db, "publicGuides", token));
        if (!snap.exists()) throw new Error("해당 공유 토큰의 가이드를 찾을 수 없습니다.");
        const loaded = normalizeGuide(snap.data() as Record<string, unknown>, token);
        if (!cancelled) {
          setGuide(loaded);
          setDraft(cloneGuide(loaded));
          setMessage("가이드 데이터를 불러왔습니다. 수정 후 저장하면 즉시 공개 페이지에 반영됩니다.");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "가이드 로딩 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  const currentSection = useMemo(() => draft ? getSection(draft, activeSection) : undefined, [draft, activeSection]);
  const productAppealCount = currentSection?.sectionType === "product" ? currentSection.items.filter((item) => item.itemType === "appeal").length : 0;

  function updateDraft(mutator: (guide: GuideTab) => void) {
    setDraft((current) => {
      if (!current) return current;
      const next = cloneGuide(current);
      mutator(next);
      return next;
    });
  }

  function updateGuideField<K extends keyof GuideTab>(key: K, value: GuideTab[K]) {
    updateDraft((next) => {
      next[key] = value;
    });
  }

  function updateItem(sectionType: SectionType, itemId: string, patch: Partial<GuideItem>) {
    updateDraft((next) => {
      const section = getSection(next, sectionType);
      if (!section) return;
      const item = section.items.find((target) => target.id === itemId);
      if (!item) return;
      Object.assign(item, patch);
    });
  }

  function addItem(sectionType: SectionType) {
    updateDraft((next) => {
      const section = getSection(next, sectionType);
      if (!section) return;
      if (sectionType === "product" && section.items.filter((item) => item.itemType === "appeal").length >= 5) {
        setError("소구 포인트는 최대 5개까지 추가할 수 있습니다.");
        return;
      }
      section.items.push(makeEmptyItem(sectionType, section.items.length + 1));
      section.items = section.items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
    });
  }

  function deleteItem(sectionType: SectionType, itemId: string) {
    updateDraft((next) => {
      const section = getSection(next, sectionType);
      if (!section) return;
      const index = section.items.findIndex((item) => item.id === itemId);
      if (index < 0) return;
      const [removed] = section.items.splice(index, 1);
      setDeletedItems((current) => [{ sectionType, item: removed }, ...current].slice(0, 20));
      section.items = section.items.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex + 1 }));
    });
  }

  function restoreItem(index: number) {
    const target = deletedItems[index];
    if (!target) return;
    updateDraft((next) => {
      const section = getSection(next, target.sectionType);
      if (!section) return;
      section.items.push({ ...target.item, id: createId("restored_item"), sortOrder: section.items.length + 1 });
    });
    setDeletedItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveItem(sectionType: SectionType, itemId: string, direction: -1 | 1) {
    updateDraft((next) => {
      const section = getSection(next, sectionType);
      if (!section) return;
      const index = section.items.findIndex((item) => item.id === itemId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= section.items.length) return;
      const [item] = section.items.splice(index, 1);
      section.items.splice(nextIndex, 0, item);
      section.items = section.items.map((target, itemIndex) => ({ ...target, sortOrder: itemIndex + 1 }));
    });
  }

  function addMedia(sectionType: SectionType, itemId: string, mediaType: MediaType) {
    updateDraft((next) => {
      const section = getSection(next, sectionType);
      const item = section?.items.find((target) => target.id === itemId);
      if (!item) return;
      const media = item.media ?? [];
      if (media.length >= 5) {
        setError("첨부는 항목당 최대 5개까지 가능합니다.");
        return;
      }
      media.push({ id: createId("media"), mediaType, title: "", externalUrl: "" });
      item.media = media;
    });
  }

  function updateMedia(sectionType: SectionType, itemId: string, mediaId: string, patch: Partial<GuideMedia>) {
    updateDraft((next) => {
      const section = getSection(next, sectionType);
      const item = section?.items.find((target) => target.id === itemId);
      const media = item?.media?.find((target) => target.id === mediaId);
      if (!media) return;
      Object.assign(media, patch);
    });
  }

  function deleteMedia(sectionType: SectionType, itemId: string, mediaId: string) {
    updateDraft((next) => {
      const section = getSection(next, sectionType);
      const item = section?.items.find((target) => target.id === itemId);
      if (!item?.media) return;
      item.media = item.media.filter((media) => media.id !== mediaId);
    });
  }

  async function uploadMediaFile(sectionType: SectionType, itemId: string, mediaId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !draft) return;
    if (!isFirebaseClientConfigured()) {
      setError("Firebase Storage 설정 후 파일 업로드가 가능합니다.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const storage = getFirebaseStorage();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `guide-assets/${draft.shareToken}/${itemId}/${mediaId}.${ext}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      const mediaType: MediaType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "external_link";
      updateMedia(sectionType, itemId, mediaId, { fileUrl: url, externalUrl: url, mediaType, title: file.name });
      setMessage("파일 업로드 완료. 저장 버튼을 눌러 공개 가이드에 반영해 주세요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }


  async function uploadBrandLogoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !draft) return;
    if (!isFirebaseClientConfigured()) {
      setError("Firebase Storage 설정 후 로고 업로드가 가능합니다.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const storage = getFirebaseStorage();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `guide-assets/${draft.shareToken}/brand-logo/logo.${ext}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      updateDraft((next) => {
        next.brandLogoUrl = url;
        next.brandLogoAlt = `${next.brandName || next.heroTitle || "Brand"} logo`;
      });
      setMessage("회사 로고 업로드 완료. 저장하면 공유 페이지에 반영됩니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로고 업로드 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function autoApplyBrandLogo() {
    if (!draft) return;
    const officialUrl = findOfficialUrl(draft);
    const domain = domainFromUrl(officialUrl);
    const logoUrl = domain ? `https://logo.clearbit.com/${domain}` : makeAvatarLogoUrl(draft.brandName || draft.heroTitle || draft.productName, draft.brandColor);
    updateDraft((next) => {
      next.brandLogoUrl = logoUrl;
      next.brandLogoAlt = `${next.brandName || next.heroTitle || "Brand"} logo`;
    });
    setMessage(domain ? `${domain} 기준으로 회사 로고를 자동 적용했습니다. 로고가 보이지 않으면 직접 업로드하거나 URL을 수정해 주세요.` : "공식 URL을 찾지 못해 브랜드명 기반 임시 로고를 적용했습니다. 실제 회사 로고는 직접 업로드하거나 URL로 교체해 주세요.");
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

  async function translateKoreanItemField(sectionType: SectionType, itemId: string, field: "titleKo" | "bodyKo", value: string) {
    const source = value.trim();
    if (!source) return;

    const key = `${itemId}_${field}`;
    setTranslatingKey(key);
    setError("");
    setMessage("한국어 입력 내용을 일본어로 자동 번역 중입니다...");

    try {
      const response = await fetch("/api/translate/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: source,
          field,
          context: {
            sectionType,
            brandName: draft?.brandName ?? "",
            productName: draft?.productName ?? ""
          }
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "자동 번역에 실패했습니다.");

      const translated = String(result.translated ?? "").trim();
      if (!translated) return;
      updateItem(sectionType, itemId, field === "titleKo" ? { titleJa: translated } : { bodyJa: translated });
      setMessage(result.mode === "openai" ? "한국어 입력 내용을 일본어로 자동 번역했습니다." : "OPENAI_API_KEY가 없어 한국어 원문을 임시로 일본어 표시란에 넣었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "자동 번역 중 오류가 발생했습니다.");
    } finally {
      setTranslatingKey("");
    }
  }

  async function handleOrientSheetUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError("");
    setImportWarning("");
    try {
      const parsed = await parseOrientSheetFile(file);
      setParsedSheet(parsed);
      setMessage(`${parsed.sheetName} 시트를 읽었습니다. GPT 자동 정리를 실행할 수 있습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오리엔시트 파일을 읽는 중 오류가 발생했습니다.");
    } finally {
      setImporting(false);
    }
  }

  async function generateFromParsedSheet() {
    if (!draft || !parsedSheet) {
      setError("먼저 XLSX 오리엔시트 파일을 업로드해 주세요.");
      return;
    }
    setImporting(true);
    setError("");
    setImportWarning("");
    setMessage("GPT로 일본어 가이드 데이터를 정리하는 중입니다...");
    try {
      const glossary = await readGlossary();
      const response = await fetch("/api/generate/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsed: parsedSheet, glossary })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "GPT 가이드 생성에 실패했습니다.");
      const merged = mergeGeneratedGuide(draft, result.guide);
      setDraft(merged);
      if (result.warning) setImportWarning(result.warning);
      setMessage(result.mode === "openai" ? "GPT 정리 결과를 편집 화면에 반영했습니다. 저장하면 공개 페이지에 반영됩니다." : "임시 정리 결과를 반영했습니다. OPENAI_API_KEY 설정 후 다시 생성할 수 있습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "GPT 가이드 생성 중 오류가 발생했습니다.");
    } finally {
      setImporting(false);
    }
  }

  async function saveGuide() {
    if (!draft) return;
    if (!isFirebaseClientConfigured()) {
      setGuide(cloneGuide(draft));
      setMessage("샘플 모드에서 저장했습니다.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("저장 중입니다...");
    try {
      const cleaned = restoreFixedNotice(draft);
      const db = getFirebaseDb();
      await setDoc(doc(db, "publicGuides", cleaned.shareToken), {
        ...JSON.parse(JSON.stringify(cleaned)),
        updatedAt: serverTimestamp()
      }, { merge: true });
      await setDoc(doc(db, "campaignTabs", cleaned.id), {
        campaignId: cleaned.campaignId,
        shareToken: cleaned.shareToken,
        skuName: cleaned.skuName,
        productName: cleaned.productName,
        brandName: cleaned.brandName,
        brandColor: cleaned.brandColor,
        heroTitle: cleaned.heroTitle,
        heroSubtitle: cleaned.heroSubtitle,
        brandLogoUrl: cleaned.brandLogoUrl ?? "",
        brandLogoAlt: cleaned.brandLogoAlt ?? "",
        status: cleaned.status,
        hashtags: cleaned.hashtags,
        updatedAt: serverTimestamp()
      }, { merge: true });
      if (cleaned.campaignId) {
        await setDoc(doc(db, "campaigns", cleaned.campaignId), {
          brandName: cleaned.brandName,
          status: cleaned.status,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      setGuide(cloneGuide(cleaned));
      setDraft(cloneGuide(cleaned));
      setMessage("저장 완료. 공개 링크에 즉시 반영되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="page"><div className="setup-banner success">{message}</div></div>;
  if (error && !draft) return <div className="page"><div className="setup-banner danger">오류: {error}</div></div>;
  if (!draft) return <div className="page"><div className="setup-banner danger">편집할 가이드 데이터가 없습니다.</div></div>;

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="wordmark">G-Futures Ops</div>
          <div className="sidebar-sub">Guide Editor</div>
        </div>
        <nav className="sidebar-nav">
          <a className="nav-item" href="/admin">대시보드</a>
          <div className="nav-label">Edit Sections</div>
          {(Object.keys(sectionLabels) as SectionType[]).map((sectionType) => (
            <button key={sectionType} className={`nav-item ${activeSection === sectionType ? "active" : ""}`} type="button" onClick={() => setActiveSection(sectionType)}>
              {sectionLabels[sectionType]}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-row"><div className="avatar">ED</div><div>즉시 반영</div></div>
        </div>
      </aside>

      <main className="admin-main">
        <div className="topbar">
          <strong>SKU 세부탭 편집</strong>
          <div className="topbar-right">
            <a className="btn btn-ghost" href={`/guide/${draft.shareToken}`} target="_blank" rel="noreferrer">공유 링크 열기</a>
            <button className="btn btn-primary" type="button" onClick={saveGuide} disabled={saving}>{saving ? "저장 중..." : "저장"}</button>
          </div>
        </div>

        <div className="page">
          <div className={`setup-banner ${error ? "danger" : "success"}`}>{error ? `오류: ${error}` : message}</div>
          {importWarning ? <div className="setup-banner warn">{importWarning}</div> : null}

          <div className="editor-card import-card">
            <div className="section-toolbar">
              <div>
                <h3>오리엔시트 XLSX 자동 입력</h3>
                <p>KOR_ 시트를 읽어 GPT로 일본어 가이드 문구를 정리합니다. コンテンツの必須事項은 기존 요구대로 직접 작성합니다.</p>
              </div>
              <div className="action-row">
                <input className="form-input" type="file" accept=".xlsx,.xls" onChange={handleOrientSheetUpload} disabled={importing} />
                <button className="btn btn-primary" type="button" onClick={generateFromParsedSheet} disabled={importing || !parsedSheet}>
                  {importing ? "처리 중..." : "GPT 정리 반영"}
                </button>
              </div>
            </div>
            {parsedSheet ? (
              <div className="parsed-summary">
                <strong>읽은 시트:</strong> {parsedSheet.sheetName}
                <span>브랜드: {parsedSheet.fields.brandName || "미감지"}</span>
                <span>상품명: {parsedSheet.fields.productName || "미감지"}</span>
                <span>소구 포인트: {parsedSheet.appealPoints.length}개</span>
                <span>해시태그: {parsedSheet.hashtags.join(" ") || "미감지"}</span>
              </div>
            ) : null}
          </div>

          <div className="guide-edit-layout">
            <section className="guide-edit-panel">
              <div className="editor-card">
                <h3>SKU 기본 설정</h3>
                <div className="form-grid two">
                  <Field label="브랜드명" value={draft.brandName} onChange={(value) => updateGuideField("brandName", value)} />
                  <Field label="상품명" value={draft.productName} onChange={(value) => updateGuideField("productName", value)} />
                  <Field label="SKU명" value={draft.skuName} onChange={(value) => updateGuideField("skuName", value)} />
                  <Field label="브랜드 컬러" value={draft.brandColor} type="color" onChange={(value) => updateGuideField("brandColor", value)} />
                  <Field label="히어로 제목" value={draft.heroTitle} onChange={(value) => updateGuideField("heroTitle", value)} />
                  <Field label="히어로 부제목" value={draft.heroSubtitle} onChange={(value) => updateGuideField("heroSubtitle", value)} />
                  <Field label="회사 로고 URL" value={draft.brandLogoUrl ?? ""} onChange={(value) => updateGuideField("brandLogoUrl", value)} helper="공식 URL이 기본 정보 안에 있으면 자동 적용 버튼으로 로고 후보를 넣을 수 있습니다." />
                  <Field label="로고 대체 텍스트" value={draft.brandLogoAlt ?? ""} onChange={(value) => updateGuideField("brandLogoAlt", value)} />
                  <div className="field-label logo-upload-field">
                    회사 로고 자동/수동 설정
                    <div className="logo-control-row">
                      <button className="btn btn-ghost" type="button" onClick={autoApplyBrandLogo}>로고 자동 적용</button>
                      <input className="file-input" type="file" accept="image/*" onChange={uploadBrandLogoFile} />
                    </div>
                    {draft.brandLogoUrl ? <img className="admin-logo-preview" src={draft.brandLogoUrl} alt="logo preview" /> : <span className="field-helper">공유 모바일 화면 우상단에 표시됩니다.</span>}
                  </div>
                  <label className="field-label">
                    상태
                    <select className="form-input" value={draft.status} onChange={(event) => updateGuideField("status", event.target.value as CampaignStatus)}>
                      <option value="unpublished">미공개</option>
                      <option value="published">공개</option>
                      <option value="error">오류</option>
                    </select>
                  </label>
                  <Field label="필수 해시태그" value={draft.hashtags.join(" ")} onChange={(value) => updateGuideField("hashtags", splitHashtags(value))} />
                </div>
              </div>

              <div className="editor-card">
                <div className="section-toolbar">
                  <div>
                    <h3>{sectionLabels[activeSection]}</h3>
                    <p>{activeSection === "product" ? `소구 포인트는 최대 5개까지입니다. 현재 ${productAppealCount}개` : "항목을 추가·수정·삭제·이동할 수 있습니다."}</p>
                  </div>
                  <button className="btn btn-primary" type="button" onClick={() => addItem(activeSection)}>항목 추가</button>
                </div>

                {currentSection?.items.map((item, index) => (
                  <div className="editable-item" key={item.id}>
                    <div className="editable-item-head">
                      <strong>{index + 1}. {item.titleJa || "제목 없음"}</strong>
                      <div className="action-row">
                        <button className="icon-btn" type="button" onClick={() => moveItem(activeSection, item.id, -1)}>↑</button>
                        <button className="icon-btn" type="button" onClick={() => moveItem(activeSection, item.id, 1)}>↓</button>
                        <button className="icon-btn" type="button" onClick={() => deleteItem(activeSection, item.id)}>⌫</button>
                      </div>
                    </div>
                    <div className="form-grid two">
                      <Field
                        label="한국어 제목"
                        value={item.titleKo ?? ""}
                        onChange={(value) => updateItem(activeSection, item.id, { titleKo: value })}
                        onBlur={(value) => translateKoreanItemField(activeSection, item.id, "titleKo", value)}
                        helper={translatingKey === `${item.id}_titleKo` ? "자동 번역 중..." : "입력 후 포커스를 벗어나면 일본어 제목이 자동 입력됩니다."}
                      />
                      <Field label="일본어 제목" value={item.titleJa} onChange={(value) => updateItem(activeSection, item.id, { titleJa: value })} />
                      <label className="field-label">
                        항목 타입
                        <select className="form-input" value={item.itemType} onChange={(event) => updateItem(activeSection, item.id, { itemType: event.target.value as GuideItem["itemType"] })}>
                          {(Object.keys(itemTypeLabels) as GuideItem["itemType"][]).map((type) => <option key={type} value={type}>{itemTypeLabels[type]}</option>)}
                        </select>
                      </label>
                      <label className="field-label">
                        공유 화면 글자 크기
                        <select className="form-input" value={item.textSize ?? "normal"} onChange={(event) => updateItem(activeSection, item.id, { textSize: event.target.value as GuideItem["textSize"] })}>
                          <option value="small">작게</option>
                          <option value="normal">기본</option>
                          <option value="large">크게</option>
                        </select>
                      </label>
                      <label className="field-label checkbox-field">
                        <input type="checkbox" checked={Boolean(item.emphasize)} onChange={(event) => updateItem(activeSection, item.id, { emphasize: event.target.checked })} />
                        이 항목 강조 표시
                      </label>
                    </div>
                    <div className="form-grid two">
                      <TextArea
                        label="한국어 원문"
                        value={item.bodyKo ?? ""}
                        onChange={(value) => updateItem(activeSection, item.id, { bodyKo: value })}
                        onBlur={(value) => translateKoreanItemField(activeSection, item.id, "bodyKo", value)}
                        helper={translatingKey === `${item.id}_bodyKo` ? "자동 번역 중..." : "입력 후 포커스를 벗어나면 일본어 표시문이 자동 입력됩니다."}
                      />
                      <TextArea label="일본어 표시문" value={item.bodyJa} onChange={(value) => updateItem(activeSection, item.id, { bodyJa: value })} />
                    </div>
                    <div className="media-editor">
                      <div className="section-toolbar compact">
                        <strong>이미지/영상/URL 첨부</strong>
                        <div className="action-row">
                          <button className="btn btn-ghost" type="button" onClick={() => addMedia(activeSection, item.id, "image")}>이미지</button>
                          <button className="btn btn-ghost" type="button" onClick={() => addMedia(activeSection, item.id, "youtube")}>YouTube</button>
                          <button className="btn btn-ghost" type="button" onClick={() => addMedia(activeSection, item.id, "google_drive")}>Drive</button>
                          <button className="btn btn-ghost" type="button" onClick={() => addMedia(activeSection, item.id, "external_link")}>URL</button>
                        </div>
                      </div>
                      {(item.media ?? []).map((media) => (
                        <div className="media-row" key={media.id}>
                          <select className="form-input" value={media.mediaType} onChange={(event) => updateMedia(activeSection, item.id, media.id, { mediaType: event.target.value as MediaType })}>
                            {(Object.keys(mediaTypeLabels) as MediaType[]).map((type) => <option key={type} value={type}>{mediaTypeLabels[type]}</option>)}
                          </select>
                          <input className="form-input" value={media.title ?? ""} onChange={(event) => updateMedia(activeSection, item.id, media.id, { title: event.target.value })} placeholder="표시명" />
                          <input className="form-input" value={media.externalUrl ?? media.fileUrl ?? ""} onChange={(event) => updateMedia(activeSection, item.id, media.id, { externalUrl: event.target.value, fileUrl: event.target.value })} placeholder="URL" />
                          <input className="file-input" type="file" accept="image/*,video/*" onChange={(event) => uploadMediaFile(activeSection, item.id, media.id, event)} />
                          <button className="icon-btn" type="button" onClick={() => deleteMedia(activeSection, item.id, media.id)}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {deletedItems.length ? (
                <div className="editor-card">
                  <h3>삭제 항목 복구</h3>
                  <div className="deleted-list">
                    {deletedItems.map((entry, index) => (
                      <button className="btn btn-ghost" key={`${entry.item.id}_${index}`} type="button" onClick={() => restoreItem(index)}>
                        복구: [{sectionLabels[entry.sectionType]}] {entry.item.titleJa}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <aside className="preview-phone editor-preview" aria-label="휴대폰 크기 미리보기">
              <div className="preview-scroll-hint">미리보기 위에 마우스를 올리고 휠로 스크롤할 수 있습니다.</div>
              <div className="preview-screen" onWheel={(event) => event.stopPropagation()}>
                <GuidePage guide={draft} embedded />
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  helper
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  type?: string;
  helper?: string;
}) {
  return (
    <label className="field-label">
      {label}
      <input
        className="form-input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlur?.(event.target.value)}
      />
      {helper ? <span className="field-helper">{helper}</span> : null}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  onBlur,
  helper
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  helper?: string;
}) {
  return (
    <label className="field-label">
      {label}
      <textarea
        className="form-textarea tall"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlur?.(event.target.value)}
      />
      {helper ? <span className="field-helper">{helper}</span> : null}
    </label>
  );
}
