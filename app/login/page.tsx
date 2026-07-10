export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.18),transparent_35%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-900 to-transparent" />
      <div className="relative z-10 w-full">
        <Suspense fallback={<Skeleton className="mx-auto h-[520px] w-full max-w-md" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
