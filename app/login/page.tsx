import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">Admin Login</p>
        <h1>관리자 로그인</h1>
        <p>Supabase Google OAuth 연결 후 이 페이지에 실제 로그인 버튼을 연결합니다.</p>
        <Link href="/admin" className="btn btn-primary">임시로 관리자 페이지 보기</Link>
      </section>
    </main>
  );
}
