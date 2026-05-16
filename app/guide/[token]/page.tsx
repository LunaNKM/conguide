import GuidePage from "@/components/guide/GuidePage";
import { getPublicGuideByToken } from "@/lib/firebase/public-guide";

export default async function PublicGuidePage({ params }: { params: { token: string } }) {
  const guide = await getPublicGuideByToken(params.token);

  if (!guide) {
    return (
      <main className="not-found-page">
        <div className="auth-card">
          <h1>ガイドが見つかりません</h1>
          <p>リンクが間違っているか、まだ公開されていない可能性があります。</p>
        </div>
      </main>
    );
  }

  return <GuidePage guide={guide} />;
}
