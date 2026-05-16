"use client";

import { FormEvent, useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb, isFirebaseClientConfigured } from "@/lib/firebase/client";

interface GlossaryEntry {
  id: string;
  korean: string;
  japanese: string;
  category: string;
}

function makeId(value: string) {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9가-힣ぁ-んァ-ン一-龥]+/gi, "_").replace(/^_+|_+$/g, "");
  return slug || `term_${Date.now()}`;
}

export default function GlossaryManager() {
  const [items, setItems] = useState<GlossaryEntry[]>([]);
  const [korean, setKorean] = useState("");
  const [japanese, setJapanese] = useState("");
  const [category, setCategory] = useState("operation");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("용어집을 불러오는 중입니다.");
  const [error, setError] = useState("");

  async function loadGlossary() {
    setLoading(true);
    setError("");
    try {
      if (!isFirebaseClientConfigured()) {
        setItems([
          { id: "megawari", korean: "메가와리", japanese: "メガワリ", category: "promotion" },
          { id: "orient_sheet", korean: "오리엔시트", japanese: "オリエンシート", category: "operation" }
        ]);
        setMessage("Firebase 미설정 상태라 샘플 용어를 표시합니다.");
        return;
      }
      const db = getFirebaseDb();
      const snap = await getDocs(query(collection(db, "glossaryGlobal"), orderBy("korean")));
      setItems(snap.docs.map((entry) => {
        const data = entry.data() as Record<string, unknown>;
        return {
          id: entry.id,
          korean: String(data.korean ?? ""),
          japanese: String(data.japanese ?? ""),
          category: String(data.category ?? "")
        };
      }));
      setMessage("전사 공통 용어집을 불러왔습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "용어집 로딩 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGlossary();
  }, []);

  async function saveEntry(event: FormEvent) {
    event.preventDefault();
    if (!korean.trim() || !japanese.trim()) {
      setError("한국어와 일본어를 모두 입력해 주세요.");
      return;
    }
    setError("");
    try {
      const entry: GlossaryEntry = { id: makeId(korean), korean: korean.trim(), japanese: japanese.trim(), category: category.trim() || "general" };
      if (isFirebaseClientConfigured()) {
        const db = getFirebaseDb();
        await setDoc(doc(db, "glossaryGlobal", entry.id), {
          korean: entry.korean,
          japanese: entry.japanese,
          category: entry.category,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      setItems((current) => [entry, ...current.filter((item) => item.id !== entry.id)].sort((a, b) => a.korean.localeCompare(b.korean)));
      setKorean("");
      setJapanese("");
      setMessage("용어를 저장했습니다. 다음 GPT 생성부터 반영됩니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "용어 저장 중 오류가 발생했습니다.");
    }
  }

  async function removeEntry(entry: GlossaryEntry) {
    try {
      if (isFirebaseClientConfigured()) {
        const db = getFirebaseDb();
        await deleteDoc(doc(db, "glossaryGlobal", entry.id));
      }
      setItems((current) => current.filter((item) => item.id !== entry.id));
      setMessage("용어를 삭제했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "용어 삭제 중 오류가 발생했습니다.");
    }
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="wordmark">G-Futures Ops</div>
          <div className="sidebar-sub">Glossary</div>
        </div>
        <nav className="sidebar-nav">
          <a className="nav-item" href="/admin">대시보드</a>
          <a className="nav-item active" href="/admin/glossary">용어집</a>
        </nav>
      </aside>

      <main className="admin-main">
        <div className="topbar">
          <strong>전사 공통 용어집</strong>
          <div className="topbar-right"><a className="btn btn-ghost" href="/admin">대시보드로</a></div>
        </div>
        <div className="page">
          <div className={`setup-banner ${error ? "danger" : "success"}`}>{error ? `오류: ${error}` : message}</div>
          <div className="editor-card">
            <h3>용어 추가</h3>
            <form className="form-grid four" onSubmit={saveEntry}>
              <label className="field-label">한국어<input className="form-input" value={korean} onChange={(event) => setKorean(event.target.value)} placeholder="예: 메가와리" /></label>
              <label className="field-label">일본어<input className="form-input" value={japanese} onChange={(event) => setJapanese(event.target.value)} placeholder="예: メガワリ" /></label>
              <label className="field-label">분류<input className="form-input" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="promotion" /></label>
              <button className="btn btn-primary glossary-submit" type="submit">저장</button>
            </form>
          </div>
          <div className="editor-card">
            <h3>등록된 용어</h3>
            {loading ? <p>불러오는 중...</p> : null}
            <div className="glossary-table">
              <div className="glossary-head"><span>한국어</span><span>일본어</span><span>분류</span><span>관리</span></div>
              {items.map((entry) => (
                <div className="glossary-row" key={entry.id}>
                  <span>{entry.korean}</span>
                  <span>{entry.japanese}</span>
                  <span>{entry.category}</span>
                  <button className="icon-btn" type="button" onClick={() => removeEntry(entry)}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
