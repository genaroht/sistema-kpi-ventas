export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { VendedoresManager } from "@/components/admin/vendedores/vendedores-manager";

export default function VendedoresPage() {
  return (
    <>
      <PageTitle title="Vendedores" description="Crea, edita, activa, desactiva y asigna zonas a vendedores." />
      <VendedoresManager />
    </>
  );
}
