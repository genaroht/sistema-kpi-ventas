"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { Alert } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  summarizeSupervisor,
  trafficLightClasses,
  trafficLightLabel,
  type ManagerSupervisorSummary,
} from "@/lib/manager-analytics";
import { formatPercent, todayInLima } from "@/lib/utils";
import { useManagerData } from "@/components/gerente/use-manager-data";

const chartColors: Record<string, string> = {
  verde: "#22c55e",
  amarillo: "#eab308",
  rojo: "#ef4444",
  gris: "#94a3b8",
};

function MetricCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-5">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-9 w-24" />
          ) : (
            <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
          )}
        </div>
        <Icon className="h-5 w-5 text-blue-600" />
      </CardContent>
    </Card>
  );
}

function SupervisorTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ManagerSupervisorSummary;
  return (
    <div className="rounded-xl border bg-white p-3 text-sm shadow-xl">
      <p className="font-black">
        {row.supervisorCode} · {row.supervisorName}
      </p>
      <p>Vendedores: {row.vendedores}</p>
      <p>Compromiso: {row.compromiso.toLocaleString("es-PE")}</p>
      <p>RAD 1:45 pm: {row.corte.toLocaleString("es-PE")}</p>
      <p>Cierre: {row.cierre.toLocaleString("es-PE")}</p>
      <p className="font-black">Avance: {formatPercent(row.avance)}</p>
    </div>
  );
}

export function ManagerDashboard({ managerId }: { managerId: string }) {
  const [fecha, setFecha] = useState(todayInLima());
  const [supervisorId, setSupervisorId] = useState("todos");
  const [kpiName, setKpiName] = useState("todos");
  const data = useManagerData({ managerId, fecha });
  const hasSpecificKpi = kpiName !== "todos";

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

  const summaries = useMemo(() => {
    return data.supervisores
      .filter(
        (supervisor) =>
          supervisorId === "todos" || supervisor.usuario_id === supervisorId,
      )
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
          (item) => vendorIds.has(item.vendedor_id) && kpiIds.has(item.kpi_id),
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
      .sort((a, b) =>
        hasSpecificKpi
          ? b.avance - a.avance ||
            a.supervisorName.localeCompare(b.supervisorName, "es")
          : a.supervisorCode.localeCompare(b.supervisorCode, "es"),
      );
  }, [
    data.habilitaciones,
    data.kpis,
    data.registros,
    data.supervisores,
    data.vendedores,
    hasSpecificKpi,
    kpiName,
    supervisorId,
  ]);

  const totals = useMemo(() => {
    const compromiso = summaries.reduce(
      (sum, item) => sum + item.compromiso,
      0,
    );
    const logrado = summaries.reduce((sum, item) => sum + item.logrado, 0);
    return {
      supervisores: summaries.length,
      vendedores: summaries.reduce((sum, item) => sum + item.vendedores, 0),
      avance: compromiso > 0 ? (logrado / compromiso) * 100 : 0,
      alDia: summaries.filter((item) => item.semaforo === "verde").length,
    };
  }, [summaries]);

  const bestSupervisor = hasSpecificKpi ? (summaries[0] ?? null) : null;
  const highestClose = hasSpecificKpi
    ? ([...summaries].sort((a, b) => b.cierre - a.cierre)[0] ?? null)
    : null;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="grid gap-3 pt-5 md:grid-cols-3">
          <div>
            <label
              htmlFor="manager-date"
              className="text-xs font-black text-slate-600"
            >
              Fecha
            </label>
            <Input
              id="manager-date"
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label
              htmlFor="manager-supervisor"
              className="text-xs font-black text-slate-600"
            >
              Supervisor
            </label>
            <Select
              id="manager-supervisor"
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
              htmlFor="manager-kpi"
              className="text-xs font-black text-slate-600"
            >
              KPI
            </label>
            <Select
              id="manager-kpi"
              value={kpiName}
              onChange={(event) => setKpiName(event.target.value)}
              className="mt-1"
            >
              <option value="todos">Todos los KPI visibles</option>
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
      {!data.loading && data.supervisores.length === 0 ? (
        <Alert tone="warning">
          No tienes supervisores asignados. El administrador debe asignarlos
          desde Usuarios.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Supervisores"
          value={String(totals.supervisores)}
          icon={Users}
          loading={data.loading}
        />
        <MetricCard
          label="Vendedores"
          value={String(totals.vendedores)}
          icon={Users}
          loading={data.loading}
        />
        <MetricCard
          label="Avance general"
          value={
            hasSpecificKpi ? formatPercent(totals.avance) : "Selecciona KPI"
          }
          icon={TrendingUp}
          loading={data.loading}
        />
        <MetricCard
          label="Supervisores al día"
          value={hasSpecificKpi ? String(totals.alDia) : "Selecciona KPI"}
          icon={CheckCircle2}
          loading={data.loading}
        />
      </div>

      {!hasSpecificKpi ? (
        <Alert tone="warning">
          Selecciona un KPI para visualizar cantidades, porcentajes, semáforos y
          rankings. La lista de supervisores permanece disponible para navegar
          al detalle de cada equipo.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {hasSpecificKpi
              ? "Avance por supervisor"
              : "Supervisores asignados"}
          </CardTitle>
          <CardDescription>
            {hasSpecificKpi
              ? "Resumen del KPI seleccionado por equipo."
              : "Selecciona un KPI para habilitar los resultados numéricos. Puedes entrar al detalle de cualquier supervisor."}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.loading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <table
              className={`w-full text-sm ${hasSpecificKpi ? "min-w-[850px]" : "min-w-[520px]"}`}
            >
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="p-3">Supervisor</th>
                  <th className="p-3 text-right">Vendedores</th>
                  {hasSpecificKpi ? (
                    <>
                      <th className="p-3 text-right">Compromiso</th>
                      <th className="p-3 text-right">RAD 1:45 pm</th>
                      <th className="p-3 text-right">Cierre</th>
                      <th className="p-3 text-right">Avance</th>
                      <th className="p-3">Estado</th>
                    </>
                  ) : null}
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {summaries.map((item) => (
                  <tr
                    key={item.supervisorId}
                    className="border-b hover:bg-blue-50/50"
                  >
                    <td className="p-3 font-black">
                      {item.supervisorCode} · {item.supervisorName}
                    </td>
                    <td className="p-3 text-right">{item.vendedores}</td>
                    {hasSpecificKpi ? (
                      <>
                        <td className="p-3 text-right font-bold">
                          {item.compromiso.toLocaleString("es-PE")}
                        </td>
                        <td className="p-3 text-right font-bold">
                          {item.corte.toLocaleString("es-PE")}
                        </td>
                        <td className="p-3 text-right font-bold">
                          {item.cierre.toLocaleString("es-PE")}
                        </td>
                        <td className="p-3 text-right font-black text-blue-700">
                          {formatPercent(item.avance)}
                        </td>
                        <td className="p-3">
                          <Badge className={trafficLightClasses(item.semaforo)}>
                            {trafficLightLabel(item.semaforo)}
                          </Badge>
                        </td>
                      </>
                    ) : null}
                    <td className="p-3 text-right">
                      <Link
                        className="inline-flex items-center gap-1 font-black text-blue-700 hover:underline"
                        href={`/admin/supervisores/${item.supervisorId}?fecha=${fecha}${kpiName !== "todos" ? `&kpi=${encodeURIComponent(kpiName)}` : ""}`}
                      >
                        Ver equipo <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {hasSpecificKpi ? (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <ChartCard
              title="Semáforo por supervisor"
              description="El estado se calcula con el resultado global de cada equipo."
            >
              <div className="space-y-2">
                {data.loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  summaries.map((item) => (
                    <Link
                      key={item.supervisorId}
                      href={`/admin/supervisores/${item.supervisorId}?fecha=${fecha}&kpi=${encodeURIComponent(kpiName)}`}
                      className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3 transition hover:border-blue-300 hover:shadow-sm"
                    >
                      <div>
                        <p className="font-black">
                          {item.supervisorCode} · {item.supervisorName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.vendedores} vendedores ·{" "}
                          {formatPercent(item.avance)}
                        </p>
                      </div>
                      <Badge className={trafficLightClasses(item.semaforo)}>
                        {trafficLightLabel(item.semaforo)}
                      </Badge>
                    </Link>
                  ))
                )}
              </div>
            </ChartCard>

            <ChartCard
              title="Ranking de supervisores"
              description="Ordenado de mayor a menor avance operativo."
            >
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summaries}
                    layout="vertical"
                    margin={{ left: 25, right: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" unit="%" domain={[0, "dataMax"]} />
                    <YAxis
                      dataKey="supervisorCode"
                      type="category"
                      width={55}
                    />
                    <Tooltip content={<SupervisorTooltip />} />
                    <Bar dataKey="avance" radius={[0, 8, 8, 0]}>
                      {summaries.map((item) => (
                        <Cell
                          key={item.supervisorId}
                          fill={chartColors[item.semaforo]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardContent className="flex items-center gap-4 pt-5">
                <Crown className="h-9 w-9 text-yellow-500" />
                <div>
                  <p className="text-sm font-bold text-slate-500">
                    Mejor supervisor del día
                  </p>
                  <p className="text-xl font-black">
                    {bestSupervisor
                      ? `${bestSupervisor.supervisorCode} · ${bestSupervisor.supervisorName}`
                      : "Sin datos"}
                  </p>
                  <p className="text-sm font-bold text-blue-700">
                    {bestSupervisor
                      ? formatPercent(bestSupervisor.avance)
                      : "0%"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-5">
                <Target className="h-9 w-9 text-blue-600" />
                <div>
                  <p className="text-sm font-bold text-slate-500">
                    Supervisor con mayor cierre
                  </p>
                  <p className="text-xl font-black">
                    {highestClose
                      ? `${highestClose.supervisorCode} · ${highestClose.supervisorName}`
                      : "Sin datos"}
                  </p>
                  <p className="text-sm font-bold text-blue-700">
                    {highestClose
                      ? highestClose.cierre.toLocaleString("es-PE")
                      : "0"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <ChartCard
            title="Compromiso vs resultado por supervisor"
            description="Comparación de Compromiso, RAD 1:45 pm y Cierre por equipo."
          >
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summaries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="supervisorCode" />
                  <YAxis />
                  <Tooltip content={<SupervisorTooltip />} />
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
        </>
      ) : null}
    </div>
  );
}
