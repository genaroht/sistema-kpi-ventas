-- Migración incremental para la versión con grupos KPI explícitos y rol visible Supervisor.
-- Ejecutar en Supabase SQL Editor una sola vez antes de desplegar esta versión.

begin;

alter table public.roles
  add column if not exists codigo_operativo text;

update public.roles
set nombre = 'Supervisor', codigo_operativo = null
where codigo = 'jefe';

alter table public.kpis
  add column if not exists grupo text;

update public.kpis
set grupo = case
  when lower(nombre) like 'vol %' or lower(nombre) in ('epa') or lower(nombre) like '%beer%' or lower(nombre) like '%premium%' or lower(nombre) like '% ss%' then 'Volumen'
  when lower(nombre) like 'cob %' or lower(nombre) like '%cobertura%' then 'Cobertura'
  when lower(nombre) like '%nolo%' or lower(nombre) like '%mikes%' then 'Cobertura'
  else 'Comercial'
end
where grupo is null;

alter table public.kpis
  alter column grupo set default 'Comercial';

alter table public.kpis
  alter column grupo set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'kpis_grupo_check'
      and conrelid = 'public.kpis'::regclass
  ) then
    alter table public.kpis
      add constraint kpis_grupo_check check (grupo in ('Volumen', 'Cobertura', 'Comercial'));
  end if;
end $$;

create index if not exists idx_kpis_jefe_grupo_orden
on public.kpis(jefe_id, grupo, orden);

commit;
