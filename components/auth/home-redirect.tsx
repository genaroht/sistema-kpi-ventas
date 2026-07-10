"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type { Rol } from "@/types/database";

export function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    async function run() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("usuarios")
        .select("activo,roles(codigo)")
        .eq("id", user.id)
        .single();

      const rol = (profile as any)?.roles?.codigo as Rol | undefined;
      if (!profile?.activo || !rol) {
        router.replace("/login?error=perfil");
        return;
      }
      router.replace(rol === "vendedor" ? "/vendedor" : "/admin/dashboard");
    }
    run();
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="rounded-2xl border bg-white p-6 text-center shadow-soft">
        <p className="font-bold">Cargando sistema...</p>
        <p className="mt-1 text-sm text-slate-500">Validando sesión y rol.</p>
      </div>
    </main>
  );
}
