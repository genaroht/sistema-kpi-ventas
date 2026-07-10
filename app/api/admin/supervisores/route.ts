import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseUrl } from "@/lib/supabase/env";

const INTERNAL_EMAIL_DOMAIN = "kpibackus.pe";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function requireAdministrador() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: jsonError("No autenticado.", 401) };

  const { data } = await supabase
    .from("usuarios")
    .select("id,activo,roles(codigo)")
    .eq("id", user.id)
    .single();

  const rol = (data as { roles?: { codigo?: string } | null } | null)?.roles
    ?.codigo;
  if (!data?.activo || rol !== "administrador") {
    return { error: jsonError("Solo el administrador puede crear supervisores.", 403) };
  }

  return { user };
}

export async function POST(request: Request) {
  const guard = await requireAdministrador();
  if ("error" in guard) return guard.error;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY no está configurada.");
    return jsonError(
      "Operación no disponible: configuración del servidor incompleta.",
      500,
    );
  }

  const body = await request.json().catch(() => null);
  const usuario = String(body?.usuario ?? "").trim().toLowerCase();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const nombre = String(body?.nombre ?? "").trim();
  const codigoOperativo = String(body?.codigo_operativo ?? "")
    .trim()
    .toUpperCase();
  const activo = Boolean(body?.activo ?? true);

  if (!usuario || !email || !password || !nombre || !codigoOperativo) {
    return jsonError(
      "Usuario, email, contraseña, nombre y código operativo son obligatorios.",
    );
  }

  if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) {
    return jsonError(
      "El usuario debe tener entre 3 y 40 caracteres: letras, números, punto, guion o guion bajo.",
    );
  }

  if (!isValidEmail(email) || !email.endsWith(`@${INTERNAL_EMAIL_DOMAIN}`)) {
    return jsonError("El email interno debe usar el dominio @kpibackus.pe.");
  }

  if (password.length < 6) {
    return jsonError("La contraseña debe tener al menos 6 caracteres.");
  }

  const admin = createSupabaseAdminClient(getSupabaseUrl(), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: roleData, error: roleError } = await admin
    .from("roles")
    .select("id")
    .eq("codigo", "jefe")
    .single();

  if (roleError || !roleData?.id) {
    return jsonError("No existe el rol Supervisor en la tabla roles.");
  }

  const { data: duplicatedCode } = await admin
    .from("supervisores")
    .select("id")
    .eq("codigo_operativo", codigoOperativo)
    .maybeSingle();

  if (duplicatedCode) {
    return jsonError("Ya existe un supervisor con ese código operativo.");
  }

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, usuario, codigo_operativo: codigoOperativo },
    });

  if (createError || !created.user) {
    console.error("Error al crear Auth supervisor", createError);
    return jsonError(
      "No se pudo crear el login del supervisor. Revisa que usuario o email no estén duplicados.",
    );
  }

  const { error: userError } = await admin.from("usuarios").upsert(
    {
      id: created.user.id,
      usuario,
      email,
      nombre,
      rol_id: roleData.id,
      jefe_id: null,
      codigo_operativo: codigoOperativo,
      activo,
    },
    { onConflict: "id" },
  );

  if (userError) {
    console.error("Error al crear usuario supervisor", userError);
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    return jsonError("No se pudo crear el perfil del supervisor.");
  }

  const { error: supervisorError } = await admin.from("supervisores").upsert(
    {
      usuario_id: created.user.id,
      nombre,
      codigo_operativo: codigoOperativo,
      activo,
    },
    { onConflict: "usuario_id" },
  );

  if (supervisorError) {
    console.error("Error al crear fila supervisores", supervisorError);
    await admin.from("usuarios").delete().eq("id", created.user.id);
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    return jsonError("No se pudo crear el registro operativo del supervisor.");
  }

  const defaultGroups = [
    { jefe_id: created.user.id, nombre: "Volumen", orden: 1, activo: true },
    { jefe_id: created.user.id, nombre: "Cobertura", orden: 2, activo: true },
    { jefe_id: created.user.id, nombre: "Comercial", orden: 3, activo: true },
  ];

  await admin
    .from("kpi_grupos")
    .upsert(defaultGroups, { onConflict: "jefe_id,nombre" });

  return NextResponse.json({ ok: true, user_id: created.user.id });
}
