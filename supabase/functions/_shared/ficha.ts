/**
 * Ficha de cliente por enlace — reglas compartidas entre el frontend y las Edge Functions.
 *
 * TypeScript PURO: sin imports ni APIs de Deno o del navegador, para que lo usen
 * igual `npm run build` (src/lib/ficha.ts lo reexporta) y el deploy de
 * ficha-publica (lo importa con extensión .ts, como exige Deno).
 *
 * La base valida lo mismo con ficha_config_valida (migración 037) y tiene el mismo
 * valor por defecto; una prueba compara FICHA_POR_DEFECTO con la migración.
 */

export type ModoCampo = 'apagado' | 'opcional' | 'obligatorio'

export type CampoFicha =
  | 'cedula_frente' | 'cedula_reverso' | 'selfie_cedula'
  | 'nombres' | 'apellidos' | 'cedula' | 'celular' | 'fecha_nacimiento' | 'telefono_alterno' | 'correo'
  | 'direccion_casa' | 'barrio' | 'ciudad' | 'tipo_vivienda' | 'tiempo_vivienda'
  | 'ocupacion' | 'negocio_empresa' | 'direccion_trabajo' | 'ingresos' | 'foto_fachada'
  | 'referencia_1' | 'referencia_2'

export type FichaConfig = {
  version: 1
  lectura_automatica: boolean
  campos: Record<CampoFicha, ModoCampo>
}

export const CAMPOS: ReadonlyArray<CampoFicha> = [
  'cedula_frente', 'cedula_reverso', 'selfie_cedula',
  'nombres', 'apellidos', 'cedula', 'celular', 'fecha_nacimiento', 'telefono_alterno', 'correo',
  'direccion_casa', 'barrio', 'ciudad', 'tipo_vivienda', 'tiempo_vivienda',
  'ocupacion', 'negocio_empresa', 'direccion_trabajo', 'ingresos', 'foto_fachada',
  'referencia_1', 'referencia_2',
]

/** Siempre obligatorios: sin ellos no hay a quién prestarle. */
export const CAMPOS_FIJOS: ReadonlySet<CampoFicha> = new Set(['nombres', 'apellidos', 'cedula', 'celular'])

/**
 * Valores por defecto (migración 037). Reglas de las fotos:
 *  - cedula_frente: siempre obligatoria.
 *  - cedula_reverso: nunca obligatoria (tiene la huella, dato sensible: el
 *    prospecto la entrega solo si la autoriza aparte).
 *  - selfie_cedula: apagada; llega después con su propia autorización.
 */
export const FICHA_POR_DEFECTO: FichaConfig = {
  version: 1,
  lectura_automatica: true,
  campos: {
    cedula_frente: 'obligatorio',
    cedula_reverso: 'opcional',
    selfie_cedula: 'apagado',
    nombres: 'obligatorio',
    apellidos: 'obligatorio',
    cedula: 'obligatorio',
    celular: 'obligatorio',
    fecha_nacimiento: 'opcional',
    telefono_alterno: 'opcional',
    correo: 'apagado',
    direccion_casa: 'obligatorio',
    barrio: 'obligatorio',
    ciudad: 'obligatorio',
    tipo_vivienda: 'obligatorio',
    tiempo_vivienda: 'opcional',
    ocupacion: 'obligatorio',
    negocio_empresa: 'obligatorio',
    direccion_trabajo: 'obligatorio',
    ingresos: 'opcional',
    foto_fachada: 'opcional',
    referencia_1: 'obligatorio',
    referencia_2: 'opcional',
  },
}

const MODOS: ReadonlyArray<ModoCampo> = ['apagado', 'opcional', 'obligatorio']

/** Por qué un campo no se puede cambiar en "Configurar la ficha" (null si es libre). */
export function bloqueo(_config: FichaConfig, campo: CampoFicha): string | null {
  if (CAMPOS_FIJOS.has(campo)) return 'Siempre obligatorio'
  if (campo === 'cedula_frente') return 'Siempre obligatoria'
  if (campo === 'selfie_cedula') return 'Llega más adelante'
  return null
}

/** Modos que se pueden elegir para un campo libre. */
export function modosPermitidos(campo: CampoFicha): ReadonlyArray<ModoCampo> {
  return campo === 'cedula_reverso' ? ['apagado', 'opcional'] : MODOS
}

/** Aplica las reglas (la base exige lo mismo con su CHECK). */
export function aplicarReglas(config: FichaConfig): FichaConfig {
  const campos = { ...config.campos }
  for (const c of CAMPOS_FIJOS) campos[c] = 'obligatorio'
  campos.cedula_frente = 'obligatorio'
  campos.selfie_cedula = 'apagado'
  if (campos.cedula_reverso === 'obligatorio') campos.cedula_reverso = 'opcional'
  // Sin foto del respaldo no hay código que leer.
  const lectura = config.lectura_automatica && campos.cedula_reverso !== 'apagado'
  return { version: 1, lectura_automatica: lectura, campos }
}

/** Lee lo que viene de la base (Json) con cuidado: lo que no cuadra cae al valor por defecto. */
export function leerFicha(valor: unknown): FichaConfig {
  const v = (valor && typeof valor === 'object' ? valor : {}) as { lectura_automatica?: unknown; campos?: unknown }
  const crudos = (v.campos && typeof v.campos === 'object' ? v.campos : {}) as Record<string, unknown>
  const campos = { ...FICHA_POR_DEFECTO.campos }
  for (const c of CAMPOS) {
    const m = crudos[c]
    if (typeof m === 'string' && (MODOS as ReadonlyArray<string>).includes(m)) campos[c] = m as ModoCampo
  }
  const lectura = typeof v.lectura_automatica === 'boolean' ? v.lectura_automatica : FICHA_POR_DEFECTO.lectura_automatica
  return aplicarReglas({ version: 1, lectura_automatica: lectura, campos })
}

export function mismaFicha(a: FichaConfig, b: FichaConfig): boolean {
  return a.lectura_automatica === b.lectura_automatica && CAMPOS.every((c) => a.campos[c] === b.campos[c])
}

export function contarModos(config: FichaConfig): Record<ModoCampo, number> {
  const n: Record<ModoCampo, number> = { apagado: 0, opcional: 0, obligatorio: 0 }
  for (const c of CAMPOS) n[config.campos[c]]++
  return n
}

export function campoActivo(config: FichaConfig, campo: CampoFicha): boolean {
  return config.campos[campo] !== 'apagado'
}

// ─────────────────────────────────────────────────────────────
//  Autorización (Ley 1581). El texto vive en src/legal/; aquí solo las versiones
//  que el servidor acepta.
// ─────────────────────────────────────────────────────────────
export const VERSIONES_AUTORIZACION: ReadonlyArray<string> = ['v1']

// ─────────────────────────────────────────────────────────────
//  Envío del formulario
// ─────────────────────────────────────────────────────────────
export type Origen = 'cedula' | 'manual'
/** Datos que pueden venir del código de barras del respaldo. */
export const CAMPOS_LEIBLES = ['cedula', 'nombres', 'apellidos', 'fecha_nacimiento'] as const
export type CampoLeible = (typeof CAMPOS_LEIBLES)[number]

export type Referencia = { nombre: string; telefono: string; parentesco: string }
export type TipoVivienda = 'propia' | 'arriendo' | 'familiar'

/** Lo que llena el prospecto. El celular NO va: es el del enlace (lo tiene el servidor). */
export type DatosFicha = {
  cedula?: string
  nombres?: string
  apellidos?: string
  fecha_nacimiento?: string
  /** Solo si se leyeron del código; nunca se piden a mano. */
  sexo?: 'M' | 'F'
  rh?: string
  telefono_alterno?: string
  correo?: string
  direccion_casa?: string
  barrio?: string
  ciudad?: string
  tipo_vivienda?: TipoVivienda
  tiempo_vivienda?: string
  ocupacion?: string
  negocio_empresa?: string
  direccion_trabajo?: string
  ingresos?: string
  referencia_1?: Referencia
  referencia_2?: Referencia
}
export type OrigenFicha = Partial<Record<CampoLeible | 'sexo' | 'rh', Origen>>

/** Campos de texto del formulario (sin fotos, sin celular, sin referencias). */
export const CAMPOS_TEXTO = [
  'cedula', 'nombres', 'apellidos', 'fecha_nacimiento', 'telefono_alterno', 'correo',
  'direccion_casa', 'barrio', 'ciudad', 'tipo_vivienda', 'tiempo_vivienda',
  'ocupacion', 'negocio_empresa', 'direccion_trabajo', 'ingresos',
] as const
export type CampoTexto = (typeof CAMPOS_TEXTO)[number]

const soloDigitos = (s: string) => s.replace(/\D/g, '')

/**
 * Valida y normaliza un valor de texto. Devuelve [valor normalizado, error].
 * Un valor vacío es válido aquí; la obligatoriedad la decide validarEnvio.
 */
export function validarCampo(campo: CampoTexto, crudo: string, hoy = new Date()): [string, string | null] {
  const v = crudo.trim().replace(/\s+/g, ' ')
  if (!v) return ['', null]
  if (v.length > 120) return [v, 'Es muy largo (máximo 120 caracteres).']
  switch (campo) {
    case 'cedula': {
      const d = soloDigitos(v)
      return /^\d{5,10}$/.test(d) ? [d, null] : [v, 'Escriba el número de la cédula, sin puntos (5 a 10 dígitos).']
    }
    case 'nombres':
    case 'apellidos':
      return v.length >= 2 && /^[\p{L}' .-]+$/u.test(v) ? [v, null] : [v, 'Escríbalo tal como aparece en la cédula.']
    case 'fecha_nacimiento': {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
      const f = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
      const valida = f && f.getMonth() === Number(m![2]) - 1 && Number(m![1]) >= 1900 && f < hoy
      return valida ? [v, null] : [v, 'Escriba una fecha válida.']
    }
    case 'telefono_alterno': {
      const d = soloDigitos(v).replace(/^57(?=\d{10}$)/, '')
      return /^\d{7,10}$/.test(d) ? [d, null] : [v, 'Escriba un teléfono de 7 a 10 dígitos.']
    }
    case 'correo':
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? [v.toLowerCase(), null] : [v, 'Escriba un correo válido.']
    case 'tipo_vivienda':
      return ['propia', 'arriendo', 'familiar'].includes(v) ? [v, null] : [v, 'Elija una opción.']
    case 'ingresos': {
      const d = soloDigitos(v)
      return /^\d{1,10}$/.test(d) ? [String(Number(d)), null] : [v, 'Escriba el valor en pesos, sin puntos.']
    }
    default:
      return v.length >= 2 ? [v, null] : [v, 'Complete este dato.']
  }
}

export function validarReferencia(r: Partial<Referencia> | undefined): [Referencia | null, Record<string, string>] {
  const nombre = (r?.nombre ?? '').trim().replace(/\s+/g, ' ')
  const telefono = soloDigitos(r?.telefono ?? '').replace(/^57(?=\d{10}$)/, '')
  const parentesco = (r?.parentesco ?? '').trim().replace(/\s+/g, ' ')
  const errores: Record<string, string> = {}
  if (nombre.length < 3 || nombre.length > 80) errores.nombre = 'Escriba el nombre completo.'
  if (!/^\d{7,10}$/.test(telefono)) errores.telefono = 'Escriba un teléfono de 7 a 10 dígitos.'
  if (parentesco.length < 2 || parentesco.length > 40) errores.parentesco = 'Diga qué es de usted (hermana, vecino…).'
  return Object.keys(errores).length ? [null, errores] : [{ nombre, telefono, parentesco }, {}]
}

const referenciaVacia = (r: Partial<Referencia> | undefined) => !r || (!r.nombre?.trim() && !r.telefono?.trim() && !r.parentesco?.trim())

export type ResultadoEnvio =
  | { ok: true; datos: DatosFicha; origen: OrigenFicha }
  | { ok: false; errores: Record<string, string> }

/**
 * Valida el envío completo contra la ficha del negocio (servidor y navegador).
 * - Campos apagados: se descartan. Obligatorios: deben venir. Formatos: validarCampo.
 * - `respaldoLeido`: si hubo foto del respaldo leída. Sin ella, todo es manual y
 *   sexo/RH no se guardan (solo existen si salieron del código).
 */
export function validarEnvio(config: FichaConfig, datosCrudos: unknown, origenCrudo: unknown, respaldoLeido: boolean): ResultadoEnvio {
  const d = (datosCrudos && typeof datosCrudos === 'object' ? datosCrudos : {}) as Record<string, unknown>
  const o = (origenCrudo && typeof origenCrudo === 'object' ? origenCrudo : {}) as Record<string, unknown>
  const errores: Record<string, string> = {}
  const datos: DatosFicha = {}
  const origen: OrigenFicha = {}

  for (const campo of CAMPOS_TEXTO) {
    const modo = config.campos[campo]
    if (modo === 'apagado') continue
    const crudo = typeof d[campo] === 'string' ? (d[campo] as string) : ''
    const [valor, error] = validarCampo(campo, crudo)
    if (error) errores[campo] = error
    else if (!valor && modo === 'obligatorio') errores[campo] = 'Este dato es obligatorio.'
    else if (valor) (datos as Record<string, string>)[campo] = valor
  }

  for (const ref of ['referencia_1', 'referencia_2'] as const) {
    const modo = config.campos[ref]
    if (modo === 'apagado') continue
    const cruda = d[ref] as Partial<Referencia> | undefined
    if (referenciaVacia(cruda)) {
      if (modo === 'obligatorio') errores[`${ref}.nombre`] = 'Esta referencia es obligatoria.'
      continue
    }
    const [r, e] = validarReferencia(cruda)
    if (r) datos[ref] = r
    for (const [k, msg] of Object.entries(e)) errores[`${ref}.${k}`] = msg
  }

  // Origen de los datos que se pueden leer del código de barras.
  for (const campo of CAMPOS_LEIBLES) {
    if (datos[campo] === undefined) continue
    origen[campo] = respaldoLeido && o[campo] === 'cedula' ? 'cedula' : 'manual'
  }
  // Sexo y RH: solo si salieron del código; nunca a mano.
  if (respaldoLeido && o.sexo === 'cedula' && (d.sexo === 'M' || d.sexo === 'F')) {
    datos.sexo = d.sexo
    origen.sexo = 'cedula'
  }
  if (respaldoLeido && o.rh === 'cedula' && typeof d.rh === 'string' && /^(A|B|AB|O)[+-]$/.test(d.rh)) {
    datos.rh = d.rh
    origen.rh = 'cedula'
  }

  return Object.keys(errores).length ? { ok: false, errores } : { ok: true, datos, origen }
}
