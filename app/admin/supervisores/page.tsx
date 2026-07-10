export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { SupervisoresManager } from "@/components/admin/supervisores/supervisores-manager";
import { requireAdministrador } from "@/lib/auth";

export default async function SupervisoresPage() {
  await requireAdministrador();

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
