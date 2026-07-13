import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Rol } from "@/types/database";

function normalizeUsuario(row: any): Profile | null {
  if (!row) return null;
  const rol = row.roles?.codigo as Rol | undefined;
  if (!rol) return null;
  return { ...row, rol } as Profile;
}

export async function requireProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("usuarios")
    .select("id,usuario,email,nombre,rol_id,jefe_id,activo,created_at,roles(codigo,nombre)")
    .eq("id", user.id)
    .single();

  const profile = normalizeUsuario(data);
  if (error || !profile || !profile.activo) redirect("/login?error=perfil");
  return { supabase, user, profile };
}

export async function requirePanelAccess() {
  const ctx = await requireProfile();
  if (ctx.profile.rol === "vendedor") redirect("/vendedor");
  return ctx;
}

export async function requireAdministrador() {
  const ctx = await requireProfile();
  if (ctx.profile.rol !== "administrador") redirect("/admin/dashboard");
  return ctx;
}

export async function requireEditorAccess() {
  const ctx = await requireProfile();
  if (!(["administrador", "jefe"] as Rol[]).includes(ctx.profile.rol)) {
    redirect("/admin/dashboard");
  }
  return ctx;
}

export async function requireVendedor() {
  const ctx = await requireProfile();
  if (ctx.profile.rol !== "vendedor") redirect("/admin/dashboard");
  return ctx;
}
