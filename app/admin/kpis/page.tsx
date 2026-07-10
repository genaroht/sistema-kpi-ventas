export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { KpisManager } from "@/components/admin/kpis/kpis-manager";

export default function KpisPage() {
  return (
    <>
      <PageTitle title="KPI" description="Crea, edita, activa, desactiva y ordena KPI normales o adicionales." />
      <KpisManager />
    </>
  );
}
