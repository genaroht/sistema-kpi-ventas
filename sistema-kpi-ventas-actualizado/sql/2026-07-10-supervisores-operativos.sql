-- Migración: tabla operativa de supervisores.
-- Ejecutar en Supabase SQL Editor antes de usar /admin/supervisores.

begin;

create table if not exists public.supervisores (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references public.usuarios(id) on delete cascade,
  codigo_operativo text not null unique,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint supervisores_codigo_not_empty check (length(trim(codigo_operativo)) > 0),
  constraint supervisores_nombre_not_empty check (length(trim(nombre)) > 0)
);

create index if not exists idx_supervisores_usuario_id
on public.supervisores(usuario_id);

create index if not exists idx_supervisores_activo_codigo
on public.supervisores(activo, codigo_operativo, nombre);

insert into public.supervisores (usuario_id, codigo_operativo, nombre, activo)
select
  u.id,
  coalesce(nullif(trim(u.codigo_operativo), ''), upper(u.usuario)),
  coalesce(nullif(trim(u.nombre), ''), u.usuario),
  u.activo
from public.usuarios u
join public.roles r on r.id = u.rol_id
where r.codigo = 'jefe'
on conflict (usuario_id) do update set
  codigo_operativo = excluded.codigo_operativo,
  nombre = excluded.nombre,
  activo = excluded.activo;

update public.usuarios u
set codigo_operativo = s.codigo_operativo,
    nombre = coalesce(nullif(trim(u.nombre), ''), s.nombre),
    activo = s.activo
from public.supervisores s
where s.usuario_id = u.id;

alter table public.supervisores enable row level security;

drop policy if exists "supervisores_select_scoped" on public.supervisores;
drop policy if exists "supervisores_admin_all" on public.supervisores;
drop policy if exists "supervisores_self_update" on public.supervisores;

create policy "supervisores_select_scoped"
on public.supervisores
for select
to authenticated
using (
  public.is_administrador()
  or usuario_id = auth.uid()
  or public.current_jefe_id() = usuario_id
);

create policy "supervisores_admin_all"
on public.supervisores
for all
to authenticated
using (public.is_administrador())
with check (public.is_administrador());

commit;
