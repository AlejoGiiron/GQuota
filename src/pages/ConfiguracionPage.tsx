import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { METODOS_PAGO, useConfiguracion } from '@/contexts/ConfiguracionContext'
import { supabase } from '@/lib/supabase'

export default function ConfiguracionPage() {
  const { user, signOut } = useAuth()
  const { negocio, loading, guardar, esDueno } = useConfiguracion()

  const [nombre, setNombre] = useState('')
  const [metodos, setMetodos] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  // Alta de cobradores (Fase 4A): el dueño crea la cuenta del cobrador con una
  // contraseña inicial. El usuario en Auth lo crea la Edge Function crear-cobrador
  // (necesita la service_role, que no puede vivir en el frontend).
  const [cobNombre, setCobNombre] = useState('')
  const [cobEmail, setCobEmail] = useState('')
  const [cobPassword, setCobPassword] = useState('')
  const [creandoCobrador, setCreandoCobrador] = useState(false)

  // Sincroniza el formulario cuando llega/ cambia el negocio.
  useEffect(() => {
    setNombre(negocio?.nombre ?? '')
    setMetodos(
      negocio?.metodos_pago && negocio.metodos_pago.length > 0
        ? negocio.metodos_pago
        : METODOS_PAGO.map((m) => m.valor),
    )
  }, [negocio])

  function toggleMetodo(valor: string) {
    setMetodos((prev) =>
      prev.includes(valor) ? prev.filter((v) => v !== valor) : [...prev, valor],
    )
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (metodos.length === 0) {
      toast.error('Activa al menos un método de pago.')
      return
    }
    setGuardando(true)
    const { error } = await guardar({
      nombre_negocio: nombre.trim() === '' ? null : nombre.trim(),
      // Conserva el orden del catálogo maestro.
      metodos_pago: METODOS_PAGO.map((m) => m.valor).filter((v) => metodos.includes(v)),
    })
    setGuardando(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Configuración guardada.')
  }

  async function handleCrearCobrador(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nombreCob = cobNombre.trim()
    const emailCob = cobEmail.trim()
    if (!nombreCob) {
      toast.error('Escribe el nombre del cobrador.')
      return
    }
    if (!emailCob.includes('@')) {
      toast.error('Escribe un correo válido.')
      return
    }
    if (cobPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setCreandoCobrador(true)
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
      'crear-cobrador',
      { body: { nombre: nombreCob, email: emailCob, password: cobPassword } },
    )
    setCreandoCobrador(false)
    // La Edge Function devuelve { error } con un mensaje ya seguro (genérico para
    // email duplicado, sin filtrar datos de otros negocios). Para respuestas no-2xx,
    // supabase-js entrega un FunctionsHttpError; el cuerpo está en error.context.
    if (error) {
      let mensaje = 'No pudimos crear el cobrador. Intenta de nuevo.'
      const contexto = (error as { context?: Response }).context
      if (contexto && typeof contexto.json === 'function') {
        try {
          const cuerpo = (await contexto.json()) as { error?: string }
          if (cuerpo?.error) mensaje = cuerpo.error
        } catch {
          // Sin cuerpo JSON: queda el mensaje genérico.
        }
      }
      toast.error(mensaje)
      return
    }
    if (data?.error) {
      toast.error(data.error)
      return
    }
    toast.success('Cobrador agregado.')
    setCobNombre('')
    setCobEmail('')
    setCobPassword('')
  }

  async function handleSignOut() {
    await signOut()
    toast.success('Sesión cerrada.')
  }

  // Configuración del negocio es solo del dueño; el cobrador no administra el negocio.
  if (!loading && !esDueno) {
    return <Navigate to="/cobros" replace />
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-text">Configuración</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Datos del negocio */}
        <section className="card p-5">
          <h2 className="text-sm font-bold text-text">Datos del negocio</h2>
          <p className="mt-1 text-xs text-text-2">
            El nombre del negocio aparece en el encabezado y en los comprobantes de pago.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <label htmlFor="cfg-nombre" className="text-[13px] font-semibold text-text-2">
              Nombre del negocio
            </label>
            <input
              id="cfg-nombre"
              className="input"
              placeholder="Ej. Préstamos La Confianza"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={loading}
            />
          </div>
        </section>

        {/* Métodos de pago */}
        <section className="card p-5">
          <h2 className="text-sm font-bold text-text">Métodos de pago</h2>
          <p className="mt-1 text-xs text-text-2">
            Activa los que usas. Son los que se ofrecen al registrar un pago.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {METODOS_PAGO.map((m) => {
              const activo = metodos.includes(m.valor)
              return (
                <label
                  key={m.valor}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    activo ? 'border-green bg-green-tint' : 'border-line bg-card hover:bg-bg'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-green"
                    checked={activo}
                    onChange={() => toggleMetodo(m.valor)}
                  />
                  <span className="text-sm font-semibold text-text">{m.label}</span>
                </label>
              )
            })}
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={guardando || loading}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      {/* Agregar cobrador (Fase 4A) — solo visible para el dueño (toda la página lo es). */}
      <form onSubmit={handleCrearCobrador} className="card flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-sm font-bold text-text">Agregar cobrador</h2>
          <p className="mt-1 text-xs text-text-2">
            Creas la cuenta del cobrador con una contraseña inicial. Podrá iniciar sesión con ese
            correo y esa contraseña, y ver solo los cobros de tu negocio.
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
            disabled={creandoCobrador}
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
            disabled={creandoCobrador}
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
            disabled={creandoCobrador}
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={creandoCobrador}>
            {creandoCobrador ? 'Creando…' : 'Agregar cobrador'}
          </button>
        </div>
      </form>

      {/* Perfil */}
      <section className="card flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-sm font-bold text-text">Perfil</h2>
          <p className="mt-1 text-sm text-text-2">{user?.email ?? 'Sin sesión'}</p>
        </div>
        <div>
          <button type="button" className="btn-destructive" onClick={handleSignOut}>
            Cerrar sesión
          </button>
        </div>
      </section>
    </div>
  )
}
