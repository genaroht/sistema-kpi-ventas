"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Home, LineChart, LogOut, Menu, ShieldCheck, Target, UserCog, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Rol } from "@/types/database";
import { roleLabelWithCode } from "@/lib/display-labels";

const baseNav = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Home, adminOnly: false },
  { href: "/admin/tabla", label: "Tabla Excel", icon: FileSpreadsheet, adminOnly: false },
  { href: "/admin/avance", label: "Avance %", icon: LineChart, adminOnly: false },
  { href: "/admin/supervisores", label: "Supervisores", icon: ShieldCheck, adminOnly: true },
  { href: "/admin/vendedores", label: "Vendedores", icon: Users, adminOnly: false },
  { href: "/admin/kpis", label: "KPI", icon: Target, adminOnly: false },
  { href: "/admin/reportes", label: "Reportes", icon: LineChart, adminOnly: false },
  { href: "/admin/exportar", label: "Exportar", icon: Download, adminOnly: false },
  { href: "/admin/usuarios", label: "Usuarios", icon: UserCog, adminOnly: true }
];

export function AdminShell({ children, profileName }: { children: React.ReactNode; profileName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(profileName);
  const [role, setRole] = useState<Rol | null>(null);
  const [codigoOperativo, setCodigoOperativo] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const nav = baseNav.filter((item) => !item.adminOnly || role === "administrador");

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("usuarios")
        .select("email,nombre,usuario,activo,codigo_operativo,roles(codigo,nombre)")
        .eq("id", user.id)
        .single();

      const userRole = (profile as any)?.roles?.codigo as Rol | undefined;
      if (!profile?.activo || !userRole) {
        router.replace("/login?error=perfil");
        return;
      }
      if (userRole === "vendedor") {
        router.replace("/vendedor");
        return;
      }
      if (pathname === "/admin/usuarios" && userRole !== "administrador") {
        router.replace("/admin/dashboard");
        return;
      }
      setRole(userRole);
      setCodigoOperativo((profile as { codigo_operativo?: string | null })?.codigo_operativo ?? null);
      setDisplayName(profile.nombre ?? profile.email ?? profile.usuario ?? profileName);
      setChecking(false);
    }
    checkRole();
  }, [router, supabase, profileName, pathname]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const Sidebar = (
    <aside className="flex h-full flex-col border-r border-white/10 bg-gradient-to-b from-slate-950 via-blue-950 to-blue-900 p-4 text-white shadow-2xl">
      <div className="mb-6 flex items-center gap-3 rounded-3xl bg-white px-4 py-3 shadow-lg">
        <Image src="/backus-logo-transparent.png" alt="Backus" width={150} height={44} className="h-auto w-40 object-contain" />
      </div>
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
        <p className="truncate text-sm font-black text-white">{displayName}</p>
        <p className="text-xs font-semibold text-blue-100">{roleLabelWithCode(role, codigoOperativo)}</p>
      </div>
      <nav className="space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition", active ? "bg-yellow-400 text-slate-950 shadow-lg" : "text-blue-50 hover:bg-white/10 hover:text-white")}
            >
              <Icon className="h-4 w-4" /> {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-2xl border border-white/10 bg-white/10 p-3">
        <Button variant="ghost" size="sm" className="w-full justify-start text-blue-50 hover:bg-white/10 hover:text-white" onClick={signOut}><LogOut className="h-4 w-4" /> Salir</Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_34%),linear-gradient(180deg,#eff6ff_0%,#f8fafc_38%,#ffffff_100%)]">
      <div className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">{Sidebar}</div>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-gradient-to-r from-slate-950 via-blue-950 to-blue-900 text-white shadow-lg backdrop-blur lg:hidden">
        <div className="flex items-center justify-between p-3">
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></Button>
          <div className="rounded-2xl bg-white px-3 py-2">
            <Image src="/backus-logo-transparent.png" alt="Backus" width={120} height={38} className="h-auto w-28 object-contain" />
          </div>
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm lg:hidden">
          <div className="h-full w-80 max-w-[85vw] shadow-2xl">
            <div className="absolute left-[min(18rem,calc(85vw-3rem))] top-3"><Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setOpen(false)}><X className="h-5 w-5" /></Button></div>
            {Sidebar}
          </div>
        </div>
      ) : null}

      <main className="min-w-0 overflow-x-hidden p-4 pb-24 lg:ml-72 lg:w-[calc(100vw-18rem)] lg:max-w-[calc(100vw-18rem)] lg:p-6">{checking ? <div className="rounded-2xl border bg-white p-6 shadow-soft"><p className="font-bold">Validando acceso...</p></div> : children}</main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-white/95 p-1 shadow-[0_-8px_22px_rgba(15,23,42,0.10)] backdrop-blur lg:hidden">
        {nav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={cn("flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-bold", active ? "bg-blue-950 text-yellow-300" : "text-slate-500")}> 
              <Icon className="h-4 w-4" /> {item.label.replace("Tabla Excel", "Tabla")}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
