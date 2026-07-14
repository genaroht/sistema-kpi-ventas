export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { SupervisoresManager } from "@/components/admin/supervisores/supervisores-manager";
import { ManagerSupervisors } from "@/components/gerente/manager-supervisors";
import { requirePanelAccess } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SupervisoresPage() {
  const { profile } = await requirePanelAccess();

  if (profile.rol === "gerente") {
    return (
      <>
        <PageTitle title="Supervisores" description="Consulta el avance y entra al detalle de cada equipo asignado." />
        <ManagerSupervisors managerId={profile.id} />
      </>
    );
  }

  if (profile.rol !== "administrador") redirect("/admin/dashboard");

  return (
    <>
      <PageTitle
        title="Supervisores"
        description="Crea, edita y activa supervisores. Cada supervisor queda en Auth, Usuarios y la tabla operativa Supervisores."
      />
      <SupervisoresManager />
    </>
  );
}
