import AuthGate from "@/components/admin/AuthGate";
import CampaignListPage from "@/components/admin/CampaignListPage";

export default function AdminCampaignsPage() {
  return (
    <AuthGate>
      <CampaignListPage />
    </AuthGate>
  );
}
