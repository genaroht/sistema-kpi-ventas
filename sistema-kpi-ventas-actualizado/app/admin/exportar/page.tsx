export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { ReportesClient } from "@/components/admin/reportes/reportes-client";
import { requireEditorAccess } from "@/lib/auth";

export default async function ExportarPage() {
  await requireEditorAccess();

  return (
    <>
      <PageTitle title="Exportar Excel" description="Descarga el archivo con Vista Matriz, Data Base y Avance %." />
      <ReportesClient mode="exportar" />
    </>
  );
}
