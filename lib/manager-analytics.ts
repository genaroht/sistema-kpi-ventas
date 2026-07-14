import { calcOperationalAdvance } from "@/lib/utils";
import type { HabilitacionEtapas, Kpi, RegistroKpi, Supervisor, Vendedor } from "@/types/database";

export type ManagerTrafficLight = "verde" | "amarillo" | "rojo" | "gris";

export type ManagerSupervisorSummary = {
  supervisorId: string;
  supervisorName: string;
  supervisorCode: string;
  vendedores: number;
  compromiso: number;
  corte: number;
  cierre: number;
  logrado: number;
  avance: number;
  expectedCells: number;
  compromisoCells: number;
  corteCells: number;
  cierreCells: number;
  semaforo: ManagerTrafficLight;
  habilitacion: HabilitacionEtapas | null;
};

export type ManagerVendorSummary = {
  vendedorId: string;
  nombre: string;
  zona: string;
  compromiso: number;
  corte: number;
  cierre: number;
  logrado: number;
  avance: number;
  expectedCells: number;
  compromisoCells: number;
  corteCells: number;
  cierreCells: number;
  semaforo: ManagerTrafficLight;
};

export type ManagerKpiSummary = {
  kpiId: string;
  nombre: string;
  grupo: string;
  compromiso: number;
  corte: number;
  cierre: number;
  logrado: number;
  avance: number;
};

type OperationalCell = {
  compromiso: number;
  corte: number;
  cierre: number;
  hasCompromiso: boolean;
  hasCorte: boolean;
  hasCierre: boolean;
  logrado: number;
  avance: number;
};

function cellFor(vendedorId: string, kpiId: string, registros: RegistroKpi[]): OperationalCell {
  const rows = registros.filter((row) => row.vendedor_id === vendedorId && row.kpi_id === kpiId);
  const compromisoRow = rows.find((row) => row.etapa === "compromiso");
  const corteRow = rows.find((row) => row.etapa === "corte");
  const cierreRow = rows.find((row) => row.etapa === "cierre");
  const compromiso = Number(compromisoRow?.cantidad ?? 0);
  const corte = Number(corteRow?.cantidad ?? 0);
  const cierre = Number(cierreRow?.cantidad ?? 0);
  const logrado = cierreRow ? cierre : corteRow ? corte : 0;

  return {
    compromiso,
    corte,
    cierre,
    hasCompromiso: Boolean(compromisoRow),
    hasCorte: Boolean(corteRow),
    hasCierre: Boolean(cierreRow),
    logrado,
    avance: calcOperationalAdvance({
      compromiso,
      corte,
      cierre,
      hasCorte: Boolean(corteRow),
      hasCierre: Boolean(cierreRow),
    }),
  };
}

function ratio(logrado: number, compromiso: number) {
  return compromiso > 0 ? (logrado / compromiso) * 100 : 0;
}

export function trafficLight(params: {
  expectedCells: number;
  compromisoCells: number;
  cierreCells: number;
  avance: number;
  hasAnyRecord: boolean;
  habilitacion?: HabilitacionEtapas | null;
}): ManagerTrafficLight {
  const { expectedCells, compromisoCells, cierreCells, avance, hasAnyRecord, habilitacion } = params;
  const allBlocked = habilitacion
    ? !habilitacion.compromiso_activo && !habilitacion.corte_activo && !habilitacion.cierre_activo
    : true;

  if (!hasAnyRecord || allBlocked) return "gris";
  if (expectedCells > 0 && cierreCells >= expectedCells) return "verde";
  if (expectedCells > 0 && compromisoCells < expectedCells) return "rojo";
  if (avance <= 50) return "rojo";
  if (avance <= 85) return "amarillo";
  return "verde";
}

export function summarizeSupervisor(params: {
  supervisor: Supervisor;
  vendedores: Vendedor[];
  kpis: Kpi[];
  registros: RegistroKpi[];
  habilitacion?: HabilitacionEtapas | null;
}): ManagerSupervisorSummary {
  const { supervisor, vendedores, kpis, registros, habilitacion = null } = params;
  let compromiso = 0;
  let corte = 0;
  let cierre = 0;
  let logrado = 0;
  let compromisoCells = 0;
  let corteCells = 0;
  let cierreCells = 0;

  vendedores.forEach((vendedor) => {
    kpis.forEach((kpi) => {
      const cell = cellFor(vendedor.id, kpi.id, registros);
      compromiso += cell.compromiso;
      corte += cell.corte;
      cierre += cell.cierre;
      logrado += cell.logrado;
      if (cell.hasCompromiso) compromisoCells += 1;
      if (cell.hasCorte) corteCells += 1;
      if (cell.hasCierre) cierreCells += 1;
    });
  });

  const expectedCells = vendedores.length * kpis.length;
  const avance = ratio(logrado, compromiso);
  const hasAnyRecord = compromisoCells + corteCells + cierreCells > 0;

  return {
    supervisorId: supervisor.usuario_id,
    supervisorName: supervisor.nombre,
    supervisorCode: supervisor.codigo_operativo,
    vendedores: vendedores.length,
    compromiso,
    corte,
    cierre,
    logrado,
    avance,
    expectedCells,
    compromisoCells,
    corteCells,
    cierreCells,
    semaforo: trafficLight({
      expectedCells,
      compromisoCells,
      cierreCells,
      avance,
      hasAnyRecord,
      habilitacion,
    }),
    habilitacion,
  };
}

export function summarizeVendor(params: {
  vendedor: Vendedor;
  kpis: Kpi[];
  registros: RegistroKpi[];
  habilitacion?: HabilitacionEtapas | null;
}): ManagerVendorSummary {
  const { vendedor, kpis, registros, habilitacion = null } = params;
  let compromiso = 0;
  let corte = 0;
  let cierre = 0;
  let logrado = 0;
  let compromisoCells = 0;
  let corteCells = 0;
  let cierreCells = 0;

  kpis.forEach((kpi) => {
    const cell = cellFor(vendedor.id, kpi.id, registros);
    compromiso += cell.compromiso;
    corte += cell.corte;
    cierre += cell.cierre;
    logrado += cell.logrado;
    if (cell.hasCompromiso) compromisoCells += 1;
    if (cell.hasCorte) corteCells += 1;
    if (cell.hasCierre) cierreCells += 1;
  });

  const expectedCells = kpis.length;
  const avance = ratio(logrado, compromiso);
  const hasAnyRecord = compromisoCells + corteCells + cierreCells > 0;

  return {
    vendedorId: vendedor.id,
    nombre: vendedor.nombre,
    zona: vendedor.zona,
    compromiso,
    corte,
    cierre,
    logrado,
    avance,
    expectedCells,
    compromisoCells,
    corteCells,
    cierreCells,
    semaforo: trafficLight({
      expectedCells,
      compromisoCells,
      cierreCells,
      avance,
      hasAnyRecord,
      habilitacion,
    }),
  };
}

export function summarizeKpi(params: {
  kpi: Kpi;
  vendedores: Vendedor[];
  registros: RegistroKpi[];
}): ManagerKpiSummary {
  const { kpi, vendedores, registros } = params;
  let compromiso = 0;
  let corte = 0;
  let cierre = 0;
  let logrado = 0;

  vendedores.forEach((vendedor) => {
    const cell = cellFor(vendedor.id, kpi.id, registros);
    compromiso += cell.compromiso;
    corte += cell.corte;
    cierre += cell.cierre;
    logrado += cell.logrado;
  });

  return {
    kpiId: kpi.id,
    nombre: kpi.nombre,
    grupo: kpi.grupo ?? "Sin grupo",
    compromiso,
    corte,
    cierre,
    logrado,
    avance: ratio(logrado, compromiso),
  };
}

export function trafficLightLabel(value: ManagerTrafficLight) {
  const labels: Record<ManagerTrafficLight, string> = {
    verde: "Al día",
    amarillo: "En proceso",
    rojo: "Requiere atención",
    gris: "Bloqueado o sin datos",
  };
  return labels[value];
}

export function trafficLightClasses(value: ManagerTrafficLight) {
  const classes: Record<ManagerTrafficLight, string> = {
    verde: "border-green-200 bg-green-50 text-green-700",
    amarillo: "border-yellow-200 bg-yellow-50 text-yellow-800",
    rojo: "border-red-200 bg-red-50 text-red-700",
    gris: "border-slate-200 bg-slate-100 text-slate-600",
  };
  return classes[value];
}
