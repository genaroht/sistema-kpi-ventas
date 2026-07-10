export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { AdminDashboard } from "@/components/admin/dashboard/admin-dashboard";

export default function DashboardPage() {
  return (
    <>
      <PageTitle title="Dashboard" description="Resumen operativo del día por vendedores y KPI activos." />
      <AdminDashboard />
    </>
  );
}
