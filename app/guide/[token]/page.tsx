import PublicGuideClient from "@/components/guide/PublicGuideClient";

export default function PublicGuidePage({ params }: { params: { token: string } }) {
  return <PublicGuideClient token={params.token} />;
}
