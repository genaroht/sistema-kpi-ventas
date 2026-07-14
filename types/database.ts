export type Rol = "administrador" | "gerente" | "jefe" | "vendedor";
export type KpiTipo = "normal" | "adicional";
export type KpiGrupo = string;
export type Etapa = "compromiso" | "corte" | "cierre";

export type Role = {
  id: string;
  codigo: Rol;
  nombre: string;
  codigo_operativo: string | null;
  created_at: string;
};

export type Usuario = {
  id: string;
  usuario: string;
  email: string | null;
  nombre: string | null;
  rol_id: string;
  jefe_id: string | null;
  codigo_operativo: string | null;
  activo: boolean;
  created_at: string;
  roles?: Pick<Role, "codigo" | "nombre"> | null;
};

export type Profile = Usuario & {
  rol: Rol;
};

export type Supervisor = {
  id: string;
  usuario_id: string;
  codigo_operativo: string;
  nombre: string;
  activo: boolean;
  created_at: string;
  usuario?: Pick<Usuario, "id" | "usuario" | "email" | "nombre" | "activo"> | null;
};

export type Gerente = {
  id: string;
  usuario_id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
  usuario?: Pick<Usuario, "id" | "usuario" | "email" | "nombre" | "activo"> | null;
};

export type Vendedor = {
  id: string;
  usuario_id: string | null;
  jefe_id: string;
  nombre: string;
  zona: string;
  visible_tabla: boolean;
  activo: boolean;
  created_at: string;
  usuario?: Pick<Usuario, "id" | "usuario" | "email" | "nombre"> | null;
  jefe?: Pick<Usuario, "id" | "usuario" | "email" | "nombre"> | null;
};

export type Kpi = {
  id: string;
  jefe_id: string;
  nombre: string;
  activo: boolean;
  tipo: KpiTipo;
  color: string | null;
  grupo: KpiGrupo | null;
  visible_tabla: boolean;
  orden: number;
  created_at: string;
  jefe?: Pick<Usuario, "id" | "usuario" | "email" | "nombre"> | null;
};


export type KpiGrupoRow = {
  id: string;
  jefe_id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  created_at: string;
  jefe?: Pick<Usuario, "id" | "usuario" | "email" | "nombre" | "codigo_operativo"> | null;
};


export type HabilitacionEtapas = {
  id: string;
  fecha: string;
  jefe_id: string;
  compromiso_activo: boolean;
  corte_activo: boolean;
  cierre_activo: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type RegistroKpi = {
  id: string;
  fecha: string;
  vendedor_id: string;
  kpi_id: string;
  etapa: Etapa;
  cantidad: number;
  created_at: string;
};

export type RegistroJoined = RegistroKpi & {
  vendedor?: Pick<Vendedor, "id" | "nombre" | "zona" | "activo" | "jefe_id"> | null;
  kpi?: Pick<Kpi, "id" | "nombre" | "tipo" | "color" | "grupo" | "visible_tabla" | "orden" | "activo" | "jefe_id"> | null;
};

export type AvanceRow = {
  fecha: string;
  zona: string;
  vendedor: string;
  vendedor_id: string;
  kpi: string;
  kpi_id: string;
  tipo: KpiTipo;
  color: string | null;
  grupo: KpiGrupo | null;
  compromiso: number;
  corte: number;
  cierre: number;
  avance: number | null;
  estado: string;
};
