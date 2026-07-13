"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type SVGProps } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import {
  advanceLabel,
  advanceTone,
  calcPercent,
  formatPercent,
  todayInLima,
} from "@/lib/utils";
import type { Etapa, Kpi, RegistroKpi, Rol, Supervisor, Vendedor } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const etapas: Etapa[] = ["compromiso", "corte", "cierre"];

type OperativeTotals = {
  compromiso: number;
  corte: number;
  cierre: number;
  avance: number;
};

type VendorProgressRow = OperativeTotals & {
  vendedorId: string;
  nombre: string;
  zona: string;
};

type TooltipPayload<T> = Array<{
  payload: T;
  name?: string;
  value?: number | string;
}>;

type TooltipProps<T> = {
  active?: boolean;
  payload?: TooltipPayload<T>;
  label?: string;
};

function addDays(date: string, days: number) {
  const current = new Date(`${date}T00:00:00`);
  current.setDate(current.getDate() + days);
  return current.toISOString().slice(0, 10);
}

function statusFromRows(rows: RegistroKpi[], activeKpiCount: number) {
  if (activeKpiCount <= 0) return "Sin KPI";
  const counts = etapas.reduce(
    (acc, etapa) => {
      acc[etapa] = new Set(
        rows.filter((row) => row.etapa === etapa).map((row) => row.kpi_id),
      ).size;
      return acc;
    },
    {} as Record<Etapa, number>,
  );

  if (counts.cierre >= activeKpiCount) return "Completo";
  if (counts.corte >= activeKpiCount) return "Pendiente cierre";
  if (counts.compromiso >= activeKpiCount) return "Pendiente corte";
  return "Pendiente compromiso";
}

function etapaTotal(rows: RegistroKpi[], kpiId: string, etapa: Etapa) {
  return rows
    .filter((row) => row.kpi_id === kpiId && row.etapa === etapa)
    .reduce((total, row) => total + Number(row.cantidad || 0), 0);
}

function totalsForVendor(
  vendedor: Vendedor,
  kpis: Kpi[],
  registros: RegistroKpi[],
): OperativeTotals {
  const rows = registros.filter((row) => row.vendedor_id === vendedor.id);
  let compromiso = 0;
  let corte = 0;
  let cierre = 0;
  const advances: number[] = [];

  kpis.filter((kpi) => kpi.jefe_id === vendedor.jefe_id).forEach((kpi) => {
    const kpiCompromiso = etapaTotal(rows, kpi.id, "compromiso");
    const kpiCorte = etapaTotal(rows, kpi.id, "corte");
    const kpiCierre = etapaTotal(rows, kpi.id, "cierre");
    compromiso += kpiCompromiso;
    corte += kpiCorte;
    cierre += kpiCierre;
    const pct = calcPercent(kpiCierre, kpiCompromiso);
    if (pct !== null) advances.push(pct);
  });

  const avance = advances.length
    ? Math.round(advances.reduce((a, b) => a + b, 0) / advances.length)
    : 0;
  return { compromiso, corte, cierre, avance };
}

function averageAdvance(
  vendedores: Vendedor[],
  kpis: Kpi[],
  registros: RegistroKpi[],
) {
  const percentages: number[] = [];

  vendedores.forEach((vendedor) => {
    const rows = registros.filter((row) => row.vendedor_id === vendedor.id);
    kpis.filter((kpi) => kpi.jefe_id === vendedor.jefe_id).forEach((kpi) => {
      const compromiso = etapaTotal(rows, kpi.id, "compromiso");
      const cierre = etapaTotal(rows, kpi.id, "cierre");
      const pct = calcPercent(cierre, compromiso);
      if (pct !== null) percentages.push(pct);
    });
  });

  return percentages.length
    ? percentages.reduce((a, b) => a + b, 0) / percentages.length
    : null;
}

function NumberPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-900">
      {label}: {value.toLocaleString("es-PE")}
    </span>
  );
}

function VendorTotalsTooltip({
  active,
  payload,
}: TooltipProps<VendorProgressRow>) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div className="rounded-2xl border bg-white p-3 text-xs shadow-xl">
      <p className="font-black text-slate-950">{row.nombre}</p>
      <p className="mb-2 font-semibold text-slate-500">Zona {row.zona}</p>
      <div className="space-y-1 font-bold text-slate-700">
        <p>Compromiso: {row.compromiso.toLocaleString("es-PE")}</p>
        <p>Corte: {row.corte.toLocaleString("es-PE")}</p>
        <p>Cierre: {row.cierre.toLocaleString("es-PE")}</p>
        <p className="text-blue-700">Avance: {row.avance}%</p>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [fecha, setFecha] = useState(todayInLima());
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);
  const [registros, setRegistros] = useState<RegistroKpi[]>([]);
  const [previousRegistros, setPreviousRegistros] = useState<RegistroKpi[]>([]);
  const [selectedKpiId, setSelectedKpiId] = useState("todos");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("todos");
  const [currentRole, setCurrentRole] = useState<Rol | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");
      const previousDate = addDays(fecha, -1);
      const [vRes, kRes, sRes, rRes, prevRes, roleRes] = await Promise.all([
        supabase
          .from("vendedores")
          .select(
            "id,usuario_id,jefe_id,nombre,zona,visible_tabla,activo,created_at",
          )
          .eq("activo", true)
          .eq("visible_tabla", true)
          .order("zona"),
        supabase
          .from("kpis")
          .select(
            "id,jefe_id,nombre,activo,tipo,color,grupo,visible_tabla,orden,created_at",
          )
          .eq("activo", true)
          .eq("visible_tabla", true)
          .order("orden"),
        supabase
          .from("supervisores")
          .select("id,usuario_id,codigo_operativo,nombre,activo,created_at")
          .eq("activo", true)
          .order("codigo_operativo"),
        supabase
          .from("registros_kpi")
          .select("id,fecha,vendedor_id,kpi_id,etapa,cantidad,created_at")
          .eq("fecha", fecha),
        supabase
          .from("registros_kpi")
          .select("id,fecha,vendedor_id,kpi_id,etapa,cantidad,created_at")
          .eq("fecha", previousDate),
        supabase.rpc("current_user_role"),
      ]);

      if (ignore) return;

      const firstError =
        vRes.error ?? kRes.error ?? sRes.error ?? rRes.error ?? prevRes.error;
      if (firstError)
        setError(
          "No se pudo cargar el dashboard. Intenta recargar o revisa la conexión.",
        );

      setVendedores((vRes.data ?? []) as Vendedor[]);
      setKpis((kRes.data ?? []) as Kpi[]);
      setSupervisores((sRes.data ?? []) as Supervisor[]);
      setRegistros((rRes.data ?? []) as RegistroKpi[]);
      setPreviousRegistros((prevRes.data ?? []) as RegistroKpi[]);
      setCurrentRole((roleRes.data as Rol | null) ?? null);
      setLoading(false);
    }

    load();
    return () => {
      ignore = true;
    };
  }, [fecha, supabase]);

  const scopedVendedores = useMemo(
    () => vendedores.filter((item) => selectedSupervisorId === "todos" || item.jefe_id === selectedSupervisorId),
    [selectedSupervisorId, vendedores],
  );

  const scopedKpis = useMemo(
    () => kpis.filter((item) => selectedSupervisorId === "todos" || item.jefe_id === selectedSupervisorId),
    [kpis, selectedSupervisorId],
  );

  const filteredKpis = useMemo(
    () =>
      selectedKpiId === "todos"
        ? scopedKpis
        : scopedKpis.filter((kpi) => kpi.id === selectedKpiId),
    [scopedKpis, selectedKpiId],
  );

  const dashboardVendedores = useMemo(() => {
    if (selectedKpiId === "todos") return scopedVendedores;
    const ownerId = filteredKpis[0]?.jefe_id;
    return ownerId
      ? scopedVendedores.filter((vendedor) => vendedor.jefe_id === ownerId)
      : [];
  }, [filteredKpis, scopedVendedores, selectedKpiId]);

  const metrics = useMemo(() => {
    const filteredKpiIds = new Set(filteredKpis.map((kpi) => kpi.id));
    const rowsByVendor = new Map<string, RegistroKpi[]>();
    registros
      .filter((row) => filteredKpiIds.has(row.kpi_id))
      .forEach((row) =>
        rowsByVendor.set(row.vendedor_id, [
          ...(rowsByVendor.get(row.vendedor_id) ?? []),
          row,
        ]),
      );

    let completos = 0;
    let pendienteCompromiso = 0;
    let pendienteCorte = 0;
    let pendienteCierre = 0;

    const vendorStatus = dashboardVendedores.map((vendedor) => {
      const vendorKpiCount = filteredKpis.filter((kpi) => kpi.jefe_id === vendedor.jefe_id).length;
      const status = statusFromRows(
        rowsByVendor.get(vendedor.id) ?? [],
        vendorKpiCount,
      );
      if (status === "Completo") completos += 1;
      else if (status === "Pendiente cierre") pendienteCierre += 1;
      else if (status === "Pendiente corte") pendienteCorte += 1;
      else pendienteCompromiso += 1;
      return { vendedor, status };
    });

    const avg = averageAdvance(dashboardVendedores, filteredKpis, registros);
    const previousAvg = averageAdvance(dashboardVendedores, filteredKpis, previousRegistros);
    const delta =
      avg !== null && previousAvg !== null ? avg - previousAvg : null;

    return {
      completos,
      pendienteCompromiso,
      pendienteCorte,
      pendienteCierre,
      avg,
      previousAvg,
      delta,
      vendorStatus,
    };
  }, [registros, dashboardVendedores, filteredKpis, previousRegistros]);

  const avancePorZona = useMemo<VendorProgressRow[]>(() => {
    return dashboardVendedores
      .map((vendedor) => ({
        vendedorId: vendedor.id,
        nombre: vendedor.nombre,
        zona: vendedor.zona,
        ...totalsForVendor(vendedor, filteredKpis, registros),
      }))
      .sort(
        (a, b) =>
          a.avance - b.avance ||
          a.zona.localeCompare(b.zona) ||
          a.nombre.localeCompare(b.nombre),
      );
  }, [dashboardVendedores, filteredKpis, registros]);

  const avancePorVendedor = useMemo<VendorProgressRow[]>(() => {
    return dashboardVendedores
      .map((vendedor) => ({
        vendedorId: vendedor.id,
        nombre: vendedor.nombre,
        zona: vendedor.zona,
        ...totalsForVendor(vendedor, filteredKpis, registros),
      }))
      .sort((a, b) => a.avance - b.avance)
      .slice(0, 12);
  }, [dashboardVendedores, filteredKpis, registros]);

  const cards = [
    {
      title: "Vendedores activos",
      value: dashboardVendedores.length,
      icon: Users,
      href: currentRole === "gerente" ? "/admin/reportes" : "/admin/vendedores",
      tone: "border-slate-200 bg-white",
    },
    {
      title: "KPI activos",
      value:
        selectedKpiId === "todos"
          ? scopedKpis.length
          : `${filteredKpis.length} de ${scopedKpis.length}`,
      icon: Target,
      href: currentRole === "gerente" ? "/admin/reportes" : "/admin/kpis",
      tone: "border-slate-200 bg-white",
    },
    {
      title: "Registros completos",
      value: metrics.completos,
      icon: CheckCircle2,
      href: `/admin/tabla?fecha=${fecha}&estado=Completo`,
      tone: metrics.completos
        ? "border-green-200 bg-green-50"
        : "border-slate-200 bg-white",
    },
    {
      title: "Pend. compromiso",
      value: metrics.pendienteCompromiso,
      icon: Clock,
      href: `/admin/tabla?fecha=${fecha}&estado=Pendiente%20compromiso`,
      tone: metrics.pendienteCompromiso
        ? "border-red-200 bg-red-50"
        : "border-green-200 bg-green-50",
    },
    {
      title: "Pend. corte",
      value: metrics.pendienteCorte,
      icon: Activity,
      href: `/admin/tabla?fecha=${fecha}&estado=Pendiente%20corte`,
      tone: metrics.pendienteCorte
        ? "border-yellow-200 bg-yellow-50"
        : "border-slate-200 bg-white",
    },
    {
      title: "Pend. cierre",
      value: metrics.pendienteCierre,
      icon: TrendingUp,
      href: `/admin/tabla?fecha=${fecha}&estado=Pendiente%20cierre`,
      tone: metrics.pendienteCierre
        ? "border-yellow-200 bg-yellow-50"
        : "border-slate-200 bg-white",
    },
    {
      title: "Cumplimiento general",
      value: formatPercent(metrics.avg),
      icon: BarIcon,
      href: "/admin/avance",
      tone: advanceTone(metrics.avg),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-4xl xl:grid-cols-3">
            <div>
              <label htmlFor="dashboard-date" className="text-sm font-black">
                Fecha operativa
              </label>
              <Input
                id="dashboard-date"
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <label htmlFor="dashboard-supervisor" className="text-sm font-black">
                Supervisor
              </label>
              <Select
                id="dashboard-supervisor"
                value={selectedSupervisorId}
                onChange={(event) => {
                  setSelectedSupervisorId(event.target.value);
                  setSelectedKpiId("todos");
                }}
                className="mt-2"
              >
                <option value="todos">Todos los supervisores</option>
                {supervisores.map((supervisor) => (
                  <option key={supervisor.usuario_id} value={supervisor.usuario_id}>
                    {supervisor.codigo_operativo} · {supervisor.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="dashboard-kpi" className="text-sm font-black">
                Filtrar por KPI
              </label>
              <Select
                id="dashboard-kpi"
                value={selectedKpiId}
                onChange={(event) => setSelectedKpiId(event.target.value)}
                className="mt-2"
              >
                <option value="todos">Todos los KPI visibles</option>
                {scopedKpis.map((kpi) => (
                  <option key={kpi.id} value={kpi.id}>
                    {kpi.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={
                metrics.pendienteCompromiso > 0
                  ? "border-red-200 bg-red-100 text-red-700"
                  : "border-green-200 bg-green-100 text-green-700"
              }
            >
              {metrics.pendienteCompromiso > 0
                ? "Alerta: compromiso pendiente"
                : "Compromiso al día"}
            </Badge>
            {metrics.delta !== null ? (
              <Badge
                className={
                  metrics.delta >= 0
                    ? "border-green-200 bg-green-100 text-green-700"
                    : "border-red-200 bg-red-100 text-red-700"
                }
              >
                {metrics.delta >= 0 ? (
                  <ArrowUpRight className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="mr-1 h-3.5 w-3.5" />
                )}
                {Math.abs(Math.round(metrics.delta))}% vs. ayer
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Card
                className={cn(
                  "h-full transition hover:-translate-y-0.5 hover:shadow-lg",
                  card.tone,
                )}
              >
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-bold text-slate-600">
                    {card.title}
                  </CardTitle>
                  <Icon className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-9 w-24" />
                  ) : (
                    <div className="text-3xl font-black">{card.value}</div>
                  )}
                  <div className="mt-3 flex items-center gap-1 text-xs font-bold text-slate-500 opacity-80 transition group-hover:text-blue-700">
                    Ver detalle <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Avance de cumplimiento por zona</CardTitle>
            <CardDescription>
              Vista por zona y vendedor con compromiso, corte, cierre y avance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-full" />
                ))}
              </div>
            ) : avancePorZona.length ? (
              <div className="space-y-3">
                {avancePorZona.map((item) => (
                  <div
                    key={item.vendedorId}
                    className="grid gap-2 rounded-2xl border bg-white p-3 sm:grid-cols-[minmax(170px,240px)_minmax(160px,1fr)_minmax(210px,auto)_74px] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-700">
                        {item.zona}
                      </p>
                      <p className="truncate text-xs font-semibold text-slate-500">
                        {item.nombre}
                      </p>
                    </div>
                    <Progress
                      value={item.avance}
                      label={`Avance ${item.zona} ${item.nombre}`}
                    />
                    <div className="flex flex-wrap gap-1 sm:justify-end">
                      <NumberPill label="Comp" value={item.compromiso} />
                      <NumberPill label="Corte" value={item.corte} />
                      <NumberPill label="Cierre" value={item.cierre} />
                    </div>
                    <span
                      className={`w-fit rounded-full border px-2 py-1 text-xs font-black sm:ml-auto ${advanceTone(item.avance)}`}
                    >
                      {advanceLabel(item.avance)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Alert tone="warning">
                No hay vendedores o KPI activos para mostrar avance.
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Semáforo del día</CardTitle>
            <CardDescription>
              Estado operativo de los vendedores.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.vendorStatus.slice(0, 10).map(({ vendedor, status }) => (
              <Link
                key={vendedor.id}
                href={`/admin/tabla?fecha=${fecha}&vendedor=${vendedor.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3 transition hover:bg-blue-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">
                    {vendedor.nombre}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    {vendedor.zona}
                  </p>
                </div>
                <Badge
                  className={
                    status === "Completo"
                      ? "border-green-200 bg-green-100 text-green-700"
                      : status === "Pendiente compromiso"
                        ? "border-red-200 bg-red-100 text-red-700"
                        : "border-yellow-200 bg-yellow-100 text-yellow-800"
                  }
                >
                  {status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendedores con menor avance</CardTitle>
          <CardDescription>
            Pasa el cursor para ver compromiso, corte, cierre y avance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={avancePorVendedor}
                layout="vertical"
                margin={{ left: 12, right: 28 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" unit="%" domain={[0, "dataMax"]} />
                <YAxis
                  dataKey="nombre"
                  type="category"
                  width={130}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<VendorTotalsTooltip />} />
                <Bar dataKey="avance" radius={[0, 8, 8, 0]}>
                  {avancePorVendedor.map((entry) => (
                    <Cell
                      key={entry.nombre}
                      className={
                        entry.avance <= 50
                          ? "fill-red-500"
                          : entry.avance <= 85
                            ? "fill-yellow-500"
                            : "fill-green-500"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BarIcon(props: SVGProps<SVGSVGElement>) {
  return <Activity {...props} />;
}
