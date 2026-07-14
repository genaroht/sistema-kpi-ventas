export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { TablaExcel } from "@/components/admin/tabla/tabla-excel";
import { ManagerReports } from "@/components/gerente/manager-reports";
import { requirePanelAccess } from "@/lib/auth";

export default async function ReportesPage() {
  const { profile } = await requirePanelAccess();

  if (profile.rol === "gerente") {
    return (
      <>
        <PageTitle title="Reportes gerenciales" description="Resumen por supervisor, detalle de vendedores y descargas consolidadas." />
        <ManagerReports managerId={profile.id} />
      </>
    );
  }

  return (
    <>
      <PageTitle
        title="Reportes"
        description="Descarga reportes PNG por etapa o trabaja con el detalle completo en Excel."
      />
      <TablaExcel role={profile.rol} currentUserId={profile.id} />
    </>
  );
}
