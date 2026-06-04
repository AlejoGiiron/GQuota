# G-Quota — Design tokens

Tokens del dashboard (Inicio). Moneda: COP sin decimales (`$1.000.000`). Idioma: español (CO).

## 1. Color

### Marca / primarios
| Token | Hex | Uso |
|---|---|---|
| `--green` | `#047857` | Esmeralda principal: botones, activos, acentos |
| `--green-700` | `#036249` | Texto/hover sobre verde, enlaces |
| `--green-tint` | `#ecfdf5` | Fondo suave (chips, badge "al día", botón fantasma) |
| `--green-tint-2` | `#d1fae5` | Hover de fondos verdes suaves |
| `--ink` | `#0c1f1a` | Verde tinta: fondo del sidebar |
| `--ink-2` | `#112a23` | Variante de tinta |
| `--ink-soft` | `#1b3a31` | Bordes/realces dentro del sidebar |

### Fondo y superficie
| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#faf9f7` | Fondo de la app (blanco hueso) |
| `--card` | `#ffffff` | Tarjetas y paneles |
| `--line` | `#ece8e1` | Bordes de tarjetas |
| `--line-soft` | `#f3f0ea` | Separadores entre filas |

### Acento y estados
| Token | Hex | Uso |
|---|---|---|
| `--amber` | `#d97706` | Acento de montos clave (Ganancia del mes) |
| `--amber-tint` | `#fef3e2` | Fondo de chip/badge "por vencer" |
| `--red` | `#dc2626` | Vencidos / mora |
| `--red-tint` | `#fef2f2` | Fondo badge "vencido", chip mora |
| `--red-tint-2` | `#fee2e2` | Fondo chip de alerta más sólido / borde |

### Texto
| Token | Hex | Uso |
|---|---|---|
| `--text` | `#16241f` | Texto principal |
| `--text-2` | `#475a53` | Texto secundario |
| `--muted` | `#8b9a93` | Terciario / captions / teléfonos |

### Badges de estado
| Estado | Fondo | Texto |
|---|---|---|
| Al día | `#ecfdf5` | `#036249` |
| Por vencer | `#fef3e2` | `#b45309` |
| Vencido | `#fef2f2` | `#dc2626` |

### Avatares (iniciales) — paleta rotativa
`#0d9488` · `#0891b2` · `#7c3aed` · `#d97706` · `#be185d` · `#4d7c0f` · `#475569` · `#b45309`

> Marca de logo: degradado `linear-gradient(150deg, #10b981, #047857)`.

---

## 2. Tipografía

| Familia | Uso | Pesos |
|---|---|---|
| **Plus Jakarta Sans** | Toda la interfaz | 400 / 500 / 600 / 700 / 800 |
| **JetBrains Mono** | Cifras y montos (alineación tabular) | 400 / 500 / 600 / 700 |

Mono con `font-feature-settings: "tnum" 1` y `letter-spacing: -.02em`.

### Escala de texto — Desktop
| Rol | Tamaño | Peso |
|---|---|---|
| Saludo / H1 | 25px | 800 |
| Valor de métrica (mono) | 29px | 700 |
| Valor franja compacta V2 (mono) | 21px | 700 |
| Título panel protagonista (H2) | 19px | 800 |
| Título de panel (H2) | 16px | 700 |
| Monto en fila (mono) | 15.5px | 700 |
| Ítem de navegación | 14.5px | 600 |
| Cuerpo / etiqueta métrica | 13–14px | 500–600 |
| Subtexto / caption | 12–12.5px | 500 |
| Micro (cuotas, "a cobrar") | 11–11.5px | 600 |

### Escala de texto — Móvil
| Rol | Tamaño | Peso |
|---|---|---|
| Saludo / H1 | 21px | 800 |
| Valor de métrica (mono) | 21px | 700 |
| Valor franja compacta (mono) | 13.5px | 700 |
| Título de sección (H2) | 16–17px | 800 |
| Nombre en fila | 14px | 700 |
| Monto en fila (mono) | 14.5–17px | 700 |
| Subtexto / caption | 11.5px | 500 |
| Navegación inferior | 11px | 600 |

---

## 3. Spacing, radios y sombras

### Radios
| Token | Valor | Uso |
|---|---|---|
| `--r-sm` | 9–11px | Chips, avatares, botones de ícono |
| `--r` | 14px | Tarjetas y paneles |
| `--r-lg` | 18px | Contenedores grandes / FAB |

Botones: radio 12px (10px en tamaño pequeño).

### Sombras
| Token | Valor |
|---|---|
| `--shadow-card` | `0 1px 2px rgba(12,31,26,.04), 0 4px 14px rgba(12,31,26,.05)` |
| `--shadow-pop` | `0 12px 36px rgba(12,31,26,.12)` |
| Botón primario | `0 6px 16px rgba(4,120,87,.28)` (hover `.36`) |

### Espaciado
| Contexto | Valor |
|---|---|
| Gap entre tarjetas de métrica / paneles | 18px |
| Padding tarjeta de métrica | 20px |
| Padding panel (cabecera) | 17px 20px 14px |
| Padding fila de cliente | 12px 20px (grande V2: 15px 24px) |
| Padding contenido desktop (scroll) | 22px 34px 30px |
| Sidebar | ancho 248px · padding 26px 18px 20px |
| Bottom nav móvil | padding 9px 8px 22px |
| Margen lateral móvil (body) | 18px |

### Tamaños fijos
| Elemento | Tamaño |
|---|---|
| Avatar fila | 42px (desktop) · 40px (móvil) · 46px (fila grande V2) |
| Botón de ícono | 42px (desktop) · 40px (móvil) |
| Botón primario | alto 46px |
| Hit target táctil mínimo | 44px |
| Barra de progreso | alto 8px, radio 6px, relleno `linear-gradient(90deg,#10b981,#047857)` |

---

## 4. Componentes (resumen)
- **Tarjeta de métrica**: card + borde `--line` + `--shadow-card`; etiqueta `--text-2`, valor mono grande, chip de ícono 36px tintado, dato secundario `--muted`.
- **Fila de cliente**: avatar con iniciales · nombre (700) + sub `--muted` · monto mono a la derecha · acción (botón fantasma verde) o badge de estado.
- **Badge de estado**: pastilla con punto `currentColor`; mapea a al día / por vencer / vencido.
- **Botón primario**: verde `--green`, texto blanco 700, sombra verde; **fantasma**: fondo `--green-tint`, texto `--green-700`.
