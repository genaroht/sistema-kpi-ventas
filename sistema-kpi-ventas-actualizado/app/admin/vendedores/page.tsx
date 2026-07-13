export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { VendedoresManager } from "@/components/admin/vendedores/vendedores-manager";
import { requireEditorAccess } from "@/lib/auth";

export default async function VendedoresPage() {
  await requireEditorAccess();

  return (
    <>
      <PageTitle title="Vendedores" description="Crea, edita, activa, desactiva y asigna zonas a vendedores." />
      <VendedoresManager />
    </>
  );
}
