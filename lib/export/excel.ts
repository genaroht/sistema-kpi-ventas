import ExcelJS from "exceljs";
import { calcOperationalAdvance, stageLabel } from "@/lib/utils";
import type { AvanceRow, Kpi, RegistroKpi, Vendedor } from "@/types/database";

function safeSheetName(name: string) {
  return name.replace(/[\\/*?:\[\]]/g, " ").slice(0, 31);
}

export async function downloadKpiExcel(params: {
  filename?: string;
  fechaLabel: string;
  vendedores: Vendedor[];
  kpis: Kpi[];
  registros: RegistroKpi[];
  avanceRows: AvanceRow[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema KPI Ventas";
  workbook.created = new Date();

  const matrix = workbook.addWorksheet("Vista Matriz");
  const base = workbook.addWorksheet("Data Base");
  const avance = workbook.addWorksheet("Avance %");

  matrix.views = [{ state: "frozen", xSplit: 2, ySplit: 2 }];
  const topHeader = ["Zona", "Vendedor"];
  params.kpis.forEach((kpi) => topHeader.push(kpi.nombre, "", "", ""));
  const secondHeader = ["", ""];
  params.kpis.forEach(() => secondHeader.push("Compromiso", "RAD 1:45 pm", "Cierre", "% Avance"));
  matrix.addRow(topHeader);
  matrix.addRow(secondHeader);

  params.vendedores.forEach((vendedor) => {
    const row: Array<string | number> = [vendedor.zona, vendedor.nombre];
    params.kpis.forEach((kpi) => {
      const find = (etapa: "compromiso" | "corte" | "cierre") => params.registros.find((r) => r.vendedor_id === vendedor.id && r.kpi_id === kpi.id && r.etapa === etapa);
      const compromisoRow = find("compromiso");
      const corteRow = find("corte");
      const cierreRow = find("cierre");
      const compromiso = Number(compromisoRow?.cantidad ?? 0);
      const corte = Number(corteRow?.cantidad ?? 0);
      const cierre = Number(cierreRow?.cantidad ?? 0);
      const percent = calcOperationalAdvance({
        compromiso,
        corte,
        cierre,
        hasCorte: Boolean(corteRow),
        hasCierre: Boolean(cierreRow),
      });
      row.push(compromiso, corte, cierre, Number((percent / 100).toFixed(4)));
    });
    matrix.addRow(row);
  });

  const totalRow: Array<string | number> = ["Total", `${params.vendedores.length} vendedores visibles`];
  params.kpis.forEach((kpi) => {
    const total = (etapa: "compromiso" | "corte" | "cierre") => params.vendedores.reduce((sum, vendedor) => {
      const value = params.registros.find((r) => r.vendedor_id === vendedor.id && r.kpi_id === kpi.id && r.etapa === etapa)?.cantidad ?? 0;
      return sum + Number(value);
    }, 0);
    const totalCompromiso = total("compromiso");
    const totalCorte = total("corte");
    const totalCierre = total("cierre");
    const totalLogrado = params.vendedores.reduce((sum, vendedor) => {
      const cierreRow = params.registros.find((r) => r.vendedor_id === vendedor.id && r.kpi_id === kpi.id && r.etapa === "cierre");
      if (cierreRow) return sum + Number(cierreRow.cantidad ?? 0);
      const corteRow = params.registros.find((r) => r.vendedor_id === vendedor.id && r.kpi_id === kpi.id && r.etapa === "corte");
      return sum + Number(corteRow?.cantidad ?? 0);
    }, 0);
    const totalPercent = totalCompromiso > 0 ? totalLogrado / totalCompromiso : 0;
    totalRow.push(totalCompromiso, totalCorte, totalCierre, Number(totalPercent.toFixed(4)));
  });
  const totalExcelRow = matrix.addRow(totalRow);
  totalExcelRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  totalExcelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172554" } };

  matrix.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  matrix.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
  matrix.getRow(2).font = { bold: true };
  matrix.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
  matrix.columns.forEach((column, index) => {
    column.width = index < 2 ? 18 : 14;
    if (index > 1 && (index - 1) % 4 === 0) column.numFmt = "0%";
  });

  base.addRow(["Fecha", "Zona", "Vendedor", "KPI", "Etapa", "Cantidad"]);
  params.registros.forEach((r) => {
    const vendedor = params.vendedores.find((v) => v.id === r.vendedor_id);
    const kpi = params.kpis.find((k) => k.id === r.kpi_id);
    base.addRow([r.fecha, vendedor?.zona ?? "", vendedor?.nombre ?? "", kpi?.nombre ?? "", stageLabel(r.etapa), Number(r.cantidad)]);
  });

  avance.addRow(["Fecha", "Zona", "Vendedor", "KPI", "Compromiso", "RAD 1:45 pm", "Cierre", "% Avance", "Estado"]);
  params.avanceRows.forEach((r) => avance.addRow([r.fecha, r.zona, r.vendedor, r.kpi, r.compromiso, r.corte, r.cierre, Number(((r.avance ?? 0) / 100).toFixed(4)), r.avance && r.avance > 100 ? "Superó meta" : r.estado]));

  [base, avance].forEach((sheet) => {
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns.forEach((column) => { column.width = 18; });
  });
  avance.getColumn(8).numFmt = "0%";

  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };
      });
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = params.filename ?? `kpi-ventas-${safeSheetName(params.fechaLabel)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
