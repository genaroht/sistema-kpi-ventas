import { cn } from "@/lib/utils";

export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-slate-200", className)} aria-label={label} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(safe)}>
      <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${safe}%` }} />
    </div>
  );
}
