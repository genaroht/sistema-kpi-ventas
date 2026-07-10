export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { ReportesClient } from "@/components/admin/reportes/reportes-client";

export default function ReportesPage() {
  return (
    <>
      <PageTitle title="Reportes" description="Consulta resultados por rango de fechas, vendedor, zona y KPI." />
      <ReportesClient mode="reportes" />
    </>
  );
}
