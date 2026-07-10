-- Migración incremental v3: código operativo por supervisor y control de visibilidad en Tabla Excel.
-- Ejecutar en Supabase SQL Editor después de la migración de grupos KPI.

begin;

-- El código operativo no pertenece al rol global; cada supervisor puede tener un código distinto.
alter table public.usuarios
  add column if not exists codigo_operativo text;

update public.roles
set nombre = 'Supervisor', codigo_operativo = null
where codigo = 'jefe';

-- Código conocido del supervisor Julio Taboada. Ajusta o agrega otros supervisores según corresponda.
update public.usuarios
set codigo_operativo = 'L7'
where lower(usuario) = 'jtaboada'
  and rol_id in (select id from public.roles where codigo = 'jefe');

-- Permite ocultar vendedores de la Tabla Excel sin desactivarlos ni borrar historial.
alter table public.vendedores
  add column if not exists visible_tabla boolean not null default true;

update public.vendedores
set visible_tabla = true
where visible_tabla is null;

create index if not exists idx_vendedores_jefe_visible_tabla
on public.vendedores(jefe_id, visible_tabla, activo);

commit;
