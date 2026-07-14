"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileImage, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { advanceLabel, advanceTone, todayInLima } from "@/lib/utils";
import { buildAvanceRows } from "@/lib/kpi-transform";
import { groupKpis } from "@/lib/kpi-groups";
import { downloadKpiExcel } from "@/lib/export/excel";
import { downloadKpiSnapshotPng, type KpiSnapshot } from "@/lib/export/png";
import type { Etapa, Kpi, RegistroKpi, Rol, Supervisor, Vendedor } from "@/types/database";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const etapas: Array<{ key: Etapa; label: string }> = [
  { key: "compromiso", label: "Compromiso" },
  { key: "corte", label: "RAD 1:45 pm" },
  { key: "cierre", label: "Cierre" },
];

const snapshotLabels: Record<KpiSnapshot, string> = {
  compromiso: "Compromiso",
  corte: "RAD 1:45 pm",
  cierre: "Cierre",
};

const snapshotColumns: Record<KpiSnapshot, Array<Etapa | "avance">> = {
  compromiso: ["compromiso"],
  corte: ["compromiso", "corte"],
  cierre: ["compromiso", "cierre", "avance"],
};

type ViewMode = "resumen" | "detalle";
type CellKey = `${string}|${string}|${Etapa}`;

function makeCellKey(vendedorId: string, kpiId: string, etapa: Etapa): CellKey {
  return `${vendedorId}|${kpiId}|${etapa}`;
}

function columnLabel(column: Etapa | "avance") {
  if (column === "avance") return "% Avance";
  return etapas.find((item) => item.key === column)?.label ?? column;
}

export function TablaExcel({
  role,
  currentUserId,
}: {
  role: Rol;
  currentUserId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const readOnly = role === "gerente";
  const canEdit = role === "administrador" || role === "jefe";
  const [fecha, setFecha] = useState(todayInLima());
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);
  const [registros, setRegistros] = useState<RegistroKpi[]>([]);
  const [supervisorId, setSupervisorId] = useState(role === "jefe" ? currentUserId : "");
  const [viewMode, setViewMode] = useState<ViewMode>("resumen");
  const [snapshot, setSnapshot] = useState<KpiSnapshot>("cierre");
  const [drafts, setDrafts] = useState<Record<CellKey, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<CellKey>>(new Set());
  const [dirtyKeys, setDirtyKeys] = useState<Set<CellKey>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [cellErrors, setCellErrors] = useState<Record<CellKey, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryFecha = params.get("fecha");
    if (queryFecha) setFecha(queryFecha);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let vendedoresQuery = supabase
      .from("vendedores")
      .select("id,usuario_id,jefe_id,nombre,zona,visible_tabla,activo,created_at")
      .eq("activo", true)
      .eq("visible_tabla", true)
      .order("zona");
    let kpisQuery = supabase
      .from("kpis")
      .select("id,jefe_id,nombre,activo,tipo,color,grupo,visible_tabla,orden,created_at")
      .eq("activo", true)
      .eq("visible_tabla", true)
      .order("orden");
    let supervisoresQuery = supabase
      .from("supervisores")
      .select("id,usuario_id,codigo_operativo,nombre,activo,created_at")
      .eq("activo", true)
      .order("codigo_operativo");

    if (role === "jefe") {
      vendedoresQuery = vendedoresQuery.eq("jefe_id", currentUserId);
      kpisQuery = kpisQuery.eq("jefe_id", currentUserId);
      supervisoresQuery = supervisoresQuery.eq("usuario_id", currentUserId);
    }

    const [vRes, kRes, sRes] = await Promise.all([
      vendedoresQuery,
      kpisQuery,
      supervisoresQuery,
    ]);

    const vendedorIds = ((vRes.data ?? []) as Vendedor[]).map((item) => item.id);
    let registrosQuery = supabase
      .from("registros_kpi")
      .select("id,fecha,vendedor_id,kpi_id,etapa,cantidad,created_at")
      .eq("fecha", fecha);
    if (role === "jefe") {
      registrosQuery = vendedorIds.length
        ? registrosQuery.in("vendedor_id", vendedorIds)
        : registrosQuery.eq("vendedor_id", "00000000-0000-0000-0000-000000000000");
    }
    const rRes = await registrosQuery;

    const firstError = vRes.error ?? kRes.error ?? sRes.error ?? rRes.error;
    if (firstError) {
      setError("No se pudo cargar el reporte. Revisa tu conexión y vuelve a intentar.");
    }

    setVendedores((vRes.data ?? []) as Vendedor[]);
    setKpis((kRes.data ?? []) as Kpi[]);
    setSupervisores((sRes.data ?? []) as Supervisor[]);
    setRegistros((rRes.data ?? []) as RegistroKpi[]);
    setLoading(false);
  }, [currentUserId, fecha, role, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (role === "jefe") {
      setSupervisorId(currentUserId);
      return;
    }
    if (!supervisorId || !supervisores.some((item) => item.usuario_id === supervisorId)) {
      setSupervisorId(supervisores[0]?.usuario_id ?? "");
    }
  }, [currentUserId, role, supervisorId, supervisores]);

  const scopedVendedores = useMemo(
    () => vendedores.filter((item) => item.jefe_id === supervisorId),
    [supervisorId, vendedores],
  );
  const scopedKpis = useMemo(
    () => kpis.filter((item) => item.jefe_id === supervisorId),
    [kpis, supervisorId],
  );
  const groupedKpis = useMemo(() => groupKpis(scopedKpis), [scopedKpis]);
  const orderedKpis = useMemo(
    () => groupedKpis.flatMap((group) => group.items),
    [groupedKpis],
  );
  const scopedRegistros = useMemo(
    () =>
      registros.filter(
        (row) =>
          scopedVendedores.some((item) => item.id === row.vendedor_id) &&
          scopedKpis.some((item) => item.id === row.kpi_id),
      ),
    [registros, scopedKpis, scopedVendedores],
  );
  const avanceRows = useMemo(
    () =>
      buildAvanceRows({
        fecha,
        vendedores: scopedVendedores,
        kpis: orderedKpis,
        registros: scopedRegistros,
      }),
    [fecha, orderedKpis, scopedRegistros, scopedVendedores],
  );

  const recordMap = useMemo(
    () =>
      new Map(
        scopedRegistros.map((row) => [
          makeCellKey(row.vendedor_id, row.kpi_id, row.etapa),
          row,
        ]),
      ),
    [scopedRegistros],
  );

  useEffect(() => {
    const nextDrafts: Record<CellKey, string> = {};
    scopedVendedores.forEach((vendedor) => {
      scopedKpis.forEach((kpi) => {
        etapas.forEach((etapa) => {
          nextDrafts[makeCellKey(vendedor.id, kpi.id, etapa.key)] = "0";
        });
      });
    });
    scopedRegistros.forEach((row) => {
      nextDrafts[makeCellKey(row.vendedor_id, row.kpi_id, row.etapa)] = String(
        Number(row.cantidad),
      );
    });
    setDrafts(nextDrafts);
    setDirtyKeys(new Set());
    setCellErrors({});
  }, [fecha, scopedKpis, scopedRegistros, scopedVendedores, supervisorId]);

  const selectedSupervisor = supervisores.find(
    (item) => item.usuario_id === supervisorId,
  );

  function rowValue(
    vendedorId: string,
    kpiId: string,
    column: Etapa | "avance",
  ) {
    const row = avanceRows.find(
      (item) => item.vendedor_id === vendedorId && item.kpi_id === kpiId,
    );
    return row?.[column] ?? (column === "avance" ? null : 0);
  }

  function totalFor(kpiId: string, etapa: Etapa) {
    return scopedVendedores.reduce((sum, vendedor) => {
      const raw = drafts[makeCellKey(vendedor.id, kpiId, etapa)] ?? "0";
      const value = Number(raw);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  }

  function totalAdvance(kpiId: string) {
    let compromiso = 0;
    let logrado = 0;

    scopedVendedores.forEach((vendedor) => {
      const compromisoKey = makeCellKey(vendedor.id, kpiId, "compromiso");
      const corteKey = makeCellKey(vendedor.id, kpiId, "corte");
      const cierreKey = makeCellKey(vendedor.id, kpiId, "cierre");
      const compromisoValue = Number(drafts[compromisoKey] ?? 0);
      const corteValue = Number(drafts[corteKey] ?? 0);
      const cierreValue = Number(drafts[cierreKey] ?? 0);

      compromiso += Number.isFinite(compromisoValue) ? compromisoValue : 0;
      logrado += recordMap.has(cierreKey)
        ? Number.isFinite(cierreValue) ? cierreValue : 0
        : recordMap.has(corteKey)
          ? Number.isFinite(corteValue) ? corteValue : 0
          : 0;
    });

    return compromiso > 0 ? (logrado / compromiso) * 100 : 0;
  }

  function setDraftValue(key: CellKey, value: string) {
    setDrafts((current) => ({ ...current, [key]: value }));
    setDirtyKeys((current) => new Set(current).add(key));
    setCellErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validateDraft(key: CellKey) {
    const clean = (drafts[key] ?? "").trim();
    if (clean === "") {
      setCellErrors((current) => ({ ...current, [key]: "Ingresa 0 o un número." }));
      return null;
    }
    const cantidad = Number(clean);
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      setCellErrors((current) => ({ ...current, [key]: "Valor inválido." }));
      return null;
    }
    return cantidad;
  }

  async function saveOneCell(key: CellKey) {
    const [vendedorId, kpiId, etapa] = key.split("|") as [string, string, Etapa];
    const cantidad = validateDraft(key);
    if (cantidad === null) return false;

    const existingValue = recordMap.get(key)?.cantidad;
    if (existingValue !== undefined && Number(existingValue) === cantidad) {
      setDirtyKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      return true;
    }

    setSavingKeys((current) => new Set(current).add(key));
    const { error: saveError } = await supabase.from("registros_kpi").upsert(
      { fecha, vendedor_id: vendedorId, kpi_id: kpiId, etapa, cantidad },
      { onConflict: "fecha,vendedor_id,kpi_id,etapa" },
    );
    setSavingKeys((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });

    if (saveError) {
      setCellErrors((current) => ({ ...current, [key]: "No se pudo guardar." }));
      return false;
    }
    setDirtyKeys((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    return true;
  }

  async function savePendingChanges() {
    if (!canEdit || dirtyKeys.size === 0) return;
    setSavingAll(true);
    setMessage("");
    let ok = true;
    for (const key of Array.from(dirtyKeys)) {
      if (!(await saveOneCell(key))) ok = false;
    }
    setSavingAll(false);
    if (ok) {
      setMessage("Cambios guardados correctamente.");
      await load();
    } else {
      setError("Hay celdas con error. Corrige los valores resaltados.");
    }
  }

  async function exportPng(mode: KpiSnapshot) {
    setSnapshot(mode);
    setDownloading(mode);
    setError("");
    setMessage("");

    const probeFile = new File([""], "reporte.png", { type: "image/png" });
    const supportsFileShare =
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [probeFile] });
    const whatsappTab = supportsFileShare
      ? null
      : window.open("about:blank", "reporte-kpi-whatsapp");

    try {
      const { blob, filename } = await downloadKpiSnapshotPng({
        snapshot: mode,
        fecha,
        supervisorLabel: selectedSupervisor
          ? `${selectedSupervisor.codigo_operativo} · ${selectedSupervisor.nombre}`
          : undefined,
        vendedores: scopedVendedores,
        kpis: orderedKpis,
        registros: scopedRegistros,
        filename: `${mode}-${selectedSupervisor?.codigo_operativo ?? "supervisor"}-${fecha}.png`,
      });

      const shareText = `Reporte ${snapshotLabels[mode]} · ${fecha}${
        selectedSupervisor ? ` · ${selectedSupervisor.codigo_operativo}` : ""
      }`;

      if (supportsFileShare) {
        const file = new File([blob], filename, { type: "image/png" });
        try {
          await navigator.share({
            title: shareText,
            text: shareText,
            files: [file],
          });
          setMessage("Imagen descargada y enviada al menú para compartir por WhatsApp.");
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === "AbortError") {
            setMessage("La imagen quedó descargada. Se canceló la acción de compartir.");
          } else {
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
              `${shareText}. La imagen PNG ya fue descargada; adjúntala en esta conversación.`,
            )}`;
            window.location.assign(whatsappUrl);
          }
        }
      } else {
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
          `${shareText}. La imagen PNG ya fue descargada; adjúntala en esta conversación.`,
        )}`;
        if (whatsappTab) {
          whatsappTab.location.href = whatsappUrl;
        } else {
          window.location.assign(whatsappUrl);
        }
        setMessage("Imagen descargada. Se abrió WhatsApp para compartirla.");
      }
    } catch {
      whatsappTab?.close();
      setError("No se pudo generar la imagen PNG.");
    } finally {
      setDownloading(null);
    }
  }

  async function exportExcel() {
    setDownloading("excel");
    setError("");
    try {
      await downloadKpiExcel({
        fechaLabel: fecha,
        filename: `reporte-completo-${selectedSupervisor?.codigo_operativo ?? "supervisor"}-${fecha}.xlsx`,
        vendedores: scopedVendedores,
        kpis: orderedKpis,
        registros: scopedRegistros,
        avanceRows,
      });
    } catch {
      setError("No se pudo generar el archivo Excel.");
    } finally {
      setDownloading(null);
    }
  }

  const summaryCols = snapshotColumns[snapshot];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div
            className={cn(
              "grid gap-3",
              role === "jefe" ? "md:grid-cols-[minmax(220px,340px)_1fr]" : "md:grid-cols-2",
            )}
          >
            <div>
              <label htmlFor="report-date" className="text-xs font-black text-slate-600">
                Fecha
              </label>
              <Input
                id="report-date"
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
                className="mt-1"
              />
            </div>
            {role !== "jefe" ? (
              <div>
                <label htmlFor="report-supervisor" className="text-xs font-black text-slate-600">
                  Supervisor
                </label>
                <Select
                  id="report-supervisor"
                  value={supervisorId}
                  onChange={(event) => setSupervisorId(event.target.value)}
                  className="mt-1"
                >
                  {supervisores.map((item) => (
                    <option key={item.usuario_id} value={item.usuario_id}>
                      {item.codigo_operativo} · {item.nombre}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="flex items-end">
                <p className="rounded-xl border bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  El reporte incluye todos tus vendedores y todos los KPI visibles.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={viewMode === "resumen" ? "default" : "outline"}
                onClick={() => setViewMode("resumen")}
              >
                Resumen PNG
              </Button>
              <Button
                type="button"
                variant={viewMode === "detalle" ? "default" : "outline"}
                onClick={() => setViewMode("detalle")}
              >
                {readOnly ? "Detalle Excel" : "Detalle editable"}
              </Button>
            </div>

            {viewMode === "resumen" ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {(["compromiso", "corte", "cierre"] as KpiSnapshot[]).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={snapshot === mode ? "default" : "outline"}
                    disabled={loading || downloading !== null || !scopedVendedores.length || !scopedKpis.length}
                    onClick={() => exportPng(mode)}
                  >
                    {downloading === mode ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileImage className="h-4 w-4" />
                    )}
                    Descargar {snapshotLabels[mode]}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                  <Button
                    onClick={savePendingChanges}
                    disabled={loading || savingAll || dirtyKeys.size === 0}
                  >
                    <Save className="h-4 w-4" />
                    {savingAll ? "Guardando..." : `Guardar cambios${dirtyKeys.size ? ` (${dirtyKeys.size})` : ""}`}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={exportExcel}
                  disabled={loading || downloading !== null || !scopedVendedores.length || !scopedKpis.length}
                >
                  {downloading === "excel" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Descargar Excel completo
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      {readOnly ? (
        <Alert tone="info">
          Vista de gerente: consulta global por supervisor. La edición permanece bloqueada.
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
        <Badge className="border-blue-200 bg-blue-50 text-blue-700">
          {scopedVendedores.length} vendedores
        </Badge>
        <Badge className="border-blue-200 bg-blue-50 text-blue-700">
          {scopedKpis.length} KPI visibles
        </Badge>
        <span>
          {viewMode === "resumen"
            ? "Las tres descargas PNG generan compromiso, RAD 1:45 pm y cierre según el formato solicitado."
            : "El detalle incluye Compromiso, RAD 1:45 pm, Cierre y Avance %."}
        </span>
      </div>

      {loading ? (
        <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-soft">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : !supervisorId || scopedVendedores.length === 0 || scopedKpis.length === 0 ? (
        <Alert tone="warning">
          No hay vendedores o KPI visibles para el supervisor seleccionado.
        </Alert>
      ) : (
        <div className="kpi-scrollbar max-h-[72vh] w-full max-w-full overflow-auto rounded-2xl border bg-white shadow-soft">
          <table className="min-w-max border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-30">
              <tr>
                <th className="sticky left-0 z-40 min-w-[120px] border-b bg-cyan-200 px-4 py-3 text-left">
                  Zona
                </th>
                <th className="sticky left-[120px] z-40 min-w-[220px] border-b bg-cyan-200 px-4 py-3 text-left">
                  Vendedor
                </th>
                {groupedKpis.map((group) => (
                  <th
                    key={group.name}
                    colSpan={
                      group.items.length *
                      (viewMode === "detalle" ? 4 : summaryCols.length)
                    }
                    className="border-b border-l bg-slate-100 px-4 py-2 text-left"
                  >
                    <span className="font-black">{group.name}</span>
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-40 border-b bg-cyan-100 px-4 py-2" />
                <th className="sticky left-[120px] z-40 border-b bg-cyan-100 px-4 py-2" />
                {orderedKpis.map((kpi, index) => (
                  <th
                    key={kpi.id}
                    colSpan={viewMode === "detalle" ? 4 : summaryCols.length}
                    className={cn(
                      "min-w-[130px] border-b border-l px-3 py-2 text-center text-white",
                      index % 2 === 0 ? "bg-red-600" : "bg-blue-700",
                    )}
                  >
                    <span className="font-black">{kpi.nombre}</span>
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-40 border-b bg-white px-4 py-2" />
                <th className="sticky left-[120px] z-40 border-b bg-white px-4 py-2" />
                {orderedKpis.map((kpi) =>
                  (viewMode === "detalle"
                    ? (["compromiso", "corte", "cierre", "avance"] as const)
                    : summaryCols
                  ).map((column) => (
                    <th
                      key={`${kpi.id}-${column}`}
                      className="min-w-[112px] border-b border-l bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600"
                    >
                      {columnLabel(column)}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {scopedVendedores.map((vendedor) => (
                <tr key={vendedor.id} className="hover:bg-blue-50/40">
                  <td className="sticky left-0 z-20 min-w-[120px] border-b bg-white px-4 py-3 font-black">
                    {vendedor.zona}
                  </td>
                  <td className="sticky left-[120px] z-20 min-w-[220px] border-b bg-white px-4 py-3 font-semibold">
                    {vendedor.nombre}
                  </td>
                  {orderedKpis.map((kpi) => {
                    if (viewMode === "resumen") {
                      return summaryCols.map((column) => {
                        const value = rowValue(vendedor.id, kpi.id, column);
                        return (
                          <td
                            key={`${vendedor.id}-${kpi.id}-${column}`}
                            className="border-b border-l px-3 py-3 text-right font-bold"
                          >
                            {column === "avance" ? (
                              <span
                                className={`rounded-full border px-2 py-1 text-xs font-black ${advanceTone(value as number | null)}`}
                              >
                                {advanceLabel(value as number | null)}
                              </span>
                            ) : (
                              Number(value).toLocaleString("es-PE")
                            )}
                          </td>
                        );
                      });
                    }

                    const avance = rowValue(vendedor.id, kpi.id, "avance") as number | null;
                    return (
                      <Fragment key={`${vendedor.id}-${kpi.id}`}>
                        {etapas.map((etapa) => {
                          const key = makeCellKey(vendedor.id, kpi.id, etapa.key);
                          const saving = savingKeys.has(key);
                          const cellError = cellErrors[key];
                          return (
                            <td key={key} className="border-b border-l px-2 py-2 text-right align-top">
                              <div className="relative">
                                <input
                                  aria-label={`${etapa.label} ${vendedor.nombre} ${kpi.nombre}`}
                                  type="number"
                                  min={0}
                                  inputMode="decimal"
                                  step="0.01"
                                  value={drafts[key] ?? "0"}
                                  disabled={saving || !canEdit}
                                  onChange={(event) => setDraftValue(key, event.target.value)}
                                  onBlur={() => {
                                    if (dirtyKeys.has(key)) validateDraft(key);
                                  }}
                                  className={cn(
                                    "h-9 w-24 rounded-lg border bg-white px-2 text-right font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                                    dirtyKeys.has(key) && "border-yellow-300 bg-yellow-50",
                                    cellError && "border-red-300 ring-2 ring-red-100",
                                    !canEdit && "bg-slate-50 text-slate-600",
                                  )}
                                />
                                {saving ? (
                                  <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-blue-600" />
                                ) : null}
                              </div>
                              {cellError ? (
                                <p className="mt-1 w-24 text-left text-[10px] font-bold text-red-600">
                                  {cellError}
                                </p>
                              ) : null}
                            </td>
                          );
                        })}
                        <td className="border-b border-l px-3 py-3 text-center align-top">
                          <span
                            className={`rounded-full border px-2 py-1 text-xs font-black ${advanceTone(avance)}`}
                          >
                            {advanceLabel(avance)}
                          </span>
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
              <tr className="sticky bottom-0 z-20 bg-blue-950 text-white shadow-[0_-6px_16px_rgba(15,23,42,0.12)]">
                <td className="sticky left-0 z-30 min-w-[120px] border-t border-blue-800 bg-blue-950 px-4 py-3 font-black">
                  Total
                </td>
                <td className="sticky left-[120px] z-30 min-w-[220px] border-t border-blue-800 bg-blue-950 px-4 py-3 text-xs font-semibold text-blue-100">
                  {scopedVendedores.length} vendedores visibles
                </td>
                {orderedKpis.map((kpi) => {
                  const columns =
                    viewMode === "detalle"
                      ? (["compromiso", "corte", "cierre", "avance"] as const)
                      : summaryCols;
                  return columns.map((column) => (
                    <td
                      key={`total-${kpi.id}-${column}`}
                      className="border-l border-t border-blue-800 px-3 py-3 text-right font-black"
                    >
                      {column === "avance"
                        ? advanceLabel(totalAdvance(kpi.id))
                        : totalFor(kpi.id, column).toLocaleString("es-PE")}
                    </td>
                  ));
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
