"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { getFirebaseDb, isFirebaseClientConfigured } from "@/lib/firebase/client";
import type { CampaignStatus } from "@/types/guide";

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

interface CampaignListRecord {
  id: string;
  campaignName: string;
  cleanCampaignName: string;
  brandName: string;
  productName: string;
  status: CampaignStatus;
  updatedAt: string;
  createdAt: string;
  tabCount: number;
  brandColor: string;
  firstShareToken?: string;
  firstTabId?: string;
  archived: boolean;
}

interface CampaignListPageProps {
  currentUser?: Pick<User, "displayName" | "email" | "photoURL"> | null;
  onLogout?: () => void | Promise<void>;
}

function formatDate(value: unknown) {
  const date = (value as { toDate?: () => Date } | undefined)?.toDate?.();
  if (!date) return "-";
  return date.toISOString().slice(0, 10);
}

function cleanArchivedName(name: string) {
  return name.replace(/^__archived__/, "");
}

function getUserInitials(nameOrEmail?: string | null) {
  const value = (nameOrEmail ?? "GF").trim();
  if (!value) return "GF";
  const name = value.includes("@") ? value.split("@")[0] : value;
  const parts = name.replace(/[._-]+/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

async function deleteDocsByQuery(collectionName: string, field: string, value: string) {
  const db = getFirebaseDb();
  const snapshot = await getDocs(query(collection(db, collectionName), where(field, "==", value)));
  if (snapshot.empty) return;

  let batch = writeBatch(db);
  let count = 0;
  for (const document of snapshot.docs) {
    batch.delete(document.ref);
    count += 1;
    if (count >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
}

export default function CampaignListPage({ currentUser = null, onLogout }: CampaignListPageProps) {
  const [campaigns, setCampaigns] = useState<CampaignListRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("캠페인 목록을 불러오는 중입니다.");
  const [error, setError] = useState("");
  const [queryText, setQueryText] = useState("");
  const [status, setStatus] = useState<"all" | CampaignStatus>("all");
  const [archiveFilter, setArchiveFilter] = useState<"all" | "active" | "archived">("all");

  const accountName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "관리자";
  const accountEmail = currentUser?.email || "로그인 정보 없음";
  const accountInitials = getUserInitials(currentUser?.displayName || currentUser?.email);

  async function loadCampaigns() {
    if (!isFirebaseClientConfigured()) {
      setMessage("Firebase 환경변수가 없어 실제 캠페인 목록을 불러올 수 없습니다.");
      setCampaigns([]);
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

      const loaded = campaignSnapshot.docs.map((campaignDoc) => {
        const campaign = campaignDoc.data();
        const campaignName = String(campaign.campaignName ?? "Untitled Campaign");
        const archived = campaignName.startsWith("__archived__") || Boolean(campaign.archivedAt);
        return {
          id: campaignDoc.id,
          campaignName,
          cleanCampaignName: cleanArchivedName(campaignName),
          brandName: String(campaign.brandName ?? ""),
          productName: productByCampaign.get(campaignDoc.id) ?? "",
          status: String(campaign.status ?? "unpublished") as CampaignStatus,
          updatedAt: formatDate(campaign.updatedAt ?? campaign.createdAt),
          createdAt: formatDate(campaign.createdAt),
          tabCount: tabsByCampaign.get(campaignDoc.id) ?? 0,
          brandColor: colorByCampaign.get(campaignDoc.id) ?? "#2D5A3D",
          firstShareToken: shareTokenByCampaign.get(campaignDoc.id),
          firstTabId: tabIdByCampaign.get(campaignDoc.id),
          archived
        } satisfies CampaignListRecord;
      });

      loaded.sort((a, b) => Number(b.archived) - Number(a.archived) || a.cleanCampaignName.localeCompare(b.cleanCampaignName));
      setCampaigns(loaded);
      setMessage(`전체 캠페인 ${loaded.length}개를 불러왔습니다. 아카이브된 캠페인도 이 화면에서 확인할 수 있습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "캠페인 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function restoreCampaign(campaign: CampaignListRecord) {
    if (!isFirebaseClientConfigured()) return;
    setLoading(true);
    setError("");

    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, "campaigns", campaign.id), {
        campaignName: campaign.cleanCampaignName,
        archivedAt: null,
        updatedAt: serverTimestamp()
      });
      setMessage(`${campaign.cleanCampaignName} 캠페인을 아카이브에서 복구했습니다.`);
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "복구 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteCampaignPermanently(campaign: CampaignListRecord) {
    if (!isFirebaseClientConfigured()) return;
    const ok = window.confirm(`${campaign.cleanCampaignName} 캠페인을 완전히 삭제할까요?\n\n이 작업은 되돌릴 수 없습니다. 연결된 SKU, 가이드 항목, 공개 링크 데이터도 함께 삭제됩니다.`);
    if (!ok) return;

    setLoading(true);
    setError("");

    try {
      const db = getFirebaseDb();
      const tabSnapshot = await getDocs(query(collection(db, "campaignTabs"), where("campaignId", "==", campaign.id)));

      for (const tabDoc of tabSnapshot.docs) {
        const tab = tabDoc.data();
        const shareToken = String(tab.shareToken ?? "");

        const sectionSnapshot = await getDocs(query(collection(db, "guideSections"), where("tabId", "==", tabDoc.id)));
        for (const sectionDoc of sectionSnapshot.docs) {
          await deleteDocsByQuery("guideItems", "sectionId", sectionDoc.id);
          await deleteDocsByQuery("mediaAssets", "itemId", sectionDoc.id);
          await deleteDoc(sectionDoc.ref);
        }

        await deleteDocsByQuery("mediaAssets", "tabId", tabDoc.id);
        if (shareToken) await deleteDoc(doc(db, "publicGuides", shareToken));
        await deleteDoc(tabDoc.ref);
      }

      await deleteDoc(doc(db, "campaigns", campaign.id));
      setMessage(`${campaign.cleanCampaignName} 캠페인을 완전히 삭제했습니다.`);
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  const filtered = useMemo(() => {
    return campaigns.filter((campaign) => {
      const matchedQuery = [campaign.cleanCampaignName, campaign.brandName, campaign.productName, campaign.firstShareToken]
        .join(" ")
        .toLowerCase()
        .includes(queryText.toLowerCase());
      const matchedStatus = status === "all" || campaign.status === status;
      const matchedArchive =
        archiveFilter === "all" ||
        (archiveFilter === "active" && !campaign.archived) ||
        (archiveFilter === "archived" && campaign.archived);
      return matchedQuery && matchedStatus && matchedArchive;
    });
  }, [archiveFilter, campaigns, queryText, status]);

  const counts = {
    total: campaigns.length,
    active: campaigns.filter((item) => !item.archived).length,
    archived: campaigns.filter((item) => item.archived).length,
    published: campaigns.filter((item) => item.status === "published" && !item.archived).length
  };

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="wordmark">G-Futures Ops</div>
          <div className="sidebar-sub">Influencer Guide OS</div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">Main</div>
          <a className="nav-item" href="/admin">대시보드</a>
          <a className="nav-item active" href="/admin/campaigns">캠페인 목록</a>
          <div className="nav-label">Settings</div>
          <a className="nav-item" href="/admin/glossary">전사 공통 용어집</a>
        </nav>
        <div className="sidebar-footer">
          <div className="user-row sidebar-account-row">
            {currentUser?.photoURL ? (
              <img className="avatar avatar-image" src={currentUser.photoURL} alt="관리자 프로필" />
            ) : (
              <div className="avatar">{accountInitials}</div>
            )}
            <div className="account-meta">
              <div className="account-name">{accountName}</div>
              <div className="account-email">{accountEmail}</div>
            </div>
            {onLogout ? (
              <button className="logout-icon-btn" type="button" onClick={onLogout} title="로그아웃" aria-label="로그아웃">
                ⎋
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <div className="topbar">
          <strong>Campaign Archive</strong>
          <div className="topbar-right">
            <button className="btn btn-ghost" type="button" onClick={loadCampaigns} disabled={loading}>새로고침</button>
            <a className="btn btn-primary" href="/admin">새 캠페인 생성</a>
          </div>
        </div>

        <div className="page">
          <div className="page-header">
            <div>
              <h1>캠페인 전체 목록</h1>
              <p>운영 중인 캠페인과 아카이브로 숨겨진 캠페인을 한 곳에서 검색·복구·삭제합니다.</p>
            </div>
          </div>

          <div className={`setup-banner ${error ? "danger" : "success"}`}>
            {error ? `오류: ${error}` : message}
          </div>

          <section className="stats-grid">
            <StatCard label="전체 캠페인" value={counts.total} sub="아카이브 포함" />
            <StatCard label="운영 목록" value={counts.active} sub="대시보드 표시" />
            <StatCard label="아카이브" value={counts.archived} sub="숨김 처리" />
            <StatCard label="공개 중" value={counts.published} sub="외부 접근 가능" />
          </section>

          <section className="search-row campaign-list-search-row">
            <input
              className="search-input"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="브랜드명, 상품명, 캠페인명, 공유 토큰으로 검색..."
            />
            <select className="filter-select" value={status} onChange={(event) => setStatus(event.target.value as "all" | CampaignStatus)}>
              <option value="all">전체 상태</option>
              <option value="unpublished">미공개</option>
              <option value="published">공개</option>
              <option value="error">오류</option>
            </select>
            <select className="filter-select" value={archiveFilter} onChange={(event) => setArchiveFilter(event.target.value as "all" | "active" | "archived")}>
              <option value="all">전체 목록</option>
              <option value="active">운영 중</option>
              <option value="archived">아카이브</option>
            </select>
          </section>

          <section className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>캠페인</th>
                  <th>상태</th>
                  <th>보관</th>
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
                    <tr key={campaign.id} className={campaign.archived ? "archived-row" : ""}>
                      <td>
                        <div className="brand-cell">
                          <span className="brand-dot" style={{ background: campaign.brandColor }} />
                          <div>
                            <div className="brand-name">{campaign.cleanCampaignName}</div>
                            <div className="brand-product">{campaign.brandName} · {campaign.productName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="status-cell"><span className={`badge ${statusClass[campaign.status]}`}>{statusLabel[campaign.status]}</span></td>
                      <td><span className={`badge ${campaign.archived ? "badge-gray" : "badge-green"}`}>{campaign.archived ? "아카이브" : "운영 중"}</span></td>
                      <td>{campaign.tabCount}개</td>
                      <td>{guideUrl ? <code>{guideUrl}</code> : "-"}</td>
                      <td>{campaign.updatedAt}</td>
                      <td>
                        <div className="action-row">
                          {guideUrl && !campaign.archived ? <a className="icon-btn" title="공유 링크 열기" href={guideUrl} target="_blank" rel="noreferrer">↗</a> : null}
                          {campaign.firstShareToken && !campaign.archived ? <a className="icon-btn" title="편집" href={`/admin/tabs/${campaign.firstShareToken}/edit`}>✎</a> : null}
                          {campaign.archived ? <button className="icon-btn" title="아카이브 복구" type="button" onClick={() => restoreCampaign(campaign)}>↩</button> : null}
                          <button className="icon-btn danger-icon-btn" title="완전 삭제" type="button" onClick={() => deleteCampaignPermanently(campaign)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={7}>검색 조건에 맞는 캠페인이 없습니다.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
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
