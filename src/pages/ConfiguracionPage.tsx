import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { METODOS_PAGO, useConfiguracion } from '@/contexts/ConfiguracionContext'

export default function ConfiguracionPage() {
  const { user, signOut } = useAuth()
  const { configuracion, loading, guardar } = useConfiguracion()

  const [nombre, setNombre] = useState('')
  const [metodos, setMetodos] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  // Sincroniza el formulario cuando llega/ cambia la config.
  useEffect(() => {
    setNombre(configuracion?.nombre_negocio ?? '')
    setMetodos(
      configuracion?.metodos_pago && configuracion.metodos_pago.length > 0
        ? configuracion.metodos_pago
        : METODOS_PAGO.map((m) => m.valor),
    )
  }, [configuracion])

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

  async function handleSignOut() {
    await signOut()
    toast.success('Sesión cerrada.')
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
