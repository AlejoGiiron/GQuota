/**
 * Configuración de la ficha de cliente por enlace (negocios.ficha_config).
 *
 * Qué dato se le pide al prospecto y cómo. Lógica pura: la usan "Configurar la
 * ficha" (dueño) y la página pública del enlace. La base valida lo mismo con
 * ficha_config_valida (migración 035) y tiene el mismo valor por defecto: una
 * prueba verifica que FICHA_POR_DEFECTO coincida con la migración.
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

/** Siempre obligatorios: sin ellos no hay a quién prestarle. */
export const CAMPOS_FIJOS: ReadonlySet<CampoFicha> = new Set(['nombres', 'apellidos', 'cedula', 'celular'])

export const FICHA_POR_DEFECTO: FichaConfig = {
  version: 1,
  lectura_automatica: true,
  campos: {
    cedula_frente: 'obligatorio',
    cedula_reverso: 'obligatorio',
    selfie_cedula: 'obligatorio',
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

export type FilaFicha = { campo: CampoFicha; nombre: string; detalle?: string }
export type SeccionFicha = { id: string; titulo: string; paso: string; nota: string; filas: FilaFicha[] }

/** Secciones y textos de "Configurar la ficha" (design/paquete-2a, Solicitudes pantalla 3). */
export const SECCIONES_FICHA: ReadonlyArray<SeccionFicha> = [
  {
    id: 'fotos', titulo: 'Fotos de la cédula', paso: 'Fotos de la cédula', nota: 'Paso 1 del formulario',
    filas: [
      { campo: 'cedula_frente', nombre: 'Cédula por delante' },
      { campo: 'cedula_reverso', nombre: 'Cédula por detrás', detalle: 'Tiene el código de barras' },
      { campo: 'selfie_cedula', nombre: 'Selfie con la cédula', detalle: 'Su cara y la cédula en la misma foto' },
    ],
  },
  {
    id: 'datos', titulo: 'Datos personales', paso: 'Sus datos', nota: 'Paso 2',
    filas: [
      { campo: 'nombres', nombre: 'Nombres' },
      { campo: 'apellidos', nombre: 'Apellidos' },
      { campo: 'cedula', nombre: 'Cédula', detalle: 'Número de documento' },
      { campo: 'celular', nombre: 'Celular', detalle: 'Viene del enlace' },
      { campo: 'fecha_nacimiento', nombre: 'Fecha de nacimiento' },
      { campo: 'telefono_alterno', nombre: 'Teléfono alterno' },
      { campo: 'correo', nombre: 'Correo' },
    ],
  },
  {
    id: 'vivienda', titulo: 'Vivienda', paso: 'Dirección', nota: 'Paso 3',
    filas: [
      { campo: 'direccion_casa', nombre: 'Dirección de la casa' },
      { campo: 'barrio', nombre: 'Barrio' },
      { campo: 'ciudad', nombre: 'Ciudad' },
      { campo: 'tipo_vivienda', nombre: 'Tipo de vivienda', detalle: 'Propia, arriendo o familiar' },
      { campo: 'tiempo_vivienda', nombre: 'Tiempo en la vivienda' },
    ],
  },
  {
    id: 'trabajo', titulo: 'Trabajo', paso: 'Trabajo', nota: 'Paso 4',
    filas: [
      { campo: 'ocupacion', nombre: 'Ocupación' },
      { campo: 'negocio_empresa', nombre: 'Negocio o empresa' },
      { campo: 'direccion_trabajo', nombre: 'Dirección del trabajo' },
      { campo: 'ingresos', nombre: 'Ingresos aproximados', detalle: 'Al mes' },
      { campo: 'foto_fachada', nombre: 'Foto de la fachada del negocio', detalle: 'Se toma con la cámara en este paso' },
    ],
  },
  {
    id: 'refs', titulo: 'Referencias', paso: 'Referencias', nota: 'Paso 5',
    filas: [
      { campo: 'referencia_1', nombre: 'Referencia 1', detalle: 'Nombre, teléfono y parentesco' },
      { campo: 'referencia_2', nombre: 'Referencia 2', detalle: 'Nombre, teléfono y parentesco' },
    ],
  },
]

const MODOS: ReadonlyArray<ModoCampo> = ['apagado', 'opcional', 'obligatorio']
const CAMPOS = Object.keys(FICHA_POR_DEFECTO.campos) as CampoFicha[]

/** Por qué un campo no se puede cambiar (null si es libre). */
export function bloqueo(config: FichaConfig, campo: CampoFicha): string | null {
  if (CAMPOS_FIJOS.has(campo)) return 'Siempre obligatorio'
  if (campo === 'cedula_reverso' && config.lectura_automatica) return 'Obligatoria por la lectura'
  return null
}

/** Aplica las reglas: fijos obligatorios y, con lectura activa, el reverso obligatorio. */
export function aplicarReglas(config: FichaConfig): FichaConfig {
  const campos = { ...config.campos }
  for (const c of CAMPOS_FIJOS) campos[c] = 'obligatorio'
  if (config.lectura_automatica) campos.cedula_reverso = 'obligatorio'
  return { ...config, campos }
}

/**
 * Lee lo que viene de la base (Json) con cuidado: si algo no cuadra, cae al valor
 * por defecto de ese campo. Nunca rompe la pantalla por un dato raro.
 */
export function leerFicha(valor: unknown): FichaConfig {
  const v = (valor && typeof valor === 'object' ? valor : {}) as Partial<{ lectura_automatica: unknown; campos: unknown }>
  const crudos = (v.campos && typeof v.campos === 'object' ? v.campos : {}) as Record<string, unknown>
  const campos = { ...FICHA_POR_DEFECTO.campos }
  for (const c of CAMPOS) {
    const m = crudos[c]
    if (typeof m === 'string' && (MODOS as string[]).includes(m)) campos[c] = m as ModoCampo
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

export type PasoFormulario = { titulo: string; detalle: string; numero: number | null }

/** Pasos que verá el prospecto (vista previa de "Configurar la ficha"). */
export function pasosFormulario(config: FichaConfig): PasoFormulario[] {
  let numero = 0
  const pasos: PasoFormulario[] = SECCIONES_FICHA.map((s) => {
    const activos = s.filas.filter((f) => config.campos[f.campo] !== 'apagado').length
    const visible = s.id === 'datos' || activos > 0
    let detalle = !visible ? 'Apagado: no se muestra' : `${activos} ${activos === 1 ? 'dato' : 'datos'}`
    if (visible && s.id === 'datos' && config.lectura_automatica) {
      detalle += ' · número, nombres, apellidos y fecha salen del código de barras'
    }
    return { titulo: s.paso, detalle, numero: visible ? ++numero : null }
  })
  pasos.push({ titulo: 'Autorización y envío', detalle: 'Siempre se pide', numero: ++numero })
  return pasos
}

export function campoActivo(config: FichaConfig, campo: CampoFicha): boolean {
  return config.campos[campo] !== 'apagado'
}
