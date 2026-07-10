"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Layers3, Plus, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type {
  Kpi,
  KpiGrupo,
  KpiGrupoRow,
  KpiTipo,
  Rol,
  Usuario,
} from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_KPI_GROUPS, getOrderedGroupNames } from "@/lib/kpi-groups";
import { roleLabelWithCode } from "@/lib/display-labels";

const empty = {
  nombre: "",
  grupo: "Volumen" as KpiGrupo,
  tipo: "normal" as KpiTipo,
  color: "#facc15",
  orden: 1,
  activo: true,
  visible_tabla: true,
  jefe_id: "",
};

type SupervisorOption = Pick<
  Usuario,
  "id" | "nombre" | "usuario" | "email" | "codigo_operativo"
>;
type KpiRow = Kpi & {
  jefe?: Pick<
    Usuario,
    "id" | "usuario" | "email" | "nombre" | "codigo_operativo"
  > | null;
};

export function KpisManager() {
  const supabase = createClient();
  const [items, setItems] = useState<KpiRow[]>([]);
  const [groups, setGroups] = useState<KpiGrupoRow[]>([]);
  const [supervisores, setSupervisores] = useState<SupervisorOption[]>([]);
  const [currentRole, setCurrentRole] = useState<Rol | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [form, setForm] = useState(empty);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupOrder, setNewGroupOrder] = useState(10);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? "");
    const { data: roleData } = await supabase.rpc("current_user_role");
    const role = roleData as Rol | null;
    setCurrentRole(role);

    const [kpiRes, groupRes] = await Promise.all([
      supabase
        .from("kpis")
        .select(
          "id,jefe_id,nombre,activo,tipo,color,grupo,visible_tabla,orden,created_at,jefe:usuarios!kpis_jefe_id_fkey(id,usuario,email,nombre,codigo_operativo)",
        )
        .order("grupo")
        .order("orden"),
      supabase
        .from("kpi_grupos")
        .select(
          "id,jefe_id,nombre,orden,activo,created_at,jefe:usuarios!kpi_grupos_jefe_id_fkey(id,usuario,email,nombre,codigo_operativo)",
        )
        .order("orden")
        .order("nombre"),
    ]);

    if (kpiRes.error)
      setMessage(
        "No se pudieron cargar los KPI. Verifica la conexión y permisos.",
      );
    if (groupRes.error)
      setMessage(
        "No se pudieron cargar los grupos KPI. Ejecuta la migración nueva de grupos dinámicos.",
      );
    setItems((kpiRes.data ?? []) as unknown as KpiRow[]);
    setGroups((groupRes.data ?? []) as unknown as KpiGrupoRow[]);

    if (role === "administrador") {
      const { data: supervisorData } = await supabase
        .from("usuarios")
        .select("id,usuario,email,nombre,codigo_operativo,roles!inner(codigo)")
        .eq("roles.codigo", "jefe")
        .eq("activo", true)
        .order("nombre");
      setSupervisores((supervisorData ?? []) as unknown as SupervisorOption[]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const selectedSupervisorId =
    currentRole === "administrador" ? form.jefe_id : currentUserId;

  const groupOptions = useMemo(() => {
    const scopedGroups = groups
      .filter((group) => group.activo)
      .filter(
        (group) =>
          !selectedSupervisorId || group.jefe_id === selectedSupervisorId,
      )
      .map((group) => group.nombre);
    const scopedKpis = items.filter(
      (item) => !selectedSupervisorId || item.jefe_id === selectedSupervisorId,
    );
    return getOrderedGroupNames(scopedKpis, [
      ...DEFAULT_KPI_GROUPS,
      ...scopedGroups,
      form.grupo ? String(form.grupo) : "",
    ]);
  }, [form.grupo, groups, items, selectedSupervisorId]);

  function edit(item: KpiRow) {
    setEditing(item.id);
    setForm({
      nombre: item.nombre,
      grupo: item.grupo ?? "Volumen",
      tipo: item.tipo,
      color: item.color ?? "#facc15",
      orden: item.orden,
      activo: item.activo,
      visible_tabla: item.visible_tabla ?? true,
      jefe_id: item.jefe_id,
    });
  }

  async function save() {
    setMessage("");
    if (!form.nombre.trim()) {
      setMessage("El nombre del KPI es obligatorio.");
      return;
    }
    if (!form.grupo.trim()) {
      setMessage("Selecciona o crea un grupo KPI.");
      return;
    }
    const supervisorId =
      currentRole === "administrador" ? form.jefe_id : currentUserId;
    if (!supervisorId) {
      setMessage("Selecciona el supervisor responsable del KPI.");
      return;
    }

    setSaving(true);
    const payload = {
      jefe_id: supervisorId,
      nombre: form.nombre.trim(),
      grupo: form.grupo.trim(),
      tipo: form.tipo,
      color: form.tipo === "adicional" ? form.color : null,
      orden: Number(form.orden),
      activo: form.activo,
      visible_tabla: form.visible_tabla,
    };
    const { error } = editing
      ? await supabase.from("kpis").update(payload).eq("id", editing)
      : await supabase.from("kpis").insert(payload);
    setSaving(false);
    setMessage(
      error
        ? "No se pudo guardar. Revisa duplicados, permisos o la migración nueva."
        : "KPI guardado correctamente.",
    );
    if (!error) {
      setForm(empty);
      setEditing(null);
      load();
    }
  }

  function editGroup(group: KpiGrupoRow) {
    setEditingGroup(group.id);
    setNewGroupName(group.nombre);
    setNewGroupOrder(group.orden);
    setForm((current) => ({
      ...current,
      jefe_id: group.jefe_id,
      grupo: group.nombre,
    }));
    setMessage("");
  }

  async function saveGroup() {
    setMessage("");
    const supervisorId =
      currentRole === "administrador" ? form.jefe_id : currentUserId;
    if (!supervisorId) {
      setMessage("Selecciona un supervisor antes de guardar el grupo KPI.");
      return;
    }
    const nombre = newGroupName.trim();
    if (!nombre) {
      setMessage("Ingresa el nombre del grupo KPI.");
      return;
    }

    setSavingGroup(true);
    const previous = editingGroup
      ? groups.find((group) => group.id === editingGroup)
      : null;
    const result = editingGroup
      ? await supabase
          .from("kpi_grupos")
          .update({ nombre, orden: Number(newGroupOrder) || 10 })
          .eq("id", editingGroup)
      : await supabase
          .from("kpi_grupos")
          .upsert(
            {
              jefe_id: supervisorId,
              nombre,
              orden: Number(newGroupOrder) || 10,
              activo: true,
            },
            { onConflict: "jefe_id,nombre" },
          );

    if (!result.error && previous && previous.nombre !== nombre) {
      await supabase
        .from("kpis")
        .update({ grupo: nombre })
        .eq("jefe_id", previous.jefe_id)
        .eq("grupo", previous.nombre);
    }
    setSavingGroup(false);

    if (result.error) {
      setMessage(
        editingGroup
          ? "No se pudo editar el grupo. Revisa permisos o duplicados."
          : "No se pudo crear el grupo. Revisa permisos o si ya existe.",
      );
      return;
    }

    setNewGroupName("");
    setNewGroupOrder(10);
    setEditingGroup(null);
    setForm((current) => ({ ...current, grupo: nombre }));
    setMessage(
      editingGroup
        ? "Grupo KPI editado correctamente."
        : "Grupo KPI creado correctamente.",
    );
    load();
  }

  async function toggle(item: KpiRow) {
    await supabase
      .from("kpis")
      .update({ activo: !item.activo })
      .eq("id", item.id);
    load();
  }

  async function toggleVisibleTabla(item: KpiRow) {
    await supabase
      .from("kpis")
      .update({ visible_tabla: !(item.visible_tabla ?? true) })
      .eq("id", item.id);
    load();
  }

  async function toggleGroup(group: KpiGrupoRow) {
    await supabase
      .from("kpi_grupos")
      .update({ activo: !group.activo })
      .eq("id", group.id);
    load();
  }

  const scopedGroups = groups.filter(
    (group) => !selectedSupervisorId || group.jefe_id === selectedSupervisorId,
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
      <Card>
        <CardContent className="space-y-5 pt-5">
          <div>
            <h2 className="text-lg font-black">
              {editing ? "Editar KPI" : "Nuevo KPI"}
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Organiza los KPI por grupos y decide cuáles aparecen en Tabla
              Excel, reportes y gráficos.
            </p>
          </div>
          {currentRole === "administrador" ? (
            <div className="space-y-2">
              <Label>Supervisor responsable</Label>
              <Select
                value={form.jefe_id}
                onChange={(e) => setForm({ ...form, jefe_id: e.target.value })}
              >
                <option value="">Selecciona supervisor</option>
                {supervisores.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {roleLabelWithCode("jefe", supervisor.codigo_operativo)} ·{" "}
                    {supervisor.nombre ?? supervisor.usuario}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Nombre del KPI"
            />
          </div>
          <div className="space-y-2">
            <Label>Grupo KPI</Label>
            <Select
              value={form.grupo}
              onChange={(e) =>
                setForm({ ...form, grupo: e.target.value as KpiGrupo })
              }
            >
              {groupOptions.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </Select>
            <p className="text-xs font-semibold text-slate-500">
              El grupo define dónde se verá el KPI en vendedor, tabla, reportes
              y gráficos.
            </p>
          </div>
          <div className="rounded-2xl border bg-blue-50/60 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-blue-950">
              <Layers3 className="h-4 w-4" />{" "}
              {editingGroup ? "Editar grupo KPI" : "Crear grupo KPI"}
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_90px]">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ej. Ejecución"
              />
              <Input
                type="number"
                min={1}
                value={newGroupOrder}
                onChange={(e) => setNewGroupOrder(Number(e.target.value))}
                aria-label="Orden del grupo"
              />
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full bg-white"
                onClick={saveGroup}
                disabled={savingGroup}
              >
                {savingGroup
                  ? "Guardando..."
                  : editingGroup
                    ? "Guardar grupo"
                    : "Crear grupo"}
              </Button>
              {editingGroup ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setEditingGroup(null);
                    setNewGroupName("");
                    setNewGroupOrder(10);
                  }}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={form.tipo}
              onChange={(e) =>
                setForm({ ...form, tipo: e.target.value as KpiTipo })
              }
            >
              <option value="normal">Normal</option>
              <option value="adicional">Adicional</option>
            </Select>
          </div>
          {form.tipo === "adicional" ? (
            <div className="space-y-2">
              <Label>Color adicional</Label>
              <Input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Orden</Label>
            <Input
              type="number"
              min={1}
              value={form.orden}
              onChange={(e) =>
                setForm({ ...form, orden: Number(e.target.value) })
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.visible_tabla}
              onChange={(e) =>
                setForm({ ...form, visible_tabla: e.target.checked })
              }
            />{" "}
            Mostrar en Tabla Excel, reportes y gráficos
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            />{" "}
            Activo para registro del vendedor
          </label>
          {message ? (
            <p className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-700">
              {message}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
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
                }}
              >
                Cancelar
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-5">
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-black">Grupos KPI</h2>
              <Badge className="w-fit border-blue-200 bg-blue-50 text-blue-700">
                {scopedGroups.length} grupos creados
              </Badge>
            </div>
            <div className="kpi-scrollbar overflow-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="p-3 text-left">Supervisor</th>
                    <th className="p-3 text-left">Grupo</th>
                    <th className="p-3 text-left">Orden</th>
                    <th className="p-3 text-left">Estado</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedGroups.length ? (
                    scopedGroups.map((group) => (
                      <tr key={group.id} className="border-b">
                        <td className="p-3">
                          {group.jefe
                            ? `${roleLabelWithCode("jefe", group.jefe.codigo_operativo)} · ${group.jefe.nombre ?? group.jefe.usuario}`
                            : group.jefe_id}
                        </td>
                        <td className="p-3 font-bold">{group.nombre}</td>
                        <td className="p-3">{group.orden}</td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-bold ${group.activo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                          >
                            {group.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="space-x-2 p-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => editGroup(group)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleGroup(group)}
                          >
                            {group.activo ? "Ocultar grupo" : "Activar grupo"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        className="p-4 text-sm font-semibold text-slate-500"
                        colSpan={5}
                      >
                        Aún no hay grupos personalizados. Puedes usar Volumen,
                        Cobertura y Comercial o crear uno nuevo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="kpi-scrollbar overflow-auto pt-5">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="p-3 text-left">Supervisor</th>
                  <th className="p-3 text-left">Grupo</th>
                  <th className="p-3 text-left">Orden</th>
                  <th className="p-3 text-left">KPI</th>
                  <th className="p-3 text-left">Tipo</th>
                  <th className="p-3 text-left">Tabla Excel</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-3">
                      {item.jefe
                        ? `${roleLabelWithCode("jefe", item.jefe.codigo_operativo)} · ${item.jefe.nombre ?? item.jefe.usuario}`
                        : item.jefe_id}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
                        {item.grupo ?? "Sin grupo"}
                      </span>
                    </td>
                    <td className="p-3 font-bold">{item.orden}</td>
                    <td className="p-3">{item.nombre}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color ?? "#cbd5e1" }}
                        />
                        {item.tipo === "adicional" ? "Adicional" : "Normal"}
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
                        variant="outline"
                        onClick={() => toggleVisibleTabla(item)}
                      >
                        {(item.visible_tabla ?? true) ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}{" "}
                        {(item.visible_tabla ?? true) ? "Ocultar" : "Mostrar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => toggle(item)}
                      >
                        {item.activo ? "Desactivar" : "Activar"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
