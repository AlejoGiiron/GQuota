import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useConfiguracion } from '@/contexts/ConfiguracionContext'

/**
 * Clave en sessionStorage donde el registro deja el nombre del negocio elegido.
 * El registro solo hace signUp (Auth); apenas hay sesión, esta pantalla aterriza
 * y CREA el negocio con ese nombre. Así una sola pantalla es dueña de la creación
 * (automática tras el registro, manual en la recuperación) y el flujo no depende
 * de orquestar dos llamadas en una página que se desmonta al aparecer la sesión.
 */
export const NOMBRE_NEGOCIO_PENDIENTE = 'gquota:nombre-negocio-pendiente'

/**
 * Pantalla "sin negocio". Se muestra a un usuario CON sesión pero sin negocio:
 *   - Recién registrado: crea su negocio automáticamente con el nombre pendiente.
 *   - Registro a medias (signUp OK pero la creación falló): reintenta a mano sin
 *     quedar trabado (crear_mi_negocio es seguro de repetir: solo crea si aún no
 *     hay membresía).
 *   - Caso raro: un cobrador al que le quitaron el acceso (membresía inactiva);
 *     para él crear_mi_negocio responde 'Ya perteneces a un negocio.' y puede salir.
 *
 * No expone datos de ningún negocio (no hay ninguno): es un formulario aislado.
 */
export default function SinNegocioPage() {
  const { user, signOut } = useAuth()
  const { crearNegocio } = useConfiguracion()
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const autoIntentado = useRef(false)

  async function crear(nombreNegocio: string) {
    setGuardando(true)
    const { error } = await crearNegocio(nombreNegocio)
    setGuardando(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('¡Listo! Tu negocio está creado.')
    // Al refrescar el contexto, negocio deja de ser null y RequiereNegocio
    // renderiza la app. No hace falta navegar.
  }

  // Creación automática tras el registro: toma el nombre pendiente UNA sola vez.
  // Se lee y se borra de inmediato (síncrono) para que el doble montaje de
  // StrictMode en dev no dispare dos creaciones.
  useEffect(() => {
    if (autoIntentado.current) return
    autoIntentado.current = true
    const pendiente = sessionStorage.getItem(NOMBRE_NEGOCIO_PENDIENTE)
    if (pendiente) {
      sessionStorage.removeItem(NOMBRE_NEGOCIO_PENDIENTE)
      void crear(pendiente)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!nombre.trim()) return toast.error('Escribe el nombre de tu negocio.')
    await crear(nombre)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="grid h-[38px] w-[38px] place-items-center rounded-[11px] bg-gradient-to-br from-[#10b981] to-green text-[19px] font-extrabold text-white shadow-[0_4px_12px_rgba(4,120,87,0.35)]">
            G
          </div>
          <div className="text-xl font-extrabold tracking-tight text-text">
            G<span className="text-green">·</span>Quota
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card flex flex-col gap-4 p-6">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-text">Crea tu negocio</h1>
            <p className="mt-1.5 text-sm text-text-2">
              Tu cuenta ya está lista. Ponle un nombre a tu negocio para empezar a llevar tus
              clientes y préstamos.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="sn-nombre" className="text-[13px] font-semibold text-text-2">
              Nombre del negocio
            </label>
            <input
              id="sn-nombre"
              className="input"
              placeholder="Ej. Préstamos Don Luis"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={guardando}
              autoFocus
            />
          </div>

          <button type="submit" className="btn-primary w-full justify-center" disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear negocio'}
          </button>

          <div className="flex items-center justify-between border-t border-line-soft pt-3 text-xs text-muted">
            <span className="truncate">{user?.email}</span>
            <button
              type="button"
              className="shrink-0 font-semibold text-text-2 hover:text-text"
              onClick={() => void signOut()}
            >
              Cerrar sesión
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
