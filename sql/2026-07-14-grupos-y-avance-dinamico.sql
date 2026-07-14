-- Corrección de grupos KPI renombrados y preparación para avance dinámico.
-- Ejecutar una sola vez en Supabase SQL Editor para una base existente.

begin;

-- El nombre del grupo se replica en los KPI usando comparación sin distinguir
-- mayúsculas, minúsculas ni espacios alrededor.
create or replace function public.sync_kpi_group_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nombre is distinct from old.nombre then
    update public.kpis
    set grupo = new.nombre
    where jefe_id = old.jefe_id
      and lower(trim(grupo)) = lower(trim(old.nombre));
  end if;

  return new;
end;
$$;

revoke execute on function public.sync_kpi_group_name() from public, anon, authenticated;

drop trigger if exists trg_sync_kpi_group_name on public.kpi_grupos;
create trigger trg_sync_kpi_group_name
after update of nombre on public.kpi_grupos
for each row
when (old.nombre is distinct from new.nombre)
execute function public.sync_kpi_group_name();

-- Uniformiza escritura y mayúsculas cuando ya existe el grupo maestro.
update public.kpis as k
set grupo = g.nombre
from public.kpi_grupos as g
where g.jefe_id = k.jefe_id
  and lower(trim(g.nombre)) = lower(trim(k.grupo))
  and k.grupo is distinct from g.nombre;

-- Corrige el caso de una instalación donde Comercial fue renombrado a
-- Excelencia Comercial, pero algunos KPI conservaron el texto anterior.
-- Solo se aplica cuando ya no existe un grupo maestro llamado Comercial.
update public.kpis as k
set grupo = g.nombre
from public.kpi_grupos as g
where g.jefe_id = k.jefe_id
  and lower(trim(g.nombre)) = 'excelencia comercial'
  and lower(trim(k.grupo)) = 'comercial'
  and not exists (
    select 1
    from public.kpi_grupos as old_group
    where old_group.jefe_id = k.jefe_id
      and lower(trim(old_group.nombre)) = 'comercial'
  );

comment on function public.sync_kpi_group_name() is
  'Mantiene kpis.grupo sincronizado al renombrar un grupo KPI, ignorando diferencias de mayúsculas y espacios.';

commit;
