import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseUrl } from "@/lib/supabase/env";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function requireAdministrador() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: jsonError("No autenticado.", 401), supabase };

  const { data } = await supabase
    .from("usuarios")
    .select("id,activo,roles(codigo)")
    .eq("id", user.id)
    .single();

  const rol = (data as { roles?: { codigo?: string } | null } | null)?.roles?.codigo;
  if (!data?.activo || rol !== "administrador") {
    return { error: jsonError("Solo el administrador puede cambiar contraseñas.", 403), supabase };
  }

  return { user, supabase };
}

export async function POST(request: Request) {
  const guard = await requireAdministrador();
  if ("error" in guard) return guard.error;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY no está configurada para cambiar contraseñas.");
    return jsonError("Operación no disponible: configuración del servidor incompleta.", 500);
  }

  const body = await request.json().catch(() => null);
  const userId = String(body?.user_id ?? "").trim();
  const password = String(body?.password ?? "");

  if (!userId || !password) {
    return jsonError("Usuario y nueva contraseña son obligatorios.");
  }

  if (password.length < 6) {
    return jsonError("La contraseña debe tener al menos 6 caracteres.");
  }

  const { data: targetUser, error: targetError } = await guard.supabase
    .from("usuarios")
    .select("id")
    .eq("id", userId)
    .single();

  if (targetError || !targetUser) {
    return jsonError("Usuario no encontrado o fuera de tu alcance.", 404);
  }

  const admin = createSupabaseAdminClient(getSupabaseUrl(), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    console.error("Error al cambiar contraseña", error);
    return jsonError("No se pudo cambiar la contraseña.");
  }

  return NextResponse.json({ ok: true });
}
