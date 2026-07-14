import { AdminShell } from "@/components/admin/admin-shell";
import { requirePanelAccess } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requirePanelAccess();
  return (
    <AdminShell
      profileName={profile.nombre ?? profile.usuario}
      initialRole={profile.rol}
      initialCodigoOperativo={profile.codigo_operativo}
    >
      {children}
    </AdminShell>
  );
}
