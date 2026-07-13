export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { UsuariosManager } from "@/components/admin/usuarios/usuarios-manager";
import { requireAdministrador } from "@/lib/auth";

export default async function UsuariosPage() {
  await requireAdministrador();

  return (
    <>
      <PageTitle title="Usuarios" description="Crea administradores, gerentes, supervisores y vendedores, y vincúlalos con Supabase Auth." />
      <UsuariosManager />
    </>
  );
}
