"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { Rol, Supervisor, Usuario, Vendedor } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { roleLabelWithCode } from "@/lib/display-labels";
import { cn } from "@/lib/utils";

const empty = {
  nombre: "",
  zona: "",
  jefe_id: "",
  activo: true,
  visible_tabla: true,
};

type SupervisorOption = Pick<
  Supervisor,
  "usuario_id" | "nombre" | "codigo_operativo"
> & {
  usuario?: Pick<Usuario, "id" | "usuario" | "email" | "nombre"> | null;
};

type VendedorRow = Vendedor & {
  jefe?: Pick<
    Usuario,
    "id" | "usuario" | "email" | "nombre" | "codigo_operativo"
  > | null;
};

export function VendedoresManager() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<VendedorRow[]>([]);
  const [supervisores, setSupervisores] = useState<SupervisorOption[]>([]);
  const [currentRole, setCurrentRole] = useState<Rol | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? "");

    const { data: roleData } = await supabase.rpc("current_user_role");
    const role = roleData as Rol | null;
    setCurrentRole(role);

    const { data, error } = await supabase
      .from("vendedores")
      .select(
        "id,usuario_id,jefe_id,nombre,zona,visible_tabla,activo,created_at,usuario:usuarios!vendedores_usuario_id_fkey(id,usuario,email,nombre),jefe:usuarios!vendedores_jefe_id_fkey(id,usuario,email,nombre,codigo_operativo)",
      )
      .order("zona")
      .order("nombre");

    if (error) {
      setMessage("No se pudieron cargar los vendedores. Revisa la conexión y los permisos.");
    }
    setItems((data ?? []) as unknown as VendedorRow[]);

    if (role === "administrador") {
      const { data: supervisorData } = await supabase
        .from("supervisores")
        .select(
          "usuario_id,nombre,codigo_operativo,usuario:usuarios!supervisores_usuario_id_fkey(id,usuario,email,nombre)",
        )
        .eq("activo", true)
        .order("codigo_operativo")
        .order("nombre");
      setSupervisores(
        (supervisorData ?? []) as unknown as SupervisorOption[],
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  function edit(item: VendedorRow) {
    setEditing(item.id);
    setForm({
      nombre: item.nombre,
      zona: item.zona,
      jefe_id: item.jefe_id,
      activo: item.activo,
      visible_tabla: item.visible_tabla ?? true,
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startNew() {
    setEditing(null);
    setForm(empty);
    setMessage("");
  }

  async function save(addAnother = false) {
    setMessage("");
    if (!form.nombre.trim() || !form.zona.trim()) {
      setMessage("Nombre y zona son obligatorios.");
      return;
    }

    const jefeId =
      currentRole === "administrador" ? form.jefe_id : currentUserId;
    if (!jefeId) {
      setMessage("Selecciona el supervisor responsable del vendedor.");
      return;
    }

    setSaving(true);
    const payload = {
      nombre: form.nombre.trim(),
      zona: form.zona.trim().toUpperCase(),
      jefe_id: jefeId,
      activo: form.activo,
      visible_tabla: form.visible_tabla,
    };

    const result = editing
      ? await supabase
          .from("vendedores")
          .update(payload)
          .eq("id", editing)
          .select("id")
          .single()
      : await supabase
          .from("vendedores")
          .insert(payload)
          .select("id")
          .single();

    setSaving(false);
    const { error } = result;
    setMessage(error ? error.message : "Vendedor guardado correctamente.");

    if (!error) {
      if (addAnother) {
        setForm(
          currentRole === "administrador"
            ? { ...empty, jefe_id: jefeId }
            : empty,
        );
        setEditing(null);
        setMessage(
          "Vendedor guardado. El formulario está listo para agregar otro.",
        );
      } else {
        setEditing(result.data?.id ?? editing);
      }
      await load();
    }
  }

  async function toggleActive(item: VendedorRow) {
    const { error } = await supabase
      .from("vendedores")
      .update({ activo: !item.activo })
      .eq("id", item.id);
    setMessage(
      error
        ? error.message
        : item.activo
          ? "Vendedor desactivado."
          : "Vendedor activado.",
    );
    if (!error) await load();
  }

  async function toggleVisible(item: VendedorRow) {
    const nextVisible = !(item.visible_tabla ?? true);
    const { error } = await supabase
      .from("vendedores")
      .update({ visible_tabla: nextVisible })
      .eq("id", item.id);
    setMessage(
      error
        ? error.message
        : nextVisible
          ? "El vendedor vuelve a mostrarse en la Reportes."
          : "El vendedor quedó oculto de la Reportes sin perder su historial.",
    );
    if (!error) await load();
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">
              {editing ? "Editar vendedor" : "Nuevo vendedor"}
            </h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={startNew}
            >
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          </div>

          <p className="rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-700">
            Las acciones Editar y Ocultar permanecen visibles al lado derecho de
            cada vendedor. Ocultar solo lo retira de la Reportes y conserva
            todo su historial.
          </p>

          {currentRole === "administrador" ? (
            <div className="space-y-2">
              <Label>Supervisor responsable</Label>
              <Select
                value={form.jefe_id}
                onChange={(event) =>
                  setForm({ ...form, jefe_id: event.target.value })
                }
              >
                <option value="">Selecciona supervisor</option>
                {supervisores.map((supervisor) => (
                  <option
                    key={supervisor.usuario_id}
                    value={supervisor.usuario_id}
                  >
                    {roleLabelWithCode("jefe", supervisor.codigo_operativo)} ·{" "}
                    {supervisor.nombre ??
                      supervisor.usuario?.nombre ??
                      supervisor.usuario?.usuario}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              value={form.nombre}
              onChange={(event) =>
                setForm({ ...form, nombre: event.target.value })
              }
              placeholder="Nombre completo"
            />
          </div>

          <div className="space-y-2">
            <Label>Zona</Label>
            <Input
              value={form.zona}
              onChange={(event) =>
                setForm({ ...form, zona: event.target.value.toUpperCase() })
              }
              placeholder="Zona"
            />
          </div>

          <p className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
            El login se vincula automáticamente desde Usuarios. No ingreses UUID
            manualmente.
          </p>

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.visible_tabla}
              onChange={(event) =>
                setForm({ ...form, visible_tabla: event.target.checked })
              }
            />
            Mostrar en Reportes
          </label>

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(event) =>
                setForm({ ...form, activo: event.target.checked })
              }
            />
            Activo
          </label>

          {message ? (
            <p className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-700">
              {message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save(false)} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Guardando..." : "Guardar"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => save(true)}
              disabled={saving}
            >
              <Plus className="h-4 w-4" /> Guardar y agregar
            </Button>
            {editing ? (
              <Button variant="outline" onClick={startNew} disabled={saving}>
                Cancelar edición
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardContent className="pt-5">
          <div className="kpi-scrollbar min-w-0 overflow-auto rounded-xl border">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="p-3 text-left">Supervisor</th>
                  <th className="p-3 text-left">Zona</th>
                  <th className="p-3 text-left">Vendedor</th>
                  <th className="p-3 text-left">Reportes</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="sticky right-0 z-10 min-w-[255px] border-l bg-slate-50 p-3 text-right shadow-[-8px_0_14px_-12px_rgba(15,23,42,0.55)]">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-b",
                      !(item.visible_tabla ?? true) && "bg-yellow-50/40",
                      !item.activo && "opacity-70",
                    )}
                  >
                    <td className="max-w-[210px] p-3">
                      {item.jefe
                        ? `${roleLabelWithCode("jefe", item.jefe.codigo_operativo)} · ${item.jefe.nombre ?? item.jefe.usuario}`
                        : item.jefe_id}
                    </td>
                    <td className="p-3 font-black">{item.zona}</td>
                    <td className="p-3">
                      <span className="block font-semibold">{item.nombre}</span>
                      <span className="block text-xs text-slate-500">
                        Login: {item.usuario?.usuario ?? "Sin vincular"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${(item.visible_tabla ?? true) ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-800"}`}
                      >
                        {(item.visible_tabla ?? true) ? "Visible" : "Oculto"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${item.activo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                      >
                        {item.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="sticky right-0 border-l bg-white p-3 shadow-[-8px_0_14px_-12px_rgba(15,23,42,0.55)]">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => edit(item)}
                        >
                          <Pencil className="h-4 w-4" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleVisible(item)}
                        >
                          {(item.visible_tabla ?? true) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          {(item.visible_tabla ?? true) ? "Ocultar" : "Mostrar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => toggleActive(item)}
                        >
                          {item.activo ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-6 text-center text-sm font-semibold text-slate-500"
                    >
                      Aún no hay vendedores registrados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
