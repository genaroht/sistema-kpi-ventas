"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/browser";
import {
  advanceLabel,
  advanceTone,
  formatPercent,
  todayInLima,
} from "@/lib/utils";
import { buildAvanceRows } from "@/lib/kpi-transform";
import type {
  AvanceRow,
  Kpi,
  RegistroKpi,
  Supervisor,
  Vendedor,
} from "@/types/database";
import { ChartCard } from "@/components/charts/chart-card";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type TotalsRow = {
  vendedorId?: string;
  nombre?: string;
  kpi?: string;
  zona?: string;
  supervisor?: string;
  compromiso: number;
  corte: number;
  cierre: number;
  avance: number;
};

type TooltipProps<T> = {
  active?: boolean;
  payload?: Array<{ payload: T; name?: string; value?: number | string }>;
  label?: string;
};

function addDays(date: string, days: number) {
  const current = new Date(`${date}T00:00:00`);
  current.setDate(current.getDate() + days);
  return current.toISOString().slice(0, 10);
}

function aggregateRows(rows: AvanceRow[]) {
  const compromiso = rows.reduce((total, row) => total + row.compromiso, 0);
  const corte = rows.reduce((total, row) => total + row.corte, 0);
  const cierre = rows.reduce((total, row) => total + row.cierre, 0);
  const logrado = rows.reduce((total, row) => {
    if (row.estado === "Completo") return total + row.cierre;
    if (row.estado === "Pendiente cierre") return total + row.corte;
    return total;
  }, 0);
  return {
    compromiso,
    corte,
    cierre,
    avance: compromiso > 0 ? Math.round((logrado / compromiso) * 100) : 0,
  };
}

function TotalsTooltip({ active, payload, label }: TooltipProps<TotalsRow>) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-2xl border bg-white p-3 text-xs shadow-xl">
      <p className="font-black text-slate-950">
        {row.nombre ?? row.kpi ?? label}
      </p>
      {row.zona ? (
        <p className="font-semibold text-slate-500">Zona {row.zona}</p>
      ) : null}
      {row.supervisor ? (
        <p className="mb-2 font-semibold text-slate-500">{row.supervisor}</p>
      ) : null}
      <div className="mt-2 space-y-1 font-bold text-slate-700">
        <p>Compromiso: {row.compromiso.toLocaleString("es-PE")}</p>
        <p>RAD 1:45 pm: {row.corte.toLocaleString("es-PE")}</p>
        <p>Cierre: {row.cierre.toLocaleString("es-PE")}</p>
        <p className="text-blue-700">Avance: {row.avance}%</p>
      </div>
    </div>
  );
}

function CompromisoCierreTooltip({
  active,
  payload,
  label,
}: TooltipProps<TotalsRow>) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-2xl border bg-white p-3 text-xs shadow-xl">
      <p className="mb-2 font-black text-slate-950">{row.kpi ?? label}</p>
      <p className="font-bold text-slate-700">
        Compromiso: {row.compromiso.toLocaleString("es-PE")}
      </p>
      <p className="font-bold text-slate-700">
        Cierre: {row.cierre.toLocaleString("es-PE")}
      </p>
    </div>
  );
}

export function AvanceDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [fecha, setFecha] = useState(todayInLima());
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);
  const [registros, setRegistros] = useState<RegistroKpi[]>([]);
  const [trendRegistros, setTrendRegistros] = useState<RegistroKpi[]>([]);
  const [selectedKpi, setSelectedKpi] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasSpecificKpi = selectedKpi !== "todos";

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError("");
      const desde = addDays(fecha, -6);
      const [vRes, kRes, sRes, dayRes, trendRes] = await Promise.all([
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
          .gte("fecha", desde)
          .lte("fecha", fecha),
      ]);
      if (ignore) return;
      const firstError =
        vRes.error ??
        kRes.error ??
        sRes.error ??
        dayRes.error ??
        trendRes.error;
      if (firstError) setError("No se pudo cargar la vista de avance.");
      setVendedores((vRes.data ?? []) as Vendedor[]);
      setKpis((kRes.data ?? []) as Kpi[]);
      setSupervisores((sRes.data ?? []) as Supervisor[]);
      setRegistros((dayRes.data ?? []) as RegistroKpi[]);
      setTrendRegistros((trendRes.data ?? []) as RegistroKpi[]);
      setLoading(false);
    }
    load();
    return () => {
      ignore = true;
    };
  }, [fecha, supabase]);

  useEffect(() => {
    if (
      selectedKpi !== "todos" &&
      !kpis.some((kpi) => kpi.id === selectedKpi)
    ) {
      setSelectedKpi("todos");
    }
  }, [kpis, selectedKpi]);

  const filteredKpis = useMemo(
    () =>
      selectedKpi === "todos"
        ? kpis
        : kpis.filter((kpi) => kpi.id === selectedKpi),
    [kpis, selectedKpi],
  );

  const selectedOwner =
    selectedKpi === "todos" ? null : (filteredKpis[0]?.jefe_id ?? null);
  const filteredVendedores = useMemo(
    () =>
      vendedores.filter(
        (vendedor) => !selectedOwner || vendedor.jefe_id === selectedOwner,
      ),
    [selectedOwner, vendedores],
  );

  const rows = useMemo(
    () =>
      buildAvanceRows({
        fecha,
        vendedores: filteredVendedores,
        kpis: filteredKpis,
        registros,
      }),
    [fecha, filteredKpis, filteredVendedores, registros],
  );

  const supervisorMap = useMemo(
    () =>
      new Map(
        supervisores.map((item) => [
          item.usuario_id,
          `${item.codigo_operativo} · ${item.nombre}`,
        ]),
      ),
    [supervisores],
  );

  const avancePorVendedor = useMemo<TotalsRow[]>(
    () =>
      hasSpecificKpi
        ? filteredVendedores
            .map((vendedor) => ({
              vendedorId: vendedor.id,
              nombre: vendedor.nombre,
              zona: vendedor.zona,
              supervisor: supervisorMap.get(vendedor.jefe_id),
              ...aggregateRows(
                rows.filter((row) => row.vendedor_id === vendedor.id),
              ),
            }))
            .sort(
              (a, b) =>
                b.avance - a.avance ||
                (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"),
            )
        : [],
    [filteredVendedores, rows, supervisorMap, hasSpecificKpi],
  );

  const compromisoVsCierre = useMemo<TotalsRow[]>(
    () =>
      hasSpecificKpi
        ? filteredKpis.map((kpi) => ({
            kpi: kpi.nombre,
            supervisor: supervisorMap.get(kpi.jefe_id),
            ...aggregateRows(rows.filter((row) => row.kpi_id === kpi.id)),
          }))
        : [],
    [filteredKpis, rows, supervisorMap, hasSpecificKpi],
  );

  const daySummary = useMemo(
    () => (hasSpecificKpi ? aggregateRows(rows) : null),
    [hasSpecificKpi, rows],
  );

  const heatmapGroups = useMemo(
    () =>
      supervisores
        .map((supervisor) => ({
          supervisor,
          vendedores: filteredVendedores.filter(
            (vendedor) => vendedor.jefe_id === supervisor.usuario_id,
          ),
          kpis: filteredKpis.filter(
            (kpi) => kpi.jefe_id === supervisor.usuario_id,
          ),
        }))
        .filter(
          (group) => group.vendedores.length > 0 && group.kpis.length > 0,
        ),
    [filteredKpis, filteredVendedores, supervisores],
  );

  const trendRows = useMemo(() => {
    if (!hasSpecificKpi) return [];
    const dates = Array.from({ length: 7 }, (_, index) =>
      addDays(fecha, index - 6),
    );
    return dates.map((date) => {
      const dateRegistros = trendRegistros.filter((row) => row.fecha === date);
      const dateRows = buildAvanceRows({
        fecha: date,
        vendedores: filteredVendedores,
        kpis: filteredKpis,
        registros: dateRegistros,
      });
      const totals = aggregateRows(dateRows);
      return {
        fecha: date.slice(5).split("-").reverse().join("/"),
        avance: totals.avance,
        compromiso: totals.compromiso,
        cierre: totals.cierre,
      };
    });
  }, [fecha, filteredKpis, filteredVendedores, trendRegistros, hasSpecificKpi]);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="grid gap-3 pt-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="advance-date"
              className="text-xs font-black text-slate-600"
            >
              Fecha
            </label>
            <Input
              id="advance-date"
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label
              htmlFor="advance-kpi"
              className="text-xs font-black text-slate-600"
            >
              KPI
            </label>
            <Select
              id="advance-kpi"
              value={selectedKpi}
              onChange={(event) => setSelectedKpi(event.target.value)}
              className="mt-1"
            >
              <option value="todos">Todos los KPI</option>
              {kpis.map((kpi) => (
                <option key={kpi.id} value={kpi.id}>
                  {supervisores.length > 1
                    ? `${supervisorMap.get(kpi.jefe_id) ?? "Supervisor"} · `
                    : ""}
                  {kpi.nombre}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {!hasSpecificKpi ? (
        <Alert tone="warning">
          Selecciona un KPI para visualizar cantidades, porcentajes, rankings y
          gráficos. El mapa de calor se mantiene porque muestra cada KPI por
          separado y no mezcla sus unidades.
        </Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-bold text-slate-500">
                  Cierre del día
                </p>
                {loading ? (
                  <Skeleton className="mt-2 h-9 w-32" />
                ) : (
                  <p className="mt-1 text-3xl font-black text-slate-950">
                    {daySummary?.cierre.toLocaleString("es-PE") ?? "—"}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-bold text-slate-500">Alcance %</p>
                {loading ? (
                  <Skeleton className="mt-2 h-9 w-40" />
                ) : (
                  <p className="mt-1 text-3xl font-black text-blue-700">
                    {formatPercent(daySummary?.avance)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <ChartCard
            title="Avance por vendedor"
            description="Cumplimiento del día para el KPI seleccionado."
          >
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={avancePorVendedor}
                  layout="vertical"
                  margin={{ left: 20, right: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, "dataMax"]} unit="%" />
                  <YAxis
                    dataKey="nombre"
                    type="category"
                    width={130}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip content={<TotalsTooltip />} />
                  <Bar dataKey="avance" radius={[0, 8, 8, 0]}>
                    {avancePorVendedor.map((entry) => (
                      <Cell
                        key={entry.vendedorId}
                        className={
                          entry.avance < 51
                            ? "fill-red-500"
                            : entry.avance < 86
                              ? "fill-yellow-500"
                              : "fill-green-500"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid gap-5 xl:grid-cols-2">
            <ChartCard
              title="Ranking de vendedores"
              description="Ordenado de mayor a menor cumplimiento."
            >
              <div className="max-h-[430px] space-y-2 overflow-auto pr-1">
                {avancePorVendedor.map((item, index) => (
                  <div
                    key={item.vendedorId}
                    className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 font-black">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold">{item.nombre}</p>
                        <p className="truncate text-xs text-slate-500">
                          {item.zona} · {item.supervisor}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-1 text-xs font-black ${advanceTone(item.avance)}`}
                    >
                      {advanceLabel(item.avance)}
                    </span>
                  </div>
                ))}
              </div>
            </ChartCard>

            <ChartCard
              title="Compromiso vs cierre"
              description="Comparación agregada por KPI."
            >
              <div className="h-[430px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compromisoVsCierre}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="kpi"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip content={<CompromisoCierreTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="compromiso"
                      name="Compromiso"
                      fill="#1d4ed8"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      dataKey="cierre"
                      name="Cierre"
                      fill="#f59e0b"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </>
      )}

      <ChartCard
        title="Mapa de calor KPI x vendedor"
        description="Vista global separada por supervisor."
      >
        {heatmapGroups.length === 0 ? (
          <Alert tone="warning">
            No hay datos visibles para construir el mapa de calor.
          </Alert>
        ) : (
          <div className="space-y-5">
            {heatmapGroups.map(
              ({ supervisor, vendedores: teamVendedores, kpis: teamKpis }) => (
                <section
                  key={supervisor.usuario_id}
                  className="overflow-hidden rounded-2xl border"
                >
                  <div className="bg-slate-100 px-4 py-3 font-black text-slate-800">
                    {supervisor.codigo_operativo} · {supervisor.nombre}
                  </div>
                  <div className="kpi-scrollbar overflow-auto">
                    <table className="min-w-max border-separate border-spacing-0 text-xs">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 bg-white p-2 text-left">
                            Vendedor
                          </th>
                          {teamKpis.map((kpi) => (
                            <th key={kpi.id} className="p-2 text-left">
                              {kpi.nombre}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {teamVendedores.map((vendedor) => (
                          <tr key={vendedor.id}>
                            <td className="sticky left-0 z-10 border-t bg-white p-2 font-bold">
                              {vendedor.nombre}
                            </td>
                            {teamKpis.map((kpi) => {
                              const value = rows.find(
                                (row) =>
                                  row.vendedor_id === vendedor.id &&
                                  row.kpi_id === kpi.id,
                              )?.avance;
                              return (
                                <td key={kpi.id} className="border-t p-2">
                                  <span
                                    className={`block rounded-lg border px-2 py-1 text-center font-black ${advanceTone(value)}`}
                                  >
                                    {value == null ? "SC" : Math.round(value)}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ),
            )}
          </div>
        )}
      </ChartCard>

      {hasSpecificKpi ? (
        <ChartCard
          title="Tendencia por días"
          description="Evolución de los últimos 7 días hasta la fecha seleccionada."
        >
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" />
                <YAxis unit="%" />
                <Tooltip formatter={(value) => `${value}%`} />
                <Line
                  type="monotone"
                  dataKey="avance"
                  name="Avance"
                  strokeWidth={3}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      ) : null}
    </div>
  );
}
