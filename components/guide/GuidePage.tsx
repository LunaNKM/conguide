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
    () => guide.sections.find((item) => item.sectionType === activeTab) ?? guide.sections[0],
    [activeTab, guide.sections]
  );

  async function copyLink() {
    const url = typeof window !== "undefined" ? window.location.href : guide.shareToken;
    await navigator.clipboard?.writeText(url);
    alert("リンクをコピーしました");
  }

  return (
    <div className="guide-body" style={{ ["--brand" as string]: guide.brandColor }}>
      <header className="guide-hero">
        <span className="hero-label">Influencer Guide</span>
        <h1 className="hero-brand">{guide.heroTitle}</h1>
        <p className="hero-product">{guide.heroSubtitle}</p>
        <div className="hero-meta">
          <span className="hero-tag">{guide.brandName}</span>
          <span className="hero-tag">{guide.skuName}</span>
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
          <BasicSection items={section.items} hashtags={guide.hashtags} />
        ) : (
          <AccordionSection items={section.items} defaultOpenFirst={activeTab === "notice"} />
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
          {items.map((item) => (
            <div className="info-row" key={item.id}>
              <span className="info-label">{item.titleJa}</span>
              <span className="info-value">{item.bodyJa}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="guide-card">
        <div className="card-header"><div className="card-title">必須ハッシュタグ</div></div>
        <div className="card-body">
          <div className="hashtag-wrap">
            {hashtags.map((tag) => <span className="hashtag" key={tag}>{tag}</span>)}
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
              <MarkdownLite text={item.bodyJa} />
              {item.media?.length ? (
                <div className="hashtag-wrap" style={{ marginTop: 12 }}>
                  {item.media.map((media) => (
                    <a className="hashtag" key={media.id} href={media.externalUrl ?? media.fileUrl} target="_blank" rel="noreferrer">
                      {media.title ?? media.mediaType}
                    </a>
                  ))}
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
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/\n/g, "<br />");

  return <div className="markdown-lite" dangerouslySetInnerHTML={{ __html: html }} />;
}
