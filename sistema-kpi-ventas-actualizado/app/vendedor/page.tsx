export const dynamic = "force-dynamic";

import { VendedorLoader } from "@/components/vendedor/vendedor-loader";
import { requireVendedor } from "@/lib/auth";

export default async function VendedorPage() {
  await requireVendedor();
  return <VendedorLoader />;
}
