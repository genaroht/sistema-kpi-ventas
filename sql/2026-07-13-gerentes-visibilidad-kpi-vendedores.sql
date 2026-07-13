-- Ajustes 2026-07-13
-- 1) Tabla operativa independiente para gerentes.
-- 2) El administrador puede crear/editar gerentes desde Usuarios.
-- 3) Los vendedores solo pueden ver y registrar KPI activos y visibles.
-- 4) La visibilidad de KPI controla vendedor, Tabla Excel, reportes y gráficos.
-- Ejecutar una sola vez en Supabase SQL Editor con permisos de propietario.

begin;

-- Asegura que el rol gerente exista.
alter table public.roles drop constraint if exists roles_codigo_check;
alter table public.roles
  add constraint roles_codigo_check
  check (codigo in ('administrador', 'gerente', 'jefe', 'vendedor'));

insert into public.roles (codigo, nombre, codigo_operativo)
values ('gerente', 'Gerente', null)
on conflict (codigo) do update set nombre = excluded.nombre;

-- Tabla separada solicitada para los gerentes.
create table if not exists public.gerentes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references public.usuarios(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint gerentes_nombre_not_empty check (length(trim(nombre)) > 0)
);

create index if not exists idx_gerentes_usuario_id
  on public.gerentes(usuario_id);
create index if not exists idx_gerentes_activo_nombre
  on public.gerentes(activo, nombre);

alter table public.gerentes enable row level security;

grant select, insert, update, delete on public.gerentes to authenticated;

-- El administrador gestiona gerentes. El gerente únicamente puede leer su propia fila.
drop policy if exists "gerentes_select_scoped" on public.gerentes;
create policy "gerentes_select_scoped"
on public.gerentes
for select
to authenticated
using (
  public.is_administrador()
  or usuario_id = auth.uid()
);

drop policy if exists "gerentes_admin_all" on public.gerentes;
create policy "gerentes_admin_all"
on public.gerentes
for all
to authenticated
using (public.is_administrador())
with check (public.is_administrador());

-- Registra en public.gerentes a cualquier gerente que ya existía en usuarios.
insert into public.gerentes (usuario_id, nombre, activo)
select
  u.id,
  coalesce(nullif(trim(u.nombre), ''), u.usuario),
  u.activo
from public.usuarios u
join public.roles r on r.id = u.rol_id
where r.codigo = 'gerente'
on conflict (usuario_id) do update set
  nombre = excluded.nombre,
  activo = excluded.activo;

-- Configuración manual segura para gerentes creados previamente en Authentication.
create or replace function public.setup_gerente(
  p_email text,
  p_usuario text,
  p_nombre text default 'Gerente Comercial'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id uuid;
  v_gerente_role_id uuid;
  v_nombre text := trim(p_nombre);
begin
  select au.id
  into v_auth_id
  from auth.users as au
  where lower(au.email) = lower(trim(p_email))
  limit 1;

  if v_auth_id is null then
    raise exception 'Primero crea el usuario % en Authentication > Users', p_email;
  end if;

  select r.id
  into v_gerente_role_id
  from public.roles as r
  where r.codigo = 'gerente'
  limit 1;

  if v_gerente_role_id is null then
    raise exception 'No existe el rol gerente en public.roles';
  end if;

  insert into public.usuarios (
    id,
    usuario,
    email,
    nombre,
    rol_id,
    jefe_id,
    codigo_operativo,
    activo
  )
  values (
    v_auth_id,
    lower(trim(p_usuario)),
    lower(trim(p_email)),
    v_nombre,
    v_gerente_role_id,
    null,
    null,
    true
  )
  on conflict (id) do update set
    usuario = excluded.usuario,
    email = excluded.email,
    nombre = excluded.nombre,
    rol_id = excluded.rol_id,
    jefe_id = null,
    codigo_operativo = null,
    activo = true;

  insert into public.gerentes (usuario_id, nombre, activo)
  values (v_auth_id, v_nombre, true)
  on conflict (usuario_id) do update set
    nombre = excluded.nombre,
    activo = excluded.activo;
end;
$$;

revoke execute on function public.setup_gerente(text, text, text)
from public, anon, authenticated;

-- Un vendedor solo puede consultar KPI que estén activos Y visibles.
-- Administradores y gerentes ven todos. Cada supervisor ve todos sus KPI para administrarlos.
drop policy if exists "kpis_select_scoped" on public.kpis;
create policy "kpis_select_scoped"
on public.kpis
for select
to authenticated
using (
  public.is_administrador()
  or public.is_gerente()
  or (public.is_jefe() and jefe_id = auth.uid())
  or (
    public.current_user_role() = 'vendedor'
    and jefe_id = public.current_jefe_id()
    and activo = true
    and visible_tabla = true
  )
);

-- Evita que un vendedor inserte registros para KPI ocultos mediante llamadas directas.
drop policy if exists "registros_insert_scoped" on public.registros_kpi;
create policy "registros_insert_scoped"
on public.registros_kpi
for insert
to authenticated
with check (
  cantidad >= 0
  and (
    public.is_administrador()
    or (
      public.is_jefe()
      and exists (
        select 1
        from public.vendedores v
        where v.id = vendedor_id
          and v.jefe_id = auth.uid()
      )
      and exists (
        select 1
        from public.kpis k
        where k.id = kpi_id
          and k.jefe_id = auth.uid()
      )
    )
    or (
      public.current_user_role() = 'vendedor'
      and vendedor_id = public.current_vendedor_id()
      and exists (
        select 1
        from public.kpis k
        where k.id = kpi_id
          and k.jefe_id = public.current_jefe_id()
          and k.activo = true
          and k.visible_tabla = true
      )
    )
  )
);

comment on table public.gerentes is
  'Registro operativo independiente de usuarios con rol gerente.';
comment on column public.kpis.visible_tabla is
  'Controla si el KPI es visible para el vendedor, Tabla Excel, reportes y gráficos.';

commit;

-- Verificación opcional:
-- select g.usuario_id, g.nombre, g.activo, u.email
-- from public.gerentes g
-- join public.usuarios u on u.id = g.usuario_id;
