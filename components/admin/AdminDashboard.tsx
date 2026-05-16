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
import { mockCampaigns, mockGuideTab } from "@/lib/mock-data";
import GuidePage from "@/components/guide/GuidePage";
import { getFirebaseDb, isFirebaseClientConfigured } from "@/lib/firebase/client";
import type { CampaignStatus, CampaignSummary } from "@/types/guide";

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

const SAMPLE_CAMPAIGN_ID = "sample-easydew-q2";
const SAMPLE_TAB_ID = "sample-easydew-ointgel";

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

export default function AdminDashboard() {
  const [queryText, setQueryText] = useState("");
  const [status, setStatus] = useState<"all" | CampaignStatus>("all");
  const [campaigns, setCampaigns] = useState<DashboardCampaign[]>(mockCampaigns);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Firestore 연결 대기 중");
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
        const campaignId = tab.campaignId ?? "";
        if (!campaignId) return;
        tabsByCampaign.set(campaignId, (tabsByCampaign.get(campaignId) ?? 0) + 1);
        if (!productByCampaign.has(campaignId)) productByCampaign.set(campaignId, tab.productName ?? tab.skuName ?? "");
        if (!colorByCampaign.has(campaignId)) colorByCampaign.set(campaignId, tab.brandColor ?? "#2D5A3D");
        if (!shareTokenByCampaign.has(campaignId)) shareTokenByCampaign.set(campaignId, tab.shareToken ?? "");
        if (!tabIdByCampaign.has(campaignId)) tabIdByCampaign.set(campaignId, tabDoc.id);
      });

      const loaded = campaignSnapshot.docs
        .map((campaignDoc) => {
          const campaign = campaignDoc.data();
          return {
            id: campaignDoc.id,
            campaignName: campaign.campaignName ?? "Untitled Campaign",
            brandName: campaign.brandName ?? "",
            productName: productByCampaign.get(campaignDoc.id) ?? "",
            status: (campaign.status ?? "unpublished") as CampaignStatus,
            updatedAt: formatDate(campaign.updatedAt?.toDate?.() ?? campaign.createdAt?.toDate?.()),
            tabCount: tabsByCampaign.get(campaignDoc.id) ?? 0,
            brandColor: colorByCampaign.get(campaignDoc.id) ?? "#2D5A3D",
            firstShareToken: shareTokenByCampaign.get(campaignDoc.id),
            firstTabId: tabIdByCampaign.get(campaignDoc.id)
          } satisfies DashboardCampaign;
        })
        .filter((campaign) => !campaign.campaignName.startsWith("__archived__"));

      setCampaigns(loaded.length ? loaded : []);
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
      const batch = writeBatch(db);
      const now = serverTimestamp();

      batch.set(doc(db, "campaigns", SAMPLE_CAMPAIGN_ID), {
        campaignName: "Easydew 2026 Q2 Campaign",
        brandName: "Easydew",
        status: "published",
        archivedAt: null,
        createdAt: now,
        updatedAt: now
      });

      batch.set(doc(db, "campaignTabs", SAMPLE_TAB_ID), {
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
      });

      mockGuideTab.sections.forEach((section) => {
        const sectionId = `${SAMPLE_TAB_ID}_${section.sectionType}`;
        batch.set(doc(db, "guideSections", sectionId), {
          tabId: SAMPLE_TAB_ID,
          sectionType: section.sectionType,
          titleJa: section.titleJa,
          sortOrder: section.sortOrder,
          isCollapsible: section.isCollapsible,
          createdAt: now,
          updatedAt: now
        });

        section.items.forEach((item) => {
          const itemId = `${sectionId}_${item.id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
          batch.set(doc(db, "guideItems", itemId), {
            sectionId,
            titleKo: item.titleKo ?? "",
            bodyKo: item.bodyKo ?? "",
            titleJa: item.titleJa,
            bodyJa: item.bodyJa,
            itemType: item.itemType,
            sortOrder: item.sortOrder,
            isDeleted: false,
            deletedAt: null,
            createdAt: now,
            updatedAt: now
          });
        });
      });

      await batch.commit();
      setMessage("샘플 데이터 생성 완료. 외부 가이드 링크도 확인할 수 있습니다.");
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
      const batch = writeBatch(db);
      const now = serverTimestamp();
      const campaignId = createId("campaign");
      const tabId = createId("tab");
      const shareToken = `guide-${slugify(brandName)}-${slugify(skuName)}-${Date.now()}-jp`;
      const hashtags = splitHashtags(form.hashtags);

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
        brandColor: form.brandColor || "#2D5A3D",
        heroTitle: form.heroTitle.trim() || brandName,
        heroSubtitle: form.heroSubtitle.trim() || productName,
        status: form.status,
        hashtags,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      });

      createDefaultSections(batch, tabId, {
        brandName,
        productName,
        skuName,
        hashtags
      });

      await batch.commit();
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
      const tabSnapshot = await getDocs(query(collection(db, "campaignTabs"), where("campaignId", "==", campaign.id)));
      if (tabSnapshot.empty) throw new Error("복제할 SKU 세부탭이 없습니다.");

      const sourceTabDoc = tabSnapshot.docs[0];
      const sourceTab = sourceTabDoc.data();
      const newCampaignId = createId("campaign");
      const newTabId = createId("tab");
      const newShareToken = `guide-copy-${Date.now()}-jp`;
      const now = serverTimestamp();
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
        ...sourceTab,
        campaignId: newCampaignId,
        shareToken: newShareToken,
        status: "unpublished",
        createdAt: now,
        updatedAt: now
      });

      const sectionsSnapshot = await getDocs(query(collection(db, "guideSections"), where("tabId", "==", sourceTabDoc.id)));
      for (const sectionDoc of sectionsSnapshot.docs) {
        const section = sectionDoc.data();
        const newSectionId = `${newTabId}_${section.sectionType}`;
        batch.set(doc(db, "guideSections", newSectionId), {
          ...section,
          tabId: newTabId,
          createdAt: now,
          updatedAt: now
        });

        const itemsSnapshot = await getDocs(query(collection(db, "guideItems"), where("sectionId", "==", sectionDoc.id)));
        itemsSnapshot.docs.forEach((itemDoc) => {
          batch.set(doc(db, "guideItems", `${newSectionId}_${itemDoc.id}`.replace(/[^a-zA-Z0-9_-]/g, "_")), {
            ...itemDoc.data(),
            sectionId: newSectionId,
            createdAt: now,
            updatedAt: now
          });
        });
      }

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
            <p>오리엔시트 업로드 전 단계로, 실제 캠페인과 SKU별 공유 링크를 직접 생성합니다.</p>
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
                          <button className="icon-btn" title="공개" type="button" onClick={() => setCampaignStatus(campaign, "published")}>✓</button>
                          <button className="icon-btn" title="미공개" type="button" onClick={() => setCampaignStatus(campaign, "unpublished")}>–</button>
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
                <textarea className="form-textarea" readOnly value="1. 실제 캠페인 생성\n2. SKU 세부탭 1개 자동 생성\n3. 기본 섹션/항목 자동 생성\n4. 공개/미공개 변경\n5. 복제/아카이브\n6. SKU별 공유 링크 확인" />
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

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label style={labelStyle}>
      {label}{required ? <span style={{ color: "#C0392B" }}> *</span> : null}
      <input className="form-input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} />
    </label>
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

function createDefaultSections(
  batch: ReturnType<typeof writeBatch>,
  tabId: string,
  data: { brandName: string; productName: string; skuName: string; hashtags: string[] }
) {
  const now = serverTimestamp();
  const sections = [
    { id: `${tabId}_basic`, sectionType: "basic", titleJa: "基本情報", sortOrder: 0, isCollapsible: false },
    { id: `${tabId}_product`, sectionType: "product", titleJa: "商品紹介および訴求ポイント", sortOrder: 1, isCollapsible: true },
    { id: `${tabId}_content`, sectionType: "content", titleJa: "コンテンツの必須事項", sortOrder: 2, isCollapsible: true },
    { id: `${tabId}_notice`, sectionType: "notice", titleJa: "注意事項", sortOrder: 3, isCollapsible: true }
  ] as const;

  sections.forEach((section) => {
    batch.set(doc(getFirebaseDb(), "guideSections", section.id), {
      tabId,
      sectionType: section.sectionType,
      titleJa: section.titleJa,
      sortOrder: section.sortOrder,
      isCollapsible: section.isCollapsible,
      createdAt: now,
      updatedAt: now
    });
  });

  const items = [
    { sectionId: `${tabId}_basic`, id: "brand", titleJa: "ブランド情報", bodyJa: `ブランド名：${data.brandName}\nブランド紹介：後から管理画面で編集してください。`, itemType: "text", sortOrder: 0 },
    { sectionId: `${tabId}_basic`, id: "product", titleJa: "製品情報", bodyJa: `商品名：${data.productName}\n提供品目・使用方法・製品特徴は後から編集してください。`, itemType: "text", sortOrder: 1 },
    { sectionId: `${tabId}_product`, id: "features", titleJa: "商品の特長", bodyJa: "オリエンシートをもとに、後から商品紹介文を入力してください。", itemType: "text", sortOrder: 0 },
    { sectionId: `${tabId}_product`, id: "appeal-1", titleJa: "訴求ポイント 01", bodyJa: "訴求ポイントのタイトルと説明を入力してください。", itemType: "appeal", sortOrder: 1 },
    { sectionId: `${tabId}_content`, id: "scene-1", titleJa: "Scene 01", bodyJa: "このシーンで必ず撮影してほしい内容を入力してください。", itemType: "scene", sortOrder: 0 },
    { sectionId: `${tabId}_notice`, id: "shooting-notice", titleJa: "必ずお読みください！", bodyJa: "- 過度なカメラアプリ・フィルターの使用はお控えください。\n- 縦向きで撮影してください。\n- 重要なシーンは画面中央に来るように撮影してください。\n- 撮影時は影が入らないようにご注意ください。\n- 動画のサムネイルや最初のクリップは、商品と一緒の日常カットとフックのある文言で構成してください。\n- コンテンツ内の字幕は動画中央付近に配置してください。\n- 他ブランドの商品露出は基本的にNGです。\n- 薬機法に抵触しないよう、注釈内容をご確認ください。", itemType: "notice", sortOrder: 0 },
    { sectionId: `${tabId}_notice`, id: "posting-notice", titleJa: "投稿時の注意事項", bodyJa: "投稿時の注意事項を入力してください。", itemType: "notice", sortOrder: 1 }
  ] as const;

  items.forEach((item) => {
    batch.set(doc(getFirebaseDb(), "guideItems", `${item.sectionId}_${item.id}`), {
      sectionId: item.sectionId,
      titleKo: "",
      bodyKo: "",
      titleJa: item.titleJa,
      bodyJa: item.bodyJa,
      itemType: item.itemType,
      sortOrder: item.sortOrder,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now
    });
  });
}

function splitHashtags(value: string) {
  return value
    .split(/[\s,，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith("#") ? item : `#${item}`));
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣ぁ-んァ-ン一-龥]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "guide";
}

function formatDate(value?: Date) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.45)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24
};

const modalStyle: React.CSSProperties = {
  width: "min(720px, 100%)",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: 24,
  boxShadow: "0 24px 80px rgba(0,0,0,.24)"
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-2)"
};
