"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Users } from "lucide-react";
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
  summarizeVendor,
  trafficLightClasses,
  trafficLightLabel,
} from "@/lib/manager-analytics";
import { buildAvanceRows } from "@/lib/kpi-transform";
import { formatPercent, todayInLima } from "@/lib/utils";
import { useManagerData } from "@/components/gerente/use-manager-data";

const chartColors: Record<string, string> = {
  verde: "#22c55e",
  amarillo: "#eab308",
  rojo: "#ef4444",
  gris: "#94a3b8",
};

function StageBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <Badge
      className={
        active
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-slate-200 bg-slate-100 text-slate-600"
      }
    >
      {active ? "Activo" : "Bloqueado"} · {label}
    </Badge>
  );
}

export function ManagerSupervisorDetail({
  managerId,
  supervisorId,
  initialDate,
  initialKpi,
}: {
  managerId: string;
  supervisorId: string;
  initialDate?: string;
  initialKpi?: string;
}) {
  const [fecha, setFecha] = useState(initialDate || todayInLima());
  const [kpiName, setKpiName] = useState(initialKpi || "todos");
  const data = useManagerData({ managerId, fecha });
  const hasSpecificKpi = kpiName !== "todos";
  const supervisor =
    data.supervisores.find((item) => item.usuario_id === supervisorId) ?? null;
  const allKpis = useMemo(
    () => data.kpis.filter((item) => item.jefe_id === supervisorId),
    [data.kpis, supervisorId],
  );
  const kpiOptions = useMemo(
    () =>
      Array.from(new Set(allKpis.map((item) => item.nombre))).sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [allKpis],
  );

  useEffect(() => {
    if (kpiName !== "todos" && !kpiOptions.includes(kpiName)) {
      setKpiName("todos");
    }
  }, [kpiName, kpiOptions]);

  const vendedores = useMemo(
    () => data.vendedores.filter((item) => item.jefe_id === supervisorId),
    [data.vendedores, supervisorId],
  );
  const kpis = useMemo(
    () =>
      hasSpecificKpi ? allKpis.filter((item) => item.nombre === kpiName) : [],
    [allKpis, hasSpecificKpi, kpiName],
  );
  const vendorIds = useMemo(
    () => new Set(vendedores.map((item) => item.id)),
    [vendedores],
  );
  const kpiIds = useMemo(() => new Set(kpis.map((item) => item.id)), [kpis]);
  const allKpiIds = useMemo(
    () => new Set(allKpis.map((item) => item.id)),
    [allKpis],
  );
  const registros = useMemo(
    () =>
      data.registros.filter(
        (item) => vendorIds.has(item.vendedor_id) && kpiIds.has(item.kpi_id),
      ),
    [data.registros, kpiIds, vendorIds],
  );
  const allRegistros = useMemo(
    () =>
      data.registros.filter(
        (item) => vendorIds.has(item.vendedor_id) && allKpiIds.has(item.kpi_id),
      ),
    [allKpiIds, data.registros, vendorIds],
  );
  const habilitacion =
    data.habilitaciones.find((item) => item.jefe_id === supervisorId) ?? null;

  const summary = useMemo(
    () =>
      supervisor
        ? summarizeSupervisor({
            supervisor,
            vendedores,
            kpis,
            registros,
            habilitacion,
          })
        : null,
    [habilitacion, kpis, registros, supervisor, vendedores],
  );

  const vendorRows = useMemo(
    () =>
      hasSpecificKpi
        ? vendedores
            .map((vendedor) =>
              summarizeVendor({
                vendedor,
                kpis,
                registros,
                habilitacion,
              }),
            )
            .sort(
              (a, b) =>
                b.avance - a.avance || a.nombre.localeCompare(b.nombre, "es"),
            )
        : [],
    [habilitacion, hasSpecificKpi, kpis, registros, vendedores],
  );

  const completeRows = useMemo(
    () =>
      buildAvanceRows({
        fecha,
        vendedores,
        kpis: allKpis,
        registros: allRegistros,
      }).sort(
        (a, b) =>
          a.zona.localeCompare(b.zona, "es") ||
          a.vendedor.localeCompare(b.vendedor, "es") ||
          (a.grupo ?? "").localeCompare(b.grupo ?? "", "es") ||
          a.kpi.localeCompare(b.kpi, "es"),
      ),
    [allKpis, allRegistros, fecha, vendedores],
  );

  if (data.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (data.error) return <Alert tone="error">{data.error}</Alert>;
  if (!supervisor || !summary) {
    return (
      <div className="space-y-4">
        <Alert tone="error">
          El supervisor no está asignado a tu cuenta o ya no está activo.
        </Alert>
        <Link
          href="/admin/supervisores"
          className="inline-flex items-center gap-2 font-black text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a Supervisores
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/admin/supervisores"
        className="inline-flex items-center gap-2 font-black text-blue-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al resumen global
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-2xl">
                {supervisor.codigo_operativo} · {supervisor.nombre}
              </CardTitle>
              <CardDescription className="mt-1 flex items-center gap-2">
                <Users className="h-4 w-4" /> {vendedores.length} vendedores
                activos
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <StageBadge
                active={Boolean(habilitacion?.compromiso_activo)}
                label="Compromiso"
              />
              <StageBadge
                active={Boolean(habilitacion?.corte_activo)}
                label="RAD 1:45 pm"
              />
              <StageBadge
                active={Boolean(habilitacion?.cierre_activo)}
                label="Cierre"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <label
              htmlFor="detail-date"
              className="text-xs font-black text-slate-600"
            >
              Fecha
            </label>
            <Input
              id="detail-date"
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label
              htmlFor="detail-kpi"
              className="text-xs font-black text-slate-600"
            >
              KPI
            </label>
            <Select
              id="detail-kpi"
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

      {!hasSpecificKpi ? (
        <Alert tone="warning">
          Selecciona un KPI para visualizar cantidades, avance, ranking y
          semáforo. La tabla completa inferior conserva todos los KPI por
          separado.
        </Alert>
      ) : null}

      {hasSpecificKpi ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-bold text-slate-500">Vendedores</p>
                <p className="mt-1 text-3xl font-black">{summary.vendedores}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-bold text-slate-500">Compromiso</p>
                <p className="mt-1 text-3xl font-black">
                  {summary.compromiso.toLocaleString("es-PE")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-bold text-slate-500">RAD 1:45 pm</p>
                <p className="mt-1 text-3xl font-black">
                  {summary.corte.toLocaleString("es-PE")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-bold text-slate-500">Cierre</p>
                <p className="mt-1 text-3xl font-black">
                  {summary.cierre.toLocaleString("es-PE")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-bold text-slate-500">Avance total</p>
                <p className="mt-1 text-3xl font-black text-blue-700">
                  {formatPercent(summary.avance)}
                </p>
                <Badge
                  className={`mt-2 ${trafficLightClasses(summary.semaforo)}`}
                >
                  {trafficLightLabel(summary.semaforo)}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ChartCard
              title="Ranking de vendedores"
              description={`Ordenado por avance de ${kpiName}.`}
            >
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={vendorRows}
                    layout="vertical"
                    margin={{ left: 45, right: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" unit="%" domain={[0, "dataMax"]} />
                    <YAxis
                      dataKey="nombre"
                      type="category"
                      width={120}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: any) => formatPercent(Number(value))}
                    />
                    <Bar dataKey="avance" radius={[0, 8, 8, 0]}>
                      {vendorRows.map((item) => (
                        <Cell
                          key={item.vendedorId}
                          fill={chartColors[item.semaforo]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title="Semáforo de vendedores"
              description={`Estado individual para ${kpiName}.`}
            >
              <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                {vendorRows.map((item, index) => (
                  <div
                    key={item.vendedorId}
                    className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 font-black">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-black">{item.nombre}</p>
                        <p className="text-xs text-slate-500">
                          {item.zona} · {formatPercent(item.avance)}
                        </p>
                      </div>
                    </div>
                    <Badge className={trafficLightClasses(item.semaforo)}>
                      {trafficLightLabel(item.semaforo)}
                    </Badge>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Vendedores: Compromiso, RAD, Cierre y Avance
              </CardTitle>
              <CardDescription>
                Resumen del KPI seleccionado. Vista gerencial de solo lectura.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="p-3">Zona</th>
                    <th className="p-3">Vendedor</th>
                    <th className="p-3 text-right">Compromiso</th>
                    <th className="p-3 text-right">RAD 1:45 pm</th>
                    <th className="p-3 text-right">Cierre</th>
                    <th className="p-3 text-right">% Avance</th>
                    <th className="p-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorRows.map((item) => (
                    <tr key={item.vendedorId} className="border-b">
                      <td className="p-3 font-bold">{item.zona}</td>
                      <td className="p-3 font-black">{item.nombre}</td>
                      <td className="p-3 text-right">
                        {item.compromiso.toLocaleString("es-PE")}
                      </td>
                      <td className="p-3 text-right">
                        {item.corte.toLocaleString("es-PE")}
                      </td>
                      <td className="p-3 text-right">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Detalle completo por vendedor y KPI</CardTitle>
            <CardDescription>
              Cada KPI se muestra en su propia fila; no se suman ni promedian
              unidades diferentes.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="p-3">Zona</th>
                  <th className="p-3">Vendedor</th>
                  <th className="p-3">Grupo</th>
                  <th className="p-3">KPI</th>
                  <th className="p-3 text-right">Compromiso</th>
                  <th className="p-3 text-right">RAD 1:45 pm</th>
                  <th className="p-3 text-right">Cierre</th>
                  <th className="p-3 text-right">% Avance</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {completeRows.map((row) => (
                  <tr
                    key={`${row.vendedor_id}-${row.kpi_id}`}
                    className="border-b"
                  >
                    <td className="p-3 font-bold">{row.zona}</td>
                    <td className="p-3 font-black">{row.vendedor}</td>
                    <td className="p-3">{row.grupo ?? "Sin grupo"}</td>
                    <td className="p-3">{row.kpi}</td>
                    <td className="p-3 text-right">
                      {row.compromiso.toLocaleString("es-PE")}
                    </td>
                    <td className="p-3 text-right">
                      {row.corte.toLocaleString("es-PE")}
                    </td>
                    <td className="p-3 text-right">
                      {row.cierre.toLocaleString("es-PE")}
                    </td>
                    <td className="p-3 text-right font-black text-blue-700">
                      {formatPercent(row.avance)}
                    </td>
                    <td className="p-3">{row.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
