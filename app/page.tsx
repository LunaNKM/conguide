import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing">
      <section className="landing-card">
        <p className="eyebrow">G-Futures Ops</p>
        <h1>오리엔시트 가이드 자동 생성 시스템</h1>
        <p className="landing-copy">
          한국어 오리엔시트를 업로드하고, SKU별 일본어 모바일 가이드 페이지를 생성하는 관리자 시스템입니다.
        </p>
        <div className="landing-actions">
          <Link href="/admin" className="btn btn-primary">관리자 페이지 보기</Link>
          <Link href="/guide/guide-easydew-ointgel-jp" className="btn btn-ghost">가이드 샘플 보기</Link>
        </div>
      </section>
    </main>
  );
}
