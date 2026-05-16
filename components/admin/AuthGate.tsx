"use client";

import { useEffect, useMemo, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, isFirebaseClientConfigured } from "@/lib/firebase/client";

interface AuthGateProps {
  children: React.ReactNode;
}

type AuthState = "checking" | "demo" | "signedOut" | "allowed" | "denied";

export default function AuthGate({ children }: AuthGateProps) {
  const configured = useMemo(() => isFirebaseClientConfigured(), []);
  const [state, setState] = useState<AuthState>(configured ? "checking" : "demo");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!configured) return;

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser?.email) {
        setState("signedOut");
        return;
      }

      try {
        const db = getFirebaseDb();
        const allowedRef = doc(db, "allowedAdmins", currentUser.email.toLowerCase());
        const allowedDoc = await getDoc(allowedRef);
        setState(allowedDoc.exists() ? "allowed" : "denied");
      } catch (err) {
        setError(err instanceof Error ? err.message : "관리자 확인 중 오류가 발생했습니다.");
        setState("denied");
      }
    });

    return () => unsubscribe();
  }, [configured]);

  async function handleLogin() {
    setError("");
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  async function handleLogout() {
    await signOut(getFirebaseAuth());
  }

  if (state === "demo") {
    return (
      <>
        <div className="setup-banner">
          Firebase 환경변수가 아직 설정되지 않아 데모 모드로 표시 중입니다. Vercel에 Firebase 환경변수를 넣으면 Google 로그인 검증이 활성화됩니다.
        </div>
        {children}
      </>
    );
  }

  if (state === "checking") {
    return <FullPageMessage title="관리자 확인 중" body="Google 로그인 상태와 관리자 허용 이메일을 확인하고 있습니다." />;
  }

  if (state === "signedOut") {
    return (
      <FullPageMessage
        title="G-Futures Ops 로그인"
        body="관리자 페이지에 접근하려면 Google 로그인이 필요합니다."
        action={<button className="btn btn-primary" onClick={handleLogin}>Google로 로그인</button>}
      />
    );
  }

  if (state === "denied") {
    return (
      <FullPageMessage
        title="접근 권한이 없습니다"
        body={`${user?.email ?? "현재 계정"}은 allowedAdmins에 등록되어 있지 않습니다.${error ? ` (${error})` : ""}`}
        action={<button className="btn btn-ghost" onClick={handleLogout}>다른 계정으로 로그인</button>}
      />
    );
  }

  return (
    <>
      <div className="setup-banner success">
        관리자 로그인: {user?.email}
        <button className="mini-link" onClick={handleLogout}>로그아웃</button>
      </div>
      {children}
    </>
  );
}

function FullPageMessage({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>{title}</h1>
        <p>{body}</p>
        {action ? <div className="auth-action">{action}</div> : null}
      </div>
    </main>
  );
}
