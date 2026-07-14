import { calcOperationalAdvance } from "@/lib/utils";
import type { Etapa, Kpi, RegistroKpi, Vendedor } from "@/types/database";

export type KpiSnapshot = "compromiso" | "corte" | "cierre";

type SnapshotColumn = { key: Etapa | "avance"; label: string };

const snapshotColumns: Record<KpiSnapshot, SnapshotColumn[]> = {
  compromiso: [{ key: "compromiso", label: "Compromiso" }],
  corte: [
    { key: "compromiso", label: "Compromiso" },
    { key: "corte", label: "RAD 1:45 pm" },
  ],
  cierre: [
    { key: "compromiso", label: "Compromiso" },
    { key: "cierre", label: "Cierre" },
    { key: "avance", label: "% Avance" },
  ],
};

function getValue(
  registros: RegistroKpi[],
  vendedorId: string,
  kpiId: string,
  etapa: Etapa,
) {
  return Number(
    registros.find(
      (row) =>
        row.vendedor_id === vendedorId &&
        row.kpi_id === kpiId &&
        row.etapa === etapa,
    )?.cantidad ?? 0,
  );
}


function hasValue(
  registros: RegistroKpi[],
  vendedorId: string,
  kpiId: string,
  etapa: Etapa,
) {
  return registros.some(
    (row) =>
      row.vendedor_id === vendedorId &&
      row.kpi_id === kpiId &&
      row.etapa === etapa,
  );
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke = "#cbd5e1",
) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  options: {
    font?: string;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
  } = {},
) {
  ctx.font = options.font ?? "600 14px Arial, sans-serif";
  ctx.fillStyle = options.color ?? "#0f172a";
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = options.baseline ?? "middle";
  let value = text;
  if (ctx.measureText(value).width > maxWidth) {
    while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
      value = value.slice(0, -1);
    }
    value = `${value}…`;
  }
  ctx.fillText(value, x, y, maxWidth);
}

function snapshotTitle(snapshot: KpiSnapshot) {
  if (snapshot === "compromiso") return "Reporte de compromisos";
  if (snapshot === "corte") return "Reporte de compromiso y RAD 1:45 pm";
  return "Reporte de compromiso, cierre y avance";
}

export async function downloadKpiSnapshotPng(params: {
  snapshot: KpiSnapshot;
  fecha: string;
  supervisorLabel?: string;
  vendedores: Vendedor[];
  kpis: Kpi[];
  registros: RegistroKpi[];
  filename?: string;
}) {
  const columns = snapshotColumns[params.snapshot];
  const zoneWidth = 122;
  const vendorWidth = 205;
  const metricWidth = params.snapshot === "compromiso" ? 126 : 112;
  const titleHeight = 82;
  const groupHeaderHeight = 52;
  const metricHeaderHeight = 40;
  const rowHeight = 42;
  const totalHeight = 46;
  const width =
    zoneWidth +
    vendorWidth +
    params.kpis.length * columns.length * metricWidth;
  const logicalWidth = Math.max(width, 900);
  const logicalHeight =
    titleHeight +
    groupHeaderHeight +
    metricHeaderHeight +
    params.vendedores.length * rowHeight +
    totalHeight;
  const scale = Math.max(1, Math.min(2, 14000 / logicalWidth));

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(logicalWidth * scale);
  canvas.height = Math.ceil(logicalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear la imagen PNG.");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  const gradient = ctx.createLinearGradient(0, 0, logicalWidth, 0);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, logicalWidth, titleHeight);

  ctx.fillStyle = "#facc15";
  roundedRect(ctx, 22, 19, 44, 44, 12);
  ctx.fill();
  drawText(ctx, "B", 44, 41, 28, {
    font: "900 24px Arial, sans-serif",
    color: "#0f172a",
    align: "center",
  });
  drawText(ctx, snapshotTitle(params.snapshot), 82, 29, logicalWidth - 104, {
    font: "800 24px Arial, sans-serif",
    color: "#ffffff",
  });
  const meta = [params.fecha, params.supervisorLabel].filter(Boolean).join(" · ");
  drawText(ctx, meta, 82, 57, logicalWidth - 104, {
    font: "600 13px Arial, sans-serif",
    color: "#dbeafe",
  });

  const headerY = titleHeight;
  fillCell(ctx, 0, headerY, zoneWidth, groupHeaderHeight + metricHeaderHeight, "#67e8f9");
  fillCell(
    ctx,
    zoneWidth,
    headerY,
    vendorWidth,
    groupHeaderHeight + metricHeaderHeight,
    "#67e8f9",
  );
  drawText(ctx, "Zona", zoneWidth / 2, headerY + (groupHeaderHeight + metricHeaderHeight) / 2, zoneWidth - 16, {
    font: "800 15px Arial, sans-serif",
    align: "center",
  });
  drawText(
    ctx,
    "Vendedor",
    zoneWidth + vendorWidth / 2,
    headerY + (groupHeaderHeight + metricHeaderHeight) / 2,
    vendorWidth - 16,
    { font: "800 15px Arial, sans-serif", align: "center" },
  );

  let x = zoneWidth + vendorWidth;
  params.kpis.forEach((kpi, index) => {
    const groupWidth = columns.length * metricWidth;
    const groupFill = index % 2 === 0 ? "#dc2626" : "#1d4ed8";
    fillCell(ctx, x, headerY, groupWidth, groupHeaderHeight, groupFill, "#ffffff");
    drawText(ctx, kpi.nombre, x + groupWidth / 2, headerY + groupHeaderHeight / 2, groupWidth - 14, {
      font: "800 14px Arial, sans-serif",
      color: "#ffffff",
      align: "center",
    });
    columns.forEach((column) => {
      const metricFill = column.key === "avance" ? "#dbeafe" : "#eff6ff";
      fillCell(ctx, x, headerY + groupHeaderHeight, metricWidth, metricHeaderHeight, metricFill);
      drawText(
        ctx,
        column.label,
        x + metricWidth / 2,
        headerY + groupHeaderHeight + metricHeaderHeight / 2,
        metricWidth - 10,
        { font: "700 11px Arial, sans-serif", align: "center", color: "#334155" },
      );
      x += metricWidth;
    });
  });

  let y = titleHeight + groupHeaderHeight + metricHeaderHeight;
  params.vendedores.forEach((vendedor, rowIndex) => {
    const rowFill = rowIndex % 2 === 0 ? "#ffffff" : "#f1f5f9";
    fillCell(ctx, 0, y, zoneWidth, rowHeight, rowFill);
    fillCell(ctx, zoneWidth, y, vendorWidth, rowHeight, rowFill);
    drawText(ctx, vendedor.zona, 12, y + rowHeight / 2, zoneWidth - 22, {
      font: "800 13px Arial, sans-serif",
    });
    drawText(ctx, vendedor.nombre, zoneWidth + 12, y + rowHeight / 2, vendorWidth - 22, {
      font: "700 13px Arial, sans-serif",
    });

    x = zoneWidth + vendorWidth;
    params.kpis.forEach((kpi) => {
      const compromiso = getValue(params.registros, vendedor.id, kpi.id, "compromiso");
      const corte = getValue(params.registros, vendedor.id, kpi.id, "corte");
      const cierre = getValue(params.registros, vendedor.id, kpi.id, "cierre");
      const avance = calcOperationalAdvance({
        compromiso,
        corte,
        cierre,
        hasCorte: hasValue(params.registros, vendedor.id, kpi.id, "corte"),
        hasCierre: hasValue(params.registros, vendedor.id, kpi.id, "cierre"),
      });
      columns.forEach((column) => {
        fillCell(ctx, x, y, metricWidth, rowHeight, rowFill);
        const value =
          column.key === "avance"
            ? avance
            : getValue(params.registros, vendedor.id, kpi.id, column.key);
        const label = column.key === "avance" ? `${Math.round(value)}%` : Number(value).toLocaleString("es-PE");
        drawText(ctx, label, x + metricWidth - 12, y + rowHeight / 2, metricWidth - 20, {
          font: "800 13px Arial, sans-serif",
          align: "right",
          color:
            column.key === "avance" && value != null
              ? value <= 50
                ? "#b91c1c"
                : value <= 85
                  ? "#a16207"
                  : "#15803d"
              : "#0f172a",
        });
        x += metricWidth;
      });
    });
    y += rowHeight;
  });

  fillCell(ctx, 0, y, zoneWidth, totalHeight, "#172554", "#1e40af");
  fillCell(ctx, zoneWidth, y, vendorWidth, totalHeight, "#172554", "#1e40af");
  drawText(ctx, "TOTAL", 12, y + totalHeight / 2, zoneWidth - 20, {
    font: "900 14px Arial, sans-serif",
    color: "#ffffff",
  });
  drawText(ctx, `${params.vendedores.length} vendedores`, zoneWidth + 12, y + totalHeight / 2, vendorWidth - 20, {
    font: "700 12px Arial, sans-serif",
    color: "#bfdbfe",
  });

  x = zoneWidth + vendorWidth;
  params.kpis.forEach((kpi) => {
    const totalCompromiso = params.vendedores.reduce(
      (sum, vendedor) => sum + getValue(params.registros, vendedor.id, kpi.id, "compromiso"),
      0,
    );
    const totalLogrado = params.vendedores.reduce((sum, vendedor) => {
      if (hasValue(params.registros, vendedor.id, kpi.id, "cierre")) {
        return sum + getValue(params.registros, vendedor.id, kpi.id, "cierre");
      }
      if (hasValue(params.registros, vendedor.id, kpi.id, "corte")) {
        return sum + getValue(params.registros, vendedor.id, kpi.id, "corte");
      }
      return sum;
    }, 0);
    columns.forEach((column) => {
      fillCell(ctx, x, y, metricWidth, totalHeight, "#172554", "#1e40af");
      const etapa = column.key;
      const value =
        etapa === "avance"
          ? totalCompromiso > 0 ? (totalLogrado / totalCompromiso) * 100 : 0
          : params.vendedores.reduce(
              (sum, vendedor) =>
                sum + getValue(params.registros, vendedor.id, kpi.id, etapa),
              0,
            );
      drawText(
        ctx,
        column.key === "avance"
          ? `${Math.round(value)}%`
          : Number(value).toLocaleString("es-PE"),
        x + metricWidth - 12,
        y + totalHeight / 2,
        metricWidth - 20,
        {
          font: "900 13px Arial, sans-serif",
          color: "#ffffff",
          align: "right",
        },
      );
      x += metricWidth;
    });
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("No se pudo generar la imagen PNG."));
    }, "image/png");
  });
  const filename = params.filename ?? `reporte-${params.snapshot}-${params.fecha}.png`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return { blob, filename };
}
