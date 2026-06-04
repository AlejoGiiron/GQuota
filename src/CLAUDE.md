# src — guía de implementación

## Componentes
- Lee src/design-system.md antes de crear cualquier pantalla o componente.
- Componentes pequeños y reutilizables en src/components; pantallas en src/pages.
- Estados obligatorios en toda vista con datos: cargando (skeleton), vacío (con acción), error (mensaje claro).
- Toast de éxito/error después de cada mutación.

## Datos
- Acceso a Supabase vía src/lib/supabase.ts.
- Tipos desde src/types/database.types.ts (generados desde el esquema).
- Regenerar src/types/database.types.ts tras cada migración (supabase gen types).
- Mutaciones que tocan varias tablas (ej. registrar pago) van en una transacción o función de Supabase.

## Dinero y cálculos
- Todo cálculo de interés/pago usa src/lib/motor-prestamos.ts. No reimplementar fórmulas.
- Formatear montos con fmtCOP() y fechas con fmtFecha(), ambos de src/lib/formatters.ts. No usar Intl directo.

## Pruebas y feedback
- Pruebas con vitest; se corren con `npm test`.
- Feedback de mutaciones con sonner: toast.success() en éxito, toast.error() en error.

## Idioma
- Interfaz y mensajes en español.