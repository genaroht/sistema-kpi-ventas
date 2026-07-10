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
