"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import type { Rol } from "@/types/database";
import { cn } from "@/lib/utils";

const REMEMBER_USER_KEY = "sistema-kpi-ventas:usuario";

function redirectByRole(rol: Rol) {
  return rol === "vendedor" ? "/vendedor" : "/admin/dashboard";
}

export function LoginForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [rememberUser, setRememberUser] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(searchParams.get("error") ? "No se pudo validar tu acceso. Comunícate con el administrador del sistema." : "");

  useEffect(() => {
    const saved = window.localStorage.getItem(REMEMBER_USER_KEY);
    if (saved) setUsuario(saved);
  }, []);

  const usuarioError = submitted && !usuario.trim() ? "Ingresa tu usuario." : "";
  const passwordError = submitted && !password ? "Ingresa tu contraseña." : "";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setSubmitted(true);
    setError("");

    const cleanUsuario = usuario.trim().toLowerCase();
    if (!cleanUsuario || !password) {
      setError("Completa usuario y contraseña para continuar.");
      return;
    }

    setLoading(true);

    try {
      let emailForLogin = cleanUsuario;
      if (!cleanUsuario.includes("@")) {
        const { data, error: lookupError } = await supabase.rpc("get_login_email", { login_text: cleanUsuario });
        if (lookupError || !data) {
          setError("Usuario o contraseña incorrectos.");
          return;
        }
        emailForLogin = data as string;
      }

      const { error: signError } = await supabase.auth.signInWithPassword({ email: emailForLogin, password });
      if (signError) {
        setError("Usuario o contraseña incorrectos.");
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setError("No se pudo validar la sesión. Inténtalo nuevamente.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("usuarios")
        .select("activo,roles(codigo)")
        .eq("id", user.id)
        .single();

      const rol = (profile as { roles?: { codigo?: Rol } | null } | null)?.roles?.codigo;
      if (profileError || !profile?.activo || !rol) {
        await supabase.auth.signOut();
        setError("Usuario inactivo o sin perfil válido. Comunícate con el administrador del sistema.");
        return;
      }

      if (rememberUser) window.localStorage.setItem(REMEMBER_USER_KEY, cleanUsuario);
      else window.localStorage.removeItem(REMEMBER_USER_KEY);

      router.replace(redirectByRole(rol));
      router.refresh();
    } catch {
      setError("No se pudo iniciar sesión. Revisa tu conexión e inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md overflow-hidden border border-white/15 bg-white shadow-2xl">
      <CardContent className="space-y-6 p-0">
        <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 px-7 py-8 text-white">
          <div className="mx-auto flex w-fit justify-center rounded-3xl bg-white/95 px-6 py-4 shadow-lg">
            <Image src="/backus-logo-transparent.png" alt="Backus" width={250} height={70} priority className="h-auto w-60 object-contain" />
          </div>
          <div className="mt-6 text-center">
            <h1 className="text-2xl font-black">Iniciar sesión</h1>
          </div>
        </div>

        <form className="space-y-4 px-7 pb-7" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="usuario">Usuario</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="usuario"
                value={usuario}
                onChange={(event) => setUsuario(event.target.value)}
                aria-invalid={!!usuarioError}
                aria-describedby={usuarioError ? "usuario-error" : undefined}
                placeholder="Ingresa tu usuario"
                autoComplete="username"
                className={cn("h-12 pl-10 text-base", usuarioError && "border-red-300 focus-visible:ring-red-500")}
                disabled={loading}
              />
            </div>
            {usuarioError ? <p id="usuario-error" className="text-xs font-semibold text-red-600">{usuarioError}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "password-error password-help" : "password-help"}
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                className={cn("h-12 pl-10 pr-12 text-base", passwordError && "border-red-300 focus-visible:ring-red-500")}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                disabled={loading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordError ? <p id="password-error" className="text-xs font-semibold text-red-600">{passwordError}</p> : null}
            <p id="password-help" className="text-xs font-semibold text-slate-500">¿Olvidaste tu contraseña? Comunícate con el administrador del sistema para restablecerla.</p>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={rememberUser}
              onChange={(event) => setRememberUser(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
              disabled={loading}
            />
            Recordar usuario en este equipo
          </label>

          {error ? <Alert tone="error">{error}</Alert> : null}

          <Button className="h-12 w-full text-base" size="lg" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Validando acceso..." : "Iniciar sesión"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
