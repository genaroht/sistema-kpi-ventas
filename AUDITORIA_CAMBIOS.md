# Auditoría y cambios — Sistema KPI Ventas

## A. Resumen ejecutivo

Se revisó el proyecto Next.js App Router con Supabase, Tailwind CSS, Recharts, roles administrador/supervisor/vendedor y vistas de dashboard, tabla, reportes, exportación y panel vendedor. La versión entregada mejora seguridad, experiencia móvil, claridad visual, agrupación de KPI, validaciones, estados de carga/error y manejo de datos editables.

El foco principal fue reducir confusión en el registro de 21 KPI, corregir entradas desactualizadas en la tabla tipo Excel, reforzar protección por rol, evitar exposición de usuarios reales en login y entregar una base más estable para producción.

## B. Problemas críticos encontrados

1. El ZIP original incluía `.env.local`, `.next`, `node_modules` y `tsconfig.tsbuildinfo`. Estos archivos no deben incluirse en entregables ni repositorios.
2. El placeholder del login exponía usuarios reales de prueba/operación.
3. Las rutas `/admin/*` y `/vendedor` dependían principalmente de validación del cliente. Se agregó guard de servidor en layout/página.
4. `components/admin/tabla/tabla-excel.tsx` usaba `defaultValue`; al cambiar fecha/filtros podía mostrar valores antiguos.
5. La tabla mostraba `0` para registros inexistentes, confundiendo vacío con cero real.
6. APIs administrativas devolvían mensajes internos sobre `.env.local` y errores técnicos de Supabase.
7. El SQL de instalación concedía ejecución de funciones `setup_*` a usuarios autenticados, peligroso en producción.

## C. Bugs reales o probables

- Inputs de tabla desincronizados por `defaultValue`.
- Posible doble envío en vendedor al hacer clic repetido.
- Validación incompleta de campos vacíos/negativos en varias acciones.
- Falta de feedback visible cuando Supabase falla.
- Reportes permitían cambiar fechas sin dejar claro que había que consultar.
- Gráficos/tablas podían quedar vacíos sin explicación.
- Exportación podía no ser obvia respecto a filtros aplicados.
- Posible uso de funciones SQL de setup por cualquier usuario autenticado.

## D. Mejoras de diseño recomendadas e implementadas

- Login con layout moderno, fondo visual, jerarquía clara y campos con iconos.
- Dashboard con tarjetas semaforizadas, badges, barras de avance y gráfico gerencial.
- Vista vendedor con header sticky, barra de progreso, acordeones por grupo KPI y botón fijo de envío.
- Tabla tipo Excel con modo Resumen/Detalle para reducir saturación visual.
- Badges y alertas reutilizables para éxito, advertencia y error.
- Skeleton loaders para cargas iniciales.

## E. Mejoras de UX/interactividad

- Toggle para mostrar/ocultar contraseña.
- Mensaje “comunícate con el administrador del sistema” ante olvido de contraseña.
- Validación inline en login y vendedor.
- Scroll automático al primer KPI con error.
- Bloqueo visual durante guardado.
- Inputs controlados en tabla Excel.
- Búsqueda rápida por vendedor.
- Filtros por grupo KPI.
- Exportación de tabla respetando filtros visibles.
- Advertencia cuando cambia el rango de fechas en reportes y falta presionar “Consultar”.

## F. Mejoras de seguridad

- Guards de servidor en `app/admin/layout.tsx` y `app/vendedor/page.tsx`.
- Service role key sigue usándose solo en API routes de servidor.
- Mensajes internos de service role fueron reemplazados por mensajes genéricos.
- Validación de usuario objetivo antes de cambiar contraseña.
- Limpieza compensatoria si se crea Auth user pero falla la creación del perfil.
- `.gitignore` ampliado para evitar secretos, build output, cachés y ZIPs.
- SQL actualizado para revocar ejecución pública/autenticada de funciones `setup_*`.

## G. Mejoras de rendimiento

- `useMemo`/`useCallback` en cargas y transformaciones pesadas.
- Tabla con modo resumen para evitar renderizar 21 KPI x 4 columnas por defecto.
- Skeletons en lugar de renders vacíos.
- Agrupación de KPI para reducir carga cognitiva y render visible.
- Evita recargas innecesarias de reportes al cambiar fechas hasta presionar consultar.

## H. Archivos modificados

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

## I. Plan de implementación por prioridad

### Alta

- Eliminar secretos/builds del ZIP final.
- Proteger rutas por servidor.
- Corregir tabla Excel con inputs controlados.
- Agrupar KPI del vendedor por categorías.
- Validar campos y prevenir doble envío.
- Ocultar usuarios reales en login.
- Revocar funciones SQL de setup para usuarios autenticados.

### Media

- Dashboard con semáforo, barras y gráfico.
- Reportes con estado “cambios sin consultar”.
- Exportación filtrada desde tabla.
- Skeleton loaders, alertas y mensajes vacíos.
- Mejor navegación visual y mobile-first.

### Baja

- Evolucionar el modelo de KPI para agregar columna `grupo` en base de datos.
- Añadir tests automatizados E2E.
- Virtualizar tablas si crecen a cientos/miles de vendedores.
- Añadir auditoría histórica de cambios por usuario.

## Validación ejecutada

- `npm run typecheck`: correcto.
- `npm run build`: la compilación avanzó correctamente y pasó TypeScript/lint de build, pero en el sandbox quedó detenido/agotó tiempo en `Collecting build traces`. Antes de eso Next mostró una advertencia conocida de Supabase en middleware Edge. Validar nuevamente en un entorno local limpio después de `npm install`.

## Advertencias importantes

- El ZIP original contenía `.env.local`. No se incluye en el ZIP final. Las credenciales expuestas en un ZIP deben rotarse/reemplazarse en Supabase.
- Si el proyecto está en producción, ejecuta el SQL actualizado o al menos revoca permisos de las funciones `setup_*`.
- No se agregó una columna `grupo` a la base de datos para no romper el esquema actual. La agrupación de KPI se hace por helper frontend basado en nombres/tipo. Para una solución definitiva se recomienda una migración explícita de DB.

## J. Actualización v8 — 12 de julio de 2026

- Nuevo rol `gerente` con acceso global de lectura y bloqueo de escritura en frontend, guards de servidor y políticas RLS.
- Filtro por supervisor en Dashboard, Tabla Excel, Avance y Reportes.
- Corrección de integridad visual para no cruzar vendedores con KPI de otro supervisor.
- Título principal “Seguimiento de Compromisos Comerciales” en branding Backus.
- Acciones explícitas Agregar, Editar, Guardar y Guardar y agregar en Vendedores.
- Autocompletado de KPI con cero en panel vendedor y tabla editable.
- Indicadores Cierre del día y Alcance % en Reportes y Avance.
- Migración `sql/2026-07-12-gerente-supervisores-y-reportes.sql` para rol, RLS y supervisores RL/RF.

## K. Actualización v9 — 13 de julio de 2026

- Se corrigió la tabla de Vendedores para mantener visible la columna Acciones mediante posición sticky. Los botones Editar y Ocultar/Mostrar ya no quedan fuera del viewport.
- Se añadió la tabla independiente `public.gerentes` con índice, RLS, backfill y sincronización desde la creación/edición administrativa de usuarios.
- La API `/api/admin/users` crea el registro operativo en `public.gerentes` cuando el rol seleccionado es `gerente`.
- La vista vendedor filtra explícitamente por supervisor, estado activo y visibilidad del KPI.
- RLS de `kpis` y `registros_kpi` evita que un vendedor lea o registre KPI ocultos aunque intente omitir el frontend.
- Nueva migración: `sql/2026-07-13-gerentes-visibilidad-kpi-vendedores.sql`.

## 2026-07-13 — Administración y edición de usuarios

- La lista de usuarios se carga desde una API administrativa del servidor para evitar que errores de RLS o relaciones de PostgREST dejen la tabla vacía.
- Se agregó edición completa para administradores: usuario, email interno, nombre, rol, supervisor, código operativo y estado.
- Los cambios de usuario, email y nombre se sincronizan con Supabase Authentication.
- Se sincronizan automáticamente las tablas operativas `supervisores`, `gerentes` y `vendedores` según el rol.
- La columna Acciones queda fija y visible aun cuando la tabla tenga desplazamiento horizontal.
- Se añadieron estados de carga, contador, botón Actualizar y mensajes explícitos cuando el servidor no tiene `SUPABASE_SERVICE_ROLE_KEY`.
- Se evita que un administrador se desactive o se quite su propio rol.
- Se evita cambiar de rol a un supervisor que todavía tenga vendedores o KPI asociados.

## 2026-07-13 — Gestión de claves desde Usuarios

- La columna Acciones usa una cuadrícula compacta y fija para mantener visibles Editar, Activar/Desactivar, Cambiar clave y Restablecer clave.
- Cambiar clave abre un modal con nueva contraseña, confirmación y control mostrar/ocultar.
- Restablecer clave usa exactamente el nombre de usuario como nueva contraseña y lo muestra con botón Copiar.
- Cambiar clave abre mediante un portal global, muestra errores dentro del modal y recupera correctamente el estado ante fallos de red o API.
- La API administrativa de contraseñas distingue las acciones `change` y `reset`, valida un mínimo de 8 caracteres y mantiene el uso de `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en servidor.
- No se requiere migración SQL para esta actualización.

## 2026-07-13 — Corrección de visibilidad de acciones en Usuarios

- Se identificó que los botones sí existían, pero la tarjeta de la tabla crecía por su ancho mínimo y el `overflow-x-hidden` del layout los dejaba fuera del viewport.
- La cuadrícula principal y la tarjeta de usuarios ahora usan `min-w-0`, de modo que la tabla queda contenida dentro del ancho disponible.
- Las columnas `Usuario` y `Acciones` se movieron al inicio y permanecen fijas a la izquierda durante el desplazamiento horizontal.
- Los botones Editar, Activar/Desactivar, Cambiar clave y Restablecer quedan visibles sin tener que llegar al extremo derecho de la tabla.
- Se añadieron títulos accesibles a las acciones para identificar el usuario afectado.
- `npm run typecheck`: correcto.
- `npm run build`: compilación y TypeScript correctos; el entorno de validación se interrumpió posteriormente en la generación de páginas con `EPIPE`.

## 2026-07-14 — Reportes PNG, control de etapas y simplificación de paneles

- La antigua opción Tabla Excel se convirtió en el módulo Reportes; las rutas `/admin/tabla` y `/admin/exportar` redirigen al nuevo módulo.
- Para supervisor, Reportes conserva únicamente el filtro de fecha y toma todos sus vendedores/KPI visibles.
- Se implementaron tres exportaciones PNG en Canvas, sin dependencia adicional: Compromiso; Compromiso + Corte 1:45; Compromiso + Cierre + Avance %.
- El detalle permite corregir Compromiso, Corte y Cierre y descargar el Excel completo; gerente permanece en modo de solo lectura.
- Dashboard conserva filtros Fecha/KPI, tarjetas, Avance por zona y Semáforo; se eliminó Vendedores con menor avance.
- Avance conserva filtros Fecha/KPI e incluye los cinco bloques solicitados: Avance por vendedor, Ranking, Compromiso vs cierre, Mapa de calor y Tendencia por días.
- Se añadió `public.habilitacion_etapas` para controlar por fecha y supervisor si Compromiso, Corte y Cierre están habilitados.
- El panel vendedor muestra las tarjetas Enviado/Habilitado/Bloqueado, exige el orden Compromiso → Corte → Cierre y precarga los campos con cero.
- El trigger `enforce_stage_order` valida en base de datos la habilitación, propiedad del vendedor y etapa previa completa; administrador/supervisor mantienen la capacidad de corrección desde el detalle.
- Migración incremental: `sql/2026-07-14-habilitacion-etapas-y-reportes-png.sql`.
- `npm run typecheck`: correcto.
- `npm run build`: correcto, incluida la generación de rutas. Persiste únicamente la advertencia no bloqueante de Supabase en middleware Edge.
