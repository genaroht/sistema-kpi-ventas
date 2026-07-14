export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { AvanceDashboard } from "@/components/admin/avance/avance-dashboard";
import { ManagerProgress } from "@/components/gerente/manager-progress";
import { requirePanelAccess } from "@/lib/auth";

export default async function AvancePage() {
  const { profile } = await requirePanelAccess();

  if (profile.rol === "gerente") {
    return (
      <>
        <PageTitle title="Avance global" description="Ranking, comparación y tendencia diaria de tus supervisores." />
        <ManagerProgress managerId={profile.id} />
      </>
    );
  }

  return (
    <>
      <PageTitle title="Avance %" description="Gráficos de avance, ranking, compromiso vs cierre, mapa de calor y tendencia por días." />
      <AvanceDashboard />
    </>
  );
}
