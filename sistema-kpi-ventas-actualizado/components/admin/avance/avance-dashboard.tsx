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
  calcPercent,
  formatPercent,
  todayInLima,
} from "@/lib/utils";
import { buildAvanceRows } from "@/lib/kpi-transform";
import type { AvanceRow, Kpi, RegistroKpi, Supervisor, Vendedor } from "@/types/database";
import { ChartCard } from "@/components/charts/chart-card";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type TotalsRow = {
  nombre?: string;
  kpi?: string;
  zona?: string;
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

function aggregateRows(rows: AvanceRow[]) {
  const values = rows
    .map((row) => row.avance)
    .filter((value): value is number => value !== null);
  return {
    compromiso: rows.reduce((total, row) => total + row.compromiso, 0),
    corte: rows.reduce((total, row) => total + row.corte, 0),
    cierre: rows.reduce((total, row) => total + row.cierre, 0),
    avance: values.length
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : 0,
  };
}

function TotalsTooltip({ active, payload, label }: TooltipProps<TotalsRow>) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const title = row.nombre ?? row.kpi ?? label ?? "Detalle";

  return (
    <div className="rounded-2xl border bg-white p-3 text-xs shadow-xl">
      <p className="font-black text-slate-950">{title}</p>
      {row.zona ? (
        <p className="mb-2 font-semibold text-slate-500">Zona {row.zona}</p>
      ) : null}
      <div className="space-y-1 font-bold text-slate-700">
        <p>Compromiso: {row.compromiso.toLocaleString("es-PE")}</p>
        <p>Corte: {row.corte.toLocaleString("es-PE")}</p>
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
}: TooltipProps<{
  kpi: string;
  compromiso: number;
  corte: number;
  cierre: number;
}>) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div className="rounded-2xl border bg-white p-3 text-xs shadow-xl">
      <p className="mb-2 font-black text-slate-950">{row.kpi ?? label}</p>
      <div className="space-y-1 font-bold text-slate-700">
        <p>Compromiso: {row.compromiso.toLocaleString("es-PE")}</p>
        <p>Corte: {row.corte.toLocaleString("es-PE")}</p>
        <p>Cierre: {row.cierre.toLocaleString("es-PE")}</p>
      </div>
    </div>
  );
}

export function AvanceDashboard() {
  const supabase = createClient();
  const [fecha, setFecha] = useState(todayInLima());
  const [desde, setDesde] = useState(todayInLima());
  const [hasta, setHasta] = useState(todayInLima());
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);
  const [registros, setRegistros] = useState<RegistroKpi[]>([]);
  const [trendRegistros, setTrendRegistros] = useState<RegistroKpi[]>([]);
  const [selectedVendedor, setSelectedVendedor] = useState("todos");
  const [selectedZona, setSelectedZona] = useState("todos");
  const [selectedKpi, setSelectedKpi] = useState("todos");
  const [selectedSupervisor, setSelectedSupervisor] = useState("todos");
  const [trendVendedor, setTrendVendedor] = useState("");
  const [trendKpi, setTrendKpi] = useState("");

  useEffect(() => {
    async function loadBase() {
      const [vRes, kRes, sRes] = await Promise.all([
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
      ]);
      const vData = (vRes.data ?? []) as Vendedor[];
      const kData = (kRes.data ?? []) as Kpi[];
      setVendedores(vData);
      setKpis(kData);
      setSupervisores((sRes.data ?? []) as Supervisor[]);
      setTrendVendedor((prev) => prev || vData[0]?.id || "");
      setTrendKpi((prev) => prev || kData[0]?.id || "");
    }
    loadBase();
  }, [supabase]);

  useEffect(() => {
    async function loadDaily() {
      const { data } = await supabase
        .from("registros_kpi")
        .select("id,fecha,vendedor_id,kpi_id,etapa,cantidad,created_at")
        .eq("fecha", fecha);
      setRegistros((data ?? []) as RegistroKpi[]);
    }
    loadDaily();
  }, [fecha, supabase]);

  useEffect(() => {
    async function loadTrend() {
      const { data } = await supabase
        .from("registros_kpi")
        .select("id,fecha,vendedor_id,kpi_id,etapa,cantidad,created_at")
        .gte("fecha", desde)
        .lte("fecha", hasta);
      setTrendRegistros((data ?? []) as RegistroKpi[]);
    }
    loadTrend();
  }, [desde, hasta, supabase]);

  const scopedVendedores = useMemo(
    () => vendedores.filter((item) => selectedSupervisor === "todos" || item.jefe_id === selectedSupervisor),
    [selectedSupervisor, vendedores],
  );

  const scopedKpis = useMemo(
    () => kpis.filter((item) => selectedSupervisor === "todos" || item.jefe_id === selectedSupervisor),
    [kpis, selectedSupervisor],
  );

  const trendKpisForVendor = useMemo(() => {
    const ownerId = scopedVendedores.find((item) => item.id === trendVendedor)?.jefe_id;
    return ownerId ? scopedKpis.filter((item) => item.jefe_id === ownerId) : [];
  }, [scopedKpis, scopedVendedores, trendVendedor]);

  useEffect(() => {
    const firstVendor = scopedVendedores[0]?.id ?? "";
    const firstKpi = trendKpisForVendor[0]?.id ?? "";
    if (!scopedVendedores.some((item) => item.id === trendVendedor)) setTrendVendedor(firstVendor);
    if (!trendKpisForVendor.some((item) => item.id === trendKpi)) setTrendKpi(firstKpi);
    if (selectedVendedor !== "todos" && !scopedVendedores.some((item) => item.id === selectedVendedor)) setSelectedVendedor("todos");
    if (selectedKpi !== "todos" && !scopedKpis.some((item) => item.id === selectedKpi)) setSelectedKpi("todos");
  }, [scopedKpis, scopedVendedores, selectedKpi, selectedVendedor, trendKpi, trendKpisForVendor, trendVendedor]);

  const rows = useMemo(
    () => buildAvanceRows({ fecha, vendedores: scopedVendedores, kpis: scopedKpis, registros }),
    [fecha, scopedVendedores, scopedKpis, registros],
  );
  const zonas = useMemo(
    () => [...new Set(scopedVendedores.map((v) => v.zona))].sort(),
    [scopedVendedores],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (
          selectedVendedor !== "todos" &&
          row.vendedor_id !== selectedVendedor
        )
          return false;
        if (selectedZona !== "todos" && row.zona !== selectedZona) return false;
        if (selectedKpi !== "todos" && row.kpi_id !== selectedKpi) return false;
        return true;
      }),
    [rows, selectedKpi, selectedVendedor, selectedZona],
  );

  const avancePorVendedor = useMemo<TotalsRow[]>(
    () => {
      const selectedKpiOwner = selectedKpi === "todos"
        ? null
        : scopedKpis.find((item) => item.id === selectedKpi)?.jefe_id;
      return scopedVendedores
        .filter((v) => !selectedKpiOwner || v.jefe_id === selectedKpiOwner)
        .filter((v) => selectedZona === "todos" || v.zona === selectedZona)
        .map((v) => {
          const vendorRows = rows.filter(
            (row) =>
              row.vendedor_id === v.id &&
              (selectedKpi === "todos" || row.kpi_id === selectedKpi),
          );
          return {
            nombre: v.nombre,
            zona: v.zona,
            ...aggregateRows(vendorRows),
          };
        })
        .sort((a, b) => b.avance - a.avance);
    },
    [rows, scopedKpis, scopedVendedores, selectedKpi, selectedZona],
  );

  const incumplimientoKpi = useMemo<TotalsRow[]>(
    () => {
      const selectedVendorOwner = selectedVendedor === "todos"
        ? null
        : scopedVendedores.find((item) => item.id === selectedVendedor)?.jefe_id;
      return scopedKpis
        .filter((kpi) => !selectedVendorOwner || kpi.jefe_id === selectedVendorOwner)
        .map((kpi) => {
          const kpiRows = rows.filter(
            (row) =>
              row.kpi_id === kpi.id &&
              (selectedZona === "todos" || row.zona === selectedZona) &&
              (selectedVendedor === "todos" ||
                row.vendedor_id === selectedVendedor),
          );
          return { kpi: kpi.nombre, ...aggregateRows(kpiRows) };
        })
        .sort((a, b) => a.avance - b.avance)
        .slice(0, 8);
    },
    [rows, scopedKpis, scopedVendedores, selectedVendedor, selectedZona],
  );

  const compromisoVsCierre = useMemo(
    () => [
      ...filteredRows
        .reduce((acc, row) => {
          const current = acc.get(row.kpi) ?? {
            kpi: row.kpi,
            compromiso: 0,
            corte: 0,
            cierre: 0,
          };
          current.compromiso += row.compromiso;
          current.corte += row.corte;
          current.cierre += row.cierre;
          acc.set(row.kpi, current);
          return acc;
        }, new Map<string, { kpi: string; compromiso: number; corte: number; cierre: number }>())
        .values(),
    ],
    [filteredRows],
  );

  const trendRows = useMemo(() => {
    if (!trendVendedor || !trendKpi) return [];
    const dates = [...new Set(trendRegistros.map((r) => r.fecha))].sort();
    return dates.map((date) => {
      const list = trendRegistros.filter(
        (r) =>
          r.fecha === date &&
          r.vendedor_id === trendVendedor &&
          r.kpi_id === trendKpi,
      );
      const compromiso =
        list.find((r) => r.etapa === "compromiso")?.cantidad ?? 0;
      const cierre = list.find((r) => r.etapa === "cierre")?.cantidad ?? 0;
      return {
        fecha: date,
        avance: Math.round(calcPercent(cierre, compromiso) ?? 0),
      };
    });
  }, [trendRegistros, trendVendedor, trendKpi]);

  const daySummary = useMemo(() => {
    const compromiso = filteredRows.reduce((total, row) => total + row.compromiso, 0);
    const cierre = filteredRows.reduce((total, row) => total + row.cierre, 0);
    return { cierre, alcance: calcPercent(cierre, compromiso) };
  }, [filteredRows]);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="grid gap-3 pt-5 md:grid-cols-3 xl:grid-cols-5">
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <Select
            value={selectedSupervisor}
            onChange={(e) => {
              setSelectedSupervisor(e.target.value);
              setSelectedZona("todos");
              setSelectedVendedor("todos");
              setSelectedKpi("todos");
            }}
          >
            <option value="todos">Todos los supervisores</option>
            {supervisores.map((supervisor) => (
              <option key={supervisor.usuario_id} value={supervisor.usuario_id}>
                {supervisor.codigo_operativo} · {supervisor.nombre}
              </option>
            ))}
          </Select>
          <Select
            value={selectedZona}
            onChange={(e) => setSelectedZona(e.target.value)}
          >
            <option value="todos">Todas las zonas</option>
            {zonas.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
          <Select
            value={selectedVendedor}
            onChange={(e) => setSelectedVendedor(e.target.value)}
          >
            <option value="todos">Todos los vendedores</option>
            {scopedVendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </Select>
          <Select
            value={selectedKpi}
            onChange={(e) => setSelectedKpi(e.target.value)}
          >
            <option value="todos">Todos los KPI</option>
            {scopedKpis.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nombre}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-bold text-slate-500">Cierre del día</p>
            <p className="mt-1 text-3xl font-black text-slate-950">{daySummary.cierre.toLocaleString("es-PE")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-bold text-slate-500">Alcance %</p>
            <p className="mt-1 text-3xl font-black text-blue-700">{formatPercent(daySummary.alcance)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Avance por vendedor"
          description="Pasa el cursor para ver compromiso, corte, cierre y avance."
        >
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={avancePorVendedor}
                layout="vertical"
                margin={{ left: 20, right: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, "dataMax"]} unit="%" />
                <YAxis dataKey="nombre" type="category" width={110} />
                <Tooltip content={<TotalsTooltip />} />
                <Bar dataKey="avance" radius={[0, 8, 8, 0]}>
                  {avancePorVendedor.map((entry) => (
                    <Cell
                      key={entry.nombre}
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

        <ChartCard
          title="KPI con mayor incumplimiento"
          description="Pasa el cursor para ver compromiso, corte, cierre y avance."
        >
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={incumplimientoKpi}
                layout="vertical"
                margin={{ left: 20, right: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" unit="%" />
                <YAxis dataKey="kpi" type="category" width={140} />
                <Tooltip content={<TotalsTooltip />} />
                <Bar dataKey="avance" radius={[0, 8, 8, 0]}>
                  {incumplimientoKpi.map((entry) => (
                    <Cell
                      key={entry.kpi}
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
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Ranking de vendedores"
          description="Ordenado de mayor a menor cumplimiento."
        >
          <div className="space-y-2">
            {avancePorVendedor.map((item, index) => (
              <div
                key={item.nombre}
                className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3"
                title={`Compromiso: ${item.compromiso} · Corte: ${item.corte} · Cierre: ${item.cierre} · Avance: ${item.avance}%`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-black">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-bold">{item.nombre}</p>
                    <p className="text-xs text-slate-500">{item.zona}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-xs font-black ${advanceTone(item.avance)}`}
                >
                  {advanceLabel(item.avance)}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          title="Compromiso vs cierre"
          description="Comparación agregada por KPI con colores distintos."
        >
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compromisoVsCierre}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="kpi"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={90}
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

      <ChartCard
        title="Mapa de calor KPI x vendedor"
        description="Rojo bajo, amarillo medio y verde cumplido."
      >
        {selectedSupervisor === "todos" ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
            Selecciona un supervisor para ver el mapa de calor sin mezclar KPI de equipos diferentes.
          </div>
        ) : <div className="kpi-scrollbar overflow-auto">
          <table className="min-w-max border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white p-2 text-left">
                  Vendedor
                </th>
                {scopedKpis.map((k) => (
                  <th key={k.id} className="p-2 text-left">
                    {k.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scopedVendedores.map((v) => (
                <tr key={v.id}>
                  <td className="sticky left-0 z-10 border-t bg-white p-2 font-bold">
                    {v.nombre}
                  </td>
                  {scopedKpis.map((k) => {
                    const value = rows.find(
                      (r) => r.vendedor_id === v.id && r.kpi_id === k.id,
                    )?.avance;
                    return (
                      <td key={k.id} className="border-t p-2">
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
        </div>}
      </ChartCard>

      <ChartCard
        title="Tendencia por días"
        description="Selecciona vendedor y KPI para ver evolución del % de avance."
      >
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <Input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
          <Input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
          <Select
            value={trendVendedor}
            onChange={(e) => setTrendVendedor(e.target.value)}
          >
            {scopedVendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </Select>
          <Select
            value={trendKpi}
            onChange={(e) => setTrendKpi(e.target.value)}
          >
            {trendKpisForVendor.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nombre}
              </option>
            ))}
          </Select>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" />
              <YAxis unit="%" />
              <Tooltip formatter={(value) => `${value}%`} />
              <Line type="monotone" dataKey="avance" strokeWidth={3} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
