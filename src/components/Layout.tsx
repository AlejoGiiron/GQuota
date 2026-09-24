import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useConfiguracion } from '@/contexts/ConfiguracionContext'
import GuiaNovedades from '@/components/novedades/GuiaNovedades'
import { useEsEscritorio } from '@/hooks/useEsEscritorio'
import { useNovedades } from '@/hooks/useNovedades'
import { monograma } from '@/lib/marca'
import { VERSION_NOVEDADES, pasosDe, seAbreSola } from '@/lib/novedades'

/* Íconos de línea del sistema 2a (design/paquete-2a, GQ.NAV). */
type IconProps = { className?: string }
const icono = (d: string) =>
  function Icono({ className }: IconProps) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    )
  }
const IconInicio = icono('M4 10.5L12 4l8 6.5V20h-5.5v-6h-5v6H4z')
const IconCobros = icono('M10 6h10M10 12h10M10 18h10M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17')
const IconClientes = icono(
  'M9 11.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7ZM2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.9c1.7.8 2.7 2.4 3 5.1',
)
const IconSolicitudes = icono('M6 3h9l4 4v14H6zM14 3v5h5M9 14l2 2 4-4')
const IconPrestamos = icono('M2.5 6h19v12h-19zM12 9.4a2.6 2.6 0 1 0 0 5.2a2.6 2.6 0 1 0 0-5.2Z')
const IconEquipo = icono('M4 3h16v18H4zM12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6ZM8 17c.8-1.8 2.2-2.6 4-2.6s3.2.8 4 2.6')
const IconConfiguracion = icono(
  'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6ZM12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4L5.6 5.6',
)
const IconNovedades = icono('M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9zM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z')
const IconSalir = icono('M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l5-5-5-5M15 12H3')
const IconChevron = icono('M6 9l6 6 6-6')

type NavItem = {
  to: string
  label: string
  Icon: (props: IconProps) => JSX.Element
  end?: boolean
}

// El orden de siempre (el que los usuarios ya conocen de antes del sistema 2a):
// Inicio, Clientes, Préstamos, Cobros. Solicitudes, si el negocio la activó, va
// junto a Clientes. Plantillas y Mi marca llegan con sus fases.
const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', Icon: IconInicio, end: true },
  { to: '/clientes', label: 'Clientes', Icon: IconClientes },
  { to: '/solicitudes', label: 'Solicitudes', Icon: IconSolicitudes },
  { to: '/prestamos', label: 'Préstamos', Icon: IconPrestamos },
  { to: '/cobros', label: 'Cobros', Icon: IconCobros },
  { to: '/equipo', label: 'Equipo', Icon: IconEquipo },
  { to: '/configuracion', label: 'Configuración', Icon: IconConfiguracion },
]
// El cobrador no ve Inicio (dashboard de ganancias), Solicitudes (alta de
// prospectos), Equipo ni Configuración: su navegación es lo operativo.
const SOLO_DUENO = new Set(['/', '/solicitudes', '/equipo', '/configuracion'])
// En móvil, Equipo y Configuración (admin) van en el menú de la cuenta, no en la
// barra inferior: ahí solo lo operativo del día a día.
const SOLO_MENU_CUENTA = new Set(['/equipo', '/configuracion'])

/* Menú lateral: el ítem activo lleva el fondo suave y la barra de la marca. */
const itemLateral = ({ isActive }: { isActive: boolean }) =>
  [
    'group relative flex h-10 items-center gap-[11px] rounded-control px-2.5 text-[14.5px] transition-colors',
    isActive ? 'bg-marca-suave font-semibold text-tinta' : 'font-medium text-tinta hover:bg-superficie-2',
  ].join(' ')

/* Barra inferior: el activo lleva una raya de la marca arriba y el texto en tinta. */
const itemInferior = ({ isActive }: { isActive: boolean }) =>
  [
    'relative flex flex-1 flex-col items-center justify-center gap-[3px] text-xs transition-colors',
    isActive ? 'font-semibold text-tinta' : 'font-medium text-tinta-3',
  ].join(' ')

function Monograma({ nombre, className }: { nombre: string; className: string }) {
  return (
    <div
      className={`grid shrink-0 place-items-center bg-marca font-bold text-marca-sobre ${className}`}
      aria-hidden="true"
    >
      {monograma(nombre)}
    </div>
  )
}

/** Lo que el menú de la cuenta necesita de la guía de novedades. */
type NovedadesMenu = {
  /** El usuario tiene una guía (creado antes de la versión): muestra "Novedades". */
  hay: boolean
  /** Todavía no la marcó como vista: lleva un punto. */
  pendiente: boolean
  abrir: () => void
}

/** Punto de "sin ver" (marca: es parte del marco, no un estado). */
const PuntoNuevo = ({ className = '' }: { className?: string }) => (
  <span className={`h-2 w-2 shrink-0 rounded-full bg-marca ${className}`} aria-hidden="true" />
)

/** Menú de la cuenta: correo, rol, accesos de admin (en móvil), novedades y cerrar sesión. */
function MenuCuenta({ enLateral, novedades }: { enLateral: boolean; novedades: NovedadesMenu }) {
  const { user, signOut } = useAuth()
  const { esDueno } = useConfiguracion()
  const [abierto, setAbierto] = useState(false)
  const correo = user?.email ?? 'Mi cuenta'
  const iniciales = (user?.email?.split('@')[0]?.slice(0, 2) || 'U').toUpperCase()
  const rol = esDueno ? 'Dueño' : 'Cobrador'

  async function cerrarSesion() {
    setAbierto(false)
    try {
      await signOut()
      toast.success('Sesión cerrada.')
      // La guarda de ruta privada redirige a /login al desaparecer la sesión.
    } catch {
      toast.error('No pudimos cerrar la sesión. Intenta de nuevo.')
    }
  }

  const itemMenu = 'flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-tinta hover:bg-superficie-2'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className={
          enLateral
            ? 'flex w-full items-center gap-2.5 rounded-control px-1.5 py-1.5 text-left transition-colors hover:bg-superficie-2'
            : 'grid h-11 w-11 place-items-center rounded-control'
        }
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={novedades.pendiente ? 'Abrir menú de la cuenta (hay novedades sin ver)' : 'Abrir menú de la cuenta'}
      >
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full border border-borde-control bg-superficie-2 text-xs font-semibold text-tinta-2">
          {iniciales}
          {novedades.pendiente && <PuntoNuevo className="absolute -right-0.5 -top-0.5 ring-2 ring-superficie" />}
        </span>
        {enLateral && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-semibold text-tinta">{correo}</span>
              <span className="block text-xs text-tinta-3">{rol}</span>
            </span>
            <IconChevron className={`h-4 w-4 shrink-0 text-tinta-3 transition-transform ${abierto ? '' : 'rotate-180'}`} />
          </>
        )}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setAbierto(false)} />
          <div
            role="menu"
            className={`absolute z-20 w-60 overflow-hidden rounded-tarjeta border border-borde bg-superficie shadow-flotante ${
              enLateral ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-1'
            }`}
          >
            <div className="border-b border-borde-fila px-4 py-3">
              <p className="text-xs font-semibold text-tinta-3">Sesión · {rol}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-tinta">{correo}</p>
            </div>
            {esDueno && !enLateral && (
              <>
                <NavLink to="/equipo" role="menuitem" onClick={() => setAbierto(false)} className={itemMenu}>
                  <IconEquipo className="h-[18px] w-[18px] text-tinta-3" />
                  Equipo
                </NavLink>
                <NavLink to="/configuracion" role="menuitem" onClick={() => setAbierto(false)} className={itemMenu}>
                  <IconConfiguracion className="h-[18px] w-[18px] text-tinta-3" />
                  Configuración
                </NavLink>
              </>
            )}
            {novedades.hay && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAbierto(false)
                  novedades.abrir()
                }}
                className={itemMenu}
              >
                <IconNovedades className="h-[18px] w-[18px] text-tinta-3" />
                Novedades
                {novedades.pendiente && (
                  <>
                    <PuntoNuevo className="ml-auto" />
                    <span className="sr-only">(sin ver)</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={cerrarSesion}
              className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-estado-mora hover:bg-estado-mora-fondo"
            >
              <IconSalir className="h-[18px] w-[18px]" />
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function Layout() {
  const { nombreNegocio, esDueno, rol, solicitudesActivas } = useConfiguracion()
  const escritorio = useEsEscritorio()

  // Solicitudes solo aparece si el negocio la activó (negocios.solicitudes_activas).
  const nav = NAV.filter(
    (n) => (esDueno || !SOLO_DUENO.has(n.to)) && (n.to !== '/solicitudes' || solicitudesActivas),
  )
  const navInferior = nav.filter((n) => !SOLO_MENU_CUENTA.has(n.to))

  // Guía de novedades: se abre sola si está pendiente y llegó su fecha; "Entendido"
  // la marca vista y "Ver después" la corre a mañana, así que deja de abrirse sola.
  // Desde el menú se puede volver a abrir cuando se quiera.
  const novedades = useNovedades()
  const [guiaDesdeMenu, setGuiaDesdeMenu] = useState(false)
  const guiaAbierta = rol !== null && (guiaDesdeMenu || seAbreSola(novedades.fila, new Date()))
  const menuNovedades: NovedadesMenu = {
    hay: novedades.fila !== null,
    pendiente: novedades.pendiente,
    abrir: () => setGuiaDesdeMenu(true),
  }

  return (
    <div className="flex h-screen bg-fondo text-tinta">
      {/* ── Menú lateral (escritorio) ── */}
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-borde bg-superficie px-3.5 pb-3 pt-5 md:flex">
        <div className="flex items-center gap-2.5 border-b border-borde px-1.5 pb-[18px]">
          <Monograma nombre={nombreNegocio} className="h-9 w-9 rounded-tarjeta text-sm" />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight">{nombreNegocio}</div>
            <div className="mt-0.5 text-[12.5px] text-tinta-3">{esDueno ? 'Dueño' : 'Cobrador'}</div>
          </div>
        </div>

        <nav aria-label="Menú principal" className="mt-3.5 flex flex-col gap-0.5">
          {nav.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={itemLateral}>
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute -left-3.5 bottom-2 top-2 w-[3px] rounded-r-sm ${isActive ? 'bg-marca' : 'bg-transparent'}`}
                    aria-hidden="true"
                  />
                  <Icon className="h-[19px] w-[19px] shrink-0" />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <MenuCuenta enLateral novedades={menuNovedades} />
          <div className="px-1.5 text-xs text-tinta-3">con G-Quota</div>
        </div>
      </aside>

      {/* ── Columna principal ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Encabezado (móvil): logo y nombre del negocio, y la cuenta */}
        <header className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-borde bg-superficie pl-4 pr-1.5 md:hidden">
          <Monograma nombre={nombreNegocio} className="h-[30px] w-[30px] rounded-[7px] text-xs" />
          <div className="min-w-0 flex-1 truncate text-[15px] font-semibold">{nombreNegocio}</div>
          <MenuCuenta enLateral={false} novedades={menuNovedades} />
        </header>

        {/* Contenido de la sección */}
        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6">
          <Outlet />
        </main>

        {/* Barra inferior (móvil) */}
        <nav
          aria-label="Menú principal"
          className="flex h-[72px] shrink-0 border-t border-borde bg-superficie pb-3 md:hidden"
        >
          {navInferior.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={itemInferior}>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute -top-px left-[30%] right-[30%] h-[3px] bg-marca" aria-hidden="true" />
                  )}
                  <Icon className="h-[21px] w-[21px]" />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {guiaAbierta && rol && (
        <GuiaNovedades
          pasos={pasosDe(novedades.fila?.version ?? VERSION_NOVEDADES, rol, escritorio ? 'computador' : 'celular')}
          rol={rol}
          pantalla={escritorio ? 'computador' : 'celular'}
          yaVista={novedades.fila?.estado === 'vista'}
          onEntendido={() => {
            setGuiaDesdeMenu(false)
            void novedades.marcarVista()
          }}
          onVerDespues={() => {
            setGuiaDesdeMenu(false)
            void novedades.verDespues()
          }}
        />
      )}
    </div>
  )
}
