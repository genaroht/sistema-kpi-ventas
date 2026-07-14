-- Mejoras 2026-07-14
-- Habilitación diaria de compromiso, corte y cierre por supervisor.
-- Ejecutar una sola vez en Supabase SQL Editor con permisos de propietario.

begin;

create table if not exists public.habilitacion_etapas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  jefe_id uuid not null references public.usuarios(id) on delete cascade,
  compromiso_activo boolean not null default false,
  corte_activo boolean not null default false,
  cierre_activo boolean not null default false,
  updated_by uuid references public.usuarios(id) on delete set null,
  updated_at timestamp with time zone not null default now(),
  constraint habilitacion_etapas_fecha_jefe_unique unique (fecha, jefe_id)
);

create index if not exists idx_habilitacion_etapas_jefe_fecha
  on public.habilitacion_etapas(jefe_id, fecha desc);

alter table public.habilitacion_etapas enable row level security;
grant select, insert, update on public.habilitacion_etapas to authenticated;

drop policy if exists "habilitacion_etapas_select_scoped" on public.habilitacion_etapas;
create policy "habilitacion_etapas_select_scoped"
on public.habilitacion_etapas
for select
to authenticated
using (
  public.is_administrador()
  or public.is_gerente()
  or jefe_id = public.current_jefe_id()
  or (public.is_jefe() and jefe_id = auth.uid())
);

drop policy if exists "habilitacion_etapas_insert_editor" on public.habilitacion_etapas;
create policy "habilitacion_etapas_insert_editor"
on public.habilitacion_etapas
for insert
to authenticated
with check (
  public.is_administrador()
  or (public.is_jefe() and jefe_id = auth.uid())
);

drop policy if exists "habilitacion_etapas_update_editor" on public.habilitacion_etapas;
create policy "habilitacion_etapas_update_editor"
on public.habilitacion_etapas
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

create or replace function public.enforce_stage_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_jefe_id uuid;
  v_enabled boolean := false;
  v_expected_kpis integer := 0;
  v_previous_count integer := 0;
begin
  v_role := public.current_user_role();

  -- Administrador y supervisor pueden corregir desde el detalle editable,
  -- incluso cuando la captura del vendedor está bloqueada.
  if v_role in ('administrador', 'jefe') then
    return new;
  end if;

  if v_role <> 'vendedor' then
    raise exception 'El rol actual no puede registrar KPI';
  end if;

  select v.jefe_id
  into v_jefe_id
  from public.vendedores v
  where v.id = new.vendedor_id
    and v.usuario_id = auth.uid()
    and v.activo = true
  limit 1;

  if v_jefe_id is null then
    raise exception 'Vendedor no autorizado';
  end if;

  select case new.etapa
    when 'compromiso' then h.compromiso_activo
    when 'corte' then h.corte_activo
    when 'cierre' then h.cierre_activo
    else false
  end
  into v_enabled
  from public.habilitacion_etapas h
  where h.fecha = new.fecha
    and h.jefe_id = v_jefe_id
  limit 1;

  if coalesce(v_enabled, false) = false then
    raise exception 'La etapa % está deshabilitada por el supervisor', new.etapa;
  end if;

  select count(*)
  into v_expected_kpis
  from public.kpis k
  where k.jefe_id = v_jefe_id
    and k.activo = true
    and k.visible_tabla = true;

  if new.etapa = 'corte' then
    select count(distinct r.kpi_id)
    into v_previous_count
    from public.registros_kpi r
    join public.kpis k on k.id = r.kpi_id
    where r.fecha = new.fecha
      and r.vendedor_id = new.vendedor_id
      and r.etapa = 'compromiso'
      and k.jefe_id = v_jefe_id
      and k.activo = true
      and k.visible_tabla = true;

    if v_previous_count < v_expected_kpis then
      raise exception 'Primero debe completar compromiso';
    end if;
  end if;

  if new.etapa = 'cierre' then
    select count(distinct r.kpi_id)
    into v_previous_count
    from public.registros_kpi r
    join public.kpis k on k.id = r.kpi_id
    where r.fecha = new.fecha
      and r.vendedor_id = new.vendedor_id
      and r.etapa = 'corte'
      and k.jefe_id = v_jefe_id
      and k.activo = true
      and k.visible_tabla = true;

    if v_previous_count < v_expected_kpis then
      raise exception 'Primero debe completar corte';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_registros_stage_order on public.registros_kpi;
create trigger trg_registros_stage_order
before insert on public.registros_kpi
for each row execute function public.enforce_stage_order();

comment on table public.habilitacion_etapas is
  'Control diario por supervisor para habilitar o bloquear compromiso, corte y cierre del vendedor.';

commit;

-- Verificación opcional:
-- select fecha, jefe_id, compromiso_activo, corte_activo, cierre_activo
-- from public.habilitacion_etapas
-- order by fecha desc, jefe_id;
