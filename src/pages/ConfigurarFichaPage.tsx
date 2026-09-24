import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import Boton from '@/components/ui/Boton'
import ControlSegmentado from '@/components/ui/ControlSegmentado'
import { useConfiguracion } from '@/contexts/ConfiguracionContext'
import { supabase } from '@/lib/supabase'
import {
  FICHA_POR_DEFECTO,
  SECCIONES_FICHA,
  aplicarReglas,
  bloqueo,
  contarModos,
  leerFicha,
  mismaFicha,
  modosPermitidos,
  pasosFormulario,
  type CampoFicha,
  type FichaConfig,
  type ModoCampo,
} from '@/lib/ficha'

const OPCIONES_MODO: ReadonlyArray<{ valor: ModoCampo; etiqueta: string }> = [
  { valor: 'apagado', etiqueta: 'Apagado' },
  { valor: 'opcional', etiqueta: 'Opcional' },
  { valor: 'obligatorio', etiqueta: 'Obligatorio' },
]

const IconoCandado = (
  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="1.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
)
const IconoInfo = (
  <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8v.01" />
  </svg>
)

/** Configurar la ficha (solo dueño): qué datos se le piden al prospecto. Aplica a los enlaces nuevos. */
export default function ConfigurarFichaPage() {
  const { loading: cargandoConfig, esDueno, negocio, refrescar, solicitudesActivas } = useConfiguracion()
  const guardada = useMemo(() => leerFicha(negocio?.ficha_config), [negocio?.ficha_config])
  const [config, setConfig] = useState<FichaConfig>(guardada)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => setConfig(guardada), [guardada])

  if (!cargandoConfig && (!esDueno || !solicitudesActivas)) return <Navigate to={esDueno ? '/' : '/cobros'} replace />

  const hayCambios = !mismaFicha(config, guardada)
  const n = contarModos(config)
  const pasos = pasosFormulario(config)

  const cambiar = (campo: CampoFicha, modo: ModoCampo) =>
    setConfig((c) => aplicarReglas({ ...c, campos: { ...c.campos, [campo]: modo } }))
  // Activar la lectura necesita la foto del respaldo: si estaba apagada, pasa a opcional.
  // (Apagar el respaldo apaga la lectura: lo hace aplicarReglas.)
  const cambiarLectura = (activa: boolean) =>
    setConfig((c) =>
      aplicarReglas({
        ...c,
        lectura_automatica: activa,
        campos: activa && c.campos.cedula_reverso === 'apagado' ? { ...c.campos, cedula_reverso: 'opcional' } : c.campos,
      }),
    )

  async function guardar() {
    if (!negocio) return
    setGuardando(true)
    const { error } = await supabase.from('negocios').update({ ficha_config: config }).eq('id', negocio.id)
    setGuardando(false)
    if (error) {
      toast.error('No pudimos guardar la ficha. Intente de nuevo.')
      return
    }
    await refrescar()
    toast.success('Ficha guardada. Aplica a los enlaces nuevos.')
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <nav aria-label="Ruta" className="text-[13px] text-tinta-3">
            <Link to="/solicitudes" className="font-semibold text-marca-texto hover:underline">
              Solicitudes
            </Link>
            <span aria-hidden="true"> / </span>
            <span>Configurar la ficha</span>
          </nav>
          <h1 className="mt-1 text-xl font-semibold">Configurar la ficha</h1>
          <p className="mt-0.5 text-[13px] text-tinta-3">
            Elija qué datos le pide a cada prospecto. Aplica a los enlaces nuevos.
          </p>
        </div>
        <div className="flex gap-2">
          <Boton
            variante="secundario"
            className="flex-1 md:flex-none"
            onClick={() => setConfig(FICHA_POR_DEFECTO)}
            disabled={mismaFicha(config, FICHA_POR_DEFECTO)}
          >
            Restablecer
          </Boton>
          <Boton className="flex-1 md:flex-none" onClick={guardar} disabled={!hayCambios || guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Datos y cómo se piden */}
        <section className="tarjeta overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-borde bg-superficie-2 px-5 py-2.5 text-[12.5px] font-semibold text-tinta-3 md:grid">
            <span>Dato</span>
            <span>Se pide</span>
          </div>
          {SECCIONES_FICHA.map((s) => (
            <div key={s.id} className="border-b border-borde last:border-b-0">
              <div className="flex items-baseline gap-2 px-5 pb-1 pt-4">
                <h2 className="text-base font-semibold">{s.titulo}</h2>
                <span className="text-[12.5px] text-tinta-3">{s.nota}</span>
              </div>
              {s.id === 'fotos' && (
                <FilaDato
                  nombre="Lectura automática"
                  detalle="Lee número, nombres, apellidos y fecha de nacimiento del código de barras del respaldo, si el prospecto autoriza esa foto"
                >
                  <ControlSegmentado
                    etiquetaAccesible="Lectura automática"
                    valor={config.lectura_automatica ? 'activa' : 'apagada'}
                    alCambiar={(v) => cambiarLectura(v === 'activa')}
                    opciones={[
                      { valor: 'apagada', etiqueta: 'Apagada' },
                      { valor: 'activa', etiqueta: 'Activa' },
                    ]}
                  />
                </FilaDato>
              )}
              {s.filas.map((f) => {
                const motivo = bloqueo(config, f.campo)
                const detalle = f.detalle
                return (
                  <FilaDato key={f.campo} nombre={f.nombre} detalle={detalle} apagado={config.campos[f.campo] === 'apagado'}>
                    {motivo ? (
                      <span className="inline-flex h-9 items-center gap-1.5 text-[13px] font-semibold text-tinta-2">
                        {IconoCandado}
                        {motivo}
                      </span>
                    ) : (
                      <ControlSegmentado
                        etiquetaAccesible={f.nombre}
                        valor={config.campos[f.campo]}
                        alCambiar={(m) => cambiar(f.campo, m)}
                        opciones={OPCIONES_MODO.filter((o) => modosPermitidos(f.campo).includes(o.valor))}
                      />
                    )}
                  </FilaDato>
                )
              })}
            </div>
          ))}
        </section>

        {/* Vista previa */}
        <aside className="tarjeta flex flex-col gap-4 p-5 lg:sticky lg:top-0">
          <h2 className="text-base font-semibold">Lo que llena el prospecto</h2>
          <ol className="flex flex-col gap-3">
            {pasos.map((p) => (
              <li key={p.titulo} className="flex items-start gap-3">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[13px] font-semibold cifra ${
                    p.numero ? 'border-tinta bg-tinta text-white' : 'border-borde-control bg-superficie text-tinta-3'
                  }`}
                  aria-hidden="true"
                >
                  {p.numero ?? '–'}
                </span>
                <div className={p.numero ? '' : 'text-tinta-3'}>
                  <div className="text-[14.5px] font-semibold">{p.titulo}</div>
                  <div className="text-[13px] text-tinta-3">{p.detalle}</div>
                </div>
              </li>
            ))}
          </ol>
          <dl className="grid grid-cols-3 overflow-hidden rounded-tarjeta border border-borde text-center">
            {(
              [
                ['Obligatorios', n.obligatorio],
                ['Opcionales', n.opcional],
                ['Apagados', n.apagado],
              ] as const
            ).map(([t, v], i) => (
              <div key={t} className={`px-2 py-2.5 ${i > 0 ? 'border-l border-borde' : ''}`}>
                <dt className="text-xs text-tinta-3">{t}</dt>
                <dd className="cifra text-lg font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {!config.lectura_automatica && (
            <p className="flex items-start gap-2 rounded-control bg-estado-parcial-fondo px-3 py-2.5 text-[13px] text-estado-parcial">
              {IconoInfo}
              <span>
                Con la lectura apagada, el prospecto escribe número, nombres, apellidos y fecha de nacimiento a mano. En la
                revisión salen como «Escrito a mano · sin verificar».
              </span>
            </p>
          )}
          <p className="text-[13px] text-tinta-3">
            La autorización de tratamiento de datos siempre se pide y no se puede apagar.
          </p>
        </aside>
      </div>
    </div>
  )
}

function FilaDato({
  nombre,
  detalle,
  apagado = false,
  children,
}: {
  nombre: string
  detalle?: string
  apagado?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-borde-fila px-5 py-3 first:border-t-0 md:flex-row md:items-center md:justify-between md:gap-4">
      <div className="min-w-0">
        <div className={`text-[14.5px] font-medium ${apagado ? 'text-tinta-3' : ''}`}>{nombre}</div>
        {detalle && <div className="text-[13px] text-tinta-3">{detalle}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
