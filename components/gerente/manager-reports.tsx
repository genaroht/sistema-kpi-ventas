"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileImage, FileSpreadsheet, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  downloadAndShareManagerPng,
  downloadManagerExcel,
} from "@/lib/export/manager";
import { buildAvanceRows } from "@/lib/kpi-transform";
import {
  summarizeSupervisor,
  summarizeVendor,
  trafficLightClasses,
  trafficLightLabel,
} from "@/lib/manager-analytics";
import { formatPercent, todayInLima } from "@/lib/utils";
import { useManagerData } from "@/components/gerente/use-manager-data";

function addDays(date: string, days: number) {
  const current = new Date(`${date}T00:00:00`);
  current.setDate(current.getDate() + days);
  return current.toISOString().slice(0, 10);
}

export function ManagerReports({ managerId }: { managerId: string }) {
  const [fecha, setFecha] = useState(todayInLima());
  const [supervisorId, setSupervisorId] = useState("todos");
  const [kpiName, setKpiName] = useState("todos");
  const [downloading, setDownloading] = useState("");
  const [message, setMessage] = useState("");
  const data = useManagerData({ managerId, fecha, trendDays: 7 });
  const hasSpecificKpi = kpiName !== "todos";

  const selectedSupervisors = useMemo(
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
      selectedSupervisors
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
      data.vendedores,
      hasSpecificKpi,
      kpiName,
      selectedSupervisors,
    ],
  );

  const selectedSupervisor =
    selectedSupervisors.length === 1 ? selectedSupervisors[0] : null;
  const scopedVendedores = useMemo(
    () =>
      data.vendedores.filter((item) =>
        selectedSupervisors.some(
          (supervisor) => supervisor.usuario_id === item.jefe_id,
        ),
      ),
    [data.vendedores, selectedSupervisors],
  );
  const scopedKpis = useMemo(
    () =>
      data.kpis.filter(
        (item) =>
          selectedSupervisors.some(
            (supervisor) => supervisor.usuario_id === item.jefe_id,
          ) &&
          (kpiName === "todos" || item.nombre === kpiName),
      ),
    [data.kpis, kpiName, selectedSupervisors],
  );
  const vendorIds = useMemo(
    () => new Set(scopedVendedores.map((item) => item.id)),
    [scopedVendedores],
  );
  const kpiIds = useMemo(
    () => new Set(scopedKpis.map((item) => item.id)),
    [scopedKpis],
  );
  const scopedRegistros = useMemo(
    () =>
      data.registros.filter(
        (item) => vendorIds.has(item.vendedor_id) && kpiIds.has(item.kpi_id),
      ),
    [data.registros, kpiIds, vendorIds],
  );
  const detailRows = useMemo(
    () =>
      buildAvanceRows({
        fecha,
        vendedores: scopedVendedores,
        kpis: scopedKpis,
        registros: scopedRegistros,
      }),
    [fecha, scopedKpis, scopedRegistros, scopedVendedores],
  );

  const vendorRows = useMemo(() => {
    if (!selectedSupervisor || !hasSpecificKpi) return [];
    const supervisorKpis = scopedKpis.filter(
      (item) => item.jefe_id === selectedSupervisor.usuario_id,
    );
    const habilitacion =
      data.habilitaciones.find(
        (item) => item.jefe_id === selectedSupervisor.usuario_id,
      ) ?? null;
    return scopedVendedores
      .filter((item) => item.jefe_id === selectedSupervisor.usuario_id)
      .map((vendedor) =>
        summarizeVendor({
          vendedor,
          kpis: supervisorKpis,
          registros: scopedRegistros,
          habilitacion,
        }),
      )
      .sort(
        (a, b) =>
          a.zona.localeCompare(b.zona, "es") ||
          a.nombre.localeCompare(b.nombre, "es"),
      );
  }, [
    data.habilitaciones,
    hasSpecificKpi,
    scopedKpis,
    scopedRegistros,
    scopedVendedores,
    selectedSupervisor,
  ]);

  const supervisorName = selectedSupervisor
    ? `${selectedSupervisor.codigo_operativo} · ${selectedSupervisor.nombre}`
    : "Todos los supervisores";

  const summaryHeaders = [
    "Supervisor",
    "Vendedores",
    "Compromiso",
    "RAD 1:45 pm",
    "Cierre",
    "Avance",
  ];
  const summaryExportRows = summaries.map((item) => [
    `${item.supervisorCode} · ${item.supervisorName}`,
    item.vendedores,
    item.compromiso,
    item.corte,
    item.cierre,
    formatPercent(item.avance),
  ]);

  const detailHeaders = [
    "Supervisor",
    "Zona",
    "Vendedor",
    "Grupo",
    "KPI",
    "Compromiso",
    "RAD 1:45 pm",
    "Cierre",
    "% Avance",
    "Estado",
  ];
  const detailExportRows = detailRows.map((row) => {
    const vendedor = scopedVendedores.find(
      (item) => item.id === row.vendedor_id,
    );
    const supervisor = selectedSupervisors.find(
      (item) => item.usuario_id === vendedor?.jefe_id,
    );
    return [
      supervisor ? `${supervisor.codigo_operativo} · ${supervisor.nombre}` : "",
      row.zona,
      row.vendedor,
      row.grupo ?? "Sin grupo",
      row.kpi,
      row.compromiso,
      row.corte,
      row.cierre,
      formatPercent(row.avance),
      row.estado,
    ];
  });

  const trendExportRows = useMemo(() => {
    const dates = Array.from({ length: 7 }, (_, index) =>
      addDays(fecha, index - 6),
    );
    return dates.flatMap((date) =>
      selectedSupervisors.map((supervisor) => {
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
        const localVendorIds = new Set(vendedores.map((item) => item.id));
        const localKpiIds = new Set(kpis.map((item) => item.id));
        const registros = data.trendRegistros.filter(
          (item) =>
            item.fecha === date &&
            localVendorIds.has(item.vendedor_id) &&
            localKpiIds.has(item.kpi_id),
        );
        const summary = summarizeSupervisor({
          supervisor,
          vendedores,
          kpis,
          registros,
          habilitacion: null,
        });
        return [
          date,
          `${supervisor.codigo_operativo} · ${supervisor.nombre}`,
          summary.compromiso,
          summary.corte,
          summary.cierre,
          formatPercent(summary.avance),
        ];
      }),
    );
  }, [
    data.kpis,
    data.trendRegistros,
    data.vendedores,
    fecha,
    kpiName,
    selectedSupervisors,
  ]);

  async function runDownload(key: string, callback: () => Promise<void>) {
    setDownloading(key);
    setMessage("");
    try {
      await callback();
      setMessage("Reporte generado correctamente.");
    } catch (error) {
      setMessage((error as Error)?.message || "No se pudo generar el reporte.");
    } finally {
      setDownloading("");
    }
  }

  function stageTable(stage: "compromiso" | "corte" | "cierre") {
    const stageLabel =
      stage === "compromiso"
        ? "Compromiso"
        : stage === "corte"
          ? "RAD 1:45 pm"
          : "Cierre y avance";
    if (selectedSupervisor) {
      return {
        title: `${stageLabel} · ${supervisorName}`,
        subtitle: `Fecha ${fecha}`,
        headers:
          stage === "cierre"
            ? ["Zona", "Vendedor", "Compromiso", "Cierre", "Avance"]
            : [
                "Zona",
                "Vendedor",
                "Compromiso",
                stage === "corte" ? "RAD 1:45 pm" : "Registrado",
              ],
        rows: vendorRows.map((item) =>
          stage === "cierre"
            ? [
                item.zona,
                item.nombre,
                item.compromiso,
                item.cierre,
                formatPercent(item.avance),
              ]
            : stage === "corte"
              ? [item.zona, item.nombre, item.compromiso, item.corte]
              : [
                  item.zona,
                  item.nombre,
                  item.compromiso,
                  item.compromisoCells > 0 ? "Sí" : "No",
                ],
        ),
        filename: `reporte-${stage}-${selectedSupervisor.codigo_operativo}-${fecha}`,
      };
    }
    return {
      title: `${stageLabel} por supervisor`,
      subtitle: `Fecha ${fecha}`,
      headers:
        stage === "cierre"
          ? ["Supervisor", "Compromiso", "Cierre", "Avance"]
          : [
              "Supervisor",
              "Compromiso",
              stage === "corte" ? "RAD 1:45 pm" : "Vendedores",
            ],
      rows: summaries.map((item) =>
        stage === "cierre"
          ? [
              `${item.supervisorCode} · ${item.supervisorName}`,
              item.compromiso,
              item.cierre,
              formatPercent(item.avance),
            ]
          : stage === "corte"
            ? [
                `${item.supervisorCode} · ${item.supervisorName}`,
                item.compromiso,
                item.corte,
              ]
            : [
                `${item.supervisorCode} · ${item.supervisorName}`,
                item.compromiso,
                item.vendedores,
              ],
      ),
      filename: `reporte-gerencial-${stage}-${fecha}`,
    };
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="grid gap-3 pt-5 md:grid-cols-3">
          <div>
            <label
              htmlFor="reports-date"
              className="text-xs font-black text-slate-600"
            >
              Fecha
            </label>
            <Input
              id="reports-date"
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label
              htmlFor="reports-supervisor"
              className="text-xs font-black text-slate-600"
            >
              Supervisor
            </label>
            <Select
              id="reports-supervisor"
              value={supervisorId}
              onChange={(event) => setSupervisorId(event.target.value)}
              className="mt-1"
            >
              <option value="todos">Resumen global por supervisores</option>
              {data.supervisores.map((item) => (
                <option key={item.usuario_id} value={item.usuario_id}>
                  {item.codigo_operativo} · {item.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label
              htmlFor="reports-kpi"
              className="text-xs font-black text-slate-600"
            >
              KPI
            </label>
            <Select
              id="reports-kpi"
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
      {message ? (
        <Alert tone={message.includes("correctamente") ? "success" : "warning"}>
          {message}
        </Alert>
      ) : null}
      {!hasSpecificKpi ? (
        <Alert tone="warning">
          Selecciona un KPI para generar resúmenes, PNG y tendencias. El detalle
          completo por vendedor y KPI, así como sus exportaciones, permanece
          disponible sin mezclar unidades.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Descargas gerenciales</CardTitle>
          <CardDescription>
            Los PNG también abren la opción para compartir por WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Button
            variant="outline"
            disabled={Boolean(downloading) || !hasSpecificKpi}
            onClick={() =>
              runDownload("summary", () =>
                downloadAndShareManagerPng({
                  title: `Resumen global · ${kpiName}`,
                  subtitle: `Fecha ${fecha}`,
                  headers: summaryHeaders,
                  rows: summaryExportRows,
                  filename: `resumen-supervisores-${fecha}`,
                }),
              )
            }
          >
            {downloading === "summary" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileImage className="h-4 w-4" />
            )}{" "}
            Resumen global
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(downloading) || !selectedSupervisor}
            onClick={() =>
              runDownload("supervisor", () =>
                downloadManagerExcel({
                  filename: `reporte-${selectedSupervisor?.codigo_operativo ?? "supervisor"}-${fecha}`,
                  sheets: hasSpecificKpi
                    ? [
                        {
                          name: "Resumen KPI",
                          headers: summaryHeaders,
                          rows: summaryExportRows,
                        },
                        {
                          name: "Vendedores y KPI",
                          headers: detailHeaders,
                          rows: detailExportRows,
                        },
                      ]
                    : [
                        {
                          name: "Vendedores y KPI",
                          headers: detailHeaders,
                          rows: detailExportRows,
                        },
                      ],
                }),
              )
            }
          >
            {downloading === "supervisor" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}{" "}
            Reporte de supervisor
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(downloading)}
            onClick={() =>
              runDownload("detail", () =>
                downloadManagerExcel({
                  filename: `detalle-vendedores-${fecha}`,
                  sheets: [
                    {
                      name: "Detalle vendedores",
                      headers: detailHeaders,
                      rows: detailExportRows,
                    },
                  ],
                }),
              )
            }
          >
            {downloading === "detail" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}{" "}
            Detalle vendedores
          </Button>
          <Button
            disabled={Boolean(downloading)}
            onClick={() =>
              runDownload("excel", () =>
                downloadManagerExcel({
                  filename: `consolidado-gerencial-${fecha}`,
                  sheets: hasSpecificKpi
                    ? [
                        {
                          name: "Supervisores",
                          headers: summaryHeaders,
                          rows: summaryExportRows,
                        },
                        {
                          name: "Detalle",
                          headers: detailHeaders,
                          rows: detailExportRows,
                        },
                        {
                          name: "Tendencia 7 dias",
                          headers: [
                            "Fecha",
                            "Supervisor",
                            "Compromiso",
                            "RAD 1:45 pm",
                            "Cierre",
                            "Avance",
                          ],
                          rows: trendExportRows,
                        },
                      ]
                    : [
                        {
                          name: "Detalle completo",
                          headers: detailHeaders,
                          rows: detailExportRows,
                        },
                      ],
                }),
              )
            }
          >
            {downloading === "excel" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}{" "}
            Excel consolidado
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(downloading) || !hasSpecificKpi}
            onClick={() =>
              runDownload("png-compromiso", () =>
                downloadAndShareManagerPng(stageTable("compromiso")),
              )
            }
          >
            {downloading === "png-compromiso" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileImage className="h-4 w-4" />
            )}{" "}
            PNG Compromiso
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(downloading) || !hasSpecificKpi}
            onClick={() =>
              runDownload("png-rad", () =>
                downloadAndShareManagerPng(stageTable("corte")),
              )
            }
          >
            {downloading === "png-rad" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileImage className="h-4 w-4" />
            )}{" "}
            PNG RAD
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(downloading) || !hasSpecificKpi}
            onClick={() =>
              runDownload("png-cierre", () =>
                downloadAndShareManagerPng(stageTable("cierre")),
              )
            }
          >
            {downloading === "png-cierre" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileImage className="h-4 w-4" />
            )}{" "}
            PNG Cierre y avance
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {hasSpecificKpi
              ? "Resumen por supervisor"
              : "Supervisores incluidos"}
          </CardTitle>
          <CardDescription>
            {hasSpecificKpi
              ? `Resultados del KPI ${kpiName}.`
              : "Sin cantidades agregadas hasta seleccionar un KPI."}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <table
              className={`w-full text-sm ${hasSpecificKpi ? "min-w-[780px]" : "min-w-[420px]"}`}
            >
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="p-3">Supervisor</th>
                  <th className="p-3 text-right">Vendedores</th>
                  {hasSpecificKpi ? (
                    <>
                      <th className="p-3 text-right">Compromiso</th>
                      <th className="p-3 text-right">RAD</th>
                      <th className="p-3 text-right">Cierre</th>
                      <th className="p-3 text-right">Avance</th>
                      <th className="p-3">Estado</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {summaries.map((item) => (
                  <tr key={item.supervisorId} className="border-b">
                    <td className="p-3 font-black">
                      {item.supervisorCode} · {item.supervisorName}
                    </td>
                    <td className="p-3 text-right">{item.vendedores}</td>
                    {hasSpecificKpi ? (
                      <>
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
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {selectedSupervisor ? (
        <Card>
          <CardHeader>
            <CardTitle>Detalle completo: {supervisorName}</CardTitle>
            <CardDescription>
              Vendedores y KPI del supervisor seleccionado.
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
                {detailRows.map((row) => (
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
      ) : null}
    </div>
  );
}
