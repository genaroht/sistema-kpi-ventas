-- Normaliza el dominio del email interno visible en public.usuarios.
-- Ejecuta después de respaldar si tienes datos reales.
-- Nota: esto no cambia contraseñas ni usuarios Auth ya creados; para Auth,
-- usa el panel Authentication de Supabase o recrea el usuario si necesitas
-- que el email de autenticación cambie también.

begin;

update public.usuarios
set email = split_part(lower(email), '@', 1) || '@kpibackus.pe'
where email is not null
  and lower(email) not like '%@kpibackus.pe';

commit;
