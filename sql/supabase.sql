-- Sistema KPI Ventas - Supabase SQL actualizado
-- Roles: administrador, supervisor(jefe interno), vendedor
-- Estructura con aislamiento por supervisor: cada supervisor solo ve sus vendedores, KPI y registros.
-- IMPORTANTE LOCAL: este script reinicia las tablas públicas del sistema.

create extension if not exists pgcrypto;

-- Limpieza segura para desarrollo local.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists trg_registros_stage_order on public.registros_kpi;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.current_user_role() cascade;
drop function if exists public.is_administrador() cascade;
drop function if exists public.is_jefe() cascade;
drop function if exists public.current_jefe_id() cascade;
drop function if exists public.current_vendedor_id() cascade;
drop function if exists public.enforce_stage_order() cascade;
drop function if exists public.get_login_email(text) cascade;
drop function if exists public.setup_admin(text,text,text) cascade;
drop function if exists public.setup_jefe_julio(text,text) cascade;
drop function if exists public.setup_vendedor_demo(text,text,text,text,text) cascade;

drop table if exists public.registros_kpi cascade;
drop table if exists public.kpi_grupos cascade;
drop table if exists public.kpis cascade;
drop table if exists public.vendedores cascade;
drop table if exists public.supervisores cascade;
drop table if exists public.usuarios cascade;
drop table if exists public.roles cascade;
drop table if exists public.profiles cascade;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo in ('administrador', 'jefe', 'vendedor')),
  nombre text not null,
  codigo_operativo text,
  created_at timestamp with time zone not null default now()
);

insert into public.roles (codigo, nombre, codigo_operativo) values
('administrador', 'Administrador', null),
('jefe', 'Supervisor', null),
('vendedor', 'Vendedor', null);

create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  usuario text not null unique,
  email text unique,
  nombre text,
  rol_id uuid not null references public.roles(id),
  jefe_id uuid references public.usuarios(id) on delete set null,
  codigo_operativo text,
  activo boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint usuarios_usuario_lower check (usuario = lower(usuario))
);

create table public.supervisores (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references public.usuarios(id) on delete cascade,
  codigo_operativo text not null unique,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint supervisores_codigo_not_empty check (length(trim(codigo_operativo)) > 0),
  constraint supervisores_nombre_not_empty check (length(trim(nombre)) > 0)
);

create table public.vendedores (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid unique references public.usuarios(id) on delete set null,
  jefe_id uuid not null references public.usuarios(id) on delete cascade,
  nombre text not null,
  zona text not null,
  visible_tabla boolean not null default true,
  activo boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint vendedores_jefe_zona_nombre_unique unique (jefe_id, zona, nombre)
);

create table public.kpis (
  id uuid primary key default gen_random_uuid(),
  jefe_id uuid not null references public.usuarios(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  tipo text not null check (tipo in ('normal', 'adicional')) default 'normal',
  color text,
  grupo text not null default 'Comercial',
  visible_tabla boolean not null default true,
  orden integer not null default 1,
  created_at timestamp with time zone not null default now(),
  constraint kpis_jefe_nombre_unique unique (jefe_id, nombre)
);


create table public.kpi_grupos (
  id uuid primary key default gen_random_uuid(),
  jefe_id uuid not null references public.usuarios(id) on delete cascade,
  nombre text not null,
  orden integer not null default 10,
  activo boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint kpi_grupos_jefe_nombre_unique unique (jefe_id, nombre),
  constraint kpi_grupos_nombre_not_empty check (length(trim(nombre)) > 0)
);

create table public.registros_kpi (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  vendedor_id uuid not null references public.vendedores(id) on delete cascade,
  kpi_id uuid not null references public.kpis(id) on delete restrict,
  etapa text not null check (etapa in ('compromiso', 'corte', 'cierre')),
  cantidad numeric not null check (cantidad >= 0),
  created_at timestamp with time zone not null default now(),
  constraint registros_kpi_unique unique (fecha, vendedor_id, kpi_id, etapa)
);

create index idx_usuarios_rol_id on public.usuarios(rol_id);
create index idx_usuarios_jefe_id on public.usuarios(jefe_id);
create index idx_supervisores_usuario_id on public.supervisores(usuario_id);
create index idx_supervisores_activo_codigo on public.supervisores(activo, codigo_operativo, nombre);
create index idx_vendedores_usuario_id on public.vendedores(usuario_id);
create index idx_vendedores_jefe_id on public.vendedores(jefe_id);
create index idx_vendedores_jefe_visible_tabla on public.vendedores(jefe_id, visible_tabla, activo);
create index idx_kpis_jefe_orden on public.kpis(jefe_id, orden);
create index idx_kpis_jefe_grupo_orden on public.kpis(jefe_id, grupo, orden);
create index idx_kpis_jefe_visible_tabla on public.kpis(jefe_id, visible_tabla, activo, grupo, orden);
create index idx_kpi_grupos_jefe_orden on public.kpi_grupos(jefe_id, activo, orden, nombre);
create index idx_registros_fecha on public.registros_kpi(fecha);
create index idx_registros_vendedor_fecha on public.registros_kpi(vendedor_id, fecha);
create index idx_registros_kpi_fecha on public.registros_kpi(kpi_id, fecha);

-- Perfil automático al crear usuarios Auth.
-- Por defecto queda como vendedor. Luego el administrador le cambia rol desde tabla o SQL.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vendedor_role_id uuid;
  base_usuario text;
begin
  select id into vendedor_role_id from public.roles where codigo = 'vendedor';
  base_usuario := lower(regexp_replace(split_part(coalesce(new.email, new.id::text), '@', 1), '[^a-zA-Z0-9_]+', '', 'g'));
  if base_usuario is null or base_usuario = '' then
    base_usuario := replace(new.id::text, '-', '');
  end if;

  insert into public.usuarios (id, usuario, email, nombre, rol_id, codigo_operativo, activo)
  values (
    new.id,
    base_usuario,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'nombre', split_part(coalesce(new.email, ''), '@', 1)),
    vendedor_role_id,
    null,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Funciones de seguridad y alcance.
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select r.codigo
  from public.usuarios u
  join public.roles r on r.id = u.rol_id
  where u.id = auth.uid()
    and u.activo = true
  limit 1;
$$;

create or replace function public.is_administrador()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'administrador', false);
$$;

create or replace function public.is_jefe()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'jefe', false);
$$;

create or replace function public.current_jefe_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select case
    when public.current_user_role() = 'jefe' then auth.uid()
    when public.current_user_role() = 'vendedor' then (select jefe_id from public.usuarios where id = auth.uid() and activo = true)
    else null::uuid
  end;
$$;

create or replace function public.current_vendedor_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id
  from public.vendedores
  where usuario_id = auth.uid()
    and activo = true
  limit 1;
$$;

-- Permite login por usuario o por email.
create or replace function public.get_login_email(login_text text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email
  from public.usuarios
  where activo = true
    and (
      lower(usuario) = lower(trim(login_text))
      or lower(email) = lower(trim(login_text))
    )
  limit 1;
$$;

grant execute on function public.get_login_email(text) to anon, authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_jefe_id() to authenticated;
grant execute on function public.current_vendedor_id() to authenticated;

-- Validación de orden de etapas. Jefe y administrador pueden corregir.
create or replace function public.enforce_stage_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() in ('administrador', 'jefe') then
    return new;
  end if;

  if public.current_user_role() = 'vendedor' then
    if new.etapa = 'corte' and not exists (
      select 1 from public.registros_kpi r
      where r.fecha = new.fecha
        and r.vendedor_id = new.vendedor_id
        and r.kpi_id = new.kpi_id
        and r.etapa = 'compromiso'
    ) then
      raise exception 'Primero debe registrar compromiso';
    end if;

    if new.etapa = 'cierre' and not exists (
      select 1 from public.registros_kpi r
      where r.fecha = new.fecha
        and r.vendedor_id = new.vendedor_id
        and r.kpi_id = new.kpi_id
        and r.etapa = 'corte'
    ) then
      raise exception 'Primero debe registrar corte';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_registros_stage_order
before insert on public.registros_kpi
for each row execute function public.enforce_stage_order();

alter table public.roles enable row level security;
alter table public.usuarios enable row level security;
alter table public.supervisores enable row level security;
alter table public.vendedores enable row level security;
alter table public.kpis enable row level security;
alter table public.kpi_grupos enable row level security;
alter table public.registros_kpi enable row level security;

-- Roles
create policy "roles_select_authenticated"
on public.roles
for select
to authenticated
using (true);

-- Usuarios
create policy "usuarios_select_scoped"
on public.usuarios
for select
to authenticated
using (
  id = auth.uid()
  or public.is_administrador()
  or (public.is_jefe() and jefe_id = auth.uid())
);

create policy "usuarios_admin_all"
on public.usuarios
for all
to authenticated
using (public.is_administrador())
with check (public.is_administrador());

-- Supervisores operativos
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

-- Vendedores
create policy "vendedores_select_scoped"
on public.vendedores
for select
to authenticated
using (
  public.is_administrador()
  or jefe_id = public.current_jefe_id()
  or usuario_id = auth.uid()
);

create policy "vendedores_insert_jefe_or_admin"
on public.vendedores
for insert
to authenticated
with check (
  public.is_administrador()
  or (public.is_jefe() and jefe_id = auth.uid())
);

create policy "vendedores_update_jefe_or_admin"
on public.vendedores
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

create policy "vendedores_delete_admin"
on public.vendedores
for delete
to authenticated
using (public.is_administrador());

-- KPI
create policy "kpis_select_scoped"
on public.kpis
for select
to authenticated
using (
  public.is_administrador()
  or jefe_id = public.current_jefe_id()
);

create policy "kpis_insert_jefe_or_admin"
on public.kpis
for insert
to authenticated
with check (
  public.is_administrador()
  or (public.is_jefe() and jefe_id = auth.uid())
);

create policy "kpis_update_jefe_or_admin"
on public.kpis
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

create policy "kpis_delete_admin"
on public.kpis
for delete
to authenticated
using (public.is_administrador());


-- Grupos KPI
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

-- Registros
create policy "registros_select_scoped"
on public.registros_kpi
for select
to authenticated
using (
  public.is_administrador()
  or exists (
    select 1 from public.vendedores v
    where v.id = vendedor_id
      and v.jefe_id = public.current_jefe_id()
  )
  or vendedor_id = public.current_vendedor_id()
);

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
      and exists (select 1 from public.vendedores v where v.id = vendedor_id and v.jefe_id = auth.uid())
      and exists (select 1 from public.kpis k where k.id = kpi_id and k.jefe_id = auth.uid())
    )
    or (
      public.current_user_role() = 'vendedor'
      and vendedor_id = public.current_vendedor_id()
      and exists (
        select 1 from public.kpis k
        where k.id = kpi_id
          and k.activo = true
          and k.jefe_id = public.current_jefe_id()
      )
    )
  )
);

create policy "registros_update_jefe_or_admin"
on public.registros_kpi
for update
to authenticated
using (
  public.is_administrador()
  or exists (
    select 1 from public.vendedores v
    where v.id = vendedor_id
      and v.jefe_id = auth.uid()
      and public.is_jefe()
  )
)
with check (
  cantidad >= 0
  and (
    public.is_administrador()
    or exists (
      select 1 from public.vendedores v
      where v.id = vendedor_id
        and v.jefe_id = auth.uid()
        and public.is_jefe()
    )
  )
);

create policy "registros_delete_jefe_or_admin"
on public.registros_kpi
for delete
to authenticated
using (
  public.is_administrador()
  or exists (
    select 1 from public.vendedores v
    where v.id = vendedor_id
      and v.jefe_id = auth.uid()
      and public.is_jefe()
  )
);

-- Funciones de configuración inicial. Ejecutarlas después de crear usuarios en Authentication.
create or replace function public.setup_admin(p_email text default 'admin01@kpibackus.pe', p_usuario text default 'admin01', p_nombre text default 'Administrador')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_id uuid;
  admin_role_id uuid;
begin
  select id into auth_id from auth.users where lower(email) = lower(p_email) limit 1;
  if auth_id is null then
    raise exception 'Primero crea el usuario % en Authentication > Users', p_email;
  end if;

  select id into admin_role_id from public.roles where codigo = 'administrador';

  insert into public.usuarios (id, usuario, email, nombre, rol_id, jefe_id, codigo_operativo, activo)
  values (auth_id, lower(p_usuario), lower(p_email), p_nombre, admin_role_id, null, null, true)
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

create or replace function public.setup_jefe_julio(p_email text default 'jtaboada@kpibackus.pe', p_usuario text default 'jtaboada')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  jefe_auth_id uuid;
  jefe_role_id uuid;
begin
  select id into jefe_auth_id from auth.users where lower(email) = lower(p_email) limit 1;
  if jefe_auth_id is null then
    raise exception 'Primero crea el usuario % en Authentication > Users', p_email;
  end if;

  select id into jefe_role_id from public.roles where codigo = 'jefe';

  insert into public.usuarios (id, usuario, email, nombre, rol_id, jefe_id, codigo_operativo, activo)
  values (jefe_auth_id, lower(p_usuario), lower(p_email), 'Julio Taboada', jefe_role_id, null, 'L7', true)
  on conflict (id) do update set
    usuario = excluded.usuario,
    email = excluded.email,
    nombre = 'Julio Taboada',
    rol_id = excluded.rol_id,
    jefe_id = null,
    codigo_operativo = 'L7',
    activo = true;

  insert into public.supervisores (usuario_id, codigo_operativo, nombre, activo)
  values (jefe_auth_id, 'L7', 'Julio Taboada', true)
  on conflict (usuario_id) do update set
    codigo_operativo = excluded.codigo_operativo,
    nombre = excluded.nombre,
    activo = excluded.activo;

  insert into public.kpi_grupos (jefe_id, nombre, orden, activo) values
  (jefe_auth_id, 'Volumen', 1, true),
  (jefe_auth_id, 'Cobertura', 2, true),
  (jefe_auth_id, 'Comercial', 3, true)
  on conflict (jefe_id, nombre) do update set
    orden = excluded.orden,
    activo = true;

  insert into public.kpis (jefe_id, nombre, activo, tipo, color, grupo, visible_tabla, orden) values
  (jefe_auth_id, 'EPA', true, 'normal', null, 'Volumen', true, 1),
  (jefe_auth_id, 'Vol Beer', true, 'normal', null, 'Volumen', true, 2),
  (jefe_auth_id, 'Vol Premium', true, 'normal', null, 'Volumen', true, 3),
  (jefe_auth_id, 'Vol SS', true, 'normal', null, 'Volumen', true, 4),
  (jefe_auth_id, 'Cob Pilsen Fresh', true, 'normal', null, 'Cobertura', true, 5),
  (jefe_auth_id, 'Cob Cristal latón', true, 'normal', null, 'Cobertura', true, 6),
  (jefe_auth_id, 'Cob Golden Laton', true, 'normal', null, 'Cobertura', true, 7),
  (jefe_auth_id, 'Cob Cusqueña Latón', true, 'normal', null, 'Cobertura', true, 8),
  (jefe_auth_id, 'Cob Flyn Fish', true, 'normal', null, 'Cobertura', true, 9),
  (jefe_auth_id, 'Cob Corona Latón', true, 'normal', null, 'Cobertura', true, 10),
  (jefe_auth_id, 'Cob Cusqueña 6xx', true, 'normal', null, 'Cobertura', true, 11),
  (jefe_auth_id, 'Tienda Perfecta', true, 'normal', null, 'Comercial', true, 12),
  (jefe_auth_id, 'C.V.', true, 'normal', null, 'Comercial', true, 13),
  (jefe_auth_id, 'Misión MKP', true, 'normal', null, 'Comercial', true, 14),
  (jefe_auth_id, 'Negociación de Precio', true, 'normal', null, 'Comercial', true, 15),
  (jefe_auth_id, 'Cob Nolo', true, 'normal', null, 'Cobertura', true, 16),
  (jefe_auth_id, 'Cob Mikes', true, 'normal', null, 'Cobertura', true, 17),
  (jefe_auth_id, 'Padrón Productivo', true, 'normal', null, 'Comercial', true, 18),
  (jefe_auth_id, 'Productividad EF', true, 'normal', null, 'Comercial', true, 19),
  (jefe_auth_id, 'Calidad e Pedido', true, 'normal', null, 'Comercial', true, 20),
  (jefe_auth_id, 'Cliente Independiente', true, 'normal', null, 'Comercial', true, 21)
  on conflict (jefe_id, nombre) do update set
    activo = excluded.activo,
    tipo = excluded.tipo,
    color = excluded.color,
    grupo = excluded.grupo,
    visible_tabla = excluded.visible_tabla,
    orden = excluded.orden;

  insert into public.vendedores (jefe_id, zona, nombre, activo) values
  (jefe_auth_id, 'PEMB12', 'Dery Cotrina', true),
  (jefe_auth_id, 'PEMB13', 'Kevyn Cerna', true),
  (jefe_auth_id, 'PEMB14', 'Luisinho Macedo', true),
  (jefe_auth_id, 'PEMB69', 'Karol Chapilliquen', true),
  (jefe_auth_id, 'PEMB70', 'Yaritza Canales', true),
  (jefe_auth_id, 'PEX553', 'Jayro Lizárraga', true),
  (jefe_auth_id, 'PEX575', 'Mathias Palacios', true),
  (jefe_auth_id, 'PEX020', 'Jhon Aquijes', true),
  (jefe_auth_id, 'PEM467', 'Adriel Ángulo', true),
  (jefe_auth_id, 'PEOE12', 'Eric Tardio', true)
  on conflict (jefe_id, zona, nombre) do update set activo = excluded.activo;
end;
$$;

create or replace function public.setup_vendedor_demo(
  p_email text,
  p_usuario text,
  p_nombre text,
  p_jefe_email text,
  p_zona text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  vendedor_auth_id uuid;
  jefe_auth_id uuid;
  vendedor_role_id uuid;
begin
  select id into vendedor_auth_id from auth.users where lower(email) = lower(p_email) limit 1;
  if vendedor_auth_id is null then
    raise exception 'Primero crea el usuario vendedor % en Authentication > Users', p_email;
  end if;

  select id into jefe_auth_id from auth.users where lower(email) = lower(p_jefe_email) limit 1;
  if jefe_auth_id is null then
    raise exception 'Primero crea el usuario jefe % en Authentication > Users', p_jefe_email;
  end if;

  select id into vendedor_role_id from public.roles where codigo = 'vendedor';

  insert into public.usuarios (id, usuario, email, nombre, rol_id, jefe_id, codigo_operativo, activo)
  values (vendedor_auth_id, lower(p_usuario), lower(p_email), p_nombre, vendedor_role_id, jefe_auth_id, null, true)
  on conflict (id) do update set
    usuario = excluded.usuario,
    email = excluded.email,
    nombre = excluded.nombre,
    rol_id = excluded.rol_id,
    jefe_id = excluded.jefe_id,
    codigo_operativo = null,
    activo = true;

  update public.vendedores
  set usuario_id = vendedor_auth_id
  where jefe_id = jefe_auth_id
    and zona = p_zona;
end;
$$;

-- Seguridad producción: estas funciones son de instalación manual. No deben estar disponibles para usuarios autenticados.
revoke execute on function public.setup_admin(text,text,text) from public, anon, authenticated;
revoke execute on function public.setup_jefe_julio(text,text) from public, anon, authenticated;
revoke execute on function public.setup_vendedor_demo(text,text,text,text,text) from public, anon, authenticated;

-- PASOS DESPUÉS DE EJECUTAR ESTE SCRIPT:
-- 1) En Authentication > Users crea:
--    admin01@kpibackus.pe / admin01
--    jtaboada@kpibackus.pe / jtaboada
--    dcotrina@kpibackus.pe / dcotrina  (opcional para probar vendedor)
-- 2) En SQL Editor ejecuta:
--    select public.setup_admin('admin01@kpibackus.pe', 'admin01', 'Administrador');
--    select public.setup_jefe_julio('jtaboada@kpibackus.pe', 'jtaboada');
--    select public.setup_vendedor_demo('dcotrina@kpibackus.pe', 'dcotrina', 'Dery Cotrina', 'jtaboada@kpibackus.pe', 'PEMB12');
-- 3) Login por usuario:
--    admin01 / admin01
--    jtaboada / jtaboada
--    dcotrina / dcotrina
