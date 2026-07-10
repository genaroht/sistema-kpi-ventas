-- Migración incremental: KPI visibles y grupos KPI dinámicos por supervisor.
-- Ejecutar una sola vez en Supabase SQL Editor después de la migración v3.

begin;

-- 1) Permitir grupos KPI personalizados y visibilidad de KPI en tabla/reportes/gráficos.
alter table public.kpis
  add column if not exists visible_tabla boolean not null default true;

alter table public.kpis
  alter column grupo set default 'Comercial';

-- La versión anterior limitaba grupo a Volumen/Cobertura/Comercial. Se retira para permitir grupos creados desde la app.
alter table public.kpis
  drop constraint if exists kpis_grupo_check;

update public.kpis
set visible_tabla = true
where visible_tabla is null;

-- 2) Tabla de grupos KPI administrable por administrador y supervisor.
create table if not exists public.kpi_grupos (
  id uuid primary key default gen_random_uuid(),
  jefe_id uuid not null references public.usuarios(id) on delete cascade,
  nombre text not null,
  orden integer not null default 10,
  activo boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint kpi_grupos_jefe_nombre_unique unique (jefe_id, nombre),
  constraint kpi_grupos_nombre_not_empty check (length(trim(nombre)) > 0)
);

create index if not exists idx_kpis_jefe_visible_tabla
on public.kpis(jefe_id, visible_tabla, activo, grupo, orden);

create index if not exists idx_kpi_grupos_jefe_orden
on public.kpi_grupos(jefe_id, activo, orden, nombre);

-- 3) Sembrar grupos base para cada supervisor existente.
insert into public.kpi_grupos (jefe_id, nombre, orden, activo)
select u.id, base.nombre, base.orden, true
from public.usuarios u
join public.roles r on r.id = u.rol_id and r.codigo = 'jefe'
cross join (values ('Volumen', 1), ('Cobertura', 2), ('Comercial', 3)) as base(nombre, orden)
on conflict (jefe_id, nombre) do update set activo = true, orden = excluded.orden;

-- 4) Registrar grupos ya usados en kpis, incluyendo personalizados.
insert into public.kpi_grupos (jefe_id, nombre, orden, activo)
select k.jefe_id, trim(k.grupo), min(coalesce(k.orden, 10)), true
from public.kpis k
where trim(coalesce(k.grupo, '')) <> ''
group by k.jefe_id, trim(k.grupo)
on conflict (jefe_id, nombre) do nothing;

alter table public.kpi_grupos enable row level security;

drop policy if exists "kpi_grupos_select_scoped" on public.kpi_grupos;
drop policy if exists "kpi_grupos_insert_jefe_or_admin" on public.kpi_grupos;
drop policy if exists "kpi_grupos_update_jefe_or_admin" on public.kpi_grupos;
drop policy if exists "kpi_grupos_delete_admin" on public.kpi_grupos;

create policy "kpi_grupos_select_scoped"
on public.kpi_grupos
for select
to authenticated
using (
  public.is_administrador()
  or jefe_id = public.current_jefe_id()
);

create policy "kpi_grupos_insert_jefe_or_admin"
on public.kpi_grupos
for insert
to authenticated
with check (
  public.is_administrador()
  or (public.is_jefe() and jefe_id = auth.uid())
);

create policy "kpi_grupos_update_jefe_or_admin"
on public.kpi_grupos
for update
to authenticated
using (
  public.is_administrador()
  or (public.is_jefe() and jefe_id = auth.uid())
)
with check (
  public.is_administrador()
  or (public.is_jefe() and jefe_id = auth.uid())
);

create policy "kpi_grupos_delete_admin"
on public.kpi_grupos
for delete
to authenticated
using (public.is_administrador());

commit;
