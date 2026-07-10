import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseUrl } from "@/lib/supabase/env";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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
    return {
      error: jsonError("Solo el administrador puede crear usuarios.", 403),
    };
  }

  return { user };
}

const INTERNAL_EMAIL_DOMAIN = "kpibackus.pe";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isInternalBackusEmail(email: string) {
  return email.endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}

export async function POST(request: Request) {
  const guard = await requireAdministrador();
  if ("error" in guard) return guard.error;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY no está configurada para crear usuarios.",
    );
    return jsonError(
      "Operación no disponible: configuración del servidor incompleta.",
      500,
    );
  }

  const body = await request.json().catch(() => null);
  const usuario = String(body?.usuario ?? "")
    .trim()
    .toLowerCase();
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");
  const nombre = String(body?.nombre ?? "").trim();
  const rolId = String(body?.rol_id ?? "").trim();
  const jefeId = body?.jefe_id ? String(body.jefe_id).trim() : null;
  const codigoOperativo = body?.codigo_operativo
    ? String(body.codigo_operativo).trim().toUpperCase()
    : null;
  const vendedorId = body?.vendedor_id ? String(body.vendedor_id).trim() : null;
  const activo = Boolean(body?.activo ?? true);

  if (!usuario || !email || !password || !nombre || !rolId) {
    return jsonError(
      "Usuario, email, contraseña, nombre y rol son obligatorios.",
    );
  }

  if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) {
    return jsonError(
      "El usuario debe tener entre 3 y 40 caracteres: letras, números, punto, guion o guion bajo.",
    );
  }

  if (!isValidEmail(email) || !isInternalBackusEmail(email)) {
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
    .select("codigo")
    .eq("id", rolId)
    .single();

  if (roleError || !roleData?.codigo) {
    return jsonError("Rol inválido.");
  }

  if (roleData.codigo === "jefe" && !codigoOperativo) {
    return jsonError("El código operativo es obligatorio para crear supervisores.");
  }

  if (roleData.codigo === "jefe" && codigoOperativo) {
    const { data: duplicatedSupervisor } = await admin
      .from("supervisores")
      .select("id")
      .eq("codigo_operativo", codigoOperativo)
      .maybeSingle();

    if (duplicatedSupervisor) {
      return jsonError("Ya existe un supervisor con ese código operativo.");
    }
  }

  let finalJefeId = jefeId;
  if (roleData.codigo === "vendedor") {
    if (!vendedorId) {
      return jsonError(
        "Selecciona un vendedor existente para vincular el login automáticamente.",
      );
    }

    const { data: vendedorData, error: vendedorError } = await admin
      .from("vendedores")
      .select("id,jefe_id,usuario_id,nombre")
      .eq("id", vendedorId)
      .single();

    if (vendedorError || !vendedorData) {
      return jsonError("No se encontró el vendedor seleccionado.");
    }

    if (vendedorData.usuario_id) {
      return jsonError(
        "El vendedor seleccionado ya tiene un usuario Auth vinculado.",
      );
    }

    finalJefeId = vendedorData.jefe_id;
  }

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, usuario },
    });

  if (createError || !created.user) {
    console.error("Error al crear usuario Auth", createError);
    return jsonError(
      "No se pudo crear el usuario. Revisa que el usuario o email no estén duplicados.",
    );
  }

  const { error: upsertError } = await admin.from("usuarios").upsert(
    {
      id: created.user.id,
      usuario,
      email,
      nombre,
      rol_id: rolId,
      jefe_id: finalJefeId,
      codigo_operativo: codigoOperativo,
      activo,
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    console.error("Error al crear perfil de usuario", upsertError);
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    return jsonError(
      "No se pudo crear el perfil del usuario. Revisa rol, supervisor y duplicados.",
    );
  }

  if (roleData.codigo === "jefe") {
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
      console.error("Error al crear supervisor operativo", supervisorError);
      await admin.from("usuarios").delete().eq("id", created.user.id);
      await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
      return jsonError("No se pudo crear el registro operativo del supervisor.");
    }

    await admin.from("kpi_grupos").upsert(
      [
        { jefe_id: created.user.id, nombre: "Volumen", orden: 1, activo: true },
        { jefe_id: created.user.id, nombre: "Cobertura", orden: 2, activo: true },
        { jefe_id: created.user.id, nombre: "Comercial", orden: 3, activo: true },
      ],
      { onConflict: "jefe_id,nombre" },
    );
  }

  if (roleData.codigo === "vendedor" && vendedorId) {
    const { error: vendedorUpdateError } = await admin
      .from("vendedores")
      .update({ usuario_id: created.user.id })
      .eq("id", vendedorId);

    if (vendedorUpdateError) {
      console.error(
        "Error al vincular vendedor con usuario Auth",
        vendedorUpdateError,
      );
      await admin.from("usuarios").delete().eq("id", created.user.id);
      await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
      return jsonError(
        "No se pudo vincular el login con el vendedor seleccionado.",
      );
    }
  }

  return NextResponse.json({
    ok: true,
    user_id: created.user.id,
    vendedor_id: vendedorId,
  });
}
