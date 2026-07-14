import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseUrl } from "@/lib/supabase/env";

const INTERNAL_EMAIL_DOMAIN = "kpibackus.pe";

type RoleCode = "administrador" | "gerente" | "jefe" | "vendedor";

type BaseUserRow = {
  id: string;
  usuario: string;
  email: string | null;
  nombre: string | null;
  rol_id: string;
  jefe_id: string | null;
  codigo_operativo: string | null;
  activo: boolean;
  created_at: string;
};

type RoleRow = {
  id: string;
  codigo: RoleCode;
  nombre: string;
  codigo_operativo: string | null;
  created_at: string;
};

type VendorRow = {
  id: string;
  nombre: string;
  zona: string;
  jefe_id: string;
  usuario_id: string | null;
  activo: boolean;
  visible_tabla?: boolean;
  created_at?: string;
};

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
      error: jsonError("Solo el administrador puede gestionar usuarios.", 403),
    };
  }

  return { user };
}

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createSupabaseAdminClient(getSupabaseUrl(), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isInternalBackusEmail(email: string) {
  return email.endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}

function normalizeUserPayload(body: any) {
  return {
    id: String(body?.id ?? "").trim(),
    usuario: String(body?.usuario ?? "")
      .trim()
      .toLowerCase(),
    email: String(body?.email ?? "")
      .trim()
      .toLowerCase(),
    password: String(body?.password ?? ""),
    nombre: String(body?.nombre ?? "").trim(),
    rolId: String(body?.rol_id ?? "").trim(),
    jefeId: body?.jefe_id ? String(body.jefe_id).trim() : null,
    codigoOperativo: body?.codigo_operativo
      ? String(body.codigo_operativo).trim().toUpperCase()
      : null,
    vendedorId: body?.vendedor_id
      ? String(body.vendedor_id).trim()
      : null,
    activo: Boolean(body?.activo ?? true),
  };
}

function validateCommonPayload(payload: ReturnType<typeof normalizeUserPayload>) {
  if (!payload.usuario || !payload.email || !payload.nombre || !payload.rolId) {
    return "Usuario, email, nombre y rol son obligatorios.";
  }

  if (!/^[a-z0-9._-]{3,40}$/.test(payload.usuario)) {
    return "El usuario debe tener entre 3 y 40 caracteres: letras, números, punto, guion o guion bajo.";
  }

  if (!isValidEmail(payload.email) || !isInternalBackusEmail(payload.email)) {
    return "El email interno debe usar el dominio @kpibackus.pe.";
  }

  return null;
}

export async function GET() {
  const guard = await requireAdministrador();
  if ("error" in guard) return guard.error;

  const admin = getAdminClient();
  if (!admin) {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY no está configurada para listar usuarios.",
    );
    return jsonError(
      "No se pudo cargar la lista de usuarios: configuración del servidor incompleta.",
      500,
    );
  }

  const [usersResult, rolesResult, vendorsResult] = await Promise.all([
    admin
      .from("usuarios")
      .select(
        "id,usuario,email,nombre,rol_id,jefe_id,codigo_operativo,activo,created_at",
      )
      .order("nombre"),
    admin
      .from("roles")
      .select("id,codigo,nombre,codigo_operativo,created_at")
      .order("nombre"),
    admin
      .from("vendedores")
      .select(
        "id,nombre,zona,jefe_id,usuario_id,activo",
      )
      .order("zona")
      .order("nombre"),
  ]);

  const firstError =
    usersResult.error ?? rolesResult.error ?? vendorsResult.error ?? null;
  if (firstError) {
    console.error("Error al cargar administración de usuarios", firstError);
    return jsonError(
      "No se pudo cargar usuarios, roles y vendedores desde la base de datos.",
      500,
    );
  }

  const users = (usersResult.data ?? []) as BaseUserRow[];
  const roles = (rolesResult.data ?? []) as RoleRow[];
  const vendors = (vendorsResult.data ?? []) as VendorRow[];
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const userById = new Map(users.map((user) => [user.id, user]));

  const hydratedUsers = users.map((user) => {
    const jefe = user.jefe_id ? userById.get(user.jefe_id) : null;
    return {
      ...user,
      roles: roleById.get(user.rol_id) ?? null,
      jefe: jefe
        ? {
            id: jefe.id,
            usuario: jefe.usuario,
            email: jefe.email,
            nombre: jefe.nombre,
            codigo_operativo: jefe.codigo_operativo,
          }
        : null,
    };
  });

  const hydratedVendors = vendors.map((vendor) => {
    const jefe = userById.get(vendor.jefe_id);
    return {
      ...vendor,
      jefe: jefe
        ? {
            id: jefe.id,
            usuario: jefe.usuario,
            nombre: jefe.nombre,
            codigo_operativo: jefe.codigo_operativo,
          }
        : null,
    };
  });

  return NextResponse.json({
    usuarios: hydratedUsers,
    roles,
    vendedores: hydratedVendors,
  });
}

export async function POST(request: Request) {
  const guard = await requireAdministrador();
  if ("error" in guard) return guard.error;

  const admin = getAdminClient();
  if (!admin) {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY no está configurada para crear usuarios.",
    );
    return jsonError(
      "Operación no disponible: configuración del servidor incompleta.",
      500,
    );
  }

  const body = await request.json().catch(() => null);
  const payload = normalizeUserPayload(body);
  const commonError = validateCommonPayload(payload);
  if (commonError) return jsonError(commonError);

  if (!payload.password) {
    return jsonError("La contraseña inicial es obligatoria.");
  }
  if (payload.password.length < 6) {
    return jsonError("La contraseña debe tener al menos 6 caracteres.");
  }

  const { data: roleData, error: roleError } = await admin
    .from("roles")
    .select("codigo")
    .eq("id", payload.rolId)
    .single();

  if (roleError || !roleData?.codigo) {
    return jsonError("Rol inválido.");
  }

  const roleCode = roleData.codigo as RoleCode;

  if (roleCode === "jefe" && !payload.codigoOperativo) {
    return jsonError(
      "El código operativo es obligatorio para crear supervisores.",
    );
  }

  if (roleCode === "jefe" && !payload.jefeId) {
    return jsonError("Selecciona el gerente responsable del supervisor.");
  }

  if (roleCode === "jefe" && payload.jefeId) {
    const { data: managerProfile } = await admin
      .from("usuarios")
      .select("id,rol_id,activo")
      .eq("id", payload.jefeId)
      .single();
    const { data: managerRole } = managerProfile
      ? await admin.from("roles").select("codigo").eq("id", managerProfile.rol_id).single()
      : { data: null };
    if (!managerProfile?.activo || managerRole?.codigo !== "gerente") {
      return jsonError("El gerente seleccionado no está activo o no tiene rol de gerente.");
    }
  }

  if (roleCode === "jefe" && payload.codigoOperativo) {
    const { data: duplicatedSupervisor } = await admin
      .from("supervisores")
      .select("id")
      .eq("codigo_operativo", payload.codigoOperativo)
      .maybeSingle();

    if (duplicatedSupervisor) {
      return jsonError("Ya existe un supervisor con ese código operativo.");
    }
  }

  let finalJefeId = payload.jefeId;
  if (roleCode === "vendedor") {
    if (!payload.vendedorId) {
      return jsonError(
        "Selecciona un vendedor existente para vincular el login automáticamente.",
      );
    }

    const { data: vendedorData, error: vendedorError } = await admin
      .from("vendedores")
      .select("id,jefe_id,usuario_id,nombre")
      .eq("id", payload.vendedorId)
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
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        nombre: payload.nombre,
        usuario: payload.usuario,
      },
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
      usuario: payload.usuario,
      email: payload.email,
      nombre: payload.nombre,
      rol_id: payload.rolId,
      jefe_id: finalJefeId,
      codigo_operativo: payload.codigoOperativo,
      activo: payload.activo,
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

  if (roleCode === "jefe") {
    const { error: supervisorError } = await admin.from("supervisores").upsert(
      {
        usuario_id: created.user.id,
        nombre: payload.nombre,
        codigo_operativo: payload.codigoOperativo,
        activo: payload.activo,
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
        {
          jefe_id: created.user.id,
          nombre: "Volumen",
          orden: 1,
          activo: true,
        },
        {
          jefe_id: created.user.id,
          nombre: "Cobertura",
          orden: 2,
          activo: true,
        },
        {
          jefe_id: created.user.id,
          nombre: "Comercial",
          orden: 3,
          activo: true,
        },
      ],
      { onConflict: "jefe_id,nombre" },
    );
  }

  if (roleCode === "gerente") {
    const { error: gerenteError } = await admin.from("gerentes").upsert(
      {
        usuario_id: created.user.id,
        nombre: payload.nombre,
        activo: payload.activo,
      },
      { onConflict: "usuario_id" },
    );

    if (gerenteError) {
      console.error("Error al crear registro operativo del gerente", gerenteError);
      await admin.from("usuarios").delete().eq("id", created.user.id);
      await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
      return jsonError(
        "No se pudo registrar al gerente. Ejecuta primero la migración de la tabla public.gerentes.",
        500,
      );
    }
  }

  if (roleCode === "vendedor" && payload.vendedorId) {
    const { error: vendedorUpdateError } = await admin
      .from("vendedores")
      .update({ usuario_id: created.user.id })
      .eq("id", payload.vendedorId);

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
    vendedor_id: payload.vendedorId,
  });
}

export async function PATCH(request: Request) {
  const guard = await requireAdministrador();
  if ("error" in guard) return guard.error;

  const admin = getAdminClient();
  if (!admin) {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY no está configurada para editar usuarios.",
    );
    return jsonError(
      "Operación no disponible: configuración del servidor incompleta.",
      500,
    );
  }

  const body = await request.json().catch(() => null);
  const payload = normalizeUserPayload(body);
  const commonError = validateCommonPayload(payload);
  if (commonError) return jsonError(commonError);
  if (!payload.id) return jsonError("El identificador del usuario es obligatorio.");

  const { data: target, error: targetError } = await admin
    .from("usuarios")
    .select(
      "id,usuario,email,nombre,rol_id,jefe_id,codigo_operativo,activo,created_at",
    )
    .eq("id", payload.id)
    .single();

  if (targetError || !target) {
    return jsonError("Usuario no encontrado.", 404);
  }

  const [{ data: nextRole }, { data: previousRole }] = await Promise.all([
    admin.from("roles").select("codigo").eq("id", payload.rolId).single(),
    admin.from("roles").select("codigo").eq("id", target.rol_id).single(),
  ]);

  if (!nextRole?.codigo || !previousRole?.codigo) {
    return jsonError("No se pudo determinar el rol del usuario.");
  }

  const nextRoleCode = nextRole.codigo as RoleCode;
  const previousRoleCode = previousRole.codigo as RoleCode;

  if (
    payload.id === guard.user.id &&
    (!payload.activo || nextRoleCode !== "administrador")
  ) {
    return jsonError(
      "No puedes desactivar tu propia cuenta ni quitarte el rol de administrador.",
    );
  }

  const [{ data: duplicateUser }, { data: duplicateEmail }] = await Promise.all([
    admin
      .from("usuarios")
      .select("id")
      .eq("usuario", payload.usuario)
      .neq("id", payload.id)
      .maybeSingle(),
    admin
      .from("usuarios")
      .select("id")
      .eq("email", payload.email)
      .neq("id", payload.id)
      .maybeSingle(),
  ]);

  if (duplicateUser) return jsonError("Ese nombre de usuario ya está en uso.");
  if (duplicateEmail) return jsonError("Ese email interno ya está en uso.");

  if (nextRoleCode === "jefe") {
    if (!payload.codigoOperativo) {
      return jsonError("El código operativo es obligatorio para supervisores.");
    }
    if (!payload.jefeId) {
      return jsonError("Selecciona el gerente responsable del supervisor.");
    }

    const { data: managerProfile } = await admin
      .from("usuarios")
      .select("id,rol_id,activo")
      .eq("id", payload.jefeId)
      .single();
    const { data: managerRole } = managerProfile
      ? await admin.from("roles").select("codigo").eq("id", managerProfile.rol_id).single()
      : { data: null };
    if (!managerProfile?.activo || managerRole?.codigo !== "gerente") {
      return jsonError("El gerente seleccionado no está activo o no tiene rol de gerente.");
    }

    const { data: duplicatedSupervisor } = await admin
      .from("supervisores")
      .select("usuario_id")
      .eq("codigo_operativo", payload.codigoOperativo)
      .neq("usuario_id", payload.id)
      .maybeSingle();

    if (duplicatedSupervisor) {
      return jsonError("Ya existe otro supervisor con ese código operativo.");
    }
  }

  if (nextRoleCode === "vendedor") {
    if (!payload.jefeId) {
      return jsonError("El usuario vendedor debe tener un supervisor asignado.");
    }

    const { data: supervisorProfile } = await admin
      .from("usuarios")
      .select("id,rol_id,activo")
      .eq("id", payload.jefeId)
      .single();
    if (!supervisorProfile?.activo) {
      return jsonError("El supervisor seleccionado no está activo.");
    }

    const { data: supervisorRole } = await admin
      .from("roles")
      .select("codigo")
      .eq("id", supervisorProfile.rol_id)
      .single();
    if (supervisorRole?.codigo !== "jefe") {
      return jsonError("El usuario seleccionado no tiene rol de supervisor.");
    }
  }

  if (previousRoleCode === "gerente" && (nextRoleCode !== "gerente" || !payload.activo)) {
    const { count: assignedSupervisors } = await admin
      .from("usuarios")
      .select("id", { count: "exact", head: true })
      .eq("jefe_id", payload.id);
    if ((assignedSupervisors ?? 0) > 0) {
      return jsonError("Reasigna primero los supervisores de este gerente antes de cambiar su rol o desactivarlo.");
    }
  }

  if (previousRoleCode === "jefe" && nextRoleCode !== "jefe") {
    const [vendorsCount, kpisCount] = await Promise.all([
      admin
        .from("vendedores")
        .select("id", { count: "exact", head: true })
        .eq("jefe_id", payload.id),
      admin
        .from("kpis")
        .select("id", { count: "exact", head: true })
        .eq("jefe_id", payload.id),
    ]);

    if ((vendorsCount.count ?? 0) > 0 || (kpisCount.count ?? 0) > 0) {
      return jsonError(
        "No se puede cambiar el rol de este supervisor porque tiene vendedores o KPI asociados. Puedes editar sus datos o desactivarlo.",
      );
    }
  }

  const { data: linkedVendor } = await admin
    .from("vendedores")
    .select("id,jefe_id,usuario_id")
    .eq("usuario_id", payload.id)
    .maybeSingle();

  if (nextRoleCode === "vendedor" && !linkedVendor) {
    return jsonError(
      "Para convertir esta cuenta en vendedor, primero debe existir un vendedor operativo vinculado. Crea o vincula el vendedor desde el módulo Vendedores.",
    );
  }

  const { data: authBefore, error: authReadError } =
    await admin.auth.admin.getUserById(payload.id);
  if (authReadError || !authBefore.user) {
    console.error("No se encontró el usuario Auth para editar", authReadError);
    return jsonError("No se encontró la cuenta en Supabase Authentication.", 404);
  }

  const previousAuthEmail = authBefore.user.email;
  const previousMetadata = authBefore.user.user_metadata ?? {};
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(
    payload.id,
    {
      email: payload.email,
      email_confirm: true,
      user_metadata: {
        ...previousMetadata,
        nombre: payload.nombre,
        usuario: payload.usuario,
      },
    },
  );

  if (authUpdateError) {
    console.error("Error al actualizar usuario Auth", authUpdateError);
    return jsonError(
      "No se pudo actualizar la cuenta Auth. Revisa que el email no esté duplicado.",
    );
  }

  const updateProfile = {
    usuario: payload.usuario,
    email: payload.email,
    nombre: payload.nombre,
    rol_id: payload.rolId,
    jefe_id: nextRoleCode === "vendedor" || nextRoleCode === "jefe" ? payload.jefeId : null,
    codigo_operativo:
      nextRoleCode === "jefe" ? payload.codigoOperativo : null,
    activo: payload.activo,
  };

  const { error: profileError } = await admin
    .from("usuarios")
    .update(updateProfile)
    .eq("id", payload.id);

  if (profileError) {
    console.error("Error al actualizar perfil", profileError);
    await admin.auth.admin
      .updateUserById(payload.id, {
        ...(previousAuthEmail ? { email: previousAuthEmail } : {}),
        user_metadata: previousMetadata,
      })
      .catch(() => undefined);
    return jsonError(
      "No se pudo guardar el perfil. Revisa usuario, email y código operativo.",
    );
  }

  if (nextRoleCode === "jefe") {
    const { error: supervisorError } = await admin.from("supervisores").upsert(
      {
        usuario_id: payload.id,
        codigo_operativo: payload.codigoOperativo,
        nombre: payload.nombre,
        activo: payload.activo,
      },
      { onConflict: "usuario_id" },
    );
    if (supervisorError) {
      console.error("Error al sincronizar supervisor", supervisorError);
      return jsonError(
        "El usuario fue actualizado, pero no se pudo sincronizar la tabla Supervisores.",
        500,
      );
    }

    await admin.from("kpi_grupos").upsert(
      [
        { jefe_id: payload.id, nombre: "Volumen", orden: 1, activo: true },
        { jefe_id: payload.id, nombre: "Cobertura", orden: 2, activo: true },
        { jefe_id: payload.id, nombre: "Comercial", orden: 3, activo: true },
      ],
      { onConflict: "jefe_id,nombre" },
    );
  } else if (previousRoleCode === "jefe") {
    await admin.from("supervisores").delete().eq("usuario_id", payload.id);
  }

  if (nextRoleCode === "gerente") {
    const { error: gerenteError } = await admin.from("gerentes").upsert(
      {
        usuario_id: payload.id,
        nombre: payload.nombre,
        activo: payload.activo,
      },
      { onConflict: "usuario_id" },
    );
    if (gerenteError) {
      console.error("Error al sincronizar gerente", gerenteError);
      return jsonError(
        "El usuario fue actualizado, pero no se pudo sincronizar la tabla Gerentes. Ejecuta la migración de gerentes.",
        500,
      );
    }
  } else {
    await admin.from("gerentes").delete().eq("usuario_id", payload.id);
  }

  if (nextRoleCode === "vendedor" && linkedVendor) {
    await admin
      .from("vendedores")
      .update({
        jefe_id: payload.jefeId,
        nombre: payload.nombre,
        activo: payload.activo,
      })
      .eq("id", linkedVendor.id);
  } else if (previousRoleCode === "vendedor" && linkedVendor) {
    await admin
      .from("vendedores")
      .update({ usuario_id: null })
      .eq("id", linkedVendor.id);
  }

  return NextResponse.json({ ok: true });
}
