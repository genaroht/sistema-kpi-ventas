"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Users } from "lucide-react";
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
} from "@/lib/manager-analytics";
import { formatPercent, todayInLima } from "@/lib/utils";
import { useManagerData } from "@/components/gerente/use-manager-data";

export function ManagerSupervisors({ managerId }: { managerId: string }) {
  const [fecha, setFecha] = useState(todayInLima());
  const [kpiName, setKpiName] = useState("todos");
  const data = useManagerData({ managerId, fecha });
  const hasSpecificKpi = kpiName !== "todos";

  const kpiOptions = useMemo(
    () =>
      Array.from(new Set(data.kpis.map((item) => item.nombre))).sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [data.kpis],
  );

  useEffect(() => {
    if (kpiName !== "todos" && !kpiOptions.includes(kpiName)) {
      setKpiName("todos");
    }
  }, [kpiName, kpiOptions]);

  const summaries = useMemo(
    () =>
      data.supervisores
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
        .sort((a, b) => a.supervisorCode.localeCompare(b.supervisorCode, "es")),
    [
      data.habilitaciones,
      data.kpis,
      data.registros,
      data.supervisores,
      data.vendedores,
      hasSpecificKpi,
      kpiName,
    ],
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="grid gap-3 pt-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="supervisors-date"
              className="text-xs font-black text-slate-600"
            >
              Fecha
            </label>
            <Input
              id="supervisors-date"
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label
              htmlFor="supervisors-kpi"
              className="text-xs font-black text-slate-600"
            >
              KPI
            </label>
            <Select
              id="supervisors-kpi"
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
      {!data.loading && summaries.length === 0 ? (
        <Alert tone="warning">No tienes supervisores asignados.</Alert>
      ) : null}
      {!hasSpecificKpi ? (
        <Alert tone="warning">
          Selecciona un KPI para ver cantidades, avance y semáforo por
          supervisor. Las tarjetas se mantienen disponibles para entrar al
          detalle del equipo.
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {data.loading
          ? Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-64 w-full rounded-2xl" />
            ))
          : summaries.map((item) => (
              <Card key={item.supervisorId}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>
                        {item.supervisorCode} · {item.supervisorName}
                      </CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-1">
                        <Users className="h-4 w-4" /> {item.vendedores}{" "}
                        vendedores activos
                      </CardDescription>
                    </div>
                    {hasSpecificKpi ? (
                      <Badge className={trafficLightClasses(item.semaforo)}>
                        {trafficLightLabel(item.semaforo)}
                      </Badge>
                    ) : (
                      <Badge className="border-slate-200 bg-slate-100 text-slate-600">
                        Selecciona KPI
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {hasSpecificKpi ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-500">
                          Compromiso
                        </p>
                        <p className="mt-1 font-black">
                          {item.compromiso.toLocaleString("es-PE")}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-500">
                          RAD 1:45 pm
                        </p>
                        <p className="mt-1 font-black">
                          {item.corte.toLocaleString("es-PE")}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-500">
                          Cierre
                        </p>
                        <p className="mt-1 font-black">
                          {item.cierre.toLocaleString("es-PE")}
                        </p>
                      </div>
                      <div className="rounded-xl bg-blue-50 p-3">
                        <p className="text-xs font-bold text-blue-600">
                          Avance
                        </p>
                        <p className="mt-1 font-black text-blue-800">
                          {formatPercent(item.avance)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                      Los resultados numéricos se mostrarán al seleccionar un
                      KPI.
                    </div>
                  )}
                  <Link
                    href={`/admin/supervisores/${item.supervisorId}?fecha=${fecha}${hasSpecificKpi ? `&kpi=${encodeURIComponent(kpiName)}` : ""}`}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700"
                  >
                    Ver detalle del equipo <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}
