"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Save, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { advanceLabel, advanceTone, todayInLima } from "@/lib/utils";
import { buildAvanceRows } from "@/lib/kpi-transform";
import { getKpiGroup, getOrderedGroupNames, groupKpis, type KpiGroupName } from "@/lib/kpi-groups";
import { downloadKpiExcel } from "@/lib/export/excel";
import type { Etapa, Kpi, RegistroKpi, Vendedor } from "@/types/database";
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
  { key: "corte", label: "Corte 1:45" },
  { key: "cierre", label: "Cierre" }
];

type ViewMode = "resumen" | "detalle";
type CellKey = `${string}|${string}|${Etapa}`;

function makeCellKey(vendedorId: string, kpiId: string, etapa: Etapa): CellKey {
  return `${vendedorId}|${kpiId}|${etapa}`;
}

function formatAmount(value: number | undefined) {
  if (value === undefined) return "";
  return Number(value).toString();
}

export function TablaExcel() {
  const supabase = useMemo(() => createClient(), []);
  const [fecha, setFecha] = useState(todayInLima());
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [registros, setRegistros] = useState<RegistroKpi[]>([]);
  const [zona, setZona] = useState("todos");
  const [vendedor, setVendedor] = useState("todos");
  const [kpi, setKpi] = useState("todos");
  const [grupo, setGrupo] = useState<KpiGroupName | "todos">("todos");
  const [estado, setEstado] = useState("todos");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("resumen");
  const [showAdicionales, setShowAdicionales] = useState(true);
  const [drafts, setDrafts] = useState<Record<CellKey, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<CellKey>>(new Set());
  const [dirtyKeys, setDirtyKeys] = useState<Set<CellKey>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [cellErrors, setCellErrors] = useState<Record<CellKey, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryFecha = params.get("fecha");
    const queryEstado = params.get("estado");
    const queryVendedor = params.get("vendedor");
    if (queryFecha) setFecha(queryFecha);
    if (queryEstado) setEstado(queryEstado);
    if (queryVendedor) setVendedor(queryVendedor);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [vRes, kRes, rRes] = await Promise.all([
      supabase.from("vendedores").select("id,usuario_id,jefe_id,nombre,zona,visible_tabla,activo,created_at").eq("activo", true).eq("visible_tabla", true).order("zona"),
      supabase.from("kpis").select("id,jefe_id,nombre,activo,tipo,color,grupo,visible_tabla,orden,created_at").eq("activo", true).eq("visible_tabla", true).order("orden"),
      supabase.from("registros_kpi").select("id,fecha,vendedor_id,kpi_id,etapa,cantidad,created_at").eq("fecha", fecha)
    ]);

    const firstError = vRes.error ?? kRes.error ?? rRes.error;
    if (firstError) setError("No se pudo cargar la tabla. Revisa tu conexión y vuelve a intentar.");

    setVendedores((vRes.data ?? []) as Vendedor[]);
    setKpis((kRes.data ?? []) as Kpi[]);
    setRegistros((rRes.data ?? []) as RegistroKpi[]);
    setLoading(false);
  }, [fecha, supabase]);

  useEffect(() => {
    let ignore = false;
    load().then(() => {
      if (ignore) return;
    });
    return () => { ignore = true; };
  }, [load]);

  const recordMap = useMemo(() => {
    return new Map(registros.map((row) => [makeCellKey(row.vendedor_id, row.kpi_id, row.etapa), row]));
  }, [registros]);

  useEffect(() => {
    const nextDrafts: Record<CellKey, string> = {};
    registros.forEach((row) => {
      nextDrafts[makeCellKey(row.vendedor_id, row.kpi_id, row.etapa)] = formatAmount(Number(row.cantidad));
    });
    setDrafts(nextDrafts);
    setDirtyKeys(new Set());
    setCellErrors({});
  }, [fecha, registros]);

  const rows = useMemo(() => buildAvanceRows({ fecha, vendedores, kpis, registros }), [fecha, vendedores, kpis, registros]);
  const zonas = useMemo(() => [...new Set(vendedores.map((item) => item.zona))].sort(), [vendedores]);

  const visibleVendedores = useMemo(() => vendedores.filter((item) => {
    if (zona !== "todos" && item.zona !== zona) return false;
    if (vendedor !== "todos" && item.id !== vendedor) return false;
    if (search.trim()) {
      const text = `${item.zona} ${item.nombre}`.toLowerCase();
      if (!text.includes(search.trim().toLowerCase())) return false;
    }
    if (estado !== "todos") {
      const vendorRows = rows.filter((row) => row.vendedor_id === item.id);
      const current = vendorRows.every((row) => row.estado === "Completo") ? "Completo" : vendorRows.some((row) => row.estado === "Pendiente cierre") ? "Pendiente cierre" : vendorRows.some((row) => row.estado === "Pendiente corte") ? "Pendiente corte" : "Pendiente compromiso";
      if (current !== estado) return false;
    }
    return true;
  }), [estado, rows, search, vendedor, vendedores, zona]);

  const visibleKpis = useMemo(() => kpis.filter((item) => {
    if (!showAdicionales && item.tipo === "adicional") return false;
    if (grupo !== "todos" && getKpiGroup(item) !== grupo) return false;
    if (kpi !== "todos" && item.id !== kpi) return false;
    return true;
  }), [grupo, kpi, kpis, showAdicionales]);

  const groupedVisibleKpis = useMemo(() => groupKpis(visibleKpis), [visibleKpis]);
  const filteredRows = useMemo(() => buildAvanceRows({ fecha, vendedores: visibleVendedores, kpis: visibleKpis, registros }), [fecha, visibleVendedores, visibleKpis, registros]);
  const filteredRegistros = useMemo(() => registros.filter((row) => visibleVendedores.some((item) => item.id === row.vendedor_id) && visibleKpis.some((item) => item.id === row.kpi_id)), [registros, visibleKpis, visibleVendedores]);

  function cell(vendedorId: string, kpiId: string, field: "compromiso" | "corte" | "cierre" | "avance") {
    return rows.find((row) => row.vendedor_id === vendedorId && row.kpi_id === kpiId)?.[field] ?? 0;
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
      setCellErrors((current) => ({ ...current, [key]: "Ingresa un número o usa 0." }));
      return null;
    }

    const cantidad = Number(clean);
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      setCellErrors((current) => ({ ...current, [key]: "Valor inválido." }));
      return null;
    }

    setCellErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
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
      { onConflict: "fecha,vendedor_id,kpi_id,etapa" }
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
    const keys = Array.from(dirtyKeys);
    if (!keys.length) return;

    setSavingAll(true);
    setMessage("");
    let ok = true;
    for (const key of keys) {
      const saved = await saveOneCell(key);
      if (!saved) ok = false;
    }
    setSavingAll(false);

    if (ok) {
      setMessage("Cambios guardados correctamente.");
      await load();
    } else {
      setMessage("Hay celdas con error. Corrige los valores resaltados y vuelve a guardar.");
    }
  }

  function totalFor(kpiId: string, etapa: Etapa) {
    return visibleVendedores.reduce((sum, current) => {
      const key = makeCellKey(current.id, kpiId, etapa);
      const raw = drafts[key];
      const value = raw === undefined || raw.trim() === "" ? 0 : Number(raw);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  }

  async function exportExcel() {
    await downloadKpiExcel({
      fechaLabel: fecha,
      filename: `tabla-kpi-${fecha}.xlsx`,
      vendedores: visibleVendedores,
      kpis: visibleKpis,
      registros: filteredRegistros,
      avanceRows: filteredRows
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid min-w-0 gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-8">
          <Input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} aria-label="Fecha" />
          <Select value={zona} onChange={(event) => setZona(event.target.value)} aria-label="Zona"><option value="todos">Todas las zonas</option>{zonas.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
          <Select value={vendedor} onChange={(event) => setVendedor(event.target.value)} aria-label="Vendedor"><option value="todos">Todos los vendedores</option>{vendedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
          <Select value={grupo} onChange={(event) => setGrupo(event.target.value as KpiGroupName | "todos")} aria-label="Grupo KPI"><option value="todos">Todos los grupos</option>{getOrderedGroupNames(kpis).map((item) => <option key={item} value={item}>{item}</option>)}</Select>
          <Select value={kpi} onChange={(event) => setKpi(event.target.value)} aria-label="KPI"><option value="todos">Todos los KPI</option>{kpis.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
          <Select value={estado} onChange={(event) => setEstado(event.target.value)} aria-label="Estado"><option value="todos">Todos los estados</option><option>Completo</option><option>Pendiente compromiso</option><option>Pendiente corte</option><option>Pendiente cierre</option></Select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar vendedor" className="pl-10" aria-label="Buscar vendedor" />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant={viewMode === "resumen" ? "default" : "outline"} className="flex-1" onClick={() => setViewMode("resumen")}>Resumen</Button>
            <Button type="button" variant={viewMode === "detalle" ? "default" : "outline"} className="flex-1" onClick={() => setViewMode("detalle")}>Detalle editable</Button>
          </div>
          <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold xl:col-span-2">
            <input type="checkbox" checked={showAdicionales} onChange={(event) => setShowAdicionales(event.target.checked)} className="h-4 w-4 rounded" /> KPI adicionales
          </label>
          {viewMode === "detalle" ? <Button onClick={savePendingChanges} disabled={loading || savingAll || dirtyKeys.size === 0} className="xl:col-span-2"><Save className="h-4 w-4" /> {savingAll ? "Guardando..." : `Guardar cambios${dirtyKeys.size ? ` (${dirtyKeys.size})` : ""}`}</Button> : null}
          <Button variant="outline" onClick={exportExcel} disabled={loading || !visibleVendedores.length || !visibleKpis.length} className="xl:col-span-2"><Download className="h-4 w-4" /> Exportar filtros</Button>
        </CardContent>
      </Card>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
        <Badge className="border-blue-200 bg-blue-50 text-blue-700">{visibleVendedores.length} vendedores</Badge>
        <Badge className="border-blue-200 bg-blue-50 text-blue-700">{visibleKpis.length} KPI visibles</Badge>
        <span>Solo aparecen vendedores y KPI marcados como “Mostrar en Tabla Excel”. En Detalle editable puedes corregir Compromiso, Corte y Cierre; luego presiona Guardar cambios.</span>
      </div>

      {loading ? (
        <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-soft">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div>
      ) : visibleVendedores.length === 0 || visibleKpis.length === 0 ? (
        <Alert tone="warning">No hay datos con los filtros actuales. Ajusta fecha, zona, vendedor, grupo, KPI o estado. También revisa que el vendedor o KPI estén marcados como “Mostrar en Tabla Excel” en sus vistas de administración.</Alert>
      ) : (
        <div className="kpi-scrollbar max-h-[72vh] w-full max-w-full overflow-auto rounded-2xl border bg-white shadow-soft">
          <table className="min-w-max border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-30">
              <tr>
                <th className="sticky left-0 z-40 min-w-[120px] border-b bg-slate-100 px-4 py-3 text-left">Zona</th>
                <th className="sticky left-[120px] z-40 min-w-[220px] border-b bg-slate-100 px-4 py-3 text-left">Vendedor</th>
                {viewMode === "detalle" ? groupedVisibleKpis.map((group) => (
                  <Fragment key={group.name}>
                    <th colSpan={group.items.length * 4} className="border-b border-l bg-slate-100 px-4 py-2 text-left">
                      <span className="font-black">{group.name}</span>
                    </th>
                  </Fragment>
                )) : groupedVisibleKpis.map((group) => (
                  <th key={group.name} colSpan={group.items.length} className="border-b border-l bg-slate-100 px-4 py-2 text-left">
                    <span className="font-black">{group.name}</span>
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-40 border-b bg-slate-50 px-4 py-2" />
                <th className="sticky left-[120px] z-40 border-b bg-slate-50 px-4 py-2" />
                {visibleKpis.map((item) => (
                  <th key={item.id} colSpan={viewMode === "detalle" ? 4 : 1} className="min-w-[130px] border-b border-l bg-slate-50 px-3 py-2 text-center" style={item.tipo === "adicional" && item.color ? { backgroundColor: `${item.color}22` } : undefined}>
                    <span className="font-black text-slate-800">{item.nombre}</span>
                    {item.tipo === "adicional" ? <Badge className="ml-2 border-blue-200 bg-blue-50 text-blue-700">Adicional</Badge> : null}
                  </th>
                ))}
              </tr>
              {viewMode === "detalle" ? (
                <tr>
                  <th className="sticky left-0 z-40 border-b bg-white px-4 py-2" />
                  <th className="sticky left-[120px] z-40 border-b bg-white px-4 py-2" />
                  {visibleKpis.map((item) => etapas.map((etapa) => <th key={`${item.id}-${etapa.key}`} className="border-b border-l bg-white px-3 py-2 text-xs font-bold text-slate-500">{etapa.label}</th>).concat(<th key={`${item.id}-avance`} className="border-b border-l bg-white px-3 py-2 text-xs font-bold text-slate-500">% Avance</th>))}
                </tr>
              ) : null}
            </thead>
            <tbody>
              {visibleVendedores.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/40">
                  <td className="sticky left-0 z-20 min-w-[120px] border-b bg-white px-4 py-3 font-black">{item.zona}</td>
                  <td className="sticky left-[120px] z-20 min-w-[220px] border-b bg-white px-4 py-3 font-semibold">{item.nombre}</td>
                  {visibleKpis.map((currentKpi) => {
                    const avance = cell(item.id, currentKpi.id, "avance") as number | null;
                    if (viewMode === "resumen") {
                      return <td key={`${item.id}-${currentKpi.id}-resumen`} className="border-b border-l px-3 py-3 text-center"><span className={`rounded-full border px-2 py-1 text-xs font-black ${advanceTone(avance)}`}>{advanceLabel(avance)}</span></td>;
                    }

                    return (
                      <Fragment key={`${item.id}-${currentKpi.id}`}>
                        {etapas.map((etapa) => {
                          const key = makeCellKey(item.id, currentKpi.id, etapa.key);
                          const saving = savingKeys.has(key);
                          const cellError = cellErrors[key];
                          return (
                            <td key={key} className="border-b border-l px-2 py-2 text-right align-top">
                              <div className="relative">
                                <input
                                  aria-label={`${etapa.label} ${item.nombre} ${currentKpi.nombre}`}
                                  type="number"
                                  min={0}
                                  inputMode="decimal"
                                  step="0.01"
                                  value={drafts[key] ?? ""}
                                  placeholder="—"
                                  disabled={saving}
                                  onChange={(event) => setDraftValue(key, event.target.value)}
                                  onBlur={() => { if (dirtyKeys.has(key)) validateDraft(key); }}
                                  className={cn("h-9 w-24 rounded-lg border bg-white px-2 text-right font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600", dirtyKeys.has(key) && "border-yellow-300 bg-yellow-50", cellError && "border-red-300 ring-2 ring-red-100")}
                                />
                                {saving ? <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-blue-600" /> : null}
                              </div>
                              {cellError ? <p className="mt-1 w-24 text-left text-[10px] font-bold text-red-600">{cellError}</p> : null}
                            </td>
                          );
                        })}
                        <td className="border-b border-l px-3 py-3 text-center align-top"><span className={`rounded-full border px-2 py-1 text-xs font-black ${advanceTone(avance)}`}>{advanceLabel(avance)}</span></td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
              {viewMode === "detalle" ? (
                <tr className="sticky bottom-0 z-20 bg-blue-950 text-white shadow-[0_-6px_16px_rgba(15,23,42,0.12)]">
                  <td className="sticky left-0 z-30 min-w-[120px] border-t border-blue-800 bg-blue-950 px-4 py-3 font-black">Total</td>
                  <td className="sticky left-[120px] z-30 min-w-[220px] border-t border-blue-800 bg-blue-950 px-4 py-3 text-xs font-semibold text-blue-100">{visibleVendedores.length} vendedores visibles</td>
                  {visibleKpis.map((currentKpi) => (
                    <Fragment key={`total-${currentKpi.id}`}>
                      {etapas.map((etapa) => <td key={`total-${currentKpi.id}-${etapa.key}`} className="border-l border-t border-blue-800 px-3 py-3 text-right font-black">{totalFor(currentKpi.id, etapa.key).toLocaleString("es-PE")}</td>)}
                      <td className="border-l border-t border-blue-800 px-3 py-3 text-center text-xs font-bold text-blue-100">—</td>
                    </Fragment>
                  ))}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
