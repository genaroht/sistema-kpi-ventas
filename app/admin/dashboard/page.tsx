export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { AdminDashboard } from "@/components/admin/dashboard/admin-dashboard";
import { ManagerDashboard } from "@/components/gerente/manager-dashboard";
import { requirePanelAccess } from "@/lib/auth";

export default async function DashboardPage() {
  const { profile } = await requirePanelAccess();

  if (profile.rol === "gerente") {
    return (
      <>
        <PageTitle title="Dashboard gerencial" description="Resultados consolidados de tus supervisores y sus equipos comerciales." />
        <ManagerDashboard managerId={profile.id} />
      </>
    );
  }

  return (
    <>
      <PageTitle title="Seguimiento de Compromisos Comerciales" description="Resumen operativo del día por supervisor, vendedores y KPI activos." />
      <AdminDashboard />
    </>
  );
}
