import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useConfiguracion, type Rol } from '@/contexts/ConfiguracionContext'
import { invocarEdge } from '@/lib/edge'

interface MiembroEquipo {
  id: string
  user_id: string
  nombre: string | null
  rol: Rol
  email: string | null
  es_yo: boolean
}

export default function EquipoPage() {
  const { loading: cargandoConfig, esDueno } = useConfiguracion()

  const [equipo, setEquipo] = useState<MiembroEquipo[] | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // Alta de cobrador (reubicada de Configuración: la gestión del equipo vive junta).
  const [cobNombre, setCobNombre] = useState('')
  const [cobEmail, setCobEmail] = useState('')
  const [cobPassword, setCobPassword] = useState('')
  const [creando, setCreando] = useState(false)

  // Acción puntual sobre un miembro (reset de clave / quitar).
  const [reseteando, setReseteando] = useState<MiembroEquipo | null>(null)
  const [nuevaClave, setNuevaClave] = useState('')
  const [guardandoClave, setGuardandoClave] = useState(false)
  const [quitando, setQuitando] = useState<MiembroEquipo | null>(null)

  const cargarEquipo = useCallback(async () => {
    setCargando(true)
    const { data, error } = await invocarEdge<{ equipo: MiembroEquipo[] }>('gestionar-equipo', {
      accion: 'listar',
    })
    if (error || !data) {
      setErrorCarga(error ?? 'No se pudo cargar el equipo.')
      setEquipo(null)
    } else {
      setErrorCarga(null)
      // Dueños primero, luego por nombre/email.
      const orden = [...data.equipo].sort((a, b) => {
        if (a.rol !== b.rol) return a.rol === 'dueno' ? -1 : 1
        return (a.nombre ?? a.email ?? '').localeCompare(b.nombre ?? b.email ?? '')
      })
      setEquipo(orden)
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    if (esDueno) void cargarEquipo()
  }, [esDueno, cargarEquipo])

  // La gestión del equipo es solo del dueño (la base también lo exige: 403).
  if (!cargandoConfig && !esDueno) {
    return <Navigate to="/cobros" replace />
  }

  async function handleCrear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nombre = cobNombre.trim()
    const email = cobEmail.trim()
    if (!nombre) return toast.error('Escribe el nombre del cobrador.')
    if (!email.includes('@')) return toast.error('Escribe un correo válido.')
    if (cobPassword.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres.')
    setCreando(true)
    const { error } = await invocarEdge('crear-cobrador', { nombre, email, password: cobPassword })
    setCreando(false)
    if (error) return toast.error(error)
    toast.success('Cobrador agregado.')
    setCobNombre('')
    setCobEmail('')
    setCobPassword('')
    void cargarEquipo()
  }

  async function handleResetear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!reseteando) return
    if (nuevaClave.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres.')
    setGuardandoClave(true)
    const { error } = await invocarEdge('gestionar-equipo', {
      accion: 'reset_password',
      miembro_id: reseteando.id,
      password: nuevaClave,
    })
    setGuardandoClave(false)
    if (error) return toast.error(error)
    toast.success(`Contraseña de ${reseteando.nombre ?? 'el cobrador'} actualizada.`)
    setReseteando(null)
    setNuevaClave('')
  }

  async function handleQuitar() {
    if (!quitando) return
    const { error } = await invocarEdge('gestionar-equipo', {
      accion: 'quitar',
      miembro_id: quitando.id,
    })
    if (error) {
      toast.error(error)
    } else {
      toast.success(`${quitando.nombre ?? 'El miembro'} fue quitado del equipo.`)
      void cargarEquipo()
    }
    setQuitando(null)
  }

  async function handleCambiarRol(m: MiembroEquipo) {
    const nuevo: Rol = m.rol === 'dueno' ? 'cobrador' : 'dueno'
    const { error } = await invocarEdge('gestionar-equipo', {
      accion: 'cambiar_rol',
      miembro_id: m.id,
      nuevo_rol: nuevo,
    })
    if (error) return toast.error(error)
    toast.success(`${m.nombre ?? 'El miembro'} ahora es ${nuevo === 'dueno' ? 'dueño' : 'cobrador'}.`)
    void cargarEquipo()
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-text">Equipo</h1>

      {/* Lista del equipo */}
      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-sm font-bold text-text">Miembros del negocio</h2>

        {cargando ? (
          <div className="flex flex-col gap-2">
            <div className="h-16 animate-pulse rounded-xl bg-bg" />
            <div className="h-16 animate-pulse rounded-xl bg-bg" />
          </div>
        ) : errorCarga ? (
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="text-sm text-text-2">{errorCarga}</p>
            <button type="button" className="btn-secondary" onClick={() => void cargarEquipo()}>
              Reintentar
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {equipo?.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-text">
                      {m.nombre ?? 'Sin nombre'}
                    </span>
                    <span
                      className={`badge ${m.rol === 'dueno' ? 'badge--pagado' : 'badge--porvenc'}`}
                    >
                      {m.rol === 'dueno' ? 'Dueño' : 'Cobrador'}
                    </span>
                    {m.es_yo && <span className="text-xs font-semibold text-muted">(Tú)</span>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-text-2">{m.email ?? '—'}</p>
                </div>

                {/* Sin acciones sobre uno mismo: no quitarse ni degradarse por accidente. */}
                {!m.es_yo && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setReseteando(m)
                        setNuevaClave('')
                      }}
                    >
                      Resetear clave
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void handleCambiarRol(m)}
                    >
                      {m.rol === 'dueno' ? 'Hacer cobrador' : 'Hacer dueño'}
                    </button>
                    <button
                      type="button"
                      className="btn-destructive"
                      onClick={() => setQuitando(m)}
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Agregar cobrador */}
      <form onSubmit={handleCrear} className="card flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-sm font-bold text-text">Agregar cobrador</h2>
          <p className="mt-1 text-xs text-text-2">
            Creas la cuenta con una contraseña inicial. El cobrador entra con ese correo y esa
            contraseña, y ve solo los cobros de tu negocio.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="cob-nombre" className="text-[13px] font-semibold text-text-2">
            Nombre
          </label>
          <input
            id="cob-nombre"
            className="input"
            placeholder="Ej. Luis Pérez"
            value={cobNombre}
            onChange={(e) => setCobNombre(e.target.value)}
            disabled={creando}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="cob-email" className="text-[13px] font-semibold text-text-2">
            Correo
          </label>
          <input
            id="cob-email"
            type="email"
            autoComplete="off"
            className="input"
            placeholder="cobrador@ejemplo.com"
            value={cobEmail}
            onChange={(e) => setCobEmail(e.target.value)}
            disabled={creando}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="cob-password" className="text-[13px] font-semibold text-text-2">
            Contraseña inicial
          </label>
          <input
            id="cob-password"
            type="text"
            autoComplete="new-password"
            className="input"
            placeholder="Mínimo 6 caracteres"
            value={cobPassword}
            onChange={(e) => setCobPassword(e.target.value)}
            disabled={creando}
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={creando}>
            {creando ? 'Creando…' : 'Agregar cobrador'}
          </button>
        </div>
      </form>

      {/* Modal: resetear contraseña */}
      <Modal
        open={reseteando !== null}
        onClose={() => setReseteando(null)}
        titulo="Resetear contraseña"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setReseteando(null)}
              disabled={guardandoClave}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-reset-clave"
              className="btn-primary"
              disabled={guardandoClave}
            >
              {guardandoClave ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </>
        }
      >
        <form id="form-reset-clave" onSubmit={handleResetear} className="flex flex-col gap-3">
          <p className="text-sm text-text-2">
            Defines una contraseña nueva para{' '}
            <span className="font-semibold text-text">{reseteando?.nombre ?? 'el cobrador'}</span>.
            Compártesela; con ella podrá iniciar sesión.
          </p>
          <input
            type="text"
            autoComplete="new-password"
            className="input"
            placeholder="Nueva contraseña (mínimo 6)"
            value={nuevaClave}
            onChange={(e) => setNuevaClave(e.target.value)}
            disabled={guardandoClave}
          />
        </form>
      </Modal>

      {/* Confirmación: quitar miembro */}
      <ConfirmDialog
        open={quitando !== null}
        titulo="Quitar del equipo"
        mensaje={`¿Quitar a ${
          quitando?.nombre ?? 'este miembro'
        } del negocio? Dejará de tener acceso. Su historial de pagos se conserva.`}
        textoConfirmar="Quitar"
        onConfirmar={handleQuitar}
        onCancelar={() => setQuitando(null)}
      />
    </div>
  )
}
