import { calcOperationalAdvance } from "@/lib/utils";
import type { AvanceRow, Etapa, Kpi, RegistroJoined, RegistroKpi, Vendedor } from "@/types/database";

export function buildAvanceRows(params: { fecha?: string; vendedores: Vendedor[]; kpis: Kpi[]; registros: RegistroKpi[] }): AvanceRow[] {
  const { fecha, vendedores, kpis, registros } = params;
  const rows: AvanceRow[] = [];

  vendedores.forEach((vendedor) => {
    kpis.forEach((kpi) => {
      if (vendedor.jefe_id !== kpi.jefe_id) return;
      const find = (etapa: Etapa) => registros.find((r) => r.vendedor_id === vendedor.id && r.kpi_id === kpi.id && r.etapa === etapa);
      const compromisoRow = find("compromiso");
      const corteRow = find("corte");
      const cierreRow = find("cierre");
      const compromiso = Number(compromisoRow?.cantidad ?? 0);
      const corte = Number(corteRow?.cantidad ?? 0);
      const cierre = Number(cierreRow?.cantidad ?? 0);
      const avance = calcOperationalAdvance({
        compromiso,
        corte,
        cierre,
        hasCorte: Boolean(corteRow),
        hasCierre: Boolean(cierreRow),
      });
      const estado = cierreRow ? "Completo" : corteRow ? "Pendiente cierre" : compromisoRow ? "Pendiente RAD" : "Pendiente compromiso";

      rows.push({
        fecha: fecha ?? find("compromiso")?.fecha ?? find("corte")?.fecha ?? find("cierre")?.fecha ?? "",
        zona: vendedor.zona,
        vendedor: vendedor.nombre,
        vendedor_id: vendedor.id,
        kpi: kpi.nombre,
        kpi_id: kpi.id,
        tipo: kpi.tipo,
        color: kpi.color,
        grupo: kpi.grupo ?? null,
        compromiso,
        corte,
        cierre,
        avance,
        estado
      });
    });
  });

  return rows;
}

export function normalizeJoinedRows(rows: RegistroJoined[]) {
  return rows.map((r) => ({
    fecha: r.fecha,
    zona: r.vendedor?.zona ?? "",
    vendedor: r.vendedor?.nombre ?? "",
    vendedor_id: r.vendedor?.id ?? r.vendedor_id,
    kpi: r.kpi?.nombre ?? "",
    kpi_id: r.kpi?.id ?? r.kpi_id,
    tipo: r.kpi?.tipo ?? "normal",
    color: r.kpi?.color ?? null,
    grupo: r.kpi?.grupo ?? null,
    etapa: r.etapa,
    cantidad: Number(r.cantidad ?? 0)
  }));
}
