"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Plus, Save, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { Role, Usuario, Vendedor } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { roleLabel, roleLabelWithCode } from "@/lib/display-labels";

const empty = {
  id: "",
  usuario: "",
  email: "",
  nombre: "",
  rol_id: "",
  jefe_id: "",
  codigo_operativo: "",
  activo: true,
  password: "",
};

type UsuarioRow = Usuario & {
  roles?: Pick<Role, "codigo" | "nombre"> | null;
  jefe?: Pick<
    Usuario,
    "id" | "nombre" | "usuario" | "email" | "codigo_operativo"
  > | null;
};

type VendedorOption = Pick<
  Vendedor,
  "id" | "nombre" | "zona" | "jefe_id" | "usuario_id" | "activo"
> & {
  jefe?: Pick<Usuario, "id" | "nombre" | "usuario" | "codigo_operativo"> | null;
};

const INTERNAL_EMAIL_DOMAIN = "kpibackus.pe";

function emailLocalPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split("@")[0]
    ?.replace(/[^a-z0-9._-]/g, "") ?? "";
}

function defaultEmail(usuario: string) {
  const clean = emailLocalPart(usuario);
  return clean ? `${clean}@${INTERNAL_EMAIL_DOMAIN}` : "";
}

function normalizeInternalEmail(value: string, fallbackUsuario: string) {
  const local = emailLocalPart(value) || emailLocalPart(fallbackUsuario);
  return local ? `${local}@${INTERNAL_EMAIL_DOMAIN}` : "";
}

function userFromName(name: string) {
  const parts = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  return `${first}${last}`.slice(0, 40);
}

export function UsuariosManager() {
  const supabase = createClient();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [vendedores, setVendedores] = useState<VendedorOption[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [passwordTarget, setPasswordTarget] = useState<UsuarioRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedVendedorId, setSelectedVendedorId] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");

  async function load() {
    const [uRes, rRes, vRes] = await Promise.all([
      supabase
        .from("usuarios")
        .select(
          "id,usuario,email,nombre,rol_id,jefe_id,codigo_operativo,activo,created_at,roles(codigo,nombre),jefe:usuarios!usuarios_jefe_id_fkey(id,usuario,email,nombre,codigo_operativo)",
        )
        .order("nombre"),
      supabase
        .from("roles")
        .select("id,codigo,nombre,codigo_operativo,created_at")
        .order("nombre"),
      supabase
        .from("vendedores")
        .select(
          "id,nombre,zona,jefe_id,usuario_id,activo,jefe:usuarios!vendedores_jefe_id_fkey(id,usuario,nombre,codigo_operativo)",
        )
        .order("zona")
        .order("nombre"),
    ]);
    setUsuarios((uRes.data ?? []) as unknown as UsuarioRow[]);
    setRoles((rRes.data ?? []) as Role[]);
    setVendedores((vRes.data ?? []) as unknown as VendedorOption[]);
  }

  useEffect(() => {
    load();
  }, []);

  const jefes = useMemo(
    () => usuarios.filter((u) => u.roles?.codigo === "jefe" && u.activo),
    [usuarios],
  );
  const selectedRoleCode = roles.find((r) => r.id === form.rol_id)?.codigo;
  const filteredVendedores = useMemo(() => {
    const query = vendorSearch.trim().toLowerCase();
    return vendedores
      .filter((vendedor) => vendedor.activo)
      .filter(
        (vendedor) =>
          !vendedor.usuario_id || vendedor.id === selectedVendedorId,
      )
      .filter((vendedor) => {
        if (!query) return true;
        return `${vendedor.zona} ${vendedor.nombre} ${vendedor.jefe?.nombre ?? vendedor.jefe?.usuario ?? ""}`
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 10);
  }, [selectedVendedorId, vendorSearch, vendedores]);

  function updateUsuario(usuario: string) {
    const clean = usuario.trim().toLowerCase();
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

  function selectRole(rolId: string) {
    const roleCode = roles.find((rol) => rol.id === rolId)?.codigo;
    setSelectedVendedorId("");
    setVendorSearch("");
    setForm((current) => ({
      ...current,
      rol_id: rolId,
      jefe_id: "",
      codigo_operativo: roleCode === "jefe" ? current.codigo_operativo : "",
    }));
  }

  function selectVendedor(vendedor: VendedorOption) {
    const suggestedUser = userFromName(vendedor.nombre);
    setSelectedVendedorId(vendedor.id);
    setVendorSearch(`${vendedor.zona} · ${vendedor.nombre}`);
    setForm((current) => ({
      ...current,
      nombre: current.nombre.trim() ? current.nombre : vendedor.nombre,
      usuario: current.usuario.trim() ? current.usuario : suggestedUser,
      email: current.email.trim() ? current.email : defaultEmail(suggestedUser),
      password: current.password.trim() ? current.password : suggestedUser,
      jefe_id: vendedor.jefe_id,
    }));
  }

  function edit(item: UsuarioRow) {
    setEditing(item.id);
    setSelectedVendedorId("");
    setVendorSearch("");
    setForm({
      id: item.id,
      usuario: item.usuario,
      email: item.email ?? "",
      nombre: item.nombre ?? "",
      rol_id: item.rol_id,
      jefe_id: item.jefe_id ?? "",
      codigo_operativo: item.codigo_operativo ?? "",
      activo: item.activo,
      password: "",
    });
    setMessage("");
  }

  async function save() {
    setMessage("");
    setSaving(true);

    const normalizedEmail = normalizeInternalEmail(form.email, form.usuario);

    if (
      !form.usuario.trim() ||
      !normalizedEmail ||
      !form.nombre.trim() ||
      !form.rol_id
    ) {
      setMessage("Usuario, email, nombre y rol son obligatorios.");
      setSaving(false);
      return;
    }
    if (selectedRoleCode === "vendedor" && !form.jefe_id) {
      setMessage("Un usuario vendedor debe estar asignado a un supervisor.");
      setSaving(false);
      return;
    }
    if (!editing && selectedRoleCode === "vendedor" && !selectedVendedorId) {
      setMessage(
        "Busca y selecciona el vendedor para vincular el login automáticamente.",
      );
      setSaving(false);
      return;
    }

    const payload = {
      id: form.id.trim(),
      usuario: form.usuario.trim().toLowerCase(),
      email: normalizedEmail,
      nombre: form.nombre.trim(),
      rol_id: form.rol_id,
      jefe_id: selectedRoleCode === "vendedor" ? form.jefe_id : null,
      codigo_operativo:
        selectedRoleCode === "jefe"
          ? form.codigo_operativo.trim() || null
          : null,
      activo: form.activo,
      vendedor_id: selectedRoleCode === "vendedor" ? selectedVendedorId : null,
    };

    if (editing) {
      const { vendedor_id: _vendedorId, ...updatePayload } = payload;
      const { error } = await supabase
        .from("usuarios")
        .update(updatePayload)
        .eq("id", editing);
      setMessage(error ? error.message : "Usuario guardado correctamente.");
      if (!error) {
        setForm(empty);
        setEditing(null);
        load();
      }
      setSaving(false);
      return;
    }

    if (!form.password.trim()) {
      setMessage("La contraseña inicial es obligatoria.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, password: form.password.trim() }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear el usuario.");
      setSaving(false);
      return;
    }

    setMessage("Usuario Auth creado y vendedor vinculado automáticamente.");
    setForm(empty);
    setEditing(null);
    setSelectedVendedorId("");
    setVendorSearch("");
    setSaving(false);
    load();
  }

  async function toggle(item: UsuarioRow) {
    await supabase
      .from("usuarios")
      .update({ activo: !item.activo })
      .eq("id", item.id);
    load();
  }

  async function resetPassword() {
    if (!passwordTarget || !newPassword.trim()) {
      setMessage("Selecciona un usuario e ingresa la nueva contraseña.");
      return;
    }
    setSaving(true);
    const response = await fetch("/api/admin/users/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: passwordTarget.id,
        password: newPassword.trim(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(
      response.ok
        ? `Contraseña actualizada para ${passwordTarget.usuario}.`
        : (data.error ?? "No se pudo cambiar la contraseña."),
    );
    if (response.ok) {
      setPasswordTarget(null);
      setNewPassword("");
    }
    setSaving(false);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[460px_1fr]">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <h2 className="text-lg font-black">
            {editing ? "Editar usuario" : "Nuevo usuario"}
          </h2>
          <p className="rounded-xl bg-yellow-50 p-3 text-xs font-semibold text-yellow-800">
            Crea usuarios internos para administradores, supervisores y
            vendedores. Todos usan email interno @kpibackus.pe. El código
            operativo se registra por cada supervisor, no por el rol.
          </p>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select
              value={form.rol_id}
              onChange={(e) => selectRole(e.target.value)}
            >
              <option value="">Selecciona rol</option>
              {roles.map((rol) => (
                <option key={rol.id} value={rol.id}>
                  {roleLabel(rol.codigo)}
                </option>
              ))}
            </Select>
          </div>
          {selectedRoleCode === "vendedor" && !editing ? (
            <div className="space-y-2 rounded-2xl border bg-blue-50/60 p-3">
              <Label>Buscar vendedor existente</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={vendorSearch}
                  onChange={(e) => {
                    setVendorSearch(e.target.value);
                    setSelectedVendedorId("");
                  }}
                  placeholder="Busca por zona o nombre"
                  className="pl-9"
                />
              </div>
              <p className="text-xs font-semibold text-slate-500">
                Al seleccionarlo, el login se vincula automáticamente al
                vendedor. Puedes editar usuario, email o nombre antes de
                guardar.
              </p>
              <div className="max-h-52 space-y-2 overflow-auto pr-1">
                {filteredVendedores.length ? (
                  filteredVendedores.map((vendedor) => (
                    <button
                      key={vendedor.id}
                      type="button"
                      onClick={() => selectVendedor(vendedor)}
                      className={`w-full rounded-xl border p-3 text-left text-sm transition hover:bg-white ${selectedVendedorId === vendedor.id ? "border-blue-500 bg-white shadow-sm" : "bg-white/70"}`}
                    >
                      <span className="block font-black">
                        {vendedor.zona} · {vendedor.nombre}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {vendedor.jefe
                          ? `${roleLabelWithCode("jefe", vendedor.jefe.codigo_operativo)} · ${vendedor.jefe.nombre ?? vendedor.jefe.usuario}`
                          : "Sin supervisor"}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="rounded-xl bg-white p-3 text-xs font-semibold text-slate-500">
                    No hay vendedores disponibles sin login vinculado.
                  </p>
                )}
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Usuario</Label>
            <Input
              value={form.usuario}
              onChange={(e) => updateUsuario(e.target.value)}
              disabled={!!editing}
            />
          </div>
          <div className="space-y-2">
            <Label>Email Auth interno (@kpibackus.pe)</Label>
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
            />
          </div>
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </div>
          {selectedRoleCode === "jefe" ? (
            <div className="space-y-2">
              <Label>Código operativo del supervisor</Label>
              <Input
                value={form.codigo_operativo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    codigo_operativo: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
          ) : null}
          {selectedRoleCode === "vendedor" ? (
            <div className="space-y-2">
              <Label>Supervisor del usuario vendedor</Label>
              <Select
                value={form.jefe_id}
                onChange={(e) => setForm({ ...form, jefe_id: e.target.value })}
              >
                <option value="">Selecciona supervisor</option>
                {jefes.map((jefe) => (
                  <option key={jefe.id} value={jefe.id}>
                    {roleLabelWithCode("jefe", jefe.codigo_operativo)} ·{" "}
                    {jefe.nombre ?? jefe.usuario}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {!editing ? (
            <div className="space-y-2">
              <Label>Contraseña inicial</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
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
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {editing ? (
                <Save className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}{" "}
              {saving ? "Guardando..." : "Guardar"}
            </Button>
            {editing ? (
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setForm(empty);
                  setSelectedVendedorId("");
                  setVendorSearch("");
                }}
              >
                Cancelar
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="kpi-scrollbar overflow-auto pt-5">
          <table className="w-full min-w-[1050px] text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="p-3 text-left">Usuario</th>
                <th className="p-3 text-left">Nombre</th>
                <th className="p-3 text-left">Email interno</th>
                <th className="p-3 text-left">Rol</th>
                <th className="p-3 text-left">Supervisor</th>
                <th className="p-3 text-left">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="p-3 font-bold">{item.usuario}</td>
                  <td className="p-3">{item.nombre}</td>
                  <td className="p-3 text-slate-600">{item.email}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">
                      {roleLabelWithCode(
                        item.roles?.codigo,
                        item.codigo_operativo,
                      )}
                    </span>
                  </td>
                  <td className="p-3">
                    {item.jefe
                      ? roleLabelWithCode("jefe", item.jefe.codigo_operativo) +
                        " · " +
                        (item.jefe.nombre ?? item.jefe.usuario)
                      : "-"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${item.activo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {item.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="space-x-2 p-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => edit(item)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => toggle(item)}
                    >
                      {item.activo ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setPasswordTarget(item);
                        setNewPassword(item.usuario);
                      }}
                    >
                      <KeyRound className="h-4 w-4" /> Clave
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {passwordTarget ? (
            <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
              <h3 className="font-black">
                Restablecer clave de {passwordTarget.usuario}
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Solo el administrador puede hacer este cambio.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña"
                  className="sm:max-w-xs"
                />
                <Button onClick={resetPassword} disabled={saving}>
                  Actualizar clave
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPasswordTarget(null);
                    setNewPassword("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
