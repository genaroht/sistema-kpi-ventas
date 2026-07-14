import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayInLima() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function formatDateHuman(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(year, month - 1, day));
}

export function numberOrZero(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function calcPercent(cierre: number | null | undefined, compromiso: number | null | undefined) {
  if (!compromiso || compromiso <= 0) return null;
  return (Number(cierre ?? 0) / Number(compromiso)) * 100;
}

/**
 * Calcula el avance operativo usando la última etapa realmente registrada.
 * Prioridad: Cierre -> RAD 1:45 pm -> 0. El valor 0 es válido, por eso
 * la existencia de la etapa se recibe por separado de su cantidad.
 */
export function calcOperationalAdvance(params: {
  compromiso: number | null | undefined;
  corte: number | null | undefined;
  cierre: number | null | undefined;
  hasCorte: boolean;
  hasCierre: boolean;
}) {
  const compromiso = Number(params.compromiso ?? 0);
  if (!Number.isFinite(compromiso) || compromiso <= 0) return 0;

  const achieved = params.hasCierre
    ? Number(params.cierre ?? 0)
    : params.hasCorte
      ? Number(params.corte ?? 0)
      : 0;

  return (Number.isFinite(achieved) ? achieved : 0) / compromiso * 100;
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "Sin compromiso";
  return `${Math.round(value)}%`;
}

export function advanceTone(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "bg-slate-100 text-slate-600 border-slate-200";
  if (value <= 50) return "bg-red-100 text-red-700 border-red-200";
  if (value <= 85) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-green-100 text-green-700 border-green-200";
}

export function advanceLabel(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "Sin compromiso";
  if (value > 100) return `${Math.round(value)}% · Superó meta`;
  return `${Math.round(value)}%`;
}

export function stageLabel(stage: string) {
  const map: Record<string, string> = {
    compromiso: "Compromiso",
    corte: "RAD 1:45 pm",
    cierre: "Cierre"
  };
  return map[stage] ?? stage;
}
