export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { ManagerSupervisorDetail } from "@/components/gerente/manager-supervisor-detail";
import { requirePanelAccess } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SupervisorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fecha?: string; kpi?: string }>;
}) {
  const { profile } = await requirePanelAccess();
  if (profile.rol !== "gerente") redirect("/admin/supervisores");

  const { id } = await params;
  const query = await searchParams;

  return (
    <>
      <PageTitle title="Detalle del supervisor" description="Avance, ranking, semáforo y resultados del equipo seleccionado." />
      <ManagerSupervisorDetail managerId={profile.id} supervisorId={id} initialDate={query.fecha} initialKpi={query.kpi} />
    </>
  );
}
