"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { mockCampaigns, mockGuideTab } from "@/lib/mock-data";
import GuidePage from "@/components/guide/GuidePage";
import { getFirebaseDb, isFirebaseClientConfigured } from "@/lib/firebase/client";
import type { CampaignStatus, CampaignSummary, GuideItem, GuideSection } from "@/types/guide";

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

export default function AdminDashboard() {
  const [queryText, setQueryText] = useState("");
  const [status, setStatus] = useState<"all" | CampaignStatus>("all");
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>(mockCampaigns);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Firestore 연결 대기 중");
  const [error, setError] = useState("");

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

      tabSnapshot.docs.forEach((tabDoc) => {
        const tab = tabDoc.data();
        const campaignId = tab.campaignId ?? "";
        if (!campaignId) return;
        tabsByCampaign.set(campaignId, (tabsByCampaign.get(campaignId) ?? 0) + 1);
        if (!productByCampaign.has(campaignId)) productByCampaign.set(campaignId, tab.productName ?? tab.skuName ?? "");
        if (!colorByCampaign.has(campaignId)) colorByCampaign.set(campaignId, tab.brandColor ?? "#2D5A3D");
      });

      const loaded = campaignSnapshot.docs.map((campaignDoc) => {
        const campaign = campaignDoc.data();
        return {
          id: campaignDoc.id,
          campaignName: campaign.campaignName ?? "Untitled Campaign",
          brandName: campaign.brandName ?? "",
          productName: productByCampaign.get(campaignDoc.id) ?? "",
          status: (campaign.status ?? "unpublished") as CampaignStatus,
          updatedAt: formatDate(campaign.updatedAt?.toDate?.() ?? campaign.createdAt?.toDate?.()),
          tabCount: tabsByCampaign.get(campaignDoc.id) ?? 0,
          brandColor: colorByCampaign.get(campaignDoc.id) ?? "#2D5A3D"
        } satisfies CampaignSummary;
      });

      setCampaigns(loaded.length ? loaded : []);
      setMessage(loaded.length ? "Firestore에서 캠페인을 불러왔습니다." : "아직 캠페인이 없습니다. 샘플 데이터를 생성해 주세요.");
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

      batch.set(doc(db, "systemTemplates", "fixed_shooting_notice"), {
        titleKo: "반드시 읽어 주세요!",
        bodyKo: "- 과도한 카메라 앱/필터 사용하지 않도록 부탁드립니다!\n- 세로 방향으로 촬영해주세요!\n- 중요한 장면은 가운데에 나오도록 촬영해 주세요.\n- 촬영 시 그림자가 생기지 않도록 주의해 주세요.\n- 영상 썸네일, 첫 클립은 제품과 함께한 일상 컷과 후킹한 문구로 배치해 주세요.\n- 콘텐츠 자막은 영상 중앙 부근으로 배치해 주세요.\n- 다른 브랜드 제품 노출은 기본적으로 NG입니다.\n- 약기법에 저촉되지 않도록, 주석 내용 확인 부탁드립니다.",
        titleJa: "必ずお読みください！",
        bodyJa: "- 過度なカメラアプリ・フィルターの使用はお控えください。\n- 縦向きで撮影してください。\n- 重要なシーンは画面中央に来るように撮影してください。\n- 撮影時は影が入らないようにご注意ください。\n- 動画のサムネイルや最初のクリップは、商品と一緒の日常カットとフックのある文言で構成してください。\n- コンテンツ内の字幕は動画中央付近に配置してください。\n- 他ブランドの商品露出は基本的にNGです。\n- 薬機法に抵触しないよう、注釈内容をご確認ください。",
        updatedAt: now
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

  async function publishAllSampleTabs() {
    if (!isFirebaseClientConfigured()) return;
    setLoading(true);
    setError("");

    try {
      const db = getFirebaseDb();
      const tabsSnapshot = await getDocs(query(collection(db, "campaignTabs"), where("campaignId", "==", SAMPLE_CAMPAIGN_ID)));
      await Promise.all(tabsSnapshot.docs.map((tabDoc) => setDoc(tabDoc.ref, { status: "published", updatedAt: serverTimestamp() }, { merge: true })));
      setMessage("샘플 SKU 세부탭을 공개 상태로 변경했습니다.");
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "공개 처리 중 오류가 발생했습니다.");
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

  const sampleGuideUrl = `/guide/${mockGuideTab.shareToken}`;

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
            <button className="btn btn-primary" type="button" onClick={createSampleData} disabled={loading}>샘플 데이터 생성</button>
          </div>
        </div>

        <div className="page">
          <div className="page-header">
            <h1>캠페인 목록</h1>
            <p>오리엔시트 업로드, SKU별 가이드 생성, 공유 링크를 관리합니다.</p>
          </div>

          <div className={`setup-banner ${error ? "danger" : "success"}`}>
            {error ? `오류: ${error}` : message}
            <a className="mini-link" href={sampleGuideUrl} target="_blank" rel="noreferrer">샘플 가이드 열기</a>
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
                  <th>수정일</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((campaign) => (
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
                    <td>{campaign.updatedAt}</td>
                    <td>
                      <div className="action-row">
                        <button className="icon-btn" title="복제" type="button">⧉</button>
                        <a className="icon-btn" title="공유" href={sampleGuideUrl} target="_blank" rel="noreferrer">↗</a>
                        <button className="icon-btn" title="공개" type="button" onClick={publishAllSampleTabs}>✓</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={5}>표시할 캠페인이 없습니다. 상단의 샘플 데이터 생성을 눌러 Firestore 저장을 테스트해 주세요.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section className="editor-grid">
            <div className="editor-card">
              <h3>다음 구현 예정</h3>
              <div className="form-grid">
                <textarea className="form-textarea" readOnly value="1. 실제 캠페인 생성 모달\n2. SKU 세부탭 생성/복제\n3. 항목 추가/수정/삭제/이동\n4. 모바일 미리보기 실시간 반영\n5. 엑셀 업로드와 GPT 일본어 정리" />
                <button className="btn btn-primary" type="button" onClick={createSampleData} disabled={loading}>Firestore 샘플 다시 생성</button>
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

function formatDate(value?: Date) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
