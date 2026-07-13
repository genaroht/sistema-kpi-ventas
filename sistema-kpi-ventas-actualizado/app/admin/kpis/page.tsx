export const dynamic = "force-dynamic";

import { PageTitle } from "@/components/admin/page-title";
import { KpisManager } from "@/components/admin/kpis/kpis-manager";
import { requireEditorAccess } from "@/lib/auth";

export default async function KpisPage() {
  await requireEditorAccess();

  return (
    <>
      <PageTitle title="KPI" description="Crea, edita, activa, desactiva y ordena KPI normales o adicionales." />
      <KpisManager />
    </>
  );
}
