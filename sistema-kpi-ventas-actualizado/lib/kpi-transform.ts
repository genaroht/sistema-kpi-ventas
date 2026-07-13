import { calcPercent } from "@/lib/utils";
import type { AvanceRow, Etapa, Kpi, RegistroJoined, RegistroKpi, Vendedor } from "@/types/database";

export function buildAvanceRows(params: { fecha?: string; vendedores: Vendedor[]; kpis: Kpi[]; registros: RegistroKpi[] }): AvanceRow[] {
  const { fecha, vendedores, kpis, registros } = params;
  const rows: AvanceRow[] = [];

  vendedores.forEach((vendedor) => {
    kpis.forEach((kpi) => {
      if (vendedor.jefe_id !== kpi.jefe_id) return;
      const find = (etapa: Etapa) => registros.find((r) => r.vendedor_id === vendedor.id && r.kpi_id === kpi.id && r.etapa === etapa);
      const compromiso = Number(find("compromiso")?.cantidad ?? 0);
      const corte = Number(find("corte")?.cantidad ?? 0);
      const cierre = Number(find("cierre")?.cantidad ?? 0);
      const avance = calcPercent(cierre, compromiso);
      const estado = find("cierre") ? "Completo" : find("corte") ? "Pendiente cierre" : find("compromiso") ? "Pendiente corte" : "Pendiente compromiso";

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
