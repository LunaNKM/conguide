"use client";

import { useMemo, useState } from "react";
import { mockCampaigns, mockGuideTab } from "@/lib/mock-data";
import GuidePage from "@/components/guide/GuidePage";
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

export default function AdminDashboard() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | CampaignStatus>("all");

  const filtered = useMemo(() => {
    return mockCampaigns.filter((campaign) => {
      const matchedQuery = [campaign.campaignName, campaign.brandName, campaign.productName]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchedStatus = status === "all" || campaign.status === status;
      return matchedQuery && matchedStatus;
    });
  }, [query, status]);

  const counts = {
    total: mockCampaigns.length,
    published: mockCampaigns.filter((item) => item.status === "published").length,
    unpublished: mockCampaigns.filter((item) => item.status === "unpublished").length,
    error: mockCampaigns.filter((item) => item.status === "error").length
  };

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
            <div>admin@gfutures.co</div>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <div className="topbar">
          <strong>캠페인 관리</strong>
          <button className="btn btn-primary">새 캠페인</button>
        </div>

        <div className="page">
          <div className="page-header">
            <h1>캠페인 목록</h1>
            <p>오리엔시트 업로드, SKU별 가이드 생성, 공유 링크를 관리합니다.</p>
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
              value={query}
              onChange={(event) => setQuery(event.target.value)}
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
                        <button className="icon-btn" title="복제">⧉</button>
                        <button className="icon-btn" title="공유">↗</button>
                        <button className="icon-btn" title="편집">✎</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="editor-grid">
            <div className="editor-card">
              <h3>SKU 세부탭 편집 샘플</h3>
              <div className="form-grid">
                <input className="form-input" defaultValue="EGF X ダウンタイム オイントゲル" aria-label="SKU명" />
                <textarea className="form-textarea" defaultValue="2번 탭의 항목은 각각 추가, 수정, 삭제할 수 있고 외부 페이지에서는 접힌 상태로 표시됩니다." />
                <textarea className="form-textarea" defaultValue="콘텐츠 필수사항은 GPT 자동 생성이 아니라 관리자가 직접 작성합니다." />
                <button className="btn btn-primary" type="button">변경사항 저장 예시</button>
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
