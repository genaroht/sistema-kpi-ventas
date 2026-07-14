"use client";

import ExcelJS from "exceljs";

export type ManagerExportTable = {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  filename: string;
};

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function createManagerTablePng(table: ManagerExportTable) {
  const scale = 2;
  const padding = 28;
  const titleHeight = 72;
  const rowHeight = 42;
  const colWidth = Math.max(135, Math.min(220, Math.floor(1500 / Math.max(1, table.headers.length))));
  const width = Math.max(900, padding * 2 + table.headers.length * colWidth);
  const height = titleHeight + padding * 2 + rowHeight * (table.rows.length + 1);
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo crear la imagen.");
  context.scale(scale, scale);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#0f172a";
  context.font = "700 26px Arial";
  context.fillText(table.title, padding, padding + 25);
  context.fillStyle = "#475569";
  context.font = "14px Arial";
  if (table.subtitle) context.fillText(table.subtitle, padding, padding + 50);

  const startY = titleHeight + padding;
  table.headers.forEach((header, columnIndex) => {
    const x = padding + columnIndex * colWidth;
    context.fillStyle = columnIndex < 2 ? "#164e63" : "#1d4ed8";
    context.fillRect(x, startY, colWidth, rowHeight);
    context.strokeStyle = "#cbd5e1";
    context.strokeRect(x, startY, colWidth, rowHeight);
    context.fillStyle = "#ffffff";
    context.font = "700 13px Arial";
    context.textAlign = columnIndex < 2 ? "left" : "right";
    const textX = columnIndex < 2 ? x + 10 : x + colWidth - 10;
    context.fillText(header.slice(0, 24), textX, startY + 26);
  });

  table.rows.forEach((row, rowIndex) => {
    const y = startY + rowHeight * (rowIndex + 1);
    row.forEach((value, columnIndex) => {
      const x = padding + columnIndex * colWidth;
      context.fillStyle = rowIndex % 2 === 0 ? "#f8fafc" : "#ffffff";
      context.fillRect(x, y, colWidth, rowHeight);
      context.strokeStyle = "#cbd5e1";
      context.strokeRect(x, y, colWidth, rowHeight);
      context.fillStyle = "#0f172a";
      context.font = `${columnIndex < 2 ? "700" : "600"} 13px Arial`;
      context.textAlign = columnIndex < 2 ? "left" : "right";
      const textX = columnIndex < 2 ? x + 10 : x + colWidth - 10;
      const formatted = typeof value === "number" ? value.toLocaleString("es-PE") : String(value);
      context.fillText(formatted.slice(0, 28), textX, y + 26);
    });
  });
  context.textAlign = "left";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("No se pudo generar el PNG.")), "image/png");
  });
  const filename = `${safeFilename(table.filename)}.png`;
  return { blob, filename };
}

export async function downloadAndShareManagerPng(table: ManagerExportTable) {
  const { blob, filename } = await createManagerTablePng(table);
  triggerDownload(blob, filename);

  const file = new File([blob], filename, { type: "image/png" });
  if (typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: table.title, text: `${table.title}${table.subtitle ? ` · ${table.subtitle}` : ""}` });
      return;
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
    }
  }

  const message = encodeURIComponent(`${table.title}${table.subtitle ? `\n${table.subtitle}` : ""}. La imagen fue descargada para adjuntarla.`);
  window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
}

export type ManagerExcelSheet = {
  name: string;
  headers: string[];
  rows: Array<Array<string | number>>;
};

export async function downloadManagerExcel(params: {
  filename: string;
  sheets: ManagerExcelSheet[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema KPI Backus";
  workbook.created = new Date();

  params.sheets.forEach((sheetData) => {
    const worksheet = workbook.addWorksheet(sheetData.name.slice(0, 31));
    worksheet.addRow(sheetData.headers);
    sheetData.rows.forEach((row) => worksheet.addRow(row));
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheetData.headers.length } };
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(1).height = 24;
    worksheet.columns.forEach((column, index) => {
      const values = [sheetData.headers[index], ...sheetData.rows.map((row) => String(row[index] ?? ""))];
      const maxLength = Math.max(...values.map((value) => value.length));
      column.width = Math.min(32, Math.max(12, maxLength + 2));
    });
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  triggerDownload(blob, `${safeFilename(params.filename)}.xlsx`);
}
