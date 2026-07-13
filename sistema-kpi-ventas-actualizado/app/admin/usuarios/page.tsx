export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { UsuariosManager } from "@/components/admin/usuarios/usuarios-manager";
import { requireAdministrador } from "@/lib/auth";

export default async function UsuariosPage() {
  await requireAdministrador();

  return (
    <>
      <PageTitle title="Usuarios" description="Gestiona usuarios de tabla, roles y vinculación con Supabase Auth. Solo administrador." />
      <UsuariosManager />
    </>
  );
}
