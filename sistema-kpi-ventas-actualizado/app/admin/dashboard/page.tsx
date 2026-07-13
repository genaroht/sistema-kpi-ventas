export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { AdminDashboard } from "@/components/admin/dashboard/admin-dashboard";

export default function DashboardPage() {
  return (
    <>
      <PageTitle title="Seguimiento de Compromisos Comerciales" description="Resumen operativo del día por supervisor, vendedores y KPI activos." />
      <AdminDashboard />
    </>
  );
}
