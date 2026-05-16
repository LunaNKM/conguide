import AuthGate from "@/components/admin/AuthGate";
import GlossaryManager from "@/components/admin/GlossaryManager";

export default function GlossaryPage() {
  return (
    <AuthGate>
      <GlossaryManager />
    </AuthGate>
  );
}
