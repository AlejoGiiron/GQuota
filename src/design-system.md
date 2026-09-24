# G-Quota — Sistema de diseño 2a Contable (design-system.md)

> **Este archivo manda.** Antes de crear o modificar un componente o una pantalla, léelo. No inventes colores, tipografías ni estilos: usa los tokens y componentes de aquí.
> Referencia visual y de origen: `design/paquete-2a/` (abrir los `.html` en el navegador; la fuente con tokens y reglas está en `fuente/G-Quota Sistema.dc.html` y `fuente/gq-comun.js`).

G-Quota es una app de dinero para prestamistas, muchas veces personas no técnicas y desde el celular. La dirección **2a Contable** es sobria y plana: superficies blancas con borde, sin sombras, cifras grandes y tabulares. Es **marca blanca**: cada negocio pone sus dos colores y la app se ve con su marca.

## Las tres reglas

1. **La marca va en el marco.** Logo/monograma, ítem activo del menú, botón principal, franja del comprobante y enlaces. **Nunca** en estados, barras de datos ni cifras.
2. **El contraste lo calcula la app.** Texto sobre la marca: blanco o tinta, el de mayor contraste. Si la marca se usa como texto sobre blanco y no llega a 4,5:1, se oscurece hacia la tinta hasta llegar. Nunca se escribe un color derivado a mano.
3. **Estado = ícono + palabra.** Los colores de estado son fijos para todos los negocios y cada estado tiene su forma de ícono y su palabra: se distinguen aunque la marca sea verde o roja, y también sin color.

## Tokens

Todos viven como variables CSS en `:root` (src/index.css) — **única fuente de verdad**. Tailwind (`tailwind.config.js`) apunta a esas variables; no copia valores.

### Marca (configurable por negocio)

| Token | Tailwind | Qué es |
|---|---|---|
| `--marca` | `bg-marca` | Color principal que elige el negocio |
| `--marca-sobre` | `text-marca-sobre` | Texto e íconos sobre la marca (blanco o tinta) |
| `--marca-texto` | `text-marca-texto` | La marca como texto sobre blanco (≥ 4,5:1) — enlaces, foco |
| `--marca-suave` | `bg-marca-suave` | Marca al 12 % sobre blanco — fondo del ítem activo |
| `--acento` | `bg-acento` | Segundo color del negocio. Uso mínimo (marcas de «hoy») |
| `--acento-sobre` / `--acento-texto` | `text-acento-sobre` / `text-acento-texto` | Igual que los de la marca |

Los derivados se calculan con **`tokensDeMarca(principal, acento)`** de `src/lib/marca.ts` (lógica pura, con pruebas contra las tres marcas del paquete). **Por ahora la marca es fija** (verde `#047857` y ámbar `#D97706` de G-Quota) y sus valores están en index.css; una prueba verifica que coincidan con la función. Con «Mi marca» la app escribirá estas variables en `document.documentElement` al cargar el negocio.

### Sistema (fijos)

| Token | Tailwind | Uso |
|---|---|---|
| `--fondo` `#F5F6F8` | `bg-fondo` | Fondo de la app |
| `--superficie` `#FFFFFF` | `bg-superficie` | Tarjetas, tablas, modales |
| `--superficie-2` `#F8F9FA` | `bg-superficie-2` | Encabezado y totales de tabla, hover |
| `--borde` `#E2E5EA` | `border-borde` | Bordes de tarjetas |
| `--borde-fila` `#EDEFF2` | `border-borde-fila` | Separador de filas |
| `--borde-control` `#CDD2D9` | `border-borde-control` | Campos y botones secundarios |
| `--tinta` `#14181F` | `text-tinta` | Texto principal y cifras |
| `--tinta-2` `#3B4452` | `text-tinta-2` / `bg-tinta-2` | Texto de apoyo y **barras de datos** |
| `--tinta-3` `#5B6472` | `text-tinta-3` | Etiquetas y texto secundario (6,1:1) |
| `--tinta-sobre-marca` `#17150F` | `text-tinta-sobre-marca` | Tinta sobre marcas claras |

### Estados (fijos: color + fondo + ícono + palabra)

| Estado | Tokens | Palabra | Cuándo |
|---|---|---|---|
| Pagado | `--estado-pagado` / `-fondo` | Pagado (Pagada, Cobrado) | Cuota o cobro completo |
| Al día | `--estado-al-dia` / `-fondo` | Al día | Préstamo sin cuotas vencidas |
| Por vencer | `--estado-por-vencer` / `-fondo` | Por vencer (Vence hoy) | Cuota que vence hoy sin pagar |
| En mora | `--estado-mora` / `-fondo` | En mora (Vencida) | Pasó la fecha; mora = más de 5 días de gracia |
| Parcial | `--estado-parcial` / `-fondo` | Parcial | Solo cuota fija: abono incompleto |
| Pendiente | `--estado-pendiente` / `-fondo` | Pendiente (Inactivo, Sin asignar) | Cuota futura; neutros |

En Tailwind: `text-estado-mora`, `bg-estado-mora-fondo`, etc.

### Forma y tipografía

- **Fuente:** IBM Plex Sans (400/500/600/700), servida desde el proyecto con `@fontsource/ibm-plex-sans` (sin CDN). **Todas las cifras con números tabulares** (`.cifra`, o `.mono` en código viejo) y los montos alineados a la derecha. Ya no hay fuente monoespaciada.
- **Escala:** comprobante 36/600 · cifra de resumen 26/600 · nombre en ficha 22/600 · título de pantalla 20/600 · título de sección 16/600 · cuerpo y celdas 14,5/400 · secundario 13/400 · encabezado de tabla 12,5/600.
- **Radios:** 6 px controles (`rounded-control`) · 8 px tarjetas, tablas y modales (`rounded-tarjeta`) · 12 px insignias de estado (`rounded-estado`).
- **Alturas:** controles 44 px en el celular y 40 px en escritorio; acción principal del celular 54 px (`btn-grande`). Filas de tabla 44 a 56 px.
- **Área de toque mínima (obligatoria):** en el celular, **todo** botón y campo mide al menos 44 px de alto (en escritorio, 40), también los enlaces-botón de texto y los de solo ícono. No achiques los primitivos con `!h-9` ni similares. Para un botón de texto que no debe engordar la fila: `min-h-11 -my-3 inline-flex items-center` (el margen negativo conserva el espacio). La excepción es el control segmentado en escritorio (36 px, como en el diseño).
- **Espaciado** base de 4 px (8, 12, 16, 20, 24, 32).
- **Sombras:** solo lo que flota (modal, menús): `shadow-flotante`. Las tarjetas van con borde, sin sombra.

## Componentes base

Clases en `@layer components` (src/index.css) y componentes React en `src/components/ui/` que las usan. Reutilízalos; no redefinas un botón o un campo por pantalla.

| Componente | React | Clases |
|---|---|---|
| Botón | `<Boton variante="principal · secundario · destructivo · enlace" grande>` | `.btn-primary` `.btn-secondary` `.btn-destructive` (contorno rojo) `.btn-enlace` `.btn-grande` |
| Campo | `<Campo etiqueta ayuda error>{(p) => <input className="input" {...p} />}</Campo>` — enlaza etiqueta, ayuda y error (aria) | `.campo` `.input` (foco: borde 2 px `--marca-texto`; error: `aria-invalid`) |
| Monto | `<EntradaMonto>` (52 px, cifra 24/600, `$` delante) | `.input-monto` |
| Selector | `<Selector>` (select nativo con la flecha del sistema) | `.select` |
| Control segmentado | `<ControlSegmentado opciones valor alCambiar etiquetaAccesible>` — la opción elegida va en tinta sólida | `.segmentado` |
| Etiqueta de estado | `<EtiquetaEstado estado="mora">En mora · 6 días</EtiquetaEstado>` — **siempre** ícono + palabra; `<IconoEstado>` para cuadrículas | `.estado--*` |
| Tarjeta | `<Tarjeta titulo acciones sinRelleno>` | `.tarjeta` (`.card` en código viejo) |
| Tabla | `<Tabla columnas filas claveFila etiqueta>` — `numerica` alinea a la derecha; `total` en una columna agrega la fila de totales | `.tabla` `.num` |
| Modal | `src/components/Modal.tsx` — velo de tinta, título 18/600, cuerpo con scroll, pie fijo con botones a la derecha | — |

**Tailwind y clases dinámicas:** Tailwind purga de `@layer components` las clases que no encuentra escritas literalmente. Nunca armes `estado--${x}`: usa un mapa con los nombres completos (como `EtiquetaEstado`).

## Layout

- **Escritorio (≥ 768 px):** menú lateral blanco de 232 px — monograma de la marca, nombre del negocio y rol; ítems de 40 px con ícono; el activo lleva `--marca-suave` y una barra de 3 px de la marca a la izquierda. Abajo, la cuenta (correo, rol, cerrar sesión) y «con G-Quota». Sin barra superior: cada página pone su título.
- **Móvil:** encabezado de 52 px (monograma, nombre del negocio, cuenta) y **barra inferior** con lo operativo; el activo lleva una raya de 3 px de la marca arriba. Equipo y Configuración van en el menú de la cuenta.
- **Permisos:** el dueño ve Inicio, Cobros, Clientes, Préstamos, Equipo y Configuración; el cobrador, Cobros, Clientes y Préstamos. Solicitudes, Plantillas y Mi marca llegan con sus fases.
- **Lista + detalle:** 60/40 en escritorio; apilado en móvil.

## Tokens viejos (transición)

Las pantallas anteriores al sistema 2a usan nombres viejos (`bg-green`, `text-text-2`, `border-line`, `text-muted`, `.badge--*`…). En index.css esas variables **apuntan a las nuevas** (`--green` → `--marca`, `--text-2` → `--tinta-2`, `--muted` → `--tinta-3`, `--red` → `--estado-mora`…), así que siguen funcionando y se ven con el sistema nuevo. **No los uses en código nuevo**; se retiran a medida que cada pantalla se rediseñe.

## Patrones de UX (sin cambios)

- **Dinero** siempre con `fmtCOP()` y **fechas** con `fmtFecha()` (src/lib/formatters.ts). Todo el texto en español.
- **Estados obligatorios** en toda vista con datos: cargando (skeleton), vacío (con acción), error (mensaje claro).
- **Confirmación** antes de eliminar o cancelar. **Toast** de éxito/error tras cada mutación.
- **Cifras grandes y legibles**: la app se usa en la calle, desde el celular. Texto normal ≥ 4,5:1 contra su fondo.
