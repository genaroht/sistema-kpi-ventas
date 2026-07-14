"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Loader2, LockKeyhole, Power } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { Etapa, HabilitacionEtapas, Rol, Supervisor } from "@/types/database";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const stages: Array<{
  key: Etapa;
  label: string;
  field: "compromiso_activo" | "corte_activo" | "cierre_activo";
}> = [
  { key: "compromiso", label: "Compromiso", field: "compromiso_activo" },
  { key: "corte", label: "Corte 1:45 pm", field: "corte_activo" },
  { key: "cierre", label: "Cierre", field: "cierre_activo" },
];

const emptyConfig = {
  compromiso_activo: false,
  corte_activo: false,
  cierre_activo: false,
};

export function StageControl({
  fecha,
  role,
  supervisores,
}: {
  fecha: string;
  role: Rol | null;
  supervisores: Supervisor[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState("");
  const [targetSupervisor, setTargetSupervisor] = useState("");
  const [configs, setConfigs] = useState<HabilitacionEtapas[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let ignore = false;
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (ignore) return;
      setUserId(data.user?.id ?? "");
    }
    loadUser();
    return () => {
      ignore = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (role === "jefe" && userId) {
      setTargetSupervisor(userId);
      return;
    }
    if (!targetSupervisor || !supervisores.some((item) => item.usuario_id === targetSupervisor)) {
      setTargetSupervisor(supervisores[0]?.usuario_id ?? "");
    }
  }, [role, supervisores, targetSupervisor, userId]);

  useEffect(() => {
    let ignore = false;
    async function loadConfigs() {
      setLoading(true);
      setError("");
      const { data, error: queryError } = await supabase
        .from("habilitacion_etapas")
        .select(
          "id,fecha,jefe_id,compromiso_activo,corte_activo,cierre_activo,updated_by,updated_at",
        )
        .eq("fecha", fecha);
      if (ignore) return;
      if (queryError) {
        setError(
          "No se pudo consultar la habilitación de etapas. Ejecuta la migración SQL incluida y vuelve a intentar.",
        );
        setConfigs([]);
      } else {
        setConfigs((data ?? []) as HabilitacionEtapas[]);
      }
      setLoading(false);
    }
    loadConfigs();
    return () => {
      ignore = true;
    };
  }, [fecha, supabase]);

  const configMap = useMemo(
    () => new Map(configs.map((config) => [config.jefe_id, config])),
    [configs],
  );

  const selectedConfig = targetSupervisor
    ? configMap.get(targetSupervisor) ?? emptyConfig
    : emptyConfig;

  async function toggleStage(
    field: "compromiso_activo" | "corte_activo" | "cierre_activo",
    label: string,
  ) {
    if (!targetSupervisor || !userId || !(role === "administrador" || role === "jefe")) return;
    const nextValue = !selectedConfig[field];
    setSavingField(field);
    setError("");
    setMessage("");

    const payload = {
      fecha,
      jefe_id: targetSupervisor,
      compromiso_activo: selectedConfig.compromiso_activo,
      corte_activo: selectedConfig.corte_activo,
      cierre_activo: selectedConfig.cierre_activo,
      [field]: nextValue,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    const { data, error: saveError } = await supabase
      .from("habilitacion_etapas")
      .upsert(payload, { onConflict: "fecha,jefe_id" })
      .select(
        "id,fecha,jefe_id,compromiso_activo,corte_activo,cierre_activo,updated_by,updated_at",
      )
      .single();

    setSavingField(null);
    if (saveError || !data) {
      setError("No se pudo cambiar la habilitación. Revisa permisos o conexión.");
      return;
    }

    setConfigs((current) => [
      ...current.filter((item) => item.jefe_id !== targetSupervisor),
      data as HabilitacionEtapas,
    ]);
    setMessage(`${label} quedó ${nextValue ? "habilitado" : "bloqueado"}.`);
  }

  if (role === "gerente") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Habilitación de etapas por supervisor</CardTitle>
          <CardDescription>Vista global de solo lectura para la fecha seleccionada.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Consultando estados...
            </div>
          ) : error ? (
            <Alert tone="error">{error}</Alert>
          ) : (
            <div className="space-y-2">
              {supervisores.map((supervisor) => {
                const config = configMap.get(supervisor.usuario_id) ?? emptyConfig;
                return (
                  <div
                    key={supervisor.usuario_id}
                    className="flex flex-col gap-3 rounded-2xl border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-black text-slate-950">
                        {supervisor.codigo_operativo} · {supervisor.nombre}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {stages.map((stage) => (
                        <Badge
                          key={stage.key}
                          className={
                            config[stage.field]
                              ? "border-green-200 bg-green-100 text-green-700"
                              : "border-slate-200 bg-slate-100 text-slate-600"
                          }
                        >
                          {config[stage.field] ? "Activo" : "Bloqueado"} · {stage.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!(role === "administrador" || role === "jefe")) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Habilitar llenado del día</CardTitle>
            <CardDescription>
              Mientras una etapa esté bloqueada, los vendedores no podrán abrirla ni enviarla.
            </CardDescription>
          </div>
          {role === "administrador" ? (
            <div className="w-full lg:w-80">
              <label htmlFor="stage-supervisor" className="text-xs font-black text-slate-600">
                Supervisor a configurar
              </label>
              <Select
                id="stage-supervisor"
                value={targetSupervisor}
                onChange={(event) => setTargetSupervisor(event.target.value)}
                className="mt-1"
              >
                {supervisores.map((supervisor) => (
                  <option key={supervisor.usuario_id} value={supervisor.usuario_id}>
                    {supervisor.codigo_operativo} · {supervisor.nombre}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
        {loading ? (
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Consultando estados...
          </div>
        ) : !targetSupervisor ? (
          <Alert tone="warning">No hay un supervisor disponible para configurar.</Alert>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {stages.map((stage) => {
              const active = selectedConfig[stage.field];
              const saving = savingField === stage.field;
              return (
                <div
                  key={stage.key}
                  className={cn(
                    "rounded-2xl border p-4 transition",
                    active
                      ? "border-green-200 bg-green-50"
                      : "border-slate-200 bg-slate-50",
                  )}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{stage.label}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {active ? "Los vendedores pueden llenarla." : "Nadie puede llenarla."}
                      </p>
                    </div>
                    {active ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <LockKeyhole className="h-5 w-5 text-slate-500" />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant={active ? "outline" : "default"}
                    className="w-full"
                    disabled={saving || savingField !== null}
                    onClick={() => toggleStage(stage.field, stage.label)}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : active ? (
                      <Clock3 className="h-4 w-4" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                    {saving ? "Guardando..." : active ? "Bloquear" : "Habilitar"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
