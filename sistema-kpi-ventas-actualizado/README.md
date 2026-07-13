# Sistema KPI Ventas

Aplicación web para registrar, supervisar y exportar KPI de ventas por roles:

- **Administrador**: gestión completa de usuarios, vendedores, KPI, reportes y exportación.
- **Gerente**: vista ejecutiva de solo lectura. Puede consultar dashboard, tabla, avance y reportes de todos los supervisores, sin permisos para crear, editar o eliminar información.
- **Supervisor**: seguimiento de vendedores y KPI bajo su alcance según RLS. El código interno en base de datos se mantiene como `jefe` para no romper RLS ni funciones existentes. Cada supervisor puede tener su propio código operativo, por ejemplo `L7`.
- **Vendedor**: registro diario de compromiso, corte y cierre.

Stack principal:

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Supabase Auth, Database y RLS
- Recharts
- ExcelJS
- PWA básica

## Mejoras incluidas en esta versión

### Login

- Placeholder seguro: ya no expone usuarios reales.
- Toggle para mostrar/ocultar contraseña.
- Validación visual de campos vacíos.
- Mensajes genéricos de error para no revelar si falló usuario o contraseña.
- Mensaje de ayuda para contraseña olvidada: comunicarse con el administrador del sistema.
- Opción “Recordar usuario”.
- Estado de carga en botón.

### Vista vendedor

- KPI agrupados por **Volumen**, **Cobertura**, **Comercial** y grupos personalizados creados por administrador o supervisor.
- Acordeones para reducir carga visual.
- Barra sticky de progreso: KPI completados de la etapa actual.
- Validación inline por KPI.
- Scroll automático al primer error.
- Los KPI pendientes se autocompletan con `0`, permitiendo modificar solo los que tengan una cantidad diferente.
- Botón fijo/sticky “Enviar etapa”.
- Prevención de doble envío y bloqueo mientras guarda.
- Registros ya enviados quedan bloqueados.

### Dashboard administrativo/supervisor

- Tarjetas semaforizadas y clicables.
- Badge de alerta para compromiso pendiente.
- Comparación contra el día anterior cuando hay datos.
- Avance por zona con barras horizontales.
- Semáforo del día por vendedor.
- Gráfico de vendedores con menor avance.
- Estados de carga, error y vacío.

### Tabla tipo Excel

- Solucionado bug de `defaultValue`: ahora los inputs son controlados y sincronizados con fecha/registros.
- Modo **Resumen** para ver solo % avance.
- Modo **Detalle editable** para que administrador y supervisor corrijan compromiso, corte y cierre.
- Botón **Guardar cambios** para confirmar las ediciones pendientes.
- Fila **Total** por KPI y etapa: compromiso, corte y cierre.
- Columnas Zona/Vendedor y header sticky.
- Búsqueda rápida por vendedor.
- Filtro por grupo KPI.
- Solo aparecen vendedores y KPI marcados como **Mostrar en Tabla Excel** desde las vistas Vendedores y KPI.
- Las celdas sin registro se inicializan visualmente con `0`; solo se guardan cuando el usuario modifica y confirma cambios.
- Exportación Excel desde tabla respetando filtros visibles e incluyendo totales.

### Reportes y exportación

- Filtros por grupo KPI, incluyendo grupos personalizados.
- Al cambiar fechas se muestra aviso para presionar **Consultar**.
- Excel respeta filtros aplicados y solo incluye KPI/vendedores visibles.
- Estados de loading, vacío y error.

### Seguridad

- Guards de servidor en `/admin/*` y `/vendedor`.
- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en API routes del servidor.
- Mensajes internos de configuración se reemplazaron por mensajes genéricos.
- Validación de permisos antes de crear usuarios o cambiar contraseñas.
- SQL actualizado para que funciones `setup_*` no queden ejecutables por cualquier usuario autenticado.
- `.gitignore` reforzado para evitar `.env`, `.env.local`, `.next`, `node_modules`, logs, cachés y ZIPs.

## Instalación

```bash
npm install
cp .env.example .env.local
```

Completa `.env.local` con tus valores reales:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key_o_anon_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_solo_servidor
```

> `SUPABASE_SERVICE_ROLE_KEY` nunca debe llevar `NEXT_PUBLIC_` y nunca debe usarse en componentes cliente.

## Ejecución local

```bash
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## Validaciones recomendadas

```bash
npm run typecheck
npm run build
```

En esta entrega se validó:

- `npm run typecheck`: correcto.
- `npm run build`: compiló correctamente y pasó TypeScript/lint; en el sandbox agotó tiempo durante `Collecting page data`. Repetir en entorno local limpio tras `npm install` para validar el empaquetado completo.

## Pruebas manuales obligatorias

1. Login con usuario correcto.
2. Login con usuario/contraseña incorrectos.
3. Cierre de sesión.
4. Acceso a `/admin/dashboard` sin sesión: debe redirigir a login.
5. Acceso de vendedor a `/admin/*`: debe redirigir a `/vendedor`.
6. Acceso de admin/supervisor a `/vendedor`: debe redirigir a panel admin.
7. Rol administrador: usuarios, vendedores, KPI, tabla, reportes y exportación.
8. Rol Supervisor: solo datos dentro de su alcance RLS. Validar que su código operativo se muestre junto al nombre si está configurado.
9. Rol Gerente: solo Dashboard, Tabla Excel, Avance y Reportes; debe poder filtrar por supervisor y no debe ver acciones de edición.
10. Rol vendedor: solo su propio registro del día.
11. Vista vendedor en celular: acordeones, progreso sticky y botón fijo.
12. Confirmar que los KPI pendientes aparezcan precargados en `0`.
13. Registrar cero real: debe aceptar `0`.
14. Intentar número negativo: debe bloquearlo.
15. Tabla Excel: cambiar fecha y confirmar que valores no quedan desactualizados.
16. Tabla Excel: alternar Resumen/Detalle para administrador y supervisor.
17. Tabla Excel como gerente: no debe mostrar Detalle editable ni Guardar cambios.
18. Reportes: cambiar fechas, seleccionar supervisor y presionar Consultar.
19. Confirmar que Cierre del día y Alcance % coincidan con los datos filtrados.
20. Exportación Excel con filtros aplicados.
21. Gráficos sin datos: deben mostrar estado vacío o no fallar.

## Actualización v4

- Se corrigió toda la referencia visual a **Backus**.
- El archivo de logo usado por la app ahora es `public/backus-logo-transparent.png`.
- Los KPI ahora tienen el mismo control de visibilidad que vendedores: **Mostrar en Tabla Excel, reportes y gráficos**.
- Administrador y supervisor pueden crear grupos KPI personalizados desde `/admin/kpis`.
- La Tabla Excel, Reportes, Exportar, Dashboard y Avance filtran KPI con `visible_tabla = true`.
- El layout admin usa ancho controlado para evitar que tablas o headers se crucen con la barra lateral en desktop.
- Se reforzó el comportamiento responsive para móvil/tablet usando scroll interno en tablas y contenedores `min-w-0`.

## Supabase / RLS

El archivo `sql/supabase.sql` contiene el esquema, funciones y políticas RLS.

Cambio importante de seguridad:

```sql
revoke execute on function public.setup_admin(text,text,text) from public, anon, authenticated;
revoke execute on function public.setup_jefe_julio(text,text) from public, anon, authenticated;
revoke execute on function public.setup_vendedor_demo(text,text,text,text,text) from public, anon, authenticated;
```

Estas funciones son útiles para instalación/demo, pero no deben quedar disponibles para usuarios autenticados en producción.

## Supabase: migraciones obligatorias

Ejecuta estos archivos en Supabase SQL Editor, en orden, antes de desplegar si tu base aún no los tiene:

```text
sql/2026-07-09-kpi-grupos-supervisor.sql
sql/2026-07-09-supervisor-codigo-y-vendedores-visibles.sql
sql/2026-07-09-kpi-visibles-y-grupos-dinamicos.sql
sql/2026-07-10-email-interno-kpibackus.sql  # opcional si tienes emails antiguos
```

Resumen del cambio:

```sql
alter table public.kpis add column if not exists grupo text;
alter table public.usuarios add column if not exists codigo_operativo text;
alter table public.vendedores add column if not exists visible_tabla boolean not null default true;
alter table public.kpis add column if not exists visible_tabla boolean not null default true;
create table if not exists public.kpi_grupos (...);
update public.roles set nombre = 'Supervisor', codigo_operativo = null where codigo = 'jefe';
update public.usuarios set codigo_operativo = 'L7' where lower(usuario) = '<usuario_supervisor>';  -- ajusta el usuario
```

El código interno del rol sigue siendo `jefe` para mantener compatibilidad con RLS y funciones. En la interfaz se muestra **Supervisor** y, si el usuario tiene código, se muestra como **Supervisor · código**.

## Archivos modificados

- `.gitignore`
- `AUDITORIA_CAMBIOS.md`
- `README.md`
- `app/admin/layout.tsx`
- `app/api/admin/users/route.ts`
- `app/api/admin/users/password/route.ts`
- `app/login/page.tsx`
- `app/vendedor/page.tsx`
- `components/auth/login-form.tsx`
- `components/admin/dashboard/admin-dashboard.tsx`
- `components/admin/reportes/reportes-client.tsx`
- `components/admin/tabla/tabla-excel.tsx`
- `components/vendedor/vendedor-dia.tsx`
- `components/vendedor/vendedor-loader.tsx`
- `components/ui/alert.tsx`
- `components/ui/progress.tsx`
- `components/ui/skeleton.tsx`
- `lib/kpi-groups.ts`
- `sql/supabase.sql`

- `components/admin/admin-shell.tsx`

- `components/admin/kpis/kpis-manager.tsx`

- `components/admin/page-title.tsx`

- `lib/display-labels.ts`

- `public/backus-logo-transparent.png`

- `sql/2026-07-09-kpi-grupos-supervisor.sql`
- `sql/2026-07-09-supervisor-codigo-y-vendedores-visibles.sql`
- `sql/2026-07-09-kpi-visibles-y-grupos-dinamicos.sql`
- `sql/2026-07-10-email-interno-kpibackus.sql`
- `types/database.ts`
- `lib/export/excel.ts`
- `components/admin/usuarios/usuarios-manager.tsx`
- `components/admin/vendedores/vendedores-manager.tsx`

## Advertencia sobre secretos

El ZIP original recibido incluía `.env.local`. El ZIP final no lo incluye. Si ese archivo contenía credenciales reales, rota las claves de Supabase y reemplaza las variables en tu entorno seguro.

## Actualización v5

- En el Dashboard, **Avance de cumplimiento por zona** ahora muestra zona + vendedor, y junto al porcentaje muestra los totales de Compromiso, Corte y Cierre.
- Los gráficos **Vendedores con menor avance**, **Avance por vendedor** y **KPI con mayor incumplimiento** muestran en el tooltip Compromiso, Corte, Cierre y Avance %.
- El gráfico **Compromiso vs cierre** usa colores distintos para diferenciar ambas series.
- En `/admin/kpis`, administrador y supervisor pueden **editar y ocultar grupos KPI**. Si se renombra un grupo, los KPI asociados se actualizan al nuevo nombre.
- En `/admin/usuarios`, al crear un usuario con rol vendedor se puede **buscar un vendedor existente**, autocompletar nombre/supervisor/usuario/email y editar esos campos antes de guardar.
- Al guardar un usuario vendedor, el sistema crea el usuario en Supabase Auth y vincula automáticamente el `usuario_id` en la tabla `vendedores`; ya no se ingresa manualmente el UUID del Auth ID.

Esta actualización no requiere nuevas columnas ni tablas si ya ejecutaste las migraciones v4. Solo reemplaza archivos, instala dependencias y despliega.

## Actualización v6

- En Dashboard se agregó filtro **Filtrar por KPI** para revisar avance, semáforo y gráficos por un KPI específico o por todos los KPI visibles.
- En `/admin/vendedores` se eliminó el campo manual **ID usuario Auth para vincular login vendedor**. El vínculo se hace automáticamente al crear el usuario desde `/admin/usuarios`.
- El email interno de nuevos usuarios se genera y valida con el dominio **@kpibackus.pe**.
- Se agregó la migración opcional `sql/2026-07-10-email-interno-kpibackus.sql` para normalizar el email visible en `public.usuarios` si tenías datos antiguos con otro dominio.

Si ya existen usuarios en Supabase Auth con otro dominio, cambia también el email de autenticación desde Supabase Authentication o recrea esos usuarios, porque la migración solo actualiza `public.usuarios.email`.

## Actualización v7 - Supervisores operativos

- Se agregó la vista `/admin/supervisores` solo para administrador.
- El administrador puede crear, editar, activar y desactivar supervisores desde una vista separada.
- Al crear un supervisor se registra en tres lugares de forma automática:
  - Supabase Auth, para permitir login.
  - `public.usuarios`, para permisos y rol interno `jefe`/Supervisor.
  - `public.supervisores`, para manejar código operativo, nombre y estado como tabla operativa independiente.
- El código operativo ya no depende del rol: queda registrado por cada supervisor en `public.supervisores` y se sincroniza con `public.usuarios.codigo_operativo` para compatibilidad visual.
- Al crear supervisor se generan por defecto los grupos KPI `Volumen`, `Cobertura` y `Comercial` para ese supervisor.
- Las vistas de Vendedores y KPI cargan la lista de supervisores desde `public.supervisores`.

### Migración obligatoria para v7

Ejecuta en Supabase SQL Editor:

```sql
-- Archivo incluido:
-- sql/2026-07-10-supervisores-operativos.sql
```

Esta migración crea `public.supervisores`, migra los supervisores existentes desde `public.usuarios`, activa RLS y agrega políticas para administrador.

### Después de aplicar v7

1. Entra como administrador.
2. Abre `/admin/supervisores`.
3. Crea un supervisor con usuario, email interno `@kpibackus.pe`, nombre, código operativo y contraseña inicial.
4. Luego asigna vendedores desde `/admin/vendedores`.
5. Luego crea grupos/KPI desde `/admin/kpis`.

## Actualización v8 - Seguimiento comercial y rol Gerente

- Se agregó el título **Seguimiento de Compromisos Comerciales** junto al logo de Backus en la pantalla de acceso y en el panel principal.
- La vista de Vendedores ahora presenta claramente las acciones **Agregar**, **Editar**, **Guardar** y **Guardar y agregar**.
- Los KPI del vendedor se precargan con valor `0` en cada nueva etapa.
- Reportes y gráficos muestran dos indicadores contiguos: **Cierre del día** y **Alcance %**.
- Se agregó filtro por supervisor en Dashboard, Avance, Tabla Excel y Reportes.
- Se corrigió la combinación de datos entre equipos: un vendedor solo se cruza con KPI pertenecientes a su mismo supervisor.
- Se agregó el rol interno `gerente`, con lectura global mediante RLS y sin políticas de escritura.
- La Tabla Excel exige seleccionar un supervisor para evitar matrices que mezclen KPI de equipos distintos.
- Se incorporaron los supervisores solicitados:
  - `RL` — Roberto Luna
  - `RF` — Anthony Huertas

### Migración obligatoria para v8

Ejecuta en Supabase SQL Editor:

```text
sql/2026-07-12-gerente-supervisores-y-reportes.sql
```

La migración agrega el rol Gerente, actualiza las políticas RLS de lectura y registra RL/RF automáticamente cuando ya existen estos usuarios en Supabase Authentication:

```text
rluna@kpibackus.pe
ahuertas@kpibackus.pe
```

Cuando todavía no existan, créalos primero en **Authentication > Users** y después ejecuta:

```sql
select public.setup_supervisor_operativo('rluna@kpibackus.pe', 'rluna', 'Roberto Luna', 'RL');
select public.setup_supervisor_operativo('ahuertas@kpibackus.pe', 'ahuertas', 'Anthony Huertas', 'RF');
```

Para provisionar un usuario gerente después de crearlo en Authentication:

```sql
select public.setup_gerente('gerente@kpibackus.pe', 'gerente', 'Gerente Comercial');
```
