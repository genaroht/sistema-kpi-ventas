export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { UsuariosManager } from "@/components/admin/usuarios/usuarios-manager";

export default function UsuariosPage() {
  return (
    <>
      <PageTitle title="Usuarios" description="Gestiona usuarios de tabla, roles y vinculación con Supabase Auth. Solo administrador." />
      <UsuariosManager />
    </>
  );
}
