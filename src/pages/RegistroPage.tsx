import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { NOMBRE_NEGOCIO_PENDIENTE } from '@/pages/SinNegocioPage'
import './login.css'

/* Íconos (mismo set/trazo del login). */
const IconMail = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M4 7l8 5.5L20 7" />
  </svg>
)
const IconLock = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 018 0v2.5" />
  </svg>
)
const IconStore = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9.5V19a1 1 0 001 1h14a1 1 0 001-1V9.5" />
    <path d="M3 9.5l1.5-5h15L21 9.5a2.5 2.5 0 01-4.5 1.5 2.5 2.5 0 01-4.5 0 2.5 2.5 0 01-4.5 0A2.5 2.5 0 013 9.5Z" />
  </svg>
)
const IconEye = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const IconEyeOff = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3l18 18" />
    <path d="M10.6 10.7a2 2 0 002.8 2.8" />
    <path d="M9.4 5.8A9.3 9.3 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 01-2.4 3.2M6.2 7.2A16 16 0 002.5 12S6 18.5 12 18.5a8.7 8.7 0 003-.5" />
  </svg>
)
const IconArrow = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
const IconAlert = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4.5M12 16v0" />
  </svg>
)
const IconCheck = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
)

function Logo({ size, theme }: { size: 'lg' | 'md'; theme: 'light' | 'dark' }) {
  return (
    <div className={`lg-logo lg-logo--${theme}`}>
      <div className={`lg-mark lg-mark--${size}`}>G</div>
      <div className={`lg-word${size === 'md' ? ' lg-word--md' : ''}`}>
        G<span className="dot">·</span>Quota
      </div>
    </div>
  )
}

const BENEFICIOS = [
  'Tu propio negocio, listo en un minuto',
  'Clientes, préstamos y cobros en un solo lugar',
  'Tus datos, privados y solo tuyos',
]

export default function RegistroPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [negocio, setNegocio] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Caso "Confirm email" ON: signUp no entrega sesión hasta confirmar el correo.
  const [confirmaPendiente, setConfirmaPendiente] = useState(false)

  const limpiarError = () => {
    if (error) setError(null)
  }

  function validar(): string | null {
    if (!negocio.trim()) return 'Escribe el nombre de tu negocio.'
    if (!email.trim().includes('@')) return 'Escribe un correo válido.'
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
    return null
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const problema = validar()
    if (problema) {
      setError(problema)
      toast.error(problema)
      return
    }
    setSubmitting(true)
    // El nombre del negocio se guarda ANTES del signUp: apenas haya sesión, la
    // app navega a la pantalla "sin negocio", que lo lee y crea el negocio.
    sessionStorage.setItem(NOMBRE_NEGOCIO_PENDIENTE, negocio.trim())
    const { error: msg, sesionLista } = await signUp(email.trim(), password)
    if (msg) {
      sessionStorage.removeItem(NOMBRE_NEGOCIO_PENDIENTE)
      setError(msg)
      toast.error(msg)
      setSubmitting(false)
      return
    }
    if (!sesionLista) {
      // Confirm email ON: no hay sesión todavía. El negocio se creará cuando el
      // usuario confirme y entre (la pantalla "sin negocio" pedirá el nombre).
      sessionStorage.removeItem(NOMBRE_NEGOCIO_PENDIENTE)
      setSubmitting(false)
      setConfirmaPendiente(true)
      return
    }
    // Con sesión: la guarda de ruta redirige a la app y SinNegocioPage crea el
    // negocio con el nombre pendiente. Empujamos por si acaso.
    navigate('/', { replace: true })
  }

  if (confirmaPendiente) {
    return (
      <div className="lg">
        <div className="lg-formside">
          <div className="lg-form">
            <div className="lg-form-head">
              <Logo size="md" theme="light" />
              <div className="lg-h1" style={{ marginTop: 18 }}>
                Revisa tu correo
              </div>
              <p>
                Te enviamos un enlace a <b>{email.trim()}</b> para confirmar tu cuenta. Cuando lo
                confirmes, inicia sesión y termina de crear tu negocio.
              </p>
            </div>
            <Link to="/login" className="lg-submit" style={{ textDecoration: 'none' }}>
              Ir a iniciar sesión {IconArrow}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="lg">
      <aside className="lg-brand">
        <Logo size="lg" theme="dark" />
        <div className="lg-brand-body">
          <div className="lg-brand-eyebrow">Crea tu cuenta</div>
          <div className="lg-brand-head">
            Empieza a llevar tu cartera <em>hoy mismo</em>.
          </div>
          <p className="lg-brand-sub">
            Regístrate gratis y monta tu negocio en un minuto. Sin cuadernos, sin enredos.
          </p>
          <div className="lg-brand-points">
            {BENEFICIOS.map((texto) => (
              <div className="lg-brand-point" key={texto}>
                <span className="tick">{IconCheck}</span>
                {texto}
              </div>
            ))}
          </div>
        </div>
        <div className="lg-brand-foot">© 2026 G-Quota · Hecho en Colombia 🇨🇴</div>
      </aside>

      <div className="lg-formside">
        <form className="lg-form" onSubmit={handleSubmit} noValidate>
          <div className="lg-mobile-head">
            <Logo size="md" theme="light" />
            <div className="lg-h1">Crear cuenta</div>
            <p>Monta tu negocio y empieza a llevar tus préstamos.</p>
          </div>

          <div className="lg-form-head">
            <div className="lg-h1">Crear cuenta</div>
            <p>Monta tu negocio y empieza a llevar tus préstamos.</p>
          </div>

          {error && (
            <div className="lg-alert" role="alert">
              <span className="ic">{IconAlert}</span>
              <p>{error}</p>
            </div>
          )}

          <div className="lg-fields">
            <div className="lg-field">
              <label className="lg-label" htmlFor="rg-negocio">
                Nombre de tu negocio
              </label>
              <div className="lg-input-wrap">
                <span className="lg-input-ic">{IconStore}</span>
                <input
                  id="rg-negocio"
                  type="text"
                  className={`lg-input${error ? ' is-error' : ''}`}
                  placeholder="Ej. Préstamos Don Luis"
                  value={negocio}
                  onChange={(e) => {
                    setNegocio(e.target.value)
                    limpiarError()
                  }}
                  required
                />
              </div>
            </div>

            <div className="lg-field">
              <label className="lg-label" htmlFor="rg-email">
                Correo electrónico
              </label>
              <div className="lg-input-wrap">
                <span className="lg-input-ic">{IconMail}</span>
                <input
                  id="rg-email"
                  type="email"
                  autoComplete="email"
                  className={`lg-input${error ? ' is-error' : ''}`}
                  placeholder="tucorreo@ejemplo.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    limpiarError()
                  }}
                  required
                />
              </div>
            </div>

            <div className="lg-field">
              <label className="lg-label" htmlFor="rg-pwd">
                Contraseña
              </label>
              <div className="lg-input-wrap">
                <span className="lg-input-ic">{IconLock}</span>
                <input
                  id="rg-pwd"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`lg-input pwd${error ? ' is-error' : ''}`}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    limpiarError()
                  }}
                  required
                />
                <button
                  type="button"
                  className="lg-eye"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? IconEyeOff : IconEye}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="lg-submit" disabled={submitting}>
            {submitting ? (
              <>
                Creando cuenta… <span className="lg-spinner" aria-hidden="true" />
              </>
            ) : (
              <>Crear cuenta {IconArrow}</>
            )}
          </button>

          <div className="lg-alt">
            ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
