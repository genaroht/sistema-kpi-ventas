"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { advanceLabel, advanceTone, todayInLima } from "@/lib/utils";
import { buildAvanceRows } from "@/lib/kpi-transform";
import { getKpiGroup, getOrderedGroupNames, type KpiGroupName } from "@/lib/kpi-groups";
import { downloadKpiExcel } from "@/lib/export/excel";
import type { AvanceRow, Kpi, RegistroKpi, Vendedor } from "@/types/database";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export function ReportesClient({ mode }: { mode: "reportes" | "exportar" }) {
  const supabase = useMemo(() => createClient(), []);
  const today = todayInLima();
  const [desde, setDesde] = useState(today);
  const [hasta, setHasta] = useState(today);
  const [loadedRange, setLoadedRange] = useState({ desde: today, hasta: today });
  const [zona, setZona] = useState("todos");
  const [vendedorId, setVendedorId] = useState("todos");
  const [kpiId, setKpiId] = useState("todos");
  const [grupo, setGrupo] = useState<KpiGroupName | "todos">("todos");
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [registros, setRegistros] = useState<RegistroKpi[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dirtyDates, setDirtyDates] = useState(false);

  const loadBase = useCallback(async () => {
    setLoadingBase(true);
    const [vRes, kRes] = await Promise.all([
      supabase.from("vendedores").select("id,usuario_id,jefe_id,nombre,zona,visible_tabla,activo,created_at").eq("activo", true).order("zona"),
      supabase.from("kpis").select("id,jefe_id,nombre,activo,tipo,color,grupo,visible_tabla,orden,created_at").eq("activo", true).eq("visible_tabla", true).order("orden")
    ]);
    const firstError = vRes.error ?? kRes.error;
    if (firstError) setError("No se pudieron cargar vendedores o KPI.");
    setVendedores((vRes.data ?? []) as Vendedor[]);
    setKpis((kRes.data ?? []) as Kpi[]);
    setLoadingBase(false);
  }, [supabase]);

  const loadRegistros = useCallback(async () => {
    setError("");
    if (desde > hasta) {
      setError("La fecha inicial no puede ser mayor que la fecha final.");
      return;
    }

    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("registros_kpi")
      .select("id,fecha,vendedor_id,kpi_id,etapa,cantidad,created_at")
      .gte("fecha", desde)
      .lte("fecha", hasta);

    if (queryError) {
      setError("No se pudieron consultar los registros. Intenta nuevamente.");
      setRegistros([]);
    } else {
      setRegistros((data ?? []) as RegistroKpi[]);
      setLoadedRange({ desde, hasta });
      setDirtyDates(false);
    }
    setLoading(false);
  }, [desde, hasta, supabase]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadRegistros(); }, []); // consulta inicial del día actual

  const zonas = useMemo(() => [...new Set(vendedores.map((v) => v.zona))].sort(), [vendedores]);

  const filteredVendedores = useMemo(() => vendedores.filter((v) => {
    if (zona !== "todos" && v.zona !== zona) return false;
    if (vendedorId !== "todos" && v.id !== vendedorId) return false;
    return true;
  }), [vendedorId, vendedores, zona]);

  const filteredKpis = useMemo(() => kpis.filter((k) => {
    if (grupo !== "todos" && getKpiGroup(k) !== grupo) return false;
    if (kpiId !== "todos" && k.id !== kpiId) return false;
    return true;
  }), [grupo, kpiId, kpis]);

  const avanceRows = useMemo(() => {
    const dates = [...new Set(registros.map((r) => r.fecha))].sort();
    const rows: AvanceRow[] = [];
    dates.forEach((date) => {
      const dateRows = registros.filter((r) => r.fecha === date);
      rows.push(...buildAvanceRows({ fecha: date, vendedores: filteredVendedores, kpis: filteredKpis, registros: dateRows }));
    });
    return rows;
  }, [registros, filteredVendedores, filteredKpis]);

  const filteredRegistros = useMemo(() => registros.filter((r) => filteredVendedores.some((v) => v.id === r.vendedor_id) && filteredKpis.some((k) => k.id === r.kpi_id)), [filteredKpis, filteredVendedores, registros]);

  async function exportExcel() {
    const dateForMatrix = loadedRange.hasta;
    const matrixRows = filteredRegistros.filter((r) => r.fecha === dateForMatrix);
    await downloadKpiExcel({
      fechaLabel: `${loadedRange.desde}_${loadedRange.hasta}`,
      filename: `kpi-ventas-${loadedRange.desde}-${loadedRange.hasta}.xlsx`,
      vendedores: filteredVendedores,
      kpis: filteredKpis,
      registros: matrixRows,
      avanceRows
    });
  }

  function onDesdeChange(value: string) {
    setDesde(value);
    setDirtyDates(true);
  }

  function onHastaChange(value: string) {
    setHasta(value);
    setDirtyDates(true);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid min-w-0 gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-8">
          <Input type="date" value={desde} onChange={(event) => onDesdeChange(event.target.value)} aria-label="Fecha inicial" />
          <Input type="date" value={hasta} onChange={(event) => onHastaChange(event.target.value)} aria-label="Fecha final" />
          <Select value={zona} onChange={(event) => setZona(event.target.value)} aria-label="Zona"><option value="todos">Todas las zonas</option>{zonas.map((z) => <option key={z} value={z}>{z}</option>)}</Select>
          <Select value={vendedorId} onChange={(event) => setVendedorId(event.target.value)} aria-label="Vendedor"><option value="todos">Todos los vendedores</option>{vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}</Select>
          <Select value={grupo} onChange={(event) => setGrupo(event.target.value as KpiGroupName | "todos")} aria-label="Grupo KPI"><option value="todos">Todos los grupos</option>{getOrderedGroupNames(kpis).map((item) => <option key={item} value={item}>{item}</option>)}</Select>
          <Select value={kpiId} onChange={(event) => setKpiId(event.target.value)} aria-label="KPI"><option value="todos">Todos los KPI</option>{kpis.map((k) => <option key={k.id} value={k.id}>{k.nombre}</option>)}</Select>
          <Button variant="outline" onClick={loadRegistros} disabled={loading}><Search className="h-4 w-4" /> {loading ? "Consultando..." : "Consultar"}</Button>
          <Button onClick={exportExcel} disabled={loading || !avanceRows.length}><Download className="h-4 w-4" /> Descargar Excel</Button>
        </CardContent>
      </Card>

      {dirtyDates ? <Alert tone="warning">Cambiaste el rango de fechas. Presiona <b>Consultar</b> para cargar los registros de {desde} a {hasta}.</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {mode === "exportar" ? (
        <Alert tone="info">El Excel respeta los filtros aplicados y genera 3 hojas: <b>Vista Matriz</b>, <b>Data Base</b> y <b>Avance %</b>. La hoja Vista Matriz usa la fecha final consultada.</Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
        <Badge className="border-slate-200 bg-white text-slate-700">Rango consultado: {loadedRange.desde} a {loadedRange.hasta}</Badge>
        <Badge className="border-blue-200 bg-blue-50 text-blue-700">{avanceRows.length} filas</Badge>
      </div>

      {loadingBase || loading ? (
        <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-soft">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div>
      ) : avanceRows.length === 0 ? (
        <Alert tone="warning">No hay datos para el rango y filtros actuales.</Alert>
      ) : (
        <div className="kpi-scrollbar max-h-[72vh] w-full max-w-full overflow-auto rounded-2xl border bg-white shadow-soft">
          <table className="min-w-[1000px] w-full text-sm">
            <thead className="sticky top-0 z-10"><tr className="border-b bg-slate-100"><th className="p-3 text-left">Fecha</th><th className="p-3 text-left">Zona</th><th className="p-3 text-left">Vendedor</th><th className="p-3 text-left">KPI</th><th className="p-3 text-right">Compromiso</th><th className="p-3 text-right">Corte</th><th className="p-3 text-right">Cierre</th><th className="p-3 text-center">% Avance</th><th className="p-3 text-left">Estado</th></tr></thead>
            <tbody>{avanceRows.map((row) => <tr key={`${row.fecha}-${row.vendedor_id}-${row.kpi_id}`} className="border-b hover:bg-blue-50/50"><td className="p-3">{row.fecha}</td><td className="p-3 font-bold">{row.zona}</td><td className="p-3">{row.vendedor}</td><td className="p-3">{row.kpi}</td><td className="p-3 text-right">{row.compromiso}</td><td className="p-3 text-right">{row.corte}</td><td className="p-3 text-right">{row.cierre}</td><td className="p-3 text-center"><span className={`rounded-full border px-2 py-1 text-xs font-black ${advanceTone(row.avance)}`}>{advanceLabel(row.avance)}</span></td><td className="p-3">{row.estado}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
