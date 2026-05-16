import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-mark" aria-hidden>
          <span className="login-mark-dot" />
          G-Futures Ops
        </div>

        <p className="eyebrow">Admin Login</p>
        <h1>관리자 로그인</h1>
        <p>
          Google OAuth로 인증된 G-Futures 운영팀만 이용할 수 있습니다.
          연동이 완료되면 이 페이지에 실제 로그인 버튼이 활성화됩니다.
        </p>

        <div className="login-actions">
          <Link href="/admin" className="btn btn-primary btn-lg">
            임시로 관리자 페이지 보기
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="login-hint">
          <div className="login-hint-label">개발 메모</div>
          <div className="login-hint-text">
            Firebase Google 로그인을 연결하면 이 임시 버튼은 비활성화됩니다.
          </div>
        </div>
      </section>
    </main>
  );
}
