export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { TablaExcel } from "@/components/admin/tabla/tabla-excel";
import { requirePanelAccess } from "@/lib/auth";

export default async function ReportesPage() {
  const { profile } = await requirePanelAccess();

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
