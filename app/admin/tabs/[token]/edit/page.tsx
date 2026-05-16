import AuthGate from "@/components/admin/AuthGate";
import TabEditor from "@/components/admin/TabEditor";

export default function TabEditPage({ params }: { params: { token: string } }) {
  return (
    <AuthGate>
      <TabEditor token={decodeURIComponent(params.token)} />
    </AuthGate>
  );
}
