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
      error: jsonError(
        "Solo el administrador puede cambiar contraseñas.",
        403,
      ),
    };
  }

  return { user };
}

export async function POST(request: Request) {
  const guard = await requireAdministrador();
  if ("error" in guard) return guard.error;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY no está configurada para cambiar contraseñas.",
    );
    return jsonError(
      "Operación no disponible: configuración del servidor incompleta.",
      500,
    );
  }

  const body = await request.json().catch(() => null);
  const userId = String(body?.user_id ?? "").trim();
  const action = body?.action === "reset" ? "reset" : "change";
  const requestedPassword = String(body?.password ?? "").trim();

  if (!userId) {
    return jsonError("El usuario es obligatorio.");
  }

  const admin = createSupabaseAdminClient(getSupabaseUrl(), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: targetUser, error: targetError } = await admin
    .from("usuarios")
    .select("id,usuario")
    .eq("id", userId)
    .single();

  if (targetError || !targetUser) {
    return jsonError("Usuario no encontrado.", 404);
  }

  const resetPassword = String(targetUser.usuario ?? "").trim();
  const password = action === "reset" ? resetPassword : requestedPassword;

  if (!password) {
    return jsonError(
      action === "reset"
        ? "El usuario no tiene un nombre de usuario válido para usarlo como clave."
        : "La nueva contraseña es obligatoria.",
    );
  }

  if (action === "change" && password.length < 8) {
    return jsonError("La contraseña debe tener al menos 8 caracteres.");
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    console.error("Error al cambiar contraseña", {
      action,
      userId,
      message: error.message,
    });

    const normalizedMessage = error.message.toLowerCase();
    if (
      action === "reset" &&
      (normalizedMessage.includes("password") ||
        normalizedMessage.includes("contraseña"))
    ) {
      return jsonError(
        `No se pudo usar el usuario “${resetPassword}” como clave. Revisa la longitud mínima configurada en Supabase Authentication.`,
      );
    }

    return jsonError("No se pudo cambiar la contraseña.");
  }

  return NextResponse.json({
    ok: true,
    action,
    ...(action === "reset" ? { temporary_password: password } : {}),
  });
}
