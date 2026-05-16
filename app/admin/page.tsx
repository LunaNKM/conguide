import AdminDashboard from "@/components/admin/AdminDashboard";
import AuthGate from "@/components/admin/AuthGate";

export default function AdminPage() {
  return (
    <AuthGate>
      <AdminDashboard />
    </AuthGate>
  );
}
