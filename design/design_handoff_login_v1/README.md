# Handoff: G-Quota — Login (ingreso) · V1 (pantalla dividida)

## Overview
Pantalla de **ingreso (login)** de **G-Quota**, una app web responsive de gestión de
préstamos para prestamistas en Colombia. Es la puerta de entrada a la app: debe transmitir
**confianza** (maneja dinero) y resolver el acceso del usuario con correo + contraseña.

Esta entrega cubre **una sola variante de layout — V1 (pantalla dividida)** — en dos breakpoints:
- **Desktop**: panel de marca a la izquierda (verde tinta) + formulario a la derecha (blanco).
- **Móvil (390 px)**: logo arriba, formulario centrado debajo, botón ancho.

Todo en **español (CO)**, tono claro y cercano. **Tema claro únicamente.**

---

## About the Design Files
Los archivos de la carpeta `reference/` son **referencias de diseño hechas en HTML/React** —
prototipos que muestran el aspecto y el comportamiento previstos, **no código de producción
para copiar tal cual**. La tarea es **recrear este diseño dentro del entorno del codebase
existente** (React, Vue, etc.) usando sus patrones y librerías establecidas. Si todavía no hay
entorno, elige el framework más apropiado e impleméntalo allí.

G-Quota ya tiene un **Dashboard V2 aprobado** que comparte el mismo sistema visual. **No crees
tokens nuevos**: reutiliza exactamente los mismos colores y tipografías que ya están en
`gquota.css` (incluido en la carpeta). Esta pantalla extiende ese sistema; los estilos
específicos de login están en `gq-login.css`.

---

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciados, radios e interacciones son finales.
Recrea la UI de forma fiel usando las librerías/patrones del codebase. Los valores exactos
están documentados abajo y en los archivos CSS de referencia.

---

## Screens / Views

### A. Desktop — Login V1 (pantalla dividida)
Lienzo de referencia: **1440 × 840** (la pantalla real es fluida y ocupa el alto del viewport).

**Layout**
- Contenedor raíz: `display:flex`, ocupa `100vw × 100vh`.
- **Columna izquierda (panel de marca)**: `flex: 0 0 47%`. Fondo verde tinta `#0c1f1a`.
  `display:flex; flex-direction:column`. Padding `56px 60px`.
  - Logo arriba (alineado al inicio).
  - Bloque central (`margin: auto 0`, `max-width: 460px`): eyebrow + titular + subtítulo + 3 beneficios.
  - Footer abajo: `© 2026 G-Quota · Hecho en Colombia`.
  - Dos halos radiales decorativos muy sutiles (verde arriba-derecha, ámbar abajo-izquierda),
    `pointer-events:none`. Opcionales — no afectan layout.
- **Columna derecha (formulario)**: `flex:1`. Fondo blanco `#ffffff`.
  `display:flex; align-items:center; justify-content:center`. Padding `48px`.
  - Formulario centrado, `max-width: 384px`.

**Componentes — panel de marca (columna izquierda)**
- **Logo**: cuadro + nombre, en fila, `gap: 13px`.
  - Cuadro: `60×60`, `border-radius: 17px`, fondo **ámbar `#d97706`**, letra "G" blanca
    `font-weight:800`, `font-size:31px`. Sombra `0 8px 20px rgba(217,119,6,.32)`.
    ⚠️ Nota de marca: este login usa el cuadro **ámbar**; el Dashboard V2 usa un cuadro verde.
    Confirmar con diseño cuál es el definitivo antes de implementar en ambos sitios.
  - Nombre: `G·Quota` (el `·` es un punto medio `&middot;`). `font-size:27px; font-weight:800;
    letter-spacing:-.025em`. Texto blanco; el `·` en verde claro `#34d399`.
- **Eyebrow**: "GESTIÓN DE PRÉSTAMOS". `12px / 700`, `letter-spacing:.12em`, mayúsculas,
  color `#58c79a`. Margen inferior `18px`.
- **Titular**: "Tu cartera, *ordenada* y bajo control." `38px / 800`, `line-height:1.12`,
  `letter-spacing:-.025em`, blanco. La palabra "ordenada" en verde `#34d399`.
- **Subtítulo**: "Clientes, cuotas y los cobros del día en un solo lugar. Sin cuadernos, sin enredos."
  `16px / 500`, `line-height:1.55`, color `#9fbdb1`, `max-width:400px`, margen superior `18px`.
- **Beneficios** (3): columna, `gap:13px`, margen superior `34px`. Cada uno: fila `gap:12px`,
  texto `14.5px / 500` color `#cfe3da`, precedido de un check.
  - Check: caja `26×26`, `border-radius:8px`, fondo `rgba(52,211,153,.14)`, ícono ✓ `#34d399`.
  - Textos: "Cobros del día siempre a la mano" · "Alertas de cuotas por vencer y en mora" ·
    "Tu ganancia del mes, clara y al instante".
- **Footer**: "© 2026 G-Quota · Hecho en Colombia". `12.5px / 500`, color `#5e7d72`.

**Componentes — formulario (columna derecha)**
- **Encabezado**:
  - Título "Iniciar sesión": `27px / 800`, `letter-spacing:-.03em`, color `#16241f`.
  - Subtítulo "Qué bueno verte de nuevo. Ingresa para ver tus cobros de hoy."
    `14.5px / 500`, color `#475a53`, margen superior `7px`. ← copy neutral en género.
- **Mensaje de error** (cuando aplica): caja a ancho completo, fondo `#fef2f2`,
  borde `1px solid #fee2e2`, `border-radius:12px`, padding `12px 14px`. Ícono de alerta
  (círculo con "!") en rojo `#dc2626`. Texto `13px / 600` color `#b42121`:
  "Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo."
- **Campos** (columna, `gap:16px`):
  - **Correo electrónico**:
    - Label `13px / 600` color `#475a53`.
    - Input: alto `52px`, `border-radius:12px`, borde `1.5px solid #ece8e1`, fondo blanco,
      texto `15px / 500`. Ícono de sobre a la izquierda (`19px`, color `#8b9a93`,
      offset `left:15px`), padding-left `44px`. Placeholder "tucorreo@ejemplo.com" color `#8b9a93`.
    - **Focus**: borde `#047857` + halo `0 0 0 4px rgba(4,120,87,.12)`.
    - **Error**: borde `#dc2626`, fondo `#fffdfd`, halo en focus `rgba(220,38,38,.10)`.
  - **Contraseña**:
    - Fila superior: label "Contraseña" + enlace "¿Olvidaste tu contraseña?" alineado a la derecha
      (`12.5px / 700`, color `#036249`, subraya en hover).
    - Input igual al de correo, con ícono de candado a la izquierda y **botón ojo** a la derecha
      (`40×40`, `border-radius:9px`, ícono `19px` color `#8b9a93`; hover: color `#475a53`,
      fondo `#faf9f7`). padding-right `50px`. Placeholder "Tu contraseña".
    - El botón ojo **alterna** `type="password" ↔ "text"` y cambia el ícono (ojo / ojo tachado).
      `aria-label` "Mostrar contraseña" / "Ocultar contraseña".
- **Botón primario** "Iniciar sesión":
  - Ancho completo, alto `52px`, `border-radius:12px`, fondo verde `#047857`, texto blanco
    `15.5px / 700`, ícono de flecha → a la derecha (`gap:9px`). Margen superior `22px`.
  - Sombra `0 8px 18px rgba(4,120,87,.28)`. Hover: `translateY(-1px)` + sombra más marcada.
- **Enlace secundario**: "¿No tienes cuenta? **Crear cuenta**" centrado, `13.5px / 500`,
  color `#475a53`; "Crear cuenta" en `#036249 / 700`. Margen superior `22px`.
- **Pie de seguridad**: separador superior `1px solid #f3f0ea`; fila centrada con ícono escudo +
  "Conexión segura · tus datos están protegidos". `11.5px / 600`, color `#8b9a93`.

---

### B. Móvil — Login V1 (390 px)
Lienzo de referencia: **390 × 844**.

**Layout**
- Contenedor raíz: `display:flex; flex-direction:column`, alto completo.
- (En el prototipo hay una status bar simulada; **omitir** en la app real — la provee el navegador/SO.)
- **Cuerpo**: `flex:1; display:flex; flex-direction:column`, padding `0 26px 26px`.
  - **Zona de logo** (centrada, `padding: 50px 0 30px`): logo (versión tema claro) + título
    "Iniciar sesión" (`24px / 800`, margen superior `26px`) + subtítulo
    "Qué bueno verte de nuevo. Ingresa para ver tus cobros de hoy." (`14px`, color `#475a53`).
    En móvil el **logo va sobre fondo claro**: cuadro ámbar, nombre en texto oscuro `#16241f`,
    el `·` en verde `#047857`.
  - **Formulario**: mismos campos, estados y botón que en desktop, a ancho completo
    (sin `max-width`). El enlace "¿Olvidaste?" se acorta por espacio.
  - **Pie**: empujado abajo (`margin-top:auto`), ícono escudo + "Conexión segura", centrado.

**Logo (móvil, tema claro)** — tamaño `md`: cuadro `50×50`, `border-radius:14px`,
nombre `23px`.

---

## Interactions & Behavior
- **Mostrar/ocultar contraseña**: el botón ojo alterna la visibilidad del campo y su ícono.
- **Validación / error**: al enviar con credenciales inválidas se muestra el bloque de error en
  español y los inputs pasan a estado de error (borde rojo). En el prototipo el submit fuerza el
  estado de error para demostración; en producción el error proviene de la respuesta del backend.
  - Texto de error sugerido (no revela cuál campo falló, por seguridad):
    "Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo."
- **Enlaces**: "¿Olvidaste tu contraseña?" → flujo de recuperación (pendiente de diseño).
  "Crear cuenta" → registro (pendiente de diseño).
- **Hover**: botón primario se eleva 1px; enlaces subrayan; botón ojo cambia color/fondo.
- **Focus**: anillo verde de 4px en los inputs (rojo translúcido en estado de error). Mantener
  foco visible por accesibilidad.
- **Responsive**: por debajo de ~768px, colapsar de pantalla dividida (B) a la versión móvil de
  una sola columna con el logo arriba. El panel de marca verde no se muestra en móvil.

---

## State Management
Estado local del formulario:
- `email` (string), `password` (string)
- `showPassword` (bool) — alterna el `type` del input de contraseña
- `error` (bool/string) — controla el bloque de error y el estado visual de los inputs
- `submitting` (bool) — opcional, para estado de carga del botón (no presente en el prototipo;
  recomendado en producción: deshabilitar el botón y mostrar spinner mientras autentica)

Transiciones: `submit` → llamar API de autenticación → en éxito navegar al dashboard; en fallo,
setear `error`. Limpiar `error` al editar cualquier campo.

---

## Design Tokens
**Reutilizar los del Dashboard V2 (ya en `gquota.css`). No crear tokens nuevos.**

**Color**
| Token | Hex | Uso |
|---|---|---|
| `--green` | `#047857` | Primario (botón, focus, acentos) |
| `--green-700` | `#036249` | Enlaces, texto sobre tinte verde |
| `--green-tint` | `#ecfdf5` | Fondos verdes suaves |
| `--ink` | `#0c1f1a` | Panel de marca (superficie oscura) |
| `--bg` | `#faf9f7` | Fondo blanco hueso (app) |
| `--card` | `#ffffff` | Tarjetas / lado del formulario |
| `--line` | `#ece8e1` | Bordes de inputs/tarjetas |
| `--line-soft` | `#f3f0ea` | Separadores suaves |
| `--amber` | `#d97706` | Acento (cuadro del logo) |
| `--red` | `#dc2626` | Errores |
| `--red-tint` | `#fef2f2` | Fondo del bloque de error |
| `--red-tint-2` | `#fee2e2` | Borde del bloque de error |
| `--text` | `#16241f` | Texto principal |
| `--text-2` | `#475a53` | Texto secundario |
| `--muted` | `#8b9a93` | Texto terciario / placeholders / íconos |

Colores auxiliares usados solo en el panel oscuro: `#34d399` / `#58c79a` (verdes claros del
titular y eyebrow), `#cfe3da` / `#9fbdb1` (textos sobre tinta), `#5e7d72` (footer).

**Tipografía**
- UI: **Plus Jakarta Sans** (`--font-ui`). Pesos usados: 500/600/700/800.
- Cifras / mono: **JetBrains Mono** (`--font-mono`) — no se usa en login, pero forma parte del sistema.

**Radio**: `--r-sm: 9px` · `--r: 14px` · `--r-lg: 18px`. Inputs/botón usan `12px`; logo `14–17px`.

**Sombras**
- Botón primario: `0 8px 18px rgba(4,120,87,.28)` (hover `0 10px 24px rgba(4,120,87,.36)`).
- Logo (cuadro ámbar): `0 8px 20px rgba(217,119,6,.32)`.
- Tarjeta (V2, no usado aquí): `--shadow-pop: 0 12px 36px rgba(12,31,26,.12)`.

**Alturas clave**: inputs y botón primario = `52px`.

---

## Assets
- **Sin imágenes externas.** El logo es CSS + texto (cuadro de color con la letra "G").
- **Íconos**: SVG inline (sobre, candado, ojo, ojo-tachado, escudo, flecha, alerta, check),
  trazo `currentColor`, `stroke-width` ~1.9–2.4. Definidos en `gq-login.jsx` (objeto `LI`).
  En el codebase, sustituir por la librería de íconos del proyecto (p. ej. Lucide/Heroicons)
  manteniendo el mismo trazo y tamaños.
- **Fuentes**: cargar Plus Jakarta Sans y JetBrains Mono (Google Fonts o self-hosted) como en el
  resto de la app.

---

## Files (en `reference/`)
- **`G-Quota Login.html`** — entrada del prototipo. Monta las variantes en un lienzo de diseño.
  Para Login V1, mirar el componente `LoginV1` (desktop) y `MobileLogin` (móvil).
- **`gq-login.jsx`** — componentes del login: `Logo`, `LoginForm`, `LoginV1`, `MobileLogin`,
  `MobileForm` y el set de íconos `LI`. **Fuente principal de la UI a recrear.**
- **`gq-login.css`** — estilos específicos del login (clases `lg-*` y `lgm-*`). Valores exactos.
- **`gquota.css`** — **sistema visual del Dashboard V2** (tokens `--*`, reset `.gq`, tipografía).
  Reutilizar estos tokens; no inventar nuevos.
- **`gq-common.jsx`** — componentes compartidos del dashboard. Para login solo es relevante
  `StatusBar` (status bar simulada del móvil, que en producción se omite).
- **`design-canvas.jsx`** — andamiaje de presentación (lienzo pan/zoom). **No es parte del
  producto**; ignorar al implementar.

> Nota: V2 (tarjeta centrada) queda fuera de este handoff por decisión de diseño — se implementa V1.
