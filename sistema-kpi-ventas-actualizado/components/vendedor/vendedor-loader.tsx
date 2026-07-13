"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { todayInLima } from "@/lib/utils";
import type { Kpi, RegistroKpi, Rol, Vendedor } from "@/types/database";
import { VendedorDia } from "@/components/vendedor/vendedor-dia";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Payload = { vendedor: Vendedor; fecha: string; kpis: Kpi[]; registros: RegistroKpi[] };

type ProfileRole = { activo?: boolean | null; roles?: { codigo?: Rol | null } | null } | null;

export function VendedorLoader() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function load() {
      setError("");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("usuarios")
        .select("id,activo,roles(codigo)")
        .eq("id", user.id)
        .single();

      const typedProfile = profile as ProfileRole;
      const rol = typedProfile?.roles?.codigo ?? undefined;
      if (!typedProfile?.activo || !rol) {
        router.replace("/login?error=perfil");
        return;
      }
      if (rol !== "vendedor") {
        router.replace("/admin/dashboard");
        return;
      }

      const { data: vendedor, error: vendedorError } = await supabase
        .from("vendedores")
        .select("id,usuario_id,jefe_id,nombre,zona,visible_tabla,activo,created_at")
        .eq("usuario_id", user.id)
        .eq("activo", true)
        .single();

      if (vendedorError || !vendedor) {
        setError("Usuario sin vendedor activo asignado. Pide al administrador o supervisor que vincule tu usuario.");
        return;
      }

      const fecha = todayInLima();
      const [kRes, rRes] = await Promise.all([
        supabase.from("kpis").select("id,jefe_id,nombre,activo,tipo,color,grupo,visible_tabla,orden,created_at").eq("activo", true).order("orden"),
        supabase.from("registros_kpi").select("id,fecha,vendedor_id,kpi_id,etapa,cantidad,created_at").eq("fecha", fecha).eq("vendedor_id", vendedor.id)
      ]);

      if (ignore) return;

      if (kRes.error || rRes.error) {
        setError("No se pudo cargar tu panel. Revisa tu conexión e inténtalo nuevamente.");
        return;
      }

      const kpis = (kRes.data ?? []) as Kpi[];
      if (!kpis.length) {
        setError("No hay KPI activos para tu supervisor. Pide al supervisor o administrador que los active.");
        return;
      }

      setPayload({ vendedor: vendedor as Vendedor, fecha, kpis, registros: (rRes.data ?? []) as RegistroKpi[] });
    }

    load();
    return () => { ignore = true; };
  }, [router, supabase]);

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.20),transparent_34%),linear-gradient(180deg,#eff6ff_0%,#f8fafc_38%,#ffffff_100%)] p-4">
        <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-soft">
          <Alert tone="error">{error}</Alert>
          <Button className="mt-4 w-full" onClick={() => router.replace("/login")}>Volver al login</Button>
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.20),transparent_34%),linear-gradient(180deg,#eff6ff_0%,#f8fafc_38%,#ffffff_100%)] p-4">
        <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-soft">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </div>
      </main>
    );
  }

  return <VendedorDia {...payload} />;
}
