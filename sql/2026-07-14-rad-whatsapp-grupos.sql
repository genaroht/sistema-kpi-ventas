-- Ajustes de nomenclatura RAD y sincronización automática de nombres de grupos KPI.
-- Ejecutar una sola vez en Supabase SQL Editor para una base existente.

begin;

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
      and trim(grupo) = trim(old.nombre);
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

comment on function public.sync_kpi_group_name() is
  'Mantiene kpis.grupo sincronizado cuando un supervisor cambia el nombre de un grupo KPI.';

commit;
