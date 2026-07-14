"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Clipboard,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  X,
} from "lucide-react";
import type { Role, Usuario, Vendedor } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
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
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [vendedores, setVendedores] = useState<VendedorOption[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [passwordTarget, setPasswordTarget] = useState<UsuarioRow | null>(null);
  const [resetTarget, setResetTarget] = useState<UsuarioRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [temporaryCredential, setTemporaryCredential] = useState<{
    usuario: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedVendedorId, setSelectedVendedorId] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "GET",
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setUsuarios([]);
        setRoles([]);
        setVendedores([]);
        setMessage(data.error ?? "No se pudo cargar la lista de usuarios.");
        return;
      }

      setUsuarios((data.usuarios ?? []) as UsuarioRow[]);
      setRoles((data.roles ?? []) as Role[]);
      setVendedores((data.vendedores ?? []) as VendedorOption[]);
    } catch {
      setUsuarios([]);
      setRoles([]);
      setVendedores([]);
      setMessage("No se pudo conectar con el servicio de administración de usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const jefes = useMemo(
    () => usuarios.filter((u) => u.roles?.codigo === "jefe" && u.activo),
    [usuarios],
  );
  const gerentes = useMemo(
    () => usuarios.filter((u) => u.roles?.codigo === "gerente" && u.activo),
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
    if (selectedRoleCode === "jefe" && !form.codigo_operativo.trim()) {
      setMessage("El código operativo es obligatorio para supervisores.");
      setSaving(false);
      return;
    }
    if (selectedRoleCode === "jefe" && !form.jefe_id) {
      setMessage("Selecciona el gerente responsable del supervisor.");
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
      jefe_id: selectedRoleCode === "vendedor" || selectedRoleCode === "jefe" ? form.jefe_id : null,
      codigo_operativo:
        selectedRoleCode === "jefe"
          ? form.codigo_operativo.trim() || null
          : null,
      activo: form.activo,
      vendedor_id: selectedRoleCode === "vendedor" ? selectedVendedorId : null,
    };

    if (editing) {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: editing }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error ?? "No se pudo editar el usuario.");
        setSaving(false);
        return;
      }

      setMessage("Usuario actualizado correctamente en Auth y en la base de datos.");
      setForm(empty);
      setEditing(null);
      setSelectedVendedorId("");
      setVendorSearch("");
      await load();
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

    setMessage(
      selectedRoleCode === "vendedor"
        ? "Usuario Auth creado y vendedor vinculado automáticamente."
        : selectedRoleCode === "jefe"
          ? "Usuario Auth creado y supervisor registrado correctamente."
          : selectedRoleCode === "gerente"
            ? "Usuario Auth creado y registrado en la tabla Gerentes."
            : "Usuario Auth creado correctamente.",
    );
    setForm(empty);
    setEditing(null);
    setSelectedVendedorId("");
    setVendorSearch("");
    setSaving(false);
    load();
  }

  async function toggle(item: UsuarioRow) {
    const nextActive = !item.activo;
    setSaving(true);
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        usuario: item.usuario,
        email: item.email,
        nombre: item.nombre,
        rol_id: item.rol_id,
        jefe_id: item.jefe_id,
        codigo_operativo: item.codigo_operativo,
        activo: nextActive,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo cambiar el estado del usuario.");
      setSaving(false);
      return;
    }

    setMessage(nextActive ? "Usuario activado." : "Usuario desactivado.");
    await load();
    setSaving(false);
  }

  function openChangePassword(item: UsuarioRow) {
    setPasswordTarget(item);
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setPasswordError("");
    setMessage("");
  }

  async function changePassword() {
    if (!passwordTarget) return;

    setPasswordError("");

    if (!newPassword.trim()) {
      setPasswordError("Ingresa la nueva contraseña.");
      return;
    }

    if (newPassword.trim().length < 8) {
      setPasswordError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setPasswordError("La confirmación de la contraseña no coincide.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: passwordTarget.id,
          action: "change",
          password: newPassword.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setPasswordError(data.error ?? "No se pudo cambiar la contraseña.");
        return;
      }

      setMessage(`Contraseña actualizada para ${passwordTarget.usuario}.`);
      setPasswordTarget(null);
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setPasswordError("");
    } catch {
      setPasswordError(
        "No se pudo conectar con el servicio de contraseñas. Revisa la terminal del servidor.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!resetTarget) return;

    const target = resetTarget;
    setSaving(true);

    try {
      const response = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: target.id,
          action: "reset",
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.temporary_password) {
        setMessage(data.error ?? "No se pudo restablecer la contraseña.");
        return;
      }

      setResetTarget(null);
      setTemporaryCredential({
        usuario: target.usuario,
        password: String(data.temporary_password),
      });
      setCopied(false);
      setMessage(
        `Clave restablecida para ${target.usuario}. La nueva clave es igual al usuario.`,
      );
    } catch {
      setMessage(
        "No se pudo conectar con el servicio de contraseñas. Revisa la terminal del servidor.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyTemporaryPassword() {
    if (!temporaryCredential) return;
    try {
      await navigator.clipboard.writeText(temporaryCredential.password);
      setCopied(true);
    } catch {
      setMessage("No se pudo copiar automáticamente. Selecciona la clave y cópiala manualmente.");
    }
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(360px,460px)_minmax(0,1fr)]">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <h2 className="text-lg font-black">
            {editing ? "Editar usuario" : "Nuevo usuario"}
          </h2>
          <p className="rounded-xl bg-yellow-50 p-3 text-xs font-semibold text-yellow-800">
            Crea administradores, gerentes, supervisores y vendedores. Los gerentes se registran automáticamente en la tabla Gerentes y tienen acceso de solo lectura. Todos usan email interno @kpibackus.pe.
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
          {selectedRoleCode === "gerente" ? (
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-800">
              El gerente consultará únicamente los supervisores que el administrador le asigne.
              Tendrá acceso de solo lectura y podrá descargar reportes gerenciales.
            </p>
          ) : null}
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
            <>
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
              <div className="space-y-2">
                <Label>Gerente responsable</Label>
                <Select
                  value={form.jefe_id}
                  onChange={(e) => setForm({ ...form, jefe_id: e.target.value })}
                >
                  <option value="">Selecciona gerente</option>
                  {gerentes.map((gerente) => (
                    <option key={gerente.id} value={gerente.id}>
                      {gerente.nombre ?? gerente.usuario}
                    </option>
                  ))}
                </Select>
                <p className="text-xs font-semibold text-slate-500">El gerente solo verá los resultados de los supervisores asignados.</p>
              </div>
            </>
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

      <Card className="min-w-0 overflow-hidden">
        <CardContent className="min-w-0 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Usuarios registrados</h2>
              <p className="text-xs font-semibold text-slate-500">
                Edita datos, rol, estado o contraseña. Los cambios de email y
                nombre también se sincronizan con Supabase Auth.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {usuarios.length} usuarios
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void load()}
                disabled={loading || saving}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Actualizar
              </Button>
            </div>
          </div>

          <div className="kpi-scrollbar mt-4 w-full min-w-0 max-w-full overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[1060px] table-fixed text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="sticky left-0 z-20 w-[190px] border-r bg-slate-50 p-3 text-left">Usuario</th>
                  <th className="sticky left-[190px] z-20 w-[300px] min-w-[300px] border-x bg-slate-50 p-3 text-left shadow-[8px_0_14px_-14px_rgba(15,23,42,0.75)]">
                    Acciones
                  </th>
                  <th className="w-[180px] p-3 text-left">Nombre</th>
                  <th className="w-[145px] p-3 text-left">Rol</th>
                  <th className="w-[190px] p-3 text-left">Responsable</th>
                  <th className="w-[95px] p-3 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center font-semibold text-slate-500">
                      Cargando usuarios...
                    </td>
                  </tr>
                ) : usuarios.length ? (
                  usuarios.map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="sticky left-0 z-10 w-[190px] border-r bg-white p-3">
                        <span className="block truncate font-black" title={item.usuario}>
                          {item.usuario}
                        </span>
                        <span
                          className="block truncate text-xs font-semibold text-slate-500"
                          title={item.email ?? ""}
                        >
                          {item.email}
                        </span>
                      </td>
                      <td className="sticky left-[190px] z-10 w-[300px] min-w-[300px] border-x bg-white p-3 shadow-[8px_0_14px_-14px_rgba(15,23,42,0.75)]">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => edit(item)}
                            disabled={saving}
                            className="w-full justify-start px-2 text-xs"
                            title={`Editar ${item.usuario}`}
                          >
                            <Pencil className="h-4 w-4 shrink-0" /> Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void toggle(item)}
                            disabled={saving}
                            className="w-full justify-start px-2 text-xs"
                            title={item.activo ? `Desactivar ${item.usuario}` : `Activar ${item.usuario}`}
                          >
                            {item.activo ? "Desactivar" : "Activar"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openChangePassword(item)}
                            disabled={saving}
                            className="w-full justify-start px-2 text-[11px]"
                            title={`Cambiar clave de ${item.usuario}`}
                          >
                            <KeyRound className="h-4 w-4 shrink-0" /> Cambiar clave
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setResetTarget(item)}
                            disabled={saving}
                            className="w-full justify-start px-2 text-[11px]"
                            title={`Restablecer clave de ${item.usuario}`}
                          >
                            <RotateCcw className="h-4 w-4 shrink-0" /> Restablecer
                          </Button>
                        </div>
                      </td>
                      <td className="p-3 font-semibold">{item.nombre}</td>
                      <td className="p-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">
                          {roleLabelWithCode(
                            item.roles?.codigo,
                            item.codigo_operativo,
                          )}
                        </span>
                      </td>
                      <td className="p-3 text-xs font-semibold text-slate-600">
                        {item.jefe
                          ? roleLabelWithCode(
                              item.roles?.codigo === "jefe" ? "gerente" : "jefe",
                              item.jefe.codigo_operativo,
                            ) +
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
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center">
                      <p className="font-black text-slate-700">
                        No se encontraron usuarios.
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Pulsa Actualizar. Si continúa vacío, revisa
                        SUPABASE_SERVICE_ROLE_KEY en el servidor.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </CardContent>
      </Card>

      {passwordTarget && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="change-password-title"
            >
              <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2
                      id="change-password-title"
                      className="text-xl font-black text-slate-950"
                    >
                      Cambiar clave
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Usuario: {passwordTarget.usuario}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Cerrar"
                    onClick={() => {
                      setPasswordTarget(null);
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordError("");
                    }}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-new-password">
                      Nueva contraseña
                    </Label>
                    <div className="relative">
                      <Input
                        id="admin-new-password"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setPasswordError("");
                        }}
                        placeholder="Mínimo 8 caracteres"
                        className="pr-11"
                        autoComplete="new-password"
                        autoFocus
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword
                            ? "Ocultar contraseña"
                            : "Mostrar contraseña"
                        }
                        onClick={() =>
                          setShowPassword((current) => !current)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-confirm-password">
                      Confirmar contraseña
                    </Label>
                    <Input
                      id="admin-confirm-password"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordError("");
                      }}
                      placeholder="Repite la nueva contraseña"
                      autoComplete="new-password"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !saving) {
                          void changePassword();
                        }
                      }}
                    />
                  </div>

                  {passwordError ? (
                    <p
                      role="alert"
                      className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700"
                    >
                      {passwordError}
                    </p>
                  ) : null}

                  <p className="rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">
                    La nueva clave se aplicará inmediatamente en Supabase
                    Authentication.
                  </p>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPasswordTarget(null);
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordError("");
                    }}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void changePassword()}
                    disabled={saving}
                  >
                    <KeyRound className="h-4 w-4" />
                    {saving ? "Cambiando..." : "Cambiar clave"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="Restablecer clave"
        description={`La contraseña de ${resetTarget?.usuario ?? "este usuario"} se restablecerá usando exactamente su nombre de usuario como nueva clave.`}
        confirmText="Restablecer clave"
        loading={saving}
        onConfirm={() => void resetPassword()}
        onClose={() => setResetTarget(null)}
      />

      {temporaryCredential && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-password-result-title"
            >
              <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-2xl">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <Check className="h-6 w-6" />
                </div>
                <h2
                  id="reset-password-result-title"
                  className="mt-4 text-xl font-black text-slate-950"
                >
                  Clave restablecida
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Usuario: {temporaryCredential.usuario}
                </p>
                <p className="mt-4 rounded-xl bg-yellow-50 p-3 text-xs font-semibold text-yellow-800">
                  La nueva clave es igual al nombre de usuario. Entrégala al
                  usuario y pídele que la cambie después de ingresar.
                </p>
                <div className="mt-4 flex items-center gap-2 rounded-xl border bg-slate-50 p-3">
                  <code className="min-w-0 flex-1 select-all break-all text-sm font-black text-slate-900">
                    {temporaryCredential.password}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copyTemporaryPassword()}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Clipboard className="h-4 w-4" />
                    )}
                    {copied ? "Copiada" : "Copiar"}
                  </Button>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button
                    type="button"
                    onClick={() => setTemporaryCredential(null)}
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
