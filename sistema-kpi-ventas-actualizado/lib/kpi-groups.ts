import type { Kpi } from "@/types/database";

export const DEFAULT_KPI_GROUPS = ["Volumen", "Cobertura", "Comercial"] as const;
export const KPI_GROUP_ORDER = [...DEFAULT_KPI_GROUPS];
export type KpiGroupName = string;

const COMERCIAL_KEYWORDS = [
  "c.v",
  "cv",
  "mision",
  "misión",
  "mkp",
  "negociacion",
  "negociación",
  "precio",
  "padron",
  "padrón",
  "productividad",
  "calidad",
  "cliente",
  "tienda",
  "perfecta"
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function cleanGroup(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : null;
}

export function getKpiGroup(kpi: Pick<Kpi, "nombre" | "tipo"> & { grupo?: string | null }): KpiGroupName {
  const assignedGroup = cleanGroup(kpi.grupo);
  if (assignedGroup) return assignedGroup;

  const name = normalize(kpi.nombre);
  if (name.startsWith("cob ") || name.includes(" cobertura")) return "Cobertura";
  if (name.startsWith("vol ") || name === "epa" || name.includes("beer") || name.includes("premium") || name.includes(" ss")) return "Volumen";
  if (COMERCIAL_KEYWORDS.some((keyword) => name.includes(normalize(keyword)))) return "Comercial";

  return "Comercial";
}

export function getOrderedGroupNames(kpis: Array<Pick<Kpi, "nombre" | "tipo"> & { grupo?: string | null }>, extraGroups: string[] = []) {
  const names = new Set<string>();
  DEFAULT_KPI_GROUPS.forEach((group) => names.add(group));
  extraGroups.map((group) => cleanGroup(group)).filter(Boolean).forEach((group) => names.add(group as string));
  kpis.forEach((kpi) => names.add(getKpiGroup(kpi)));

  return Array.from(names).sort((a, b) => {
    const ai = DEFAULT_KPI_GROUPS.indexOf(a as (typeof DEFAULT_KPI_GROUPS)[number]);
    const bi = DEFAULT_KPI_GROUPS.indexOf(b as (typeof DEFAULT_KPI_GROUPS)[number]);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b, "es");
  });
}

export function groupKpis<T extends Pick<Kpi, "nombre" | "tipo" | "orden"> & { grupo?: string | null }>(kpis: T[], extraGroups: string[] = []) {
  return getOrderedGroupNames(kpis, extraGroups)
    .map((name) => ({
      name,
      items: kpis
        .filter((kpi) => getKpiGroup(kpi) === name)
        .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"))
    }))
    .filter((group) => group.items.length > 0);
}
