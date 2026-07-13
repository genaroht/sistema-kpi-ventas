"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Plus, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { Supervisor, Usuario } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INTERNAL_EMAIL_DOMAIN = "kpibackus.pe";

const empty = {
  usuario: "",
  email: "",
  nombre: "",
  codigo_operativo: "",
  activo: true,
  password: "",
};

type SupervisorRow = Supervisor & {
  usuario?: Pick<Usuario, "id" | "usuario" | "email" | "nombre" | "activo"> | null;
};

function emailLocalPart(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .split("@")[0]
      ?.replace(/[^a-z0-9._-]/g, "") ?? ""
  );
}

function defaultEmail(usuario: string) {
  const clean = emailLocalPart(usuario);
  return clean ? `${clean}@${INTERNAL_EMAIL_DOMAIN}` : "";
}

function normalizeInternalEmail(value: string, fallbackUsuario: string) {
  const local = emailLocalPart(value) || emailLocalPart(fallbackUsuario);
  return local ? `${local}@${INTERNAL_EMAIL_DOMAIN}` : "";
}

export function SupervisoresManager() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<SupervisorRow[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<SupervisorRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("supervisores")
      .select(
        "id,usuario_id,codigo_operativo,nombre,activo,created_at,usuario:usuarios!supervisores_usuario_id_fkey(id,usuario,email,nombre,activo)",
      )
      .order("codigo_operativo")
      .order("nombre");

    if (error) {
      setMessage(
        "No se pudieron cargar supervisores. Ejecuta la migración de supervisores en Supabase.",
      );
      setItems([]);
      return;
    }

    setItems((data ?? []) as unknown as SupervisorRow[]);
  }

  useEffect(() => {
    load();
  }, []);

  function updateUsuario(value: string) {
    const clean = value.trim().toLowerCase();
    setForm((current) => ({
      ...current,
      usuario: clean,
      email:
        current.email && current.email !== defaultEmail(current.usuario)
          ? normalizeInternalEmail(current.email, clean)
          : defaultEmail(clean),
      password: current.password || clean,
    }));
  }

  function edit(item: SupervisorRow) {
    setEditing(item);
    setForm({
      usuario: item.usuario?.usuario ?? "",
      email: item.usuario?.email ?? "",
      nombre: item.nombre ?? item.usuario?.nombre ?? "",
      codigo_operativo: item.codigo_operativo ?? "",
      activo: item.activo,
      password: "",
    });
    setMessage("");
  }

  function reset() {
    setEditing(null);
    setForm(empty);
    setMessage("");
  }

  async function save() {
    setMessage("");

    const usuario = form.usuario.trim().toLowerCase();
    const email = normalizeInternalEmail(form.email, usuario);
    const nombre = form.nombre.trim();
    const codigo = form.codigo_operativo.trim().toUpperCase();

    if (!usuario || !email || !nombre || !codigo) {
      setMessage("Usuario, email, nombre y código operativo son obligatorios.");
      return;
    }
    if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) {
      setMessage(
        "El usuario debe tener entre 3 y 40 caracteres: letras, números, punto, guion o guion bajo.",
      );
      return;
    }
    if (!email.endsWith(`@${INTERNAL_EMAIL_DOMAIN}`)) {
      setMessage("El email interno debe usar @kpibackus.pe.");
      return;
    }

    setSaving(true);

    if (editing) {
      const [supervisorRes, usuarioRes] = await Promise.all([
        supabase
          .from("supervisores")
          .update({ nombre, codigo_operativo: codigo, activo: form.activo })
          .eq("id", editing.id),
        supabase
          .from("usuarios")
          .update({ nombre, codigo_operativo: codigo, activo: form.activo })
          .eq("id", editing.usuario_id),
      ]);

      setSaving(false);

      if (supervisorRes.error || usuarioRes.error) {
        setMessage(
          supervisorRes.error?.message ||
            usuarioRes.error?.message ||
            "No se pudo actualizar el supervisor.",
        );
        return;
      }

      setMessage("Supervisor actualizado correctamente.");
      reset();
      load();
      return;
    }

    if (!form.password.trim()) {
      setSaving(false);
      setMessage("La contraseña inicial es obligatoria.");
      return;
    }

    const response = await fetch("/api/admin/supervisores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario,
        email,
        password: form.password.trim(),
        nombre,
        codigo_operativo: codigo,
        activo: form.activo,
      }),
    });
    const data = await response.json().catch(() => ({}));

    setSaving(false);

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear el supervisor.");
      return;
    }

    setMessage("Supervisor creado en Auth, Usuarios y tabla Supervisores.");
    reset();
    load();
  }

  async function toggle(item: SupervisorRow) {
    const nextActivo = !item.activo;
    setSaving(true);
    const [supervisorRes, usuarioRes] = await Promise.all([
      supabase.from("supervisores").update({ activo: nextActivo }).eq("id", item.id),
      supabase.from("usuarios").update({ activo: nextActivo }).eq("id", item.usuario_id),
    ]);
    setSaving(false);

    if (supervisorRes.error || usuarioRes.error) {
      setMessage(
        supervisorRes.error?.message || usuarioRes.error?.message || "No se pudo cambiar el estado.",
      );
      return;
    }

    load();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div>
            <h2 className="text-lg font-black">
              {editing ? "Editar supervisor" : "Nuevo supervisor"}
            </h2>
            <p className="mt-1 rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-700">
              Esta vista crea el login en Supabase Auth, el perfil en Usuarios y
              el registro operativo en la tabla Supervisores. El código pertenece
              al supervisor, no al rol.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Usuario</Label>
            <Input
              value={form.usuario}
              onChange={(e) => updateUsuario(e.target.value)}
              placeholder="usuario supervisor"
              disabled={!!editing}
            />
          </div>

          <div className="space-y-2">
            <Label>Email Auth interno</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm({
                  ...form,
                  email: normalizeInternalEmail(e.target.value, form.usuario),
                })
              }
              placeholder="usuario@kpibackus.pe"
              disabled={!!editing}
            />
          </div>

          <div className="space-y-2">
            <Label>Nombre del supervisor</Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Nombre completo"
            />
          </div>

          <div className="space-y-2">
            <Label>Código operativo</Label>
            <Input
              value={form.codigo_operativo}
              onChange={(e) =>
                setForm({ ...form, codigo_operativo: e.target.value.toUpperCase() })
              }
              placeholder="Ej. L7"
            />
          </div>

          {!editing ? (
            <div className="space-y-2">
              <Label>Contraseña inicial</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            />{" "}
            Activo
          </label>

          {message ? (
            <p className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-700">
              {message}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={save} disabled={saving}>
              {editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {saving ? "Guardando..." : "Guardar"}
            </Button>
            {editing ? (
              <Button variant="outline" onClick={reset} disabled={saving}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="kpi-scrollbar overflow-auto pt-5">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-black">Supervisores</h2>
            <span className="w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              {items.length} registrados
            </span>
          </div>

          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="p-3 text-left">Código</th>
                <th className="p-3 text-left">Supervisor</th>
                <th className="p-3 text-left">Usuario</th>
                <th className="p-3 text-left">Email interno</th>
                <th className="p-3 text-left">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-3 font-black text-blue-700">{item.codigo_operativo}</td>
                    <td className="p-3 font-semibold">{item.nombre}</td>
                    <td className="p-3">{item.usuario?.usuario ?? "Sin usuario"}</td>
                    <td className="p-3 text-xs text-slate-500">{item.usuario?.email ?? "Sin email"}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${item.activo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                      >
                        {item.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="space-x-2 p-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => edit(item)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggle(item)} disabled={saving}>
                        {item.activo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {item.activo ? "Desactivar" : "Activar"}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 text-sm font-semibold text-slate-500" colSpan={6}>
                    Aún no hay supervisores. Crea uno para asignarle vendedores, KPI y grupos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
