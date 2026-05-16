"use client";

import { useMemo, useState } from "react";
import type { GuideItem, GuideTab, SectionType } from "@/types/guide";

const tabs: { key: SectionType; label: string }[] = [
  { key: "basic", label: "基本情報" },
  { key: "product", label: "商品紹介" },
  { key: "content", label: "コンテンツ" },
  { key: "notice", label: "注意事項" }
];

export default function GuidePage({ guide, embedded = false }: { guide: GuideTab; embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<SectionType>("basic");
  const section = useMemo(
    () => guide.sections.find((item) => item.sectionType === activeTab) ?? guide.sections[0] ?? null,
    [activeTab, guide.sections]
  );
  const items = section?.items ?? [];

  async function copyLink() {
    const url = typeof window !== "undefined" ? window.location.href : guide.shareToken;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        alert("リンクをコピーしました");
        return;
      }
    } catch {
      // 일부 모바일 브라우저에서는 clipboard 권한이 막힐 수 있어 아래 안내로 대체합니다.
    }

    window.prompt("リンクをコピーしてください", url);
  }

  return (
    <div className="guide-body" style={{ ["--brand" as string]: guide.brandColor || "#2D5A3D" }}>
      <header className="guide-hero">
        <span className="hero-label">Influencer Guide</span>
        <h1 className="hero-brand">{guide.heroTitle || "Influencer Guide"}</h1>
        <p className="hero-product">{guide.heroSubtitle}</p>
        <div className="hero-meta">
          {guide.brandName ? <span className="hero-tag">{guide.brandName}</span> : null}
          {guide.skuName ? <span className="hero-tag">{guide.skuName}</span> : null}
        </div>
      </header>

      <nav className="tab-nav" aria-label="Guide tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="guide-content">
        {activeTab === "basic" ? (
          <BasicSection items={items} hashtags={guide.hashtags ?? []} />
        ) : (
          <AccordionSection items={items} defaultOpenFirst={activeTab === "notice"} />
        )}
      </main>

      {!embedded && (
        <button className="fab" type="button" onClick={copyLink}>リンクをコピー</button>
      )}
    </div>
  );
}

function BasicSection({ items, hashtags }: { items: GuideItem[]; hashtags: string[] }) {
  return (
    <>
      <div className="guide-card">
        <div className="card-header"><div className="card-title">ブランド・製品情報</div></div>
        <div className="card-body">
          {items.length ? items.map((item) => (
            <div className="info-row" key={item.id}>
              <span className="info-label">{item.titleJa}</span>
              <span className="info-value">{item.bodyJa}</span>
            </div>
          )) : <p className="empty-text">表示できる基本情報がまだありません。</p>}
        </div>
      </div>
      <div className="guide-card">
        <div className="card-header"><div className="card-title">必須ハッシュタグ</div></div>
        <div className="card-body">
          <div className="hashtag-wrap">
            {hashtags.length ? hashtags.map((tag) => <span className="hashtag" key={tag}>{tag}</span>) : <span className="empty-text">指定ハッシュタグはまだありません。</span>}
          </div>
        </div>
      </div>
    </>
  );
}

function AccordionSection({ items, defaultOpenFirst }: { items: GuideItem[]; defaultOpenFirst?: boolean }) {
  const [openIds, setOpenIds] = useState<string[]>(defaultOpenFirst && items[0] ? [items[0].id] : []);

  function toggle(id: string) {
    setOpenIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  if (!items.length) {
    return <div className="guide-card"><div className="card-body"><p className="empty-text">表示できる項目がまだありません。</p></div></div>;
  }

  return (
    <div>
      {items.map((item) => {
        const open = openIds.includes(item.id);
        return (
          <div key={item.id}>
            <button type="button" className={`accordion-btn ${open ? "open" : ""}`} onClick={() => toggle(item.id)}>
              <strong>{item.titleJa}</strong>
              <span>{open ? "−" : "+"}</span>
            </button>
            <div className={`accordion-detail ${open ? "open" : ""}`}>
              <MarkdownLite text={item.bodyJa ?? ""} />
              {item.media?.length ? (
                <div className="hashtag-wrap" style={{ marginTop: 12 }}>
                  {item.media.map((media) => {
                    const href = media.externalUrl ?? media.fileUrl ?? "#";
                    return (
                      <a className="hashtag" key={media.id} href={href} target="_blank" rel="noreferrer">
                        {media.title || media.mediaType}
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MarkdownLite({ text }: { text: string }) {
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const renderInline = (value: string) =>
    escapeHtml(value).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  const lines = text.split("\n");
  const htmlParts: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      htmlParts.push(`<ul>${listItems.join("")}</ul>`);
      listItems = [];
    }
  };

  lines.forEach((line) => {
    const bullet = line.match(/^- (.*)$/);

    if (bullet) {
      listItems.push(`<li>${renderInline(bullet[1])}</li>`);
      return;
    }

    flushList();

    if (line.trim() === "") {
      htmlParts.push("<br />");
      return;
    }

    htmlParts.push(`<p>${renderInline(line)}</p>`);
  });

  flushList();

  return <div className="markdown-lite" dangerouslySetInnerHTML={{ __html: htmlParts.join("") }} />;
}
