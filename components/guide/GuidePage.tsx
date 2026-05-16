"use client";

import { useMemo, useState } from "react";
import type { GuideItem, GuideMedia, GuideTab, SectionType } from "@/types/guide";

const tabs: { key: SectionType; label: string }[] = [
  { key: "basic", label: "基本情報" },
  { key: "product", label: "商品紹介" },
  { key: "content", label: "コンテンツ" },
  { key: "notice", label: "注意事項" }
];

export default function GuidePage({ guide, embedded = false }: { guide: GuideTab; embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<SectionType>("basic");
  const [copied, setCopied] = useState(false);

  const section = useMemo(
    () => guide.sections.find((item) => item.sectionType === activeTab) ?? guide.sections[0],
    [activeTab, guide.sections]
  );

  async function copyLink() {
    const url = typeof window !== "undefined" ? window.location.href : guide.shareToken;
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fall back silently
    }
  }

  return (
    <div className="guide-body" style={{ ["--brand" as string]: guide.brandColor || "#1F4A35" }}>
      <header className="guide-hero">
        {guide.brandLogoUrl ? (
          <div className="hero-logo-wrap" aria-label="Brand logo">
            <img
              className="hero-logo"
              src={guide.brandLogoUrl}
              alt={guide.brandLogoAlt || `${guide.brandName || guide.heroTitle || "Brand"} logo`}
            />
          </div>
        ) : null}
        <span className="hero-label">Influencer Guide</span>
        <h1 className="hero-brand">{guide.heroTitle || guide.brandName || "Guide"}</h1>
        <p className="hero-product">{guide.heroSubtitle || guide.productName}</p>
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
        {!section ? (
          <EmptyState />
        ) : activeTab === "basic" ? (
          <BasicSection items={section.items} hashtags={guide.hashtags} />
        ) : (
          <AccordionSection items={section.items} defaultOpenFirst={false} />
        )}
      </main>

      {!embedded && (
        <button
          className={`fab ${copied ? "fab-copied" : ""}`}
          type="button"
          onClick={copyLink}
        >
          {copied ? "コピーしました" : "リンクをコピー"}
        </button>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="guide-card">
      <div className="card-body" style={{ color: "var(--c-ink-3)", padding: "32px 20px", textAlign: "center" }}>
        表示できる項目がまだありません。
      </div>
    </div>
  );
}

function BasicSection({ items, hashtags }: { items: GuideItem[]; hashtags: string[] }) {
  return (
    <>
      <div className="guide-card">
        <div className="card-header">
          <div className="card-title">ブランド・製品情報</div>
        </div>
        <div className="card-body">
          {items.length ? (
            items.map((item) => (
              <div className="info-row" key={item.id}>
                <span className="info-label">{item.titleJa}</span>
                <span className="info-value">
                  <MarkdownLite text={item.bodyJa} inline />
                </span>
              </div>
            ))
          ) : (
            <p style={{ color: "var(--c-ink-3)", fontSize: 13 }}>表示できる項目がまだありません。</p>
          )}
        </div>
      </div>

      <div className="guide-card">
        <div className="card-header">
          <div className="card-title">必須ハッシュタグ</div>
        </div>
        <div className="card-body">
          <div className="hashtag-wrap">
            {(hashtags ?? []).length ? (
              hashtags.map((tag) => (
                <span className="hashtag" key={tag}>
                  {tag}
                </span>
              ))
            ) : (
              <span className="hashtag">#PR</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function AccordionSection({
  items,
  defaultOpenFirst
}: {
  items: GuideItem[];
  defaultOpenFirst?: boolean;
}) {
  const [openIds, setOpenIds] = useState<string[]>(
    defaultOpenFirst && items[0] ? [items[0].id] : []
  );

  function toggle(id: string) {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  if (!items.length) return <EmptyState />;

  return (
    <div>
      {items.map((item) => {
        const open = openIds.includes(item.id);
        return (
          <div key={item.id}>
            <button
              type="button"
              className={`accordion-btn accordion-${item.textSize ?? "normal"} ${
                item.emphasize ? "emphasize" : ""
              } ${open ? "open" : ""}`}
              onClick={() => toggle(item.id)}
              aria-expanded={open}
            >
              <strong className="accordion-title">{item.titleJa || "項目"}</strong>
              <span className="accordion-toggle" aria-hidden>
                {open ? "−" : "+"}
              </span>
            </button>
            <div
              className={`accordion-detail detail-${item.textSize ?? "normal"} ${
                item.emphasize ? "emphasize" : ""
              } ${open ? "open" : ""}`}
            >
              <MarkdownLite text={item.bodyJa} />
              {item.media?.length ? <MediaList media={item.media} /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MediaList({ media }: { media: GuideMedia[] }) {
  const validMedia = media.filter((item) => item.externalUrl || item.fileUrl);
  if (!validMedia.length) return null;

  return (
    <div className="media-list">
      {validMedia.map((item) => {
        const url = item.externalUrl || item.fileUrl || "";
        const title = item.title || labelForMedia(item);
        if (item.mediaType === "image") {
          return <img className="guide-media-image" key={item.id} src={url} alt={title} loading="lazy" />;
        }
        if (item.mediaType === "video" && item.fileUrl) {
          return <video className="guide-media-video" key={item.id} src={url} controls playsInline />;
        }
        const youtubeId = item.mediaType === "youtube" ? extractYoutubeId(url) : null;
        if (youtubeId) {
          return (
            <div className="youtube-frame" key={item.id}>
              <iframe src={`https://www.youtube.com/embed/${youtubeId}`} title={title} allowFullScreen />
            </div>
          );
        }
        return (
          <a className="media-link" key={item.id} href={url} target="_blank" rel="noreferrer">
            <span>{title}</span>
            <span aria-hidden>→</span>
          </a>
        );
      })}
    </div>
  );
}

function labelForMedia(media: GuideMedia) {
  if (media.mediaType === "google_drive") return "Google Drive 資料";
  if (media.mediaType === "youtube") return "YouTube 参考動画";
  if (media.mediaType === "image") return "参考画像";
  if (media.mediaType === "video") return "参考動画";
  return "参考リンク";
}

function extractYoutubeId(url: string) {
  const patterns = [/youtu\.be\/([^?&/]+)/, /youtube\.com\/watch\?v=([^?&/]+)/, /youtube\.com\/embed\/([^?&/]+)/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function MarkdownLite({ text, inline = false }: { text: string; inline?: boolean }) {
  const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const renderInline = (value: string) =>
    escapeHtml(value).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  if (inline) return <span dangerouslySetInnerHTML={{ __html: renderInline(text) }} />;

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
