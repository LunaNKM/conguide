import GuidePage from "@/components/guide/GuidePage";
import { mockGuideTab } from "@/lib/mock-data";

export default async function PublicGuidePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GuidePage guide={{ ...mockGuideTab, shareToken: token }} />;
}
