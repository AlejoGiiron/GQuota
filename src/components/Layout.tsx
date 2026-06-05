import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

/* Íconos de línea (mismo set y trazo del dashboard V2 aprobado). */
type IconProps = { className?: string }
const IconHome = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9.5V20h14V9.5" />
    <path d="M9.5 20v-5.5h5V20" />
  </svg>
)
const IconUsers = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c.6-3 2.9-4.5 5.5-4.5S13.9 16 14.5 19" />
    <path d="M16 5.2A3 3 0 0118 11M21 19c-.4-2.2-1.6-3.6-3.3-4.2" />
  </svg>
)
const IconLoan = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </svg>
)
const IconCash = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 9.5v0M18 14.5v0" />
  </svg>
)
const IconGear = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4L5.6 5.6" />
  </svg>
)
const IconChevron = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
)
const IconLogout = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" />
    <path d="M10 17l5-5-5-5M15 12H3" />
  </svg>
)

type NavItem = {
  to: string
  label: string
  Icon: (props: IconProps) => JSX.Element
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', Icon: IconHome, end: true },
  { to: '/clientes', label: 'Clientes', Icon: IconUsers },
  { to: '/prestamos', label: 'Préstamos', Icon: IconLoan },
  { to: '/cobros', label: 'Cobros', Icon: IconCash },
  { to: '/configuracion', label: 'Configuración', Icon: IconGear },
]
// Bottom nav: solo los 4 principales (Configuración vive en el perfil del header).
const NAV_BOTTOM = NAV.filter((n) => n.to !== '/configuracion')

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-3 rounded-[10px] px-3 py-[11px] text-[14.5px] font-semibold transition-colors',
    isActive
      ? 'bg-green text-white shadow-[0_4px_12px_rgba(4,120,87,0.3)]'
      : 'text-[#a9c4ba] hover:bg-white/5 hover:text-[#e6f3ee]',
  ].join(' ')

const bottomItemClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex flex-1 flex-col items-center gap-1 py-1 text-[11px] font-semibold transition-colors',
    isActive ? 'text-green' : 'text-muted',
  ].join(' ')

export default function Layout() {
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const inicialaes = (user?.email?.split('@')[0]?.slice(0, 2) || 'U').toUpperCase()

  async function handleSignOut() {
    setMenuOpen(false)
    try {
      await signOut()
      toast.success('Sesión cerrada.')
      // La guarda de ruta privada redirige a /login al desaparecer la sesión.
    } catch {
      toast.error('No pudimos cerrar la sesión. Intenta de nuevo.')
    }
  }

  return (
    <div className="flex h-screen bg-bg text-text">
      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden w-[248px] shrink-0 flex-col bg-ink px-[18px] pb-5 pt-[26px] md:flex">
        <div className="mb-[30px] flex items-center gap-3 px-2">
          <div className="grid h-[38px] w-[38px] place-items-center rounded-[11px] bg-gradient-to-br from-[#10b981] to-green text-[19px] font-extrabold text-white shadow-[0_4px_12px_rgba(4,120,87,0.35)]">
            G
          </div>
          <div className="text-xl font-extrabold tracking-tight text-white">
            G<span className="text-[#34d399]">·</span>Quota
          </div>
        </div>

        <nav className="flex flex-col gap-[3px]">
          <div className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5e7d72]">
            Menú
          </div>
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navItemClass}>
              <Icon className="h-[19px] w-[19px] shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-[18px]">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-[10px]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1f8a5b] text-sm font-bold text-white">
              {inicialaes}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13.5px] font-bold text-white">
                {user?.email ?? 'Mi cuenta'}
              </div>
              <div className="text-xs text-[#6f9085]">Prestamista</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Columna principal ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-line bg-card px-5 py-3">
          <div className="text-base font-extrabold tracking-tight text-text">G-Quota</div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl border border-line bg-card py-1.5 pl-1.5 pr-2.5 transition-colors hover:border-[#d8d2c8]"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Abrir menú de perfil"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#1f8a5b] text-xs font-bold text-white">
                {inicialaes}
              </span>
              <span className="hidden max-w-[160px] truncate text-sm font-semibold text-text sm:block">
                {user?.email ?? 'Mi cuenta'}
              </span>
              <IconChevron
                className={`h-4 w-4 text-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden="true"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-[14px] border border-line bg-card shadow-pop"
                >
                  <div className="border-b border-line-soft px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Sesión
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-text">
                      {user?.email ?? 'Mi cuenta'}
                    </p>
                  </div>
                  <NavLink
                    to="/configuracion"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-text hover:bg-bg"
                  >
                    <IconGear className="h-[18px] w-[18px] text-muted" />
                    Configuración
                  </NavLink>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-red hover:bg-red-tint"
                  >
                    <IconLogout className="h-[18px] w-[18px]" />
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Contenido de la sección */}
        <main className="flex-1 overflow-y-auto px-5 py-5 md:px-[34px] md:py-6">
          <Outlet />
        </main>

        {/* Bottom nav (móvil) */}
        <nav className="flex shrink-0 border-t border-line bg-card px-2 pb-[22px] pt-2 md:hidden">
          {NAV_BOTTOM.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={bottomItemClass}>
              <Icon className="h-[23px] w-[23px]" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
