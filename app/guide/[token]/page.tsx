import PublicGuideClient from "@/components/guide/PublicGuideClient";

export default function GuideTokenPage({ params }: { params: { token: string } }) {
  return <PublicGuideClient token={params.token} />;
}
