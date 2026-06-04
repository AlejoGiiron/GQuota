import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import './login.css'

/* Íconos del login (SVG inline, trazo currentColor — del handoff Login V1). */
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
const IconShield = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
    <path d="M9 12l2 2 4-4" />
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
  'Cobros del día siempre a la mano',
  'Alertas de cuotas por vencer y en mora',
  'Tu ganancia del mes, clara y al instante',
]

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const limpiarError = () => {
    if (error) setError(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const { error: msg } = await signIn(email, password)
    if (msg) {
      setError(msg)
      toast.error(msg)
      setSubmitting(false)
      return
    }
    // Éxito: la guarda de ruta redirige al detectar la sesión.
  }

  const pendiente = () => toast('Esta opción estará disponible pronto.')

  return (
    <div className="lg">
      <aside className="lg-brand">
        <Logo size="lg" theme="dark" />
        <div className="lg-brand-body">
          <div className="lg-brand-eyebrow">Gestión de préstamos</div>
          <div className="lg-brand-head">
            Tu cartera, <em>ordenada</em> y bajo control.
          </div>
          <p className="lg-brand-sub">
            Clientes, cuotas y los cobros del día en un solo lugar. Sin cuadernos, sin enredos.
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
            <div className="lg-h1">Iniciar sesión</div>
            <p>Qué bueno verte de nuevo. Ingresa para ver tus cobros de hoy.</p>
          </div>

          <div className="lg-form-head">
            <div className="lg-h1">Iniciar sesión</div>
            <p>Qué bueno verte de nuevo. Ingresa para ver tus cobros de hoy.</p>
          </div>

          {error && (
            <div className="lg-alert" role="alert">
              <span className="ic">{IconAlert}</span>
              <p>{error}</p>
            </div>
          )}

          <div className="lg-fields">
            <div className="lg-field">
              <label className="lg-label" htmlFor="lg-email">
                Correo electrónico
              </label>
              <div className="lg-input-wrap">
                <span className="lg-input-ic">{IconMail}</span>
                <input
                  id="lg-email"
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
              <div className="lg-field-top">
                <label className="lg-label" htmlFor="lg-pwd">
                  Contraseña
                </label>
                <button type="button" className="lg-forgot" onClick={pendiente}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="lg-input-wrap">
                <span className="lg-input-ic">{IconLock}</span>
                <input
                  id="lg-pwd"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`lg-input pwd${error ? ' is-error' : ''}`}
                  placeholder="Tu contraseña"
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
                Ingresando… <span className="lg-spinner" aria-hidden="true" />
              </>
            ) : (
              <>Iniciar sesión {IconArrow}</>
            )}
          </button>

          <div className="lg-alt">
            ¿No tienes cuenta?{' '}
            <button type="button" onClick={pendiente}>
              Crear cuenta
            </button>
          </div>

          <div className="lg-secure">
            {IconShield} Conexión segura · tus datos están protegidos
          </div>
        </form>
      </div>
    </div>
  )
}
