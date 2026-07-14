"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  LockKeyhole,
  LogOut,
  PlayCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { advanceTone, formatDateHuman, numberOrZero, stageLabel } from "@/lib/utils";
import { groupKpis } from "@/lib/kpi-groups";
import type {
  Etapa,
  HabilitacionEtapas,
  Kpi,
  RegistroKpi,
  Vendedor,
} from "@/types/database";
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
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const stages: Etapa[] = ["compromiso", "corte", "cierre"];

function isFilledValue(value: string | undefined) {
  return (
    value !== undefined &&
    value.trim() !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0
  );
}

function stageEnabled(habilitacion: HabilitacionEtapas | null, stage: Etapa) {
  if (!habilitacion) return false;
  if (stage === "compromiso") return habilitacion.compromiso_activo;
  if (stage === "corte") return habilitacion.corte_activo;
  return habilitacion.cierre_activo;
}

export function VendedorDia({
  vendedor,
  fecha,
  kpis,
  registros,
  habilitacion,
}: {
  vendedor: Vendedor;
  fecha: string;
  kpis: Kpi[];
  registros: RegistroKpi[];
  habilitacion: HabilitacionEtapas | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [selectedStage, setSelectedStage] = useState<Etapa | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const groupedKpis = useMemo(() => groupKpis(kpis), [kpis]);
  const byStage = useMemo(
    () =>
      stages.reduce((acc, stage) => {
        acc[stage] = new Map(
          registros.filter((row) => row.etapa === stage).map((row) => [row.kpi_id, row]),
        );
        return acc;
      }, {} as Record<Etapa, Map<string, RegistroKpi>>),
    [registros],
  );

  const stageDone = (stage: Etapa) =>
    kpis.length > 0 && kpis.every((kpi) => byStage[stage]?.has(kpi.id));

  const nextPendingStage: Etapa | null = !stageDone("compromiso")
    ? "compromiso"
    : !stageDone("corte")
      ? "corte"
      : !stageDone("cierre")
        ? "cierre"
        : null;

  const availableStage =
    nextPendingStage && stageEnabled(habilitacion, nextPendingStage)
      ? nextPendingStage
      : null;

  useEffect(() => {
    if (selectedStage && selectedStage !== availableStage) {
      setSelectedStage(null);
      setValues({});
      setFieldErrors({});
    }
  }, [availableStage, selectedStage]);

  const pendingKpis = useMemo(
    () =>
      selectedStage
        ? kpis.filter((kpi) => !byStage[selectedStage]?.has(kpi.id))
        : [],
    [byStage, kpis, selectedStage],
  );

  useEffect(() => {
    if (!selectedStage || pendingKpis.length === 0) return;
    setValues((current) => {
      const next = { ...current };
      let changed = false;
      pendingKpis.forEach((kpi) => {
        if (next[kpi.id] === undefined || next[kpi.id].trim() === "") {
          next[kpi.id] = "0";
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [pendingKpis, selectedStage]);

  const stageCompletedCount = useMemo(() => {
    if (!selectedStage) return 0;
    const saved = byStage[selectedStage]?.size ?? 0;
    const typed = pendingKpis.filter((kpi) => isFilledValue(values[kpi.id])).length;
    return Math.min(kpis.length, saved + typed);
  }, [byStage, kpis.length, pendingKpis, selectedStage, values]);

  const progress = kpis.length ? (stageCompletedCount / kpis.length) * 100 : 0;

  const statusText = stageDone("cierre")
    ? "Completo"
    : availableStage
      ? `${stageLabel(availableStage)} habilitado`
      : nextPendingStage
        ? `${stageLabel(nextPendingStage)} bloqueado`
        : "Bloqueado";

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function openStage(stage: Etapa) {
    if (stage !== availableStage || loading) return;
    setSelectedStage(stage);
    setValues({});
    setFieldErrors({});
    setMessage(null);
    setError(null);
  }

  function validateStage() {
    if (!selectedStage || selectedStage !== availableStage || loading) return false;
    const nextErrors: Record<string, string> = {};
    pendingKpis.forEach((kpi) => {
      const raw = values[kpi.id];
      const parsed = Number(raw);
      if (raw === undefined || raw.trim() === "") {
        nextErrors[kpi.id] = "Ingresa 0 si este KPI no tuvo dato.";
      } else if (!Number.isFinite(parsed)) {
        nextErrors[kpi.id] = "Ingresa un número válido.";
      } else if (parsed < 0) {
        nextErrors[kpi.id] = "No se permiten cantidades negativas.";
      }
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
    if (!selectedStage || selectedStage !== availableStage || !validateStage() || loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const payload = pendingKpis.map((kpi) => ({
      fecha,
      vendedor_id: vendedor.id,
      kpi_id: kpi.id,
      etapa: selectedStage,
      cantidad: numberOrZero(values[kpi.id]),
    }));

    const { error: insertError } = await supabase.from("registros_kpi").insert(payload);
    setLoading(false);
    setConfirmOpen(false);

    if (insertError) {
      const normalized = insertError.message.toLowerCase();
      setError(
        normalized.includes("deshabilitada") || normalized.includes("bloqueada")
          ? "La etapa fue bloqueada por el supervisor. Actualiza la página."
          : normalized.includes("duplicate")
            ? "Esta etapa ya fue enviada."
            : "No se pudo guardar. Revisa tu conexión o comunícate con el supervisor.",
      );
      return;
    }

    setMessage(`${stageLabel(selectedStage)} enviado correctamente.`);
    window.setTimeout(() => window.location.reload(), 450);
  }

  function stageCardState(stage: Etapa) {
    if (stageDone(stage)) return "done" as const;
    if (stage === availableStage) return "active" as const;
    return "locked" as const;
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
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" /> Salir
          </Button>
        </div>
        {selectedStage ? (
          <div className="border-t border-white/10 bg-white/10">
            <div className="container py-2">
              <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black text-blue-50">
                <span>{stageLabel(selectedStage)}</span>
                <span>{stageCompletedCount}/{kpis.length} KPI listos</span>
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
                <CardDescription>
                  Las etapas se completan en orden. Selecciona una tarjeta habilitada para comenzar.
                </CardDescription>
              </div>
              <Badge
                className={
                  stageDone("cierre")
                    ? "border-green-200 bg-green-100 text-green-700"
                    : availableStage
                      ? "border-blue-200 bg-blue-100 text-blue-700"
                      : "border-slate-200 bg-slate-100 text-slate-600"
                }
              >
                {stageDone("cierre") ? (
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                ) : availableStage ? (
                  <Clock className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <LockKeyhole className="mr-1 h-3.5 w-3.5" />
                )}
                {statusText}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3">
              {stages.map((stage) => {
                const state = stageCardState(stage);
                const selected = selectedStage === stage;
                return (
                  <button
                    key={stage}
                    type="button"
                    disabled={state !== "active" || loading}
                    onClick={() => openStage(stage)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                      state === "done" && "border-green-200 bg-green-50",
                      state === "active" && "cursor-pointer border-blue-300 bg-blue-50 hover:bg-blue-100",
                      state === "locked" && "cursor-not-allowed border-slate-200 bg-slate-100 opacity-75",
                      selected && "ring-2 ring-blue-600",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black">{stageLabel(stage)}</p>
                      {state === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : state === "active" ? (
                        <PlayCircle className="h-4 w-4 text-blue-600" />
                      ) : (
                        <LockKeyhole className="h-4 w-4 text-slate-500" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {state === "done" ? "Enviado" : state === "active" ? "Habilitado · haz clic" : "Bloqueado"}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {message ? <Alert tone="success">{message}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}

        {!selectedStage ? (
          <Alert tone={availableStage ? "info" : stageDone("cierre") ? "success" : "warning"}>
            {stageDone("cierre")
              ? "Completaste compromiso, corte y cierre del día."
              : availableStage
                ? `Haz clic en la tarjeta ${stageLabel(availableStage)} para ingresar los datos.`
                : `${stageLabel(nextPendingStage ?? "etapa")} está bloqueado. Espera que el supervisor o administrador lo habilite.`}
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{stageLabel(selectedStage)}</CardTitle>
              <CardDescription>
                Todos los campos comienzan en 0. Cambia únicamente los KPI que tengan una cantidad diferente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {groupedKpis.map((group, index) => {
                  const isOpen = openGroups[group.name] ?? index === 0;
                  const groupCompleted = group.items.filter(
                    (kpi) => byStage[selectedStage]?.has(kpi.id) || isFilledValue(values[kpi.id]),
                  ).length;
                  const groupProgress = group.items.length
                    ? (groupCompleted / group.items.length) * 100
                    : 0;

                  return (
                    <section key={group.name} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        onClick={() =>
                          setOpenGroups((current) => ({ ...current, [group.name]: !isOpen }))
                        }
                        aria-expanded={isOpen}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-slate-950">{group.name}</h3>
                            <Badge className="border-slate-200 bg-white text-slate-700">
                              {groupCompleted}/{group.items.length}
                            </Badge>
                          </div>
                          <Progress
                            value={groupProgress}
                            className="mt-2 h-1.5"
                            label={`Progreso ${group.name}`}
                          />
                        </div>
                        <ChevronDown
                          className={cn(
                            "h-5 w-5 shrink-0 text-slate-500 transition",
                            isOpen && "rotate-180",
                          )}
                        />
                      </button>

                      {isOpen ? (
                        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                          {group.items.map((kpi) => {
                            const lockedValue = byStage[selectedStage]?.get(kpi.id)?.cantidad;
                            const locked = lockedValue !== undefined;
                            const fieldError = fieldErrors[kpi.id];
                            return (
                              <div
                                key={kpi.id}
                                className={cn(
                                  "rounded-2xl border bg-white p-4 shadow-sm",
                                  fieldError
                                    ? "border-red-300 ring-2 ring-red-100"
                                    : locked
                                      ? "border-green-200 bg-green-50/50"
                                      : "border-slate-200",
                                )}
                              >
                                <div className="mb-3 flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <h4 className="font-black text-slate-950">{kpi.nombre}</h4>
                                    {kpi.tipo === "adicional" ? (
                                      <Badge className="mt-1 border-blue-200 bg-blue-50 text-blue-700">Adicional</Badge>
                                    ) : null}
                                  </div>
                                  {locked ? <ShieldCheck className="h-5 w-5 shrink-0 text-green-600" /> : null}
                                </div>
                                <Label htmlFor={`${selectedStage}-${kpi.id}`}>Cantidad</Label>
                                <Input
                                  ref={(node) => {
                                    fieldRefs.current[kpi.id] = node;
                                  }}
                                  id={`${selectedStage}-${kpi.id}`}
                                  type="number"
                                  min={0}
                                  inputMode="decimal"
                                  step="0.01"
                                  placeholder="0"
                                  disabled={locked || loading}
                                  value={locked ? String(lockedValue ?? 0) : values[kpi.id] ?? "0"}
                                  onChange={(event) => {
                                    const nextValue = event.target.value;
                                    setValues((previous) => ({ ...previous, [kpi.id]: nextValue }));
                                    setFieldErrors((previous) => {
                                      if (!previous[kpi.id]) return previous;
                                      const next = { ...previous };
                                      delete next[kpi.id];
                                      return next;
                                    });
                                  }}
                                  aria-invalid={!!fieldError}
                                  aria-describedby={fieldError ? `${kpi.id}-error` : undefined}
                                  className={cn(
                                    "mt-2 h-14 text-2xl font-black",
                                    fieldError && "border-red-300 focus-visible:ring-red-500",
                                  )}
                                />
                                {fieldError ? (
                                  <p id={`${kpi.id}-error`} className="mt-2 text-xs font-semibold text-red-600">
                                    {fieldError}
                                  </p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {selectedStage ? (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-3 shadow-[0_-12px_28px_rgba(15,23,42,0.10)] backdrop-blur md:sticky md:bottom-0">
          <div className="container flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-xs font-bold text-slate-500 sm:text-left">
              Revisa los valores antes de enviar. Después quedarán bloqueados.
            </p>
            <Button
              className="h-12 text-base sm:min-w-64"
              onClick={askConfirm}
              disabled={loading || kpis.length === 0 || selectedStage !== availableStage}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {loading ? "Enviando..." : `Enviar ${stageLabel(selectedStage)}`}
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="¿Estás seguro de enviar?"
        description="Luego no podrás modificar estos datos desde esta vista. Solo el supervisor o administrador podrá corregirlos."
        confirmText="Sí, enviar"
        loading={loading}
        onConfirm={submitStage}
        onClose={() => setConfirmOpen(false)}
      />
    </main>
  );
}
