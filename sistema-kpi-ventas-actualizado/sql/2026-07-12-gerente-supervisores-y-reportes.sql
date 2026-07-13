-- Rol gerente de solo lectura + supervisores RL/RF.
-- Ejecutar en Supabase SQL Editor con permisos de propietario.

begin;

alter table public.roles drop constraint if exists roles_codigo_check;
alter table public.roles
  add constraint roles_codigo_check
  check (codigo in ('administrador', 'gerente', 'jefe', 'vendedor'));

insert into public.roles (codigo, nombre, codigo_operativo)
values ('gerente', 'Gerente', null)
on conflict (codigo) do update set nombre = excluded.nombre;

create or replace function public.is_gerente()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'gerente', false);
$$;

grant execute on function public.is_gerente() to authenticated;

-- El gerente puede leer toda la operación, pero no recibe políticas INSERT/UPDATE/DELETE.
drop policy if exists "usuarios_select_scoped" on public.usuarios;
create policy "usuarios_select_scoped"
on public.usuarios
for select
to authenticated
using (
  id = auth.uid()
  or public.is_administrador()
  or public.is_gerente()
  or (public.is_jefe() and jefe_id = auth.uid())
);

drop policy if exists "supervisores_select_scoped" on public.supervisores;
create policy "supervisores_select_scoped"
on public.supervisores
for select
to authenticated
using (
  public.is_administrador()
  or public.is_gerente()
  or usuario_id = auth.uid()
  or public.current_jefe_id() = usuario_id
);

drop policy if exists "vendedores_select_scoped" on public.vendedores;
create policy "vendedores_select_scoped"
on public.vendedores
for select
to authenticated
using (
  public.is_administrador()
  or public.is_gerente()
  or jefe_id = public.current_jefe_id()
  or usuario_id = auth.uid()
);

drop policy if exists "kpis_select_scoped" on public.kpis;
create policy "kpis_select_scoped"
on public.kpis
for select
to authenticated
using (
  public.is_administrador()
  or public.is_gerente()
  or jefe_id = public.current_jefe_id()
);

drop policy if exists "kpi_grupos_select_scoped" on public.kpi_grupos;
create policy "kpi_grupos_select_scoped"
on public.kpi_grupos
for select
to authenticated
using (
  public.is_administrador()
  or public.is_gerente()
  or jefe_id = public.current_jefe_id()
);

drop policy if exists "registros_select_scoped" on public.registros_kpi;
create policy "registros_select_scoped"
on public.registros_kpi
for select
to authenticated
using (
  public.is_administrador()
  or public.is_gerente()
  or exists (
    select 1
    from public.vendedores v
    where v.id = vendedor_id
      and v.jefe_id = public.current_jefe_id()
  )
  or vendedor_id = public.current_vendedor_id()
);

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
  auth_id uuid;
  gerente_role_id uuid;
begin
  select id into auth_id from auth.users where lower(email) = lower(p_email) limit 1;
  if auth_id is null then
    raise exception 'Primero crea el usuario % en Authentication > Users', p_email;
  end if;

  select id into gerente_role_id from public.roles where codigo = 'gerente';

  insert into public.usuarios (id, usuario, email, nombre, rol_id, jefe_id, codigo_operativo, activo)
  values (auth_id, lower(trim(p_usuario)), lower(trim(p_email)), trim(p_nombre), gerente_role_id, null, null, true)
  on conflict (id) do update set
    usuario = excluded.usuario,
    email = excluded.email,
    nombre = excluded.nombre,
    rol_id = excluded.rol_id,
    jefe_id = null,
    codigo_operativo = null,
    activo = true;
end;
$$;

create or replace function public.setup_supervisor_operativo(
  p_email text,
  p_usuario text,
  p_nombre text,
  p_codigo_operativo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_id uuid;
  jefe_role_id uuid;
  codigo text := upper(trim(p_codigo_operativo));
begin
  select id into auth_id from auth.users where lower(email) = lower(p_email) limit 1;
  if auth_id is null then
    raise exception 'Primero crea el usuario % en Authentication > Users', p_email;
  end if;

  select id into jefe_role_id from public.roles where codigo = 'jefe';

  insert into public.usuarios (id, usuario, email, nombre, rol_id, jefe_id, codigo_operativo, activo)
  values (auth_id, lower(trim(p_usuario)), lower(trim(p_email)), trim(p_nombre), jefe_role_id, null, codigo, true)
  on conflict (id) do update set
    usuario = excluded.usuario,
    email = excluded.email,
    nombre = excluded.nombre,
    rol_id = excluded.rol_id,
    jefe_id = null,
    codigo_operativo = excluded.codigo_operativo,
    activo = true;

  insert into public.supervisores (usuario_id, codigo_operativo, nombre, activo)
  values (auth_id, codigo, trim(p_nombre), true)
  on conflict (usuario_id) do update set
    codigo_operativo = excluded.codigo_operativo,
    nombre = excluded.nombre,
    activo = true;

  insert into public.kpi_grupos (jefe_id, nombre, orden, activo) values
  (auth_id, 'Volumen', 1, true),
  (auth_id, 'Cobertura', 2, true),
  (auth_id, 'Comercial', 3, true)
  on conflict (jefe_id, nombre) do update set
    orden = excluded.orden,
    activo = true;
end;
$$;

revoke execute on function public.setup_gerente(text,text,text) from public, anon, authenticated;
revoke execute on function public.setup_supervisor_operativo(text,text,text,text) from public, anon, authenticated;

-- Registra automáticamente los nuevos supervisores cuando sus usuarios Auth ya existen.
do $$
begin
  if exists (select 1 from auth.users where lower(email) = 'rluna@kpibackus.pe') then
    perform public.setup_supervisor_operativo('rluna@kpibackus.pe', 'rluna', 'Roberto Luna', 'RL');
  else
    raise notice 'Pendiente: crear rluna@kpibackus.pe en Authentication y ejecutar setup_supervisor_operativo.';
  end if;

  if exists (select 1 from auth.users where lower(email) = 'ahuertas@kpibackus.pe') then
    perform public.setup_supervisor_operativo('ahuertas@kpibackus.pe', 'ahuertas', 'Anthony Huertas', 'RF');
  else
    raise notice 'Pendiente: crear ahuertas@kpibackus.pe en Authentication y ejecutar setup_supervisor_operativo.';
  end if;
end;
$$;

commit;

-- Después de crear los usuarios en Authentication, ejecutar si quedaron pendientes:
-- select public.setup_supervisor_operativo('rluna@kpibackus.pe', 'rluna', 'Roberto Luna', 'RL');
-- select public.setup_supervisor_operativo('ahuertas@kpibackus.pe', 'ahuertas', 'Anthony Huertas', 'RF');
-- Para el gerente:
-- select public.setup_gerente('gerente@kpibackus.pe', 'gerente', 'Gerente Comercial');
