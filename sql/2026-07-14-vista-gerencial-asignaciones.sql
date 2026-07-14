-- Vista gerencial independiente y alcance por supervisores asignados.
-- La relación Gerente -> Supervisor utiliza public.usuarios.jefe_id:
--   usuario con rol jefe.jefe_id = usuario con rol gerente.id
-- Ejecutar en Supabase SQL Editor con permisos de propietario.

begin;

create or replace function public.is_supervisor_assigned_to_current_manager(p_supervisor_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.current_user_role() = 'gerente'
    and exists (
      select 1
      from public.usuarios supervisor_user
      join public.roles supervisor_role on supervisor_role.id = supervisor_user.rol_id
      where supervisor_user.id = p_supervisor_id
        and supervisor_user.jefe_id = auth.uid()
        and supervisor_user.activo = true
        and supervisor_role.codigo = 'jefe'
    ),
    false
  );
$$;

grant execute on function public.is_supervisor_assigned_to_current_manager(uuid) to authenticated;

-- Si actualmente hay un único gerente activo, asigna automáticamente los
-- supervisores existentes que todavía no tengan gerente. Con varios gerentes,
-- la asignación se realiza desde Administrador > Usuarios.
do $$
declare
  v_manager_id uuid;
  v_manager_count integer;
begin
  select count(*), min(u.id)
  into v_manager_count, v_manager_id
  from public.usuarios u
  join public.roles r on r.id = u.rol_id
  where r.codigo = 'gerente'
    and u.activo = true;

  if v_manager_count = 1 then
    update public.usuarios supervisor_user
    set jefe_id = v_manager_id
    from public.roles supervisor_role
    where supervisor_role.id = supervisor_user.rol_id
      and supervisor_role.codigo = 'jefe'
      and supervisor_user.activo = true
      and supervisor_user.jefe_id is null;
  end if;
end;
$$;

-- Usuarios: el gerente ve su perfil y los supervisores que tiene asignados.
drop policy if exists "usuarios_select_scoped" on public.usuarios;
create policy "usuarios_select_scoped"
on public.usuarios
for select
to authenticated
using (
  id = auth.uid()
  or public.is_administrador()
  or (public.is_jefe() and jefe_id = auth.uid())
  or (
    public.is_gerente()
    and jefe_id = auth.uid()
  )
);

-- Supervisores: el gerente únicamente consulta sus supervisores.
drop policy if exists "supervisores_select_scoped" on public.supervisores;
create policy "supervisores_select_scoped"
on public.supervisores
for select
to authenticated
using (
  public.is_administrador()
  or usuario_id = auth.uid()
  or public.current_jefe_id() = usuario_id
  or public.is_supervisor_assigned_to_current_manager(usuario_id)
);

-- Vendedores de los supervisores asignados.
drop policy if exists "vendedores_select_scoped" on public.vendedores;
create policy "vendedores_select_scoped"
on public.vendedores
for select
to authenticated
using (
  public.is_administrador()
  or jefe_id = public.current_jefe_id()
  or usuario_id = auth.uid()
  or public.is_supervisor_assigned_to_current_manager(jefe_id)
);

-- KPI de los supervisores asignados. Se conserva la restricción de visibilidad
-- para vendedores.
drop policy if exists "kpis_select_scoped" on public.kpis;
create policy "kpis_select_scoped"
on public.kpis
for select
to authenticated
using (
  public.is_administrador()
  or (public.is_jefe() and jefe_id = auth.uid())
  or public.is_supervisor_assigned_to_current_manager(jefe_id)
  or (
    public.current_user_role() = 'vendedor'
    and jefe_id = public.current_jefe_id()
    and activo = true
    and visible_tabla = true
  )
);

-- Grupos KPI de los supervisores asignados.
drop policy if exists "kpi_grupos_select_scoped" on public.kpi_grupos;
create policy "kpi_grupos_select_scoped"
on public.kpi_grupos
for select
to authenticated
using (
  public.is_administrador()
  or (public.is_jefe() and jefe_id = auth.uid())
  or jefe_id = public.current_jefe_id()
  or public.is_supervisor_assigned_to_current_manager(jefe_id)
);

-- Estado de habilitación por supervisor.
drop policy if exists "habilitacion_etapas_select_scoped" on public.habilitacion_etapas;
create policy "habilitacion_etapas_select_scoped"
on public.habilitacion_etapas
for select
to authenticated
using (
  public.is_administrador()
  or (public.is_jefe() and jefe_id = auth.uid())
  or jefe_id = public.current_jefe_id()
  or public.is_supervisor_assigned_to_current_manager(jefe_id)
);

-- Registros únicamente de vendedores pertenecientes a supervisores asignados.
drop policy if exists "registros_select_scoped" on public.registros_kpi;
create policy "registros_select_scoped"
on public.registros_kpi
for select
to authenticated
using (
  public.is_administrador()
  or exists (
    select 1
    from public.vendedores v
    where v.id = vendedor_id
      and (
        v.jefe_id = public.current_jefe_id()
        or public.is_supervisor_assigned_to_current_manager(v.jefe_id)
      )
  )
  or vendedor_id = public.current_vendedor_id()
);

comment on function public.is_supervisor_assigned_to_current_manager(uuid) is
  'Valida que el supervisor indicado pertenezca al gerente autenticado.';
comment on column public.usuarios.jefe_id is
  'Jerarquía: vendedor -> supervisor y supervisor -> gerente, según el rol del usuario.';

commit;

-- Verificación:
-- select supervisor.id, supervisor.nombre, manager.nombre as gerente
-- from public.usuarios supervisor
-- join public.roles role_supervisor on role_supervisor.id = supervisor.rol_id and role_supervisor.codigo = 'jefe'
-- left join public.usuarios manager on manager.id = supervisor.jefe_id;
