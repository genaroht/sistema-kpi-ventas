import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertTone = "info" | "success" | "warning" | "error";

const toneStyles: Record<AlertTone, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-800",
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-900",
  error: "border-red-200 bg-red-50 text-red-800"
};

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle
};

export function Alert({ tone = "info", title, children, className }: { tone?: AlertTone; title?: string; children: React.ReactNode; className?: string }) {
  const Icon = icons[tone];
  return (
    <div className={cn("flex gap-3 rounded-2xl border p-3 text-sm font-semibold", toneStyles[tone], className)} role={tone === "error" ? "alert" : "status"}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title ? <p className="font-black">{title}</p> : null}
        <div className="leading-5">{children}</div>
      </div>
    </div>
  );
}
