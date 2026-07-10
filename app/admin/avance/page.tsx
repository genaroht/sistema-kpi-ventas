export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { AvanceDashboard } from "@/components/admin/avance/avance-dashboard";

export default function AvancePage() {
  return (
    <>
      <PageTitle title="Avance %" description="Gráficos de cumplimiento, ranking, brechas, heatmap y tendencia por días." />
      <AvanceDashboard />
    </>
  );
}
