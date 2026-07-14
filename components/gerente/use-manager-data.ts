"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { HabilitacionEtapas, Kpi, RegistroKpi, Supervisor, Vendedor } from "@/types/database";

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

function addDays(date: string, days: number) {
  const current = new Date(`${date}T00:00:00`);
  current.setDate(current.getDate() + days);
  return current.toISOString().slice(0, 10);
}

type AssignedUser = {
  id: string;
  nombre: string | null;
  codigo_operativo: string | null;
  activo: boolean;
  roles?: { codigo?: string } | null;
};

export function useManagerData(params: {
  managerId: string;
  fecha: string;
  trendDays?: number;
}) {
  const { managerId, fecha, trendDays = 1 } = params;
  const supabase = useMemo(() => createClient(), []);
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [registros, setRegistros] = useState<RegistroKpi[]>([]);
  const [trendRegistros, setTrendRegistros] = useState<RegistroKpi[]>([]);
  const [habilitaciones, setHabilitaciones] = useState<HabilitacionEtapas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");

      const assignedUsersRes = await supabase
        .from("usuarios")
        .select("id,nombre,codigo_operativo,activo,roles(codigo)")
        .eq("jefe_id", managerId)
        .eq("activo", true)
        .order("nombre");

      if (ignore) return;
      if (assignedUsersRes.error) {
        setError("No se pudieron cargar los supervisores asignados al gerente.");
        setLoading(false);
        return;
      }

      const assignedUsers = ((assignedUsersRes.data ?? []) as AssignedUser[]).filter(
        (item) => item.roles?.codigo === "jefe",
      );
      const supervisorIds = assignedUsers.map((item) => item.id);
      const scopedIds = supervisorIds.length ? supervisorIds : [EMPTY_UUID];
      const desde = addDays(fecha, -(Math.max(1, trendDays) - 1));

      const [sRes, vRes, kRes, hRes] = await Promise.all([
        supabase
          .from("supervisores")
          .select("id,usuario_id,codigo_operativo,nombre,activo,created_at")
          .in("usuario_id", scopedIds)
          .eq("activo", true)
          .order("codigo_operativo"),
        supabase
          .from("vendedores")
          .select("id,usuario_id,jefe_id,nombre,zona,visible_tabla,activo,created_at")
          .in("jefe_id", scopedIds)
          .eq("activo", true)
          .eq("visible_tabla", true)
          .order("zona")
          .order("nombre"),
        supabase
          .from("kpis")
          .select("id,jefe_id,nombre,activo,tipo,color,grupo,visible_tabla,orden,created_at")
          .in("jefe_id", scopedIds)
          .eq("activo", true)
          .eq("visible_tabla", true)
          .order("orden"),
        supabase
          .from("habilitacion_etapas")
          .select("id,fecha,jefe_id,compromiso_activo,corte_activo,cierre_activo,updated_by,updated_at")
          .in("jefe_id", scopedIds)
          .eq("fecha", fecha),
      ]);

      if (ignore) return;
      const firstError = sRes.error ?? vRes.error ?? kRes.error ?? hRes.error;
      if (firstError) {
        setError("No se pudo cargar la información gerencial.");
        setLoading(false);
        return;
      }

      const loadedVendedores = (vRes.data ?? []) as Vendedor[];
      const vendorIds = loadedVendedores.map((item) => item.id);
      const scopedVendorIds = vendorIds.length ? vendorIds : [EMPTY_UUID];

      const [dayRes, trendRes] = await Promise.all([
        supabase
          .from("registros_kpi")
          .select("id,fecha,vendedor_id,kpi_id,etapa,cantidad,created_at")
          .in("vendedor_id", scopedVendorIds)
          .eq("fecha", fecha),
        supabase
          .from("registros_kpi")
          .select("id,fecha,vendedor_id,kpi_id,etapa,cantidad,created_at")
          .in("vendedor_id", scopedVendorIds)
          .gte("fecha", desde)
          .lte("fecha", fecha),
      ]);

      if (ignore) return;
      if (dayRes.error || trendRes.error) {
        setError("No se pudieron cargar los registros de avance.");
      }

      const supervisors = (sRes.data ?? []) as Supervisor[];
      const supervisorById = new Map(supervisors.map((item) => [item.usuario_id, item]));
      assignedUsers.forEach((item) => {
        if (!supervisorById.has(item.id)) {
          supervisors.push({
            id: item.id,
            usuario_id: item.id,
            codigo_operativo: item.codigo_operativo ?? "S/C",
            nombre: item.nombre ?? "Supervisor",
            activo: item.activo,
            created_at: "",
          });
        }
      });

      setSupervisores(supervisors.sort((a, b) => a.codigo_operativo.localeCompare(b.codigo_operativo, "es")));
      setVendedores(loadedVendedores);
      setKpis((kRes.data ?? []) as Kpi[]);
      setHabilitaciones((hRes.data ?? []) as HabilitacionEtapas[]);
      setRegistros((dayRes.data ?? []) as RegistroKpi[]);
      setTrendRegistros((trendRes.data ?? []) as RegistroKpi[]);
      setLoading(false);
    }

    void load();
    return () => {
      ignore = true;
    };
  }, [fecha, managerId, supabase, trendDays]);

  return {
    supervisores,
    vendedores,
    kpis,
    registros,
    trendRegistros,
    habilitaciones,
    loading,
    error,
  };
}
