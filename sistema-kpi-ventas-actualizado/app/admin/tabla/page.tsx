export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { TablaExcel } from "@/components/admin/tabla/tabla-excel";
import { requirePanelAccess } from "@/lib/auth";

export default async function TablaPage() {
  const { profile } = await requirePanelAccess();

  return (
    <>
      <PageTitle title="Tabla tipo Excel" description="Matriz generada desde registros normalizados por fecha, vendedor, KPI y etapa." />
      <TablaExcel readOnly={profile.rol === "gerente"} />
    </>
  );
}
