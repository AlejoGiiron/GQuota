import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import CampoFicha from '@/components/ficha/CampoFicha'
import FotoFicha, { type EstadoFoto } from '@/components/ficha/FotoFicha'
import MarcoFicha from '@/components/ficha/MarcoFicha'
import Boton from '@/components/ui/Boton'
import Campo from '@/components/ui/Campo'
import ControlSegmentado from '@/components/ui/ControlSegmentado'
import { VERSION_AUTORIZACION, autorizacionV1 } from '@/legal/autorizacion'
import type { CamposCedula } from '@/lib/cedula'
import {
  CAMPOS_LEIBLES,
  campoActivo,
  leerFicha,
  validarCampo,
  validarReferencia,
  type CampoLeible,
  type CampoTexto,
  type DatosFicha,
  type FichaConfig,
  type Origen,
  type OrigenFicha,
  type Referencia,
} from '@/lib/ficha'
import { ErrorDeRed, abrirFicha, enviarFicha, subirFoto, type FotoFicha as NombreFoto } from '@/lib/ficha-publica'
import { comprimirFoto } from '@/lib/imagen'
import { leerCedulaDeFoto } from '@/lib/lector-cedula'
import { formatearCelular, hora } from '@/lib/solicitudes'
import { fmtCOP } from '@/lib/formatters'

type Paso = 'autorizacion' | 'fotos' | 'datos' | 'vivienda' | 'trabajo' | 'referencias' | 'revisar'
type Negocio = { nombre: string; contacto_datos: string }
type Pantalla =
  | { tipo: 'cargando' }
  | { tipo: 'no_disponible' }
  | { tipo: 'error' }
  | { tipo: 'formulario'; negocio: Negocio; ficha: FichaConfig; expiraEn: string }
  | { tipo: 'enviada'; negocio: Negocio; yaEstaba?: boolean }

const ETIQUETA: Record<CampoTexto, string> = {
  cedula: 'Número de cédula',
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  fecha_nacimiento: 'Fecha de nacimiento',
  telefono_alterno: 'Teléfono alterno',
  correo: 'Correo',
  direccion_casa: 'Dirección de la casa',
  barrio: 'Barrio',
  ciudad: 'Ciudad',
  tipo_vivienda: 'Tipo de vivienda',
  tiempo_vivienda: 'Tiempo en la vivienda',
  ocupacion: 'Ocupación',
  negocio_empresa: 'Negocio o empresa',
  direccion_trabajo: 'Dirección del trabajo',
  ingresos: 'Ingresos aproximados al mes',
}
const ATRIBUTOS: Partial<Record<CampoTexto, Record<string, string>>> = {
  cedula: { inputMode: 'numeric', autoComplete: 'off' },
  nombres: { autoComplete: 'given-name' },
  apellidos: { autoComplete: 'family-name' },
  fecha_nacimiento: { type: 'date' },
  telefono_alterno: { inputMode: 'tel', autoComplete: 'tel' },
  correo: { type: 'email', inputMode: 'email', autoComplete: 'email' },
  ingresos: { inputMode: 'numeric', placeholder: '1800000' },
  tiempo_vivienda: { placeholder: '3 años' },
}
const CAMPOS_PASO: Record<'datos' | 'vivienda' | 'trabajo', CampoTexto[]> = {
  datos: ['cedula', 'nombres', 'apellidos', 'fecha_nacimiento', 'telefono_alterno', 'correo'],
  vivienda: ['direccion_casa', 'barrio', 'ciudad', 'tipo_vivienda', 'tiempo_vivienda'],
  trabajo: ['ocupacion', 'negocio_empresa', 'direccion_trabajo', 'ingresos'],
}
const TITULO: Record<Paso, string> = {
  autorizacion: 'Antes de empezar',
  fotos: 'Fotos de su cédula',
  datos: 'Sus datos',
  vivienda: '¿Dónde vive?',
  trabajo: '¿A qué se dedica?',
  referencias: 'Personas que lo conozcan',
  revisar: 'Revise y envíe',
}

const VACIA: EstadoFoto = { estado: 'vacia' }
const REF_VACIA: Partial<Referencia> = { nombre: '', telefono: '', parentesco: '' }

function venceCorto(expiraEn: string): string {
  const d = new Date(expiraEn)
  const hoy = new Date()
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((dia(d) - dia(hoy)) / 86_400_000)
  return `Vence ${dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : d.toLocaleDateString('es-CO')}, ${hora(d)}`
}

/** Evita que buscadores indexen el enlace y que el token viaje en el Referer. */
function useMetaPrivada() {
  useEffect(() => {
    const metas = [
      ['robots', 'noindex, nofollow'],
      ['referrer', 'no-referrer'],
    ].map(([name, content]) => {
      const m = document.createElement('meta')
      m.name = name
      m.content = content
      document.head.appendChild(m)
      return m
    })
    document.title = 'Solicitud de préstamo'
    return () => metas.forEach((m) => m.remove())
  }, [])
}

/**
 * Formulario del prospecto (ruta pública /s/:token, sin sesión). Solo habla con
 * el backend por la Edge Function ficha-publica (src/lib/ficha-publica.ts).
 */
export default function FichaPublicaPage() {
  const { token = '' } = useParams()
  const [pantalla, setPantalla] = useState<Pantalla>({ tipo: 'cargando' })
  useMetaPrivada()

  const cargar = useCallback(async () => {
    setPantalla({ tipo: 'cargando' })
    try {
      const r = await abrirFicha(token)
      if (r.estado === 'activa') setPantalla({ tipo: 'formulario', negocio: r.negocio, ficha: leerFicha(r.ficha), expiraEn: r.expira_en })
      else setPantalla({ tipo: 'no_disponible' })
    } catch {
      setPantalla({ tipo: 'error' })
    }
  }, [token])

  useEffect(() => {
    void cargar()
  }, [cargar])

  if (pantalla.tipo === 'cargando') {
    return (
      <MarcoFicha negocio={null}>
        <div className="flex flex-1 items-center justify-center" role="status" aria-label="Abriendo el enlace">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-borde border-t-marca" />
        </div>
      </MarcoFicha>
    )
  }
  if (pantalla.tipo === 'error') {
    return (
      <MarcoFicha negocio={null}>
        <Aviso titulo="No pudimos abrir el enlace">Revise su conexión e intente de nuevo.</Aviso>
        <Boton variante="secundario" grande onClick={() => void cargar()}>
          Intentar de nuevo
        </Boton>
      </MarcoFicha>
    )
  }
  if (pantalla.tipo === 'no_disponible') {
    return (
      <MarcoFicha negocio={null}>
        <Aviso titulo="Este enlace ya no está disponible">
          Si necesita llenar su solicitud, pídale un enlace nuevo a quien se lo envió.
        </Aviso>
      </MarcoFicha>
    )
  }
  if (pantalla.tipo === 'enviada') {
    return (
      <MarcoFicha negocio={pantalla.negocio.nombre}>
        <Aviso titulo={pantalla.yaEstaba ? 'Su solicitud ya se había enviado' : 'Sus datos llegaron'} exito>
          {pantalla.negocio.nombre} va a revisar su solicitud y le escribirá. Este enlace ya quedó usado. Si necesita cambiar
          algo, escriba a {pantalla.negocio.contacto_datos}.
        </Aviso>
      </MarcoFicha>
    )
  }
  return (
    <Formulario
      token={token}
      negocio={pantalla.negocio}
      ficha={pantalla.ficha}
      expiraEn={pantalla.expiraEn}
      alTerminar={(yaEstaba) => setPantalla({ tipo: 'enviada', negocio: pantalla.negocio, yaEstaba })}
      alPerderEnlace={() => setPantalla({ tipo: 'no_disponible' })}
    />
  )
}

function Aviso({ titulo, exito = false, children }: { titulo: string; exito?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
      <div
        className={`grid h-14 w-14 place-items-center rounded-full ${exito ? 'bg-estado-al-dia-fondo text-estado-al-dia' : 'bg-superficie-2 text-tinta-2'}`}
      >
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={exito ? 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17ZM8 12.3l2.7 2.7L16 9.6' : 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17ZM12 7.5V12l3 2'} />
        </svg>
      </div>
      <h1 className="text-xl font-semibold">{titulo}</h1>
      <p className="max-w-xs text-[14.5px] leading-relaxed text-tinta-2">{children}</p>
    </div>
  )
}

function Formulario({
  token,
  negocio,
  ficha,
  expiraEn,
  alTerminar,
  alPerderEnlace,
}: {
  token: string
  negocio: Negocio
  ficha: FichaConfig
  expiraEn: string
  alTerminar: (yaEstaba: boolean) => void
  alPerderEnlace: () => void
}) {
  const activo = (c: Parameters<typeof campoActivo>[1]) => campoActivo(ficha, c)
  const pideRespaldo = activo('cedula_reverso')
  const pideFachada = activo('foto_fachada')
  const texto = useMemo(() => autorizacionV1(negocio.nombre, negocio.contacto_datos, pideFachada), [negocio, pideFachada])

  const pasos = useMemo<Paso[]>(() => {
    const p: Paso[] = ['autorizacion', 'fotos', 'datos']
    if (CAMPOS_PASO.vivienda.some(activo)) p.push('vivienda')
    if (CAMPOS_PASO.trabajo.some(activo) || pideFachada) p.push('trabajo')
    if (activo('referencia_1') || activo('referencia_2')) p.push('referencias')
    p.push('revisar')
    return p
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficha])

  const [indice, setIndice] = useState(0)
  const paso = pasos[indice]
  const [autorizaDatos, setAutorizaDatos] = useState(false)
  const [autorizaRespaldo, setAutorizaRespaldo] = useState(false)
  const [valores, setValores] = useState<Partial<Record<CampoTexto, string>>>({})
  const [referencias, setReferencias] = useState<Record<'referencia_1' | 'referencia_2', Partial<Referencia>>>({
    referencia_1: REF_VACIA,
    referencia_2: REF_VACIA,
  })
  const [leidos, setLeidos] = useState<CamposCedula | null>(null)
  const [origen, setOrigen] = useState<Partial<Record<CampoLeible, Origen>>>({})
  const [fotos, setFotos] = useState<Record<NombreFoto, EstadoFoto>>({ frente: VACIA, respaldo: VACIA, fachada: VACIA })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const huboErrorDeRed = useRef(false)
  const vistas = useRef<string[]>([])
  useEffect(() => () => vistas.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const setFoto = (f: NombreFoto, e: EstadoFoto) => setFotos((x) => ({ ...x, [f]: e }))

  /** Lee (si es el respaldo), comprime y sube. Ningún error de lectura bloquea. */
  async function tomarFoto(nombre: NombreFoto, archivo: File) {
    let campos: CamposCedula | null = null
    if (nombre === 'respaldo' && ficha.lectura_automatica) {
      setFoto(nombre, { estado: 'procesando', mensaje: 'Leyendo el código de barras…' })
      campos = await leerCedulaDeFoto(archivo) // a resolución completa, antes de comprimir
    }
    setFoto(nombre, { estado: 'procesando', mensaje: 'Subiendo la foto…' })
    try {
      const comprimida = await comprimirFoto(archivo)
      await subirFoto(token, nombre, comprimida, autorizaRespaldo)
      const vista = URL.createObjectURL(comprimida)
      vistas.current.push(vista)
      let nota: string | undefined
      if (nombre === 'respaldo' && ficha.lectura_automatica) {
        nota = campos ? 'Lista · leímos sus datos' : 'Lista · no pudimos leer el código: escribirá sus datos'
        aplicarLectura(campos)
      }
      setFoto(nombre, { estado: 'lista', vistaPrevia: vista, nota })
    } catch (e) {
      setFoto(nombre, {
        estado: 'error',
        mensaje: e instanceof ErrorDeRed ? 'Sin conexión. Tome la foto otra vez.' : 'No se pudo subir. Tome la foto otra vez.',
      })
    }
  }

  /** Prellena lo leído. Solo pisa lo que estaba vacío o también venía de la cédula. */
  function aplicarLectura(campos: CamposCedula | null) {
    setLeidos(campos)
    if (!campos) {
      setOrigen((o) => Object.fromEntries(Object.entries(o).map(([k]) => [k, 'manual'])) as typeof o)
      return
    }
    const nuevosValores: Partial<Record<CampoTexto, string>> = {}
    const nuevoOrigen: Partial<Record<CampoLeible, Origen>> = {}
    for (const c of CAMPOS_LEIBLES) {
      const v = campos[c]
      if (!v || !activo(c)) continue
      if (!valores[c] || origen[c] === 'cedula') {
        nuevosValores[c] = v
        nuevoOrigen[c] = 'cedula'
      }
    }
    setValores((x) => ({ ...x, ...nuevosValores }))
    setOrigen((o) => ({ ...o, ...nuevoOrigen }))
  }

  function cambiar(campo: CampoTexto, v: string) {
    setValores((x) => ({ ...x, [campo]: v }))
    setErrores((e) => sinClave(e, campo))
    if ((CAMPOS_LEIBLES as ReadonlyArray<string>).includes(campo)) {
      const c = campo as CampoLeible
      // Si lo edita, pasa a manual (salvo que vuelva a dejar exactamente lo leído).
      setOrigen((o) => ({ ...o, [c]: leidos?.[c] && v.trim() === leidos[c] ? 'cedula' : 'manual' }))
    }
  }

  function erroresDe(p: Paso): Record<string, string> {
    const e: Record<string, string> = {}
    if (p === 'autorizacion' && !autorizaDatos) e.autorizacion = 'Para continuar, marque la autorización de datos personales.'
    if (p === 'fotos') {
      if (fotos.frente.estado !== 'lista') e.cedula_frente = 'Falta la foto de la cédula por delante.'
      if (fotos.frente.estado === 'procesando' || fotos.respaldo.estado === 'procesando') e.fotos = 'Espere a que terminen de subir las fotos.'
    }
    if (p === 'datos' || p === 'vivienda' || p === 'trabajo') {
      for (const c of CAMPOS_PASO[p]) {
        if (!activo(c)) continue
        const [valor, error] = validarCampo(c, valores[c] ?? '')
        if (error) e[c] = error
        else if (!valor && ficha.campos[c] === 'obligatorio') e[c] = 'Este dato es obligatorio.'
      }
      if (p === 'trabajo' && pideFachada) {
        if (fotos.fachada.estado === 'procesando') e.foto_fachada = 'Espere a que termine de subir la foto.'
        else if (ficha.campos.foto_fachada === 'obligatorio' && fotos.fachada.estado !== 'lista') e.foto_fachada = 'Falta la foto de la fachada.'
      }
    }
    if (p === 'referencias') {
      for (const r of ['referencia_1', 'referencia_2'] as const) {
        if (!activo(r)) continue
        const cruda = referencias[r]
        const vacia = !cruda.nombre?.trim() && !cruda.telefono?.trim() && !cruda.parentesco?.trim()
        if (vacia && ficha.campos[r] !== 'obligatorio') continue
        const [, errs] = validarReferencia(cruda)
        for (const [k, msg] of Object.entries(errs)) e[`${r}.${k}`] = msg
      }
    }
    return e
  }

  function continuar() {
    const e = erroresDe(paso)
    setErrores(e)
    if (Object.keys(e).length) return
    setIndice((i) => Math.min(i + 1, pasos.length - 1))
    window.scrollTo(0, 0)
  }

  function irA(p: Paso) {
    setIndice(pasos.indexOf(p))
    window.scrollTo(0, 0)
  }

  async function enviar() {
    // Revalida todo antes de enviar; el servidor vuelve a validar.
    for (const p of pasos) {
      const e = erroresDe(p)
      if (Object.keys(e).length) {
        setErrores(e)
        irA(p)
        return
      }
    }
    const datos: DatosFicha = {}
    for (const c of Object.keys(ETIQUETA) as CampoTexto[]) {
      const v = valores[c]?.trim()
      if (v && activo(c)) (datos as Record<string, string>)[c] = v
    }
    for (const r of ['referencia_1', 'referencia_2'] as const) {
      const [ref] = validarReferencia(referencias[r])
      if (ref && activo(r)) datos[r] = ref
    }
    const origenEnvio: OrigenFicha = { ...origen }
    const respaldoListo = fotos.respaldo.estado === 'lista' && autorizaRespaldo
    if (leidos && respaldoListo) {
      if (leidos.sexo) { datos.sexo = leidos.sexo; origenEnvio.sexo = 'cedula' }
      if (leidos.rh) { datos.rh = leidos.rh; origenEnvio.rh = 'cedula' }
    }
    setEnviando(true)
    try {
      const r = await enviarFicha(token, {
        autorizacion: { version: VERSION_AUTORIZACION, datos: true, respaldo: respaldoListo },
        datos,
        origen: origenEnvio,
      })
      if (r.estado === 'enviada') alTerminar(false)
      else if (r.estado === 'invalida') {
        setErrores(r.errores)
        const primero = pasos.find((p) => Object.keys(r.errores).some((k) => pertenece(k, p)))
        if (primero) irA(primero)
      } else if (huboErrorDeRed.current) alTerminar(true) // el envío anterior sí había llegado
      else alPerderEnlace()
    } catch (e) {
      if (e instanceof ErrorDeRed) huboErrorDeRed.current = true
      setErrores({ envio: 'No pudimos confirmar el envío. Revise su conexión e intente de nuevo.' })
    } finally {
      setEnviando(false)
    }
  }

  const numero = indice + 1
  const acciones = (
    <>
      {indice > 0 && (
        <Boton variante="secundario" grande className="flex-1" onClick={() => irA(pasos[indice - 1])} disabled={enviando}>
          Atrás
        </Boton>
      )}
      {paso === 'revisar' ? (
        <Boton grande className="flex-[2]" onClick={() => void enviar()} disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar solicitud'}
        </Boton>
      ) : (
        <Boton grande className="flex-[2]" onClick={continuar}>
          Continuar
        </Boton>
      )}
    </>
  )

  const campo = (c: CampoTexto) =>
    activo(c) && (
      <CampoFicha
        key={c}
        etiqueta={ETIQUETA[c]}
        opcional={ficha.campos[c] === 'opcional'}
        valor={valores[c] ?? ''}
        alCambiar={(v) => cambiar(c, v)}
        error={errores[c]}
        origen={(CAMPOS_LEIBLES as ReadonlyArray<string>).includes(c) && (valores[c] ?? '') !== '' ? origen[c as CampoLeible] ?? 'manual' : undefined}
        {...ATRIBUTOS[c]}
      />
    )

  return (
    <MarcoFicha negocio={negocio.nombre} avance={`Paso ${numero} de ${pasos.length} · ${venceCorto(expiraEn)}`} acciones={acciones}>
      <h1 className="text-[22px] font-semibold">{TITULO[paso]}</h1>
      {errores.envio && <p className="mt-3 rounded-control bg-estado-mora-fondo px-3 py-2.5 text-sm text-estado-mora">{errores.envio}</p>}

      {paso === 'autorizacion' && (
        <div className="mt-2 flex flex-col gap-4">
          <p className="text-[14.5px] leading-relaxed text-tinta-2">
            {negocio.nombre} le pide algunos datos para estudiar su solicitud de préstamo. Le toma unos 5 minutos. Primero,
            su autorización:
          </p>
          <div className="flex flex-col gap-2 rounded-tarjeta border border-borde bg-superficie-2 p-3.5 text-[13.5px] leading-relaxed text-tinta-2">
            {texto.datos.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <Casilla marcada={autorizaDatos} alCambiar={(v) => { setAutorizaDatos(v); setErrores({}) }} error={errores.autorizacion}>
            <strong className="font-semibold text-tinta">Autorizo el tratamiento de mis datos personales.</strong> Es obligatorio para
            continuar.
          </Casilla>
          {pideRespaldo && (
            <Casilla marcada={autorizaRespaldo} alCambiar={setAutorizaRespaldo}>
              <strong className="font-semibold text-tinta">Opcional: autorizo la foto de mi cédula por detrás.</strong> {texto.respaldo}
            </Casilla>
          )}
          <p className="text-xs text-tinta-3">Autorización versión {VERSION_AUTORIZACION}.</p>
        </div>
      )}

      {paso === 'fotos' && (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-[14.5px] leading-relaxed text-tinta-2">
            {autorizaRespaldo && pideRespaldo && ficha.lectura_automatica
              ? 'Del código de barras de atrás leemos sus datos. Usted los ve en el siguiente paso.'
              : 'Tómela con buena luz, que se lea completa.'}
          </p>
          <div className="rounded-tarjeta border border-borde px-3.5">
            <FotoFicha titulo="Cédula por delante" detalle="Falta" estado={fotos.frente} alElegir={(a) => void tomarFoto('frente', a)} />
            {autorizaRespaldo && pideRespaldo && (
              <FotoFicha
                titulo="Cédula por detrás"
                detalle={ficha.lectura_automatica ? 'Falta · de aquí leemos sus datos' : 'Falta'}
                opcional
                estado={fotos.respaldo}
                alElegir={(a) => void tomarFoto('respaldo', a)}
              />
            )}
          </div>
          {(errores.cedula_frente || errores.fotos) && <p className="text-[13px] text-estado-mora">{errores.fotos ?? errores.cedula_frente}</p>}
          {pideRespaldo && !autorizaRespaldo && (
            <p className="text-[13px] text-tinta-3">No autorizó la foto de atrás: en el siguiente paso escribe sus datos a mano.</p>
          )}
        </div>
      )}

      {paso === 'datos' && (
        <div className="mt-2 flex flex-col gap-4">
          <p className="text-[14.5px] leading-relaxed text-tinta-2">
            {leidos
              ? 'Los leímos del código de barras de su cédula. Revíselos; si cambia alguno, quedará como escrito a mano.'
              : 'Escríbalos tal como aparecen en su cédula. El negocio verá que se escribieron a mano.'}
          </p>
          {CAMPOS_PASO.datos.map(campo)}
          {leidos && (leidos.sexo || leidos.rh) && fotos.respaldo.estado === 'lista' && (
            <p className="text-[13px] text-tinta-3">
              También leímos de su cédula:{leidos.sexo ? ` sexo ${leidos.sexo}` : ''}
              {leidos.sexo && leidos.rh ? ' ·' : ''}
              {leidos.rh ? ` RH ${leidos.rh}` : ''}.
            </p>
          )}
          <p className="text-[13px] text-tinta-3">El celular es el número al que le llegó este enlace.</p>
        </div>
      )}

      {paso === 'vivienda' && (
        <div className="mt-2 flex flex-col gap-4">
          {campo('direccion_casa')}
          {campo('barrio')}
          {campo('ciudad')}
          {activo('tipo_vivienda') && (
            <Campo etiqueta={`${ETIQUETA.tipo_vivienda}${ficha.campos.tipo_vivienda === 'opcional' ? ' (opcional)' : ''}`} error={errores.tipo_vivienda}>
              {() => (
                <ControlSegmentado
                  etiquetaAccesible="Tipo de vivienda"
                  valor={valores.tipo_vivienda ?? ''}
                  alCambiar={(v) => cambiar('tipo_vivienda', v)}
                  opciones={[
                    { valor: 'propia', etiqueta: 'Propia' },
                    { valor: 'arriendo', etiqueta: 'Arriendo' },
                    { valor: 'familiar', etiqueta: 'Familiar' },
                  ]}
                />
              )}
            </Campo>
          )}
          {campo('tiempo_vivienda')}
        </div>
      )}

      {paso === 'trabajo' && (
        <div className="mt-2 flex flex-col gap-4">
          {campo('ocupacion')}
          {campo('negocio_empresa')}
          {campo('direccion_trabajo')}
          {campo('ingresos')}
          {pideFachada && (
            <div>
              <div className="rounded-tarjeta border border-borde px-3.5">
                <FotoFicha
                  titulo="Foto de la fachada del negocio"
                  detalle="Tómela desde la calle"
                  opcional={ficha.campos.foto_fachada === 'opcional'}
                  estado={fotos.fachada}
                  alElegir={(a) => void tomarFoto('fachada', a)}
                />
              </div>
              {errores.foto_fachada && <p className="mt-1.5 text-[13px] text-estado-mora">{errores.foto_fachada}</p>}
            </div>
          )}
        </div>
      )}

      {paso === 'referencias' && (
        <div className="mt-2 flex flex-col gap-5">
          <p className="text-[14.5px] leading-relaxed text-tinta-2">Que no vivan con usted. Solo las llaman si hace falta.</p>
          {(['referencia_1', 'referencia_2'] as const).filter(activo).map((r, i) => (
            <fieldset key={r} className="flex flex-col gap-3">
              <legend className="mb-1 text-base font-semibold">
                Referencia {i + 1} {ficha.campos[r] === 'opcional' && <span className="text-[13px] font-normal text-tinta-3">(opcional)</span>}
              </legend>
              {(['nombre', 'telefono', 'parentesco'] as const).map((k) => (
                <CampoFicha
                  key={k}
                  etiqueta={k === 'nombre' ? 'Nombre' : k === 'telefono' ? 'Teléfono' : 'Parentesco'}
                  valor={referencias[r][k] ?? ''}
                  alCambiar={(v) => {
                    setReferencias((x) => ({ ...x, [r]: { ...x[r], [k]: v } }))
                    setErrores((e) => sinClave(e, `${r}.${k}`))
                  }}
                  error={errores[`${r}.${k}`]}
                  {...(k === 'telefono' ? { inputMode: 'tel' } : k === 'parentesco' ? { placeholder: 'Hermana, vecino…' } : {})}
                />
              ))}
            </fieldset>
          ))}
        </div>
      )}

      {paso === 'revisar' && (
        <Revisar
          pasos={pasos}
          irA={irA}
          valores={valores}
          referencias={referencias}
          fotos={fotos}
          autorizaRespaldo={autorizaRespaldo}
          errores={errores}
        />
      )}
    </MarcoFicha>
  )
}

function sinClave(errores: Record<string, string>, clave: string): Record<string, string> {
  const copia = { ...errores }
  delete copia[clave]
  return copia
}

function pertenece(clave: string, p: Paso): boolean {
  if (p === 'autorizacion') return clave === 'autorizacion'
  if (p === 'fotos') return clave === 'cedula_frente'
  if (p === 'referencias') return clave.startsWith('referencia_')
  if (p === 'trabajo' && clave === 'foto_fachada') return true
  return p === 'datos' || p === 'vivienda' || p === 'trabajo' ? (CAMPOS_PASO[p] as string[]).includes(clave) : false
}

function Casilla({
  marcada,
  alCambiar,
  error,
  children,
}: {
  marcada: boolean
  alCambiar: (v: boolean) => void
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-tarjeta border border-borde-control p-3.5 text-[13.5px] leading-relaxed text-tinta-2">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--marca)]"
          checked={marcada}
          onChange={(e) => alCambiar(e.target.checked)}
        />
        <span>{children}</span>
      </label>
      {error && <p className="mt-1.5 text-[13px] text-estado-mora">{error}</p>}
    </div>
  )
}

function Revisar({
  pasos,
  irA,
  valores,
  referencias,
  fotos,
  autorizaRespaldo,
  errores,
}: {
  pasos: Paso[]
  irA: (p: Paso) => void
  valores: Partial<Record<CampoTexto, string>>
  referencias: Record<'referencia_1' | 'referencia_2', Partial<Referencia>>
  fotos: Record<NombreFoto, EstadoFoto>
  autorizaRespaldo: boolean
  errores: Record<string, string>
}) {
  const v = (c: CampoTexto) => valores[c]?.trim()
  const unir = (...xs: Array<string | undefined>) => xs.filter(Boolean).join(', ')
  const nFotos = (['frente', 'respaldo', 'fachada'] as const).filter((f) => fotos[f].estado === 'lista').length
  const filas: Array<[Paso, string, string]> = [
    ['datos', 'Sus datos', unir(unir(v('nombres'), v('apellidos')).replace(', ', ' '), v('cedula') ? `C.C. ${v('cedula')}` : undefined)],
    ['vivienda', 'Dirección', unir(v('direccion_casa'), v('barrio'), v('ciudad'))],
    ['trabajo', 'Trabajo', unir(v('negocio_empresa'), v('ocupacion'), v('ingresos') ? fmtCOP(Number(v('ingresos')!.replace(/\D/g, ''))) : undefined)],
    [
      'referencias',
      'Referencias',
      unir(
        ...(['referencia_1', 'referencia_2'] as const).map((r) =>
          referencias[r].nombre?.trim() ? `${referencias[r].nombre?.trim()} (${formatearCelular(referencias[r].telefono ?? '')})` : undefined,
        ),
      ),
    ],
    ['fotos', 'Fotos', `${nFotos} ${nFotos === 1 ? 'foto tomada' : 'fotos tomadas'}`],
    ['autorizacion', 'Autorización', autorizaRespaldo ? 'Datos personales y foto de atrás' : 'Datos personales'],
  ]
  return (
    <div className="mt-2 flex flex-col">
      <p className="text-[14.5px] leading-relaxed text-tinta-2">Revise que todo esté bien. Cuando envíe, el enlace queda usado.</p>
      <dl className="mt-3 rounded-tarjeta border border-borde">
        {filas
          .filter(([p]) => pasos.includes(p))
          .map(([p, t, detalle]) => (
            <div key={p} className="flex items-center gap-3 border-b border-borde-fila px-3.5 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <dt className="text-[13px] font-semibold text-tinta-3">{t}</dt>
                <dd className="break-words text-[14.5px]">{detalle || '—'}</dd>
              </div>
              <button type="button" className="btn-enlace -my-3 min-h-11 shrink-0" onClick={() => irA(p)}>
                Editar
              </button>
            </div>
          ))}
      </dl>
      {Object.keys(errores).length > 0 && !errores.envio && (
        <p className="mt-3 text-[13px] text-estado-mora">Hay datos por corregir. Toque «Editar» en la sección marcada.</p>
      )}
    </div>
  )
}
