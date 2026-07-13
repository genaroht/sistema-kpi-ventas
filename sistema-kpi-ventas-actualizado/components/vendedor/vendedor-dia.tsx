"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Clock, Loader2, LogOut, Send, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { advanceTone, formatDateHuman, numberOrZero, stageLabel } from "@/lib/utils";
import { groupKpis } from "@/lib/kpi-groups";
import type { Etapa, Kpi, RegistroKpi, Vendedor } from "@/types/database";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const stages: Etapa[] = ["compromiso", "corte", "cierre"];

function isFilledValue(value: string | undefined) {
  return value !== undefined && value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
}

export function VendedorDia({ vendedor, fecha, kpis, registros }: { vendedor: Vendedor; fecha: string; kpis: Kpi[]; registros: RegistroKpi[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const groupedKpis = useMemo(() => groupKpis(kpis), [kpis]);

  const byStage = useMemo(() => {
    return stages.reduce((acc, stage) => {
      acc[stage] = new Map(registros.filter((r) => r.etapa === stage).map((r) => [r.kpi_id, r]));
      return acc;
    }, {} as Record<Etapa, Map<string, RegistroKpi>>);
  }, [registros]);

  const stageDone = (stage: Etapa) => kpis.length > 0 && kpis.every((kpi) => byStage[stage]?.has(kpi.id));
  const currentStage: Etapa | null = !stageDone("compromiso") ? "compromiso" : !stageDone("corte") ? "corte" : !stageDone("cierre") ? "cierre" : null;

  const statusText = !stageDone("compromiso")
    ? "Pendiente compromiso"
    : !stageDone("corte")
      ? "Corte habilitado"
      : !stageDone("cierre")
        ? "Cierre habilitado"
        : "Completo";

  const pendingKpis = useMemo(() => currentStage ? kpis.filter((kpi) => !byStage[currentStage]?.has(kpi.id)) : [], [byStage, currentStage, kpis]);

  useEffect(() => {
    if (!currentStage || pendingKpis.length === 0) return;
    setValues((current) => {
      let changed = false;
      const next = { ...current };
      pendingKpis.forEach((kpi) => {
        if (next[kpi.id] === undefined || next[kpi.id]?.trim() === "") {
          next[kpi.id] = "0";
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [currentStage, pendingKpis]);
  const stageCompletedCount = useMemo(() => {
    if (!currentStage) return kpis.length;
    const saved = byStage[currentStage]?.size ?? 0;
    const typed = pendingKpis.filter((kpi) => isFilledValue(values[kpi.id])).length;
    return Math.min(kpis.length, saved + typed);
  }, [byStage, currentStage, kpis.length, pendingKpis, values]);
  const progress = kpis.length ? (stageCompletedCount / kpis.length) * 100 : 0;

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function validateStage() {
    if (!currentStage || loading) return false;

    const nextErrors: Record<string, string> = {};
    pendingKpis.forEach((kpi) => {
      const raw = values[kpi.id];
      const parsed = Number(raw);
      if (raw === undefined || raw.trim() === "") nextErrors[kpi.id] = "Campo requerido. Ingresa 0 si no hubo avance.";
      else if (!Number.isFinite(parsed)) nextErrors[kpi.id] = "Ingresa un número válido.";
      else if (parsed < 0) nextErrors[kpi.id] = "No se permiten cantidades negativas.";
    });

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const groupsWithErrors = groupedKpis.reduce((acc, group) => {
        if (group.items.some((kpi) => nextErrors[kpi.id])) acc[group.name] = true;
        return acc;
      }, {} as Record<string, boolean>);
      setOpenGroups((current) => ({ ...current, ...groupsWithErrors }));
      setError("Revisa los campos resaltados antes de enviar.");

      const firstErrorId = pendingKpis.find((kpi) => nextErrors[kpi.id])?.id;
      if (firstErrorId) {
        window.setTimeout(() => {
          fieldRefs.current[firstErrorId]?.scrollIntoView({ behavior: "smooth", block: "center" });
          fieldRefs.current[firstErrorId]?.focus();
        }, 60);
      }
      return false;
    }

    setError(null);
    return true;
  }

  function askConfirm() {
    if (validateStage()) setConfirmOpen(true);
  }

  async function submitStage() {
    if (!currentStage || !validateStage() || loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const payload = pendingKpis.map((kpi) => ({
      fecha,
      vendedor_id: vendedor.id,
      kpi_id: kpi.id,
      etapa: currentStage,
      cantidad: numberOrZero(values[kpi.id])
    }));

    if (payload.length === 0) {
      setLoading(false);
      setConfirmOpen(false);
      router.refresh();
      return;
    }

    const { error: insertError } = await supabase.from("registros_kpi").insert(payload);
    setLoading(false);
    setConfirmOpen(false);

    if (insertError) {
      setError(insertError.message.toLowerCase().includes("duplicate") ? "Esta etapa ya fue enviada o contiene registros duplicados." : "No se pudo guardar. Revisa tu conexión o comunícate con el administrador.");
      return;
    }

    setValues({});
    setFieldErrors({});
    setMessage(`${stageLabel(currentStage)} enviado correctamente.`);
    router.refresh();
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.20),transparent_34%),linear-gradient(180deg,#eff6ff_0%,#f8fafc_38%,#ffffff_100%)] pb-28 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-r from-slate-950 via-blue-950 to-blue-900 text-white shadow-lg backdrop-blur">
        <div className="container flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-300">Panel vendedor</p>
            <h1 className="truncate text-lg font-black text-white">{vendedor.nombre}</h1>
            <p className="text-sm text-blue-100">Zona {vendedor.zona}</p>
          </div>
          <Button variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={signOut}><LogOut className="h-4 w-4" /> Salir</Button>
        </div>
        {currentStage ? (
          <div className="border-t border-white/10 bg-white/10">
            <div className="container py-2">
              <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black text-blue-50">
                <span>{stageLabel(currentStage)}</span>
                <span>{stageCompletedCount}/{kpis.length} KPIs completados</span>
              </div>
              <Progress value={progress} label="Progreso de registro de KPI" />
            </div>
          </div>
        ) : null}
      </header>

      <section className="container space-y-4 pt-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{formatDateHuman(fecha)}</CardTitle>
                <CardDescription>Completa las etapas en orden. Los KPI enviados quedan bloqueados para evitar duplicados.</CardDescription>
              </div>
              <Badge className={stageDone("cierre") ? "border-green-200 bg-green-100 text-green-700" : "border-blue-200 bg-blue-100 text-blue-700"}>
                {stageDone("cierre") ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <Clock className="mr-1 h-3.5 w-3.5" />}
                {statusText}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3">
              {stages.map((stage) => (
                <div key={stage} className={cn("rounded-xl border p-3", stageDone(stage) ? "border-green-200 bg-green-50" : currentStage === stage ? "border-blue-200 bg-blue-50" : "bg-blue-50")}>
                  <p className="text-sm font-black">{stageLabel(stage)}</p>
                  <p className="text-xs text-slate-500">{stageDone(stage) ? "Enviado" : currentStage === stage ? "Habilitado" : "Bloqueado"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {message ? <Alert tone="success">{message}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Card>
          <CardHeader>
            <CardTitle>{currentStage ? stageLabel(currentStage) : "Día completo"}</CardTitle>
            <CardDescription>{currentStage ? "Los KPI están agrupados para registrar más rápido y con menos errores." : "Ya enviaste compromiso, corte y cierre."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {kpis.length === 0 ? (
              <Alert tone="warning">No hay KPI activos asignados. Comunícate con tu supervisor o administrador.</Alert>
            ) : null}

            <div className="space-y-3">
              {groupedKpis.map((group, index) => {
                const isOpen = openGroups[group.name] ?? index === 0;
                const groupCompleted = currentStage
                  ? group.items.filter((kpi) => byStage[currentStage]?.has(kpi.id) || isFilledValue(values[kpi.id])).length
                  : group.items.length;
                const groupProgress = group.items.length ? (groupCompleted / group.items.length) * 100 : 0;

                return (
                  <section key={group.name} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      onClick={() => setOpenGroups((current) => ({ ...current, [group.name]: !isOpen }))}
                      aria-expanded={isOpen}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-slate-950">{group.name}</h3>
                          <Badge className="border-slate-200 bg-white text-slate-700">{groupCompleted}/{group.items.length}</Badge>
                        </div>
                        <Progress value={groupProgress} className="mt-2 h-1.5" label={`Progreso ${group.name}`} />
                      </div>
                      <ChevronDown className={cn("h-5 w-5 shrink-0 text-slate-500 transition", isOpen && "rotate-180")} />
                    </button>

                    {isOpen ? (
                      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                        {group.items.map((kpi) => {
                          const lockedValue = currentStage ? byStage[currentStage]?.get(kpi.id)?.cantidad : byStage.cierre.get(kpi.id)?.cantidad;
                          const locked = lockedValue !== undefined || !currentStage;
                          const fieldError = fieldErrors[kpi.id];
                          return (
                            <div key={kpi.id} className={cn("rounded-2xl border bg-white p-4 shadow-sm", fieldError ? "border-red-300 ring-2 ring-red-100" : locked ? "border-green-200 bg-green-50/50" : "border-slate-200")}>
                              <div className="mb-3 flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="font-black text-slate-950">{kpi.nombre}</h4>
                                  {kpi.tipo === "adicional" ? <Badge className="mt-1 border-blue-200 bg-blue-50 text-blue-700">Adicional</Badge> : null}
                                </div>
                                {locked ? <ShieldCheck className="h-5 w-5 shrink-0 text-green-600" /> : null}
                              </div>
                              <Label htmlFor={`${currentStage ?? "completo"}-${kpi.id}`}>Cantidad</Label>
                              <Input
                                ref={(node) => { fieldRefs.current[kpi.id] = node; }}
                                id={`${currentStage ?? "completo"}-${kpi.id}`}
                                type="number"
                                min={0}
                                inputMode="decimal"
                                step="0.01"
                                placeholder="0"
                                disabled={locked || loading}
                                value={locked ? String(lockedValue ?? "") : values[kpi.id] ?? ""}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setValues((prev) => ({ ...prev, [kpi.id]: nextValue }));
                                  setFieldErrors((prev) => {
                                    if (!prev[kpi.id]) return prev;
                                    const next = { ...prev };
                                    delete next[kpi.id];
                                    return next;
                                  });
                                }}
                                aria-invalid={!!fieldError}
                                aria-describedby={fieldError ? `${kpi.id}-error` : undefined}
                                className={cn("mt-2 h-14 text-2xl font-black", fieldError && "border-red-300 focus-visible:ring-red-500")}
                              />
                              {fieldError ? <p id={`${kpi.id}-error`} className="mt-2 text-xs font-semibold text-red-600">{fieldError}</p> : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>

            {!currentStage && kpis.length > 0 ? (
              <div className={`rounded-2xl border p-5 text-center font-black ${advanceTone(100)}`}>Día completo. Los datos ya no pueden editarse desde esta vista.</div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {currentStage ? (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-3 shadow-[0_-12px_28px_rgba(15,23,42,0.10)] backdrop-blur md:sticky md:bottom-0">
          <div className="container flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-xs font-bold text-slate-500 sm:text-left">Revisa tus cantidades antes de enviar. Los campos enviados quedan bloqueados.</p>
            <Button className="h-12 text-base sm:min-w-64" onClick={askConfirm} disabled={loading || kpis.length === 0}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {loading ? "Enviando..." : `Enviar ${stageLabel(currentStage)}`}
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="¿Estás seguro de enviar?"
        description="Luego no podrás modificar estos datos desde esta vista. Si hay un error, solo el supervisor o administrador podrá corregirlo."
        confirmText="Sí, enviar"
        loading={loading}
        onConfirm={submitStage}
        onClose={() => setConfirmOpen(false)}
      />
    </main>
  );
}
