import type { Rol } from "@/types/database";

export function roleLabel(role?: Rol | null) {
  if (role === "administrador") return "Administrador";
  if (role === "gerente") return "Gerente";
  if (role === "jefe") return "Supervisor";
  if (role === "vendedor") return "Vendedor";
  return "Sin rol";
}

export function roleLabelWithCode(role?: Rol | null, codigoOperativo?: string | null) {
  const label = roleLabel(role);
  const code = codigoOperativo?.trim();
  return role === "jefe" && code ? `${label} · ${code}` : label;
}
