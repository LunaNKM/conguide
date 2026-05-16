import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-v2">
      {/* Hero */}
      <section className="hero-v2">
        <div className="hero-v2-inner">
          <span className="eyebrow">G-Futures Ops · Influencer Guide OS</span>
          <h1 className="hero-v2-title">
            오리엔시트 한 장으로,
            <br />
            <span className="hero-v2-accent">완성된 일본어 가이드</span>까지.
          </h1>
          <p className="hero-v2-copy">
            한국어 오리엔시트 XLSX를 업로드하면 SKU별 모바일 가이드 페이지를 자동으로 생성하고,
            인플루언서에게 공유 링크 한 줄로 전달합니다.
          </p>
          <div className="hero-v2-actions">
            <Link href="/admin" className="btn btn-primary btn-lg">
              관리자 페이지 보기
              <span aria-hidden>→</span>
            </Link>
            <Link href="/guide/guide-easydew-ointgel-jp" className="btn btn-ghost btn-lg">
              가이드 샘플 보기
            </Link>
          </div>

          <div className="hero-v2-meta">
            <div className="meta-cell">
              <div className="meta-num">3 STEP</div>
              <div className="meta-label">업로드 → 검토 → 공유</div>
            </div>
            <div className="meta-cell">
              <div className="meta-num">JA</div>
              <div className="meta-label">GPT 자동 번역</div>
            </div>
            <div className="meta-cell">
              <div className="meta-num">↗</div>
              <div className="meta-label">공유 링크 즉시 발급</div>
            </div>
          </div>
        </div>

        <div className="hero-v2-visual" aria-hidden>
          <div className="hero-v2-phone">
            <div className="phone-screen">
              <div className="phone-hero">
                <div className="phone-eyebrow">INFLUENCER GUIDE</div>
                <div className="phone-title">EASYDEW</div>
                <div className="phone-sub">DW-EGF オイントジェル</div>
              </div>
              <div className="phone-tabs">
                <span className="phone-tab active">基本情報</span>
                <span className="phone-tab">商品紹介</span>
                <span className="phone-tab">コンテンツ</span>
              </div>
              <div className="phone-body">
                <div className="phone-card">
                  <div className="phone-card-title">ブランド情報</div>
                  <div className="phone-row"><span>ブランド名</span><b>EASYDEW</b></div>
                  <div className="phone-row"><span>商品名</span><b>EGF Oint Gel</b></div>
                  <div className="phone-row"><span>カテゴリ</span><b>スキンケア</b></div>
                </div>
                <div className="phone-card">
                  <div className="phone-card-title">必須ハッシュタグ</div>
                  <div className="phone-tags">
                    <span>#PR</span><span>#EASYDEW</span><span>#オイントジェル</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-v2">
        <div className="features-v2-inner">
          <span className="eyebrow">Workflow</span>
          <h2 className="features-v2-h">한 화면에서 끝나는 운영</h2>

          <div className="features-grid">
            <article className="feature-card">
              <div className="feature-num">01</div>
              <h3>XLSX 업로드</h3>
              <p>KOR_ 시트를 파싱해 브랜드명, 제품, 소구 포인트, 해시태그까지 한 번에 추출합니다.</p>
            </article>
            <article className="feature-card">
              <div className="feature-num">02</div>
              <h3>GPT 초안 생성</h3>
              <p>한국어 원문에서 자연스러운 일본어 인플루언서 가이드 카피를 자동 생성합니다.</p>
            </article>
            <article className="feature-card">
              <div className="feature-num">03</div>
              <h3>관리자 검토 · 편집</h3>
              <p>실시간 모바일 미리보기를 보며 항목별로 미세 조정하고 공통 용어집을 적용합니다.</p>
            </article>
            <article className="feature-card">
              <div className="feature-num">04</div>
              <h3>공유 링크 발급</h3>
              <p>SKU별 공유 토큰이 발급되어 인플루언서에게 모바일 가이드 URL을 즉시 전달합니다.</p>
            </article>
          </div>
        </div>
      </section>

      <footer className="landing-v2-footer">
        <div className="footer-inner">
          <div className="footer-mark">G-Futures Ops</div>
          <div className="footer-copy">© G-Futures. Internal tool — Influencer Guide System.</div>
        </div>
      </footer>
    </main>
  );
}
