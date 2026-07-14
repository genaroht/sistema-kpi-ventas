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
import { ChartCard } from "@/components/charts/chart-card";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { summarizeSupervisor } from "@/lib/manager-analytics";
import { formatPercent, todayInLima } from "@/lib/utils";
import { useManagerData } from "@/components/gerente/use-manager-data";

const seriesColors = [
  "#1d4ed8",
  "#16a34a",
  "#eab308",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
];
const trafficColors: Record<string, string> = {
  verde: "#22c55e",
  amarillo: "#eab308",
  rojo: "#ef4444",
  gris: "#94a3b8",
};

function addDays(date: string, days: number) {
  const current = new Date(`${date}T00:00:00`);
  current.setDate(current.getDate() + days);
  return current.toISOString().slice(0, 10);
}

export function ManagerProgress({ managerId }: { managerId: string }) {
  const [fecha, setFecha] = useState(todayInLima());
  const [supervisorId, setSupervisorId] = useState("todos");
  const [kpiName, setKpiName] = useState("todos");
  const data = useManagerData({ managerId, fecha, trendDays: 7 });
  const hasSpecificKpi = kpiName !== "todos";

  const filteredSupervisors = useMemo(
    () =>
      data.supervisores.filter(
        (item) => supervisorId === "todos" || item.usuario_id === supervisorId,
      ),
    [data.supervisores, supervisorId],
  );

  const kpiOptions = useMemo(() => {
    const source =
      supervisorId === "todos"
        ? data.kpis
        : data.kpis.filter((item) => item.jefe_id === supervisorId);
    return Array.from(new Set(source.map((item) => item.nombre))).sort((a, b) =>
      a.localeCompare(b, "es"),
    );
  }, [data.kpis, supervisorId]);

  useEffect(() => {
    if (kpiName !== "todos" && !kpiOptions.includes(kpiName))
      setKpiName("todos");
  }, [kpiName, kpiOptions]);

  const summaries = useMemo(
    () =>
      filteredSupervisors
        .map((supervisor) => {
          const vendedores = data.vendedores.filter(
            (item) => item.jefe_id === supervisor.usuario_id,
          );
          const kpis = hasSpecificKpi
            ? data.kpis.filter(
                (item) =>
                  item.jefe_id === supervisor.usuario_id &&
                  item.nombre === kpiName,
              )
            : [];
          const vendorIds = new Set(vendedores.map((item) => item.id));
          const kpiIds = new Set(kpis.map((item) => item.id));
          const registros = data.registros.filter(
            (item) =>
              vendorIds.has(item.vendedor_id) && kpiIds.has(item.kpi_id),
          );
          const habilitacion =
            data.habilitaciones.find(
              (item) => item.jefe_id === supervisor.usuario_id,
            ) ?? null;
          return summarizeSupervisor({
            supervisor,
            vendedores,
            kpis,
            registros,
            habilitacion,
          });
        })
        .sort((a, b) => b.avance - a.avance),
    [
      data.habilitaciones,
      data.kpis,
      data.registros,
      data.vendedores,
      filteredSupervisors,
      hasSpecificKpi,
      kpiName,
    ],
  );

  const total = useMemo(() => {
    const compromiso = summaries.reduce(
      (sum, item) => sum + item.compromiso,
      0,
    );
    const logrado = summaries.reduce((sum, item) => sum + item.logrado, 0);
    return {
      compromiso,
      corte: summaries.reduce((sum, item) => sum + item.corte, 0),
      cierre: summaries.reduce((sum, item) => sum + item.cierre, 0),
      avance: compromiso > 0 ? (logrado / compromiso) * 100 : 0,
    };
  }, [summaries]);

  const trendData = useMemo(() => {
    const dates = Array.from({ length: 7 }, (_, index) =>
      addDays(fecha, index - 6),
    );
    return dates.map((date) => {
      const point: Record<string, string | number> = {
        fecha: date.slice(5).split("-").reverse().join("/"),
      };
      filteredSupervisors.forEach((supervisor) => {
        const vendedores = data.vendedores.filter(
          (item) => item.jefe_id === supervisor.usuario_id,
        );
        const kpis = hasSpecificKpi
          ? data.kpis.filter(
              (item) =>
                item.jefe_id === supervisor.usuario_id &&
                item.nombre === kpiName,
            )
          : [];
        const vendorIds = new Set(vendedores.map((item) => item.id));
        const kpiIds = new Set(kpis.map((item) => item.id));
        const registros = data.trendRegistros.filter(
          (item) =>
            item.fecha === date &&
            vendorIds.has(item.vendedor_id) &&
            kpiIds.has(item.kpi_id),
        );
        const habilitacion =
          data.habilitaciones.find(
            (item) => item.jefe_id === supervisor.usuario_id,
          ) ?? null;
        const summary = summarizeSupervisor({
          supervisor,
          vendedores,
          kpis,
          registros,
          habilitacion,
        });
        point[supervisor.codigo_operativo] =
          Math.round(summary.avance * 10) / 10;
      });
      return point;
    });
  }, [
    data.habilitaciones,
    data.kpis,
    data.trendRegistros,
    data.vendedores,
    fecha,
    filteredSupervisors,
    hasSpecificKpi,
    kpiName,
  ]);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="grid gap-3 pt-5 md:grid-cols-3">
          <div>
            <label
              htmlFor="progress-date"
              className="text-xs font-black text-slate-600"
            >
              Fecha
            </label>
            <Input
              id="progress-date"
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label
              htmlFor="progress-supervisor"
              className="text-xs font-black text-slate-600"
            >
              Supervisor
            </label>
            <Select
              id="progress-supervisor"
              value={supervisorId}
              onChange={(event) => setSupervisorId(event.target.value)}
              className="mt-1"
            >
              <option value="todos">Todos mis supervisores</option>
              {data.supervisores.map((item) => (
                <option key={item.usuario_id} value={item.usuario_id}>
                  {item.codigo_operativo} · {item.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label
              htmlFor="progress-kpi"
              className="text-xs font-black text-slate-600"
            >
              KPI
            </label>
            <Select
              id="progress-kpi"
              value={kpiName}
              onChange={(event) => setKpiName(event.target.value)}
              className="mt-1"
            >
              <option value="todos">Todos los KPI</option>
              {kpiOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {data.error ? <Alert tone="error">{data.error}</Alert> : null}

      {!hasSpecificKpi ? (
        <Alert tone="warning">
          Selecciona un KPI para visualizar cantidades, porcentajes, ranking y
          tendencia. No se consolidan KPI con unidades diferentes.
        </Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Compromiso", total.compromiso.toLocaleString("es-PE")],
              ["RAD 1:45 pm", total.corte.toLocaleString("es-PE")],
              ["Cierre", total.cierre.toLocaleString("es-PE")],
              ["Avance global", formatPercent(total.avance)],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="pt-5">
                  <p className="text-sm font-bold text-slate-500">{label}</p>
                  {data.loading ? (
                    <Skeleton className="mt-2 h-9 w-28" />
                  ) : (
                    <p className="mt-1 text-3xl font-black text-blue-800">
                      {value}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ChartCard
              title="Avance por supervisor"
              description="Comparación del porcentaje operativo por equipo."
            >
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summaries}
                    layout="vertical"
                    margin={{ left: 20, right: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" unit="%" domain={[0, "dataMax"]} />
                    <YAxis
                      dataKey="supervisorCode"
                      type="category"
                      width={60}
                    />
                    <Tooltip
                      formatter={(value: any) => formatPercent(Number(value))}
                    />
                    <Bar dataKey="avance" radius={[0, 8, 8, 0]}>
                      {summaries.map((item) => (
                        <Cell
                          key={item.supervisorId}
                          fill={trafficColors[item.semaforo]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title="Ranking de supervisores"
              description="Posición por avance y cierre del día."
            >
              <div className="space-y-2">
                {data.loading ? (
                  <Skeleton className="h-80 w-full" />
                ) : (
                  summaries.map((item, index) => (
                    <div
                      key={item.supervisorId}
                      className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-black">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-black">
                            {item.supervisorCode} · {item.supervisorName}
                          </p>
                          <p className="text-xs text-slate-500">
                            Cierre {item.cierre.toLocaleString("es-PE")}
                          </p>
                        </div>
                      </div>
                      <span className="font-black text-blue-700">
                        {formatPercent(item.avance)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ChartCard>
          </div>

          <ChartCard
            title="Compromiso vs RAD vs Cierre"
            description="Resultados consolidados por supervisor."
          >
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summaries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="supervisorCode" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="compromiso"
                    name="Compromiso"
                    fill="#1d4ed8"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="corte"
                    name="RAD 1:45 pm"
                    fill="#eab308"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="cierre"
                    name="Cierre"
                    fill="#16a34a"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title="Tendencia diaria por supervisor"
            description="Avance operativo de los últimos siete días."
          >
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis unit="%" domain={[0, "auto"]} />
                  <Tooltip
                    formatter={(value: any) => formatPercent(Number(value))}
                  />
                  <Legend />
                  {filteredSupervisors.map((item, index) => (
                    <Line
                      key={item.usuario_id}
                      type="monotone"
                      dataKey={item.codigo_operativo}
                      name={`${item.codigo_operativo} · ${item.nombre}`}
                      stroke={seriesColors[index % seriesColors.length]}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}
