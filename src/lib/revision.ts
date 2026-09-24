/**
 * Revisión de solicitudes (fase 1C): relectura del respaldo, origen de cada dato y
 * cómo se muestra. Lógica pura, con pruebas.
 *
 * El origen que vale es el que calcula aprobar_solicitud (migración 039) en el
 * servidor; `origenDe` lo replica para mostrarlo antes de aprobar.
 */
import type { CamposCedula } from '@/lib/cedula'
import type { DatosFicha, Referencia } from '@/lib/ficha'
import { fmtCOP, fmtFecha } from '@/lib/formatters'
import { formatearCelular } from '@/lib/solicitudes'

export type Verificacion = 'verificado' | 'discrepancia' | 'sin_verificar'
export type OrigenDato = 'cedula' | 'discrepancia' | 'sin_verificar' | 'prospecto' | 'enlace' | 'dueno'

/** Campos que salen del código de barras del respaldo (y se verifican con él). */
export const CAMPOS_IDENTIDAD = ['cedula', 'nombres', 'apellidos', 'fecha_nacimiento', 'sexo', 'rh'] as const
export type CampoIdentidad = (typeof CAMPOS_IDENTIDAD)[number]
const esIdentidad = (campo: string): campo is CampoIdentidad => (CAMPOS_IDENTIDAD as ReadonlyArray<string>).includes(campo)

/** Todo lo que puede tener la ficha de un cliente: lo del prospecto más el celular del enlace. */
export type DatosRevision = DatosFicha & { celular?: string }
export type CampoRevision = keyof DatosRevision

export const ETIQUETA_ORIGEN: Record<OrigenDato, string> = {
  cedula: 'Leído de la cédula',
  discrepancia: 'No coincide con el código',
  sin_verificar: 'Escrito a mano · sin verificar',
  prospecto: 'Escrito por el prospecto',
  enlace: 'Del enlace',
  dueno: 'Corregido por el dueño',
}

/** Grupos de la tabla "Datos" (design/paquete-2a, Solicitudes 4). */
export const GRUPOS_REVISION: ReadonlyArray<{ titulo: string; campos: ReadonlyArray<{ campo: CampoRevision; nombre: string }> }> = [
  {
    titulo: 'Datos de la cédula',
    campos: [
      { campo: 'cedula', nombre: 'Número de cédula' },
      { campo: 'nombres', nombre: 'Nombres' },
      { campo: 'apellidos', nombre: 'Apellidos' },
      { campo: 'fecha_nacimiento', nombre: 'Fecha de nacimiento' },
      { campo: 'sexo', nombre: 'Sexo' },
      { campo: 'rh', nombre: 'RH' },
    ],
  },
  {
    titulo: 'Contacto',
    campos: [
      { campo: 'celular', nombre: 'Celular' },
      { campo: 'telefono_alterno', nombre: 'Teléfono alterno' },
      { campo: 'correo', nombre: 'Correo' },
    ],
  },
  {
    titulo: 'Vivienda',
    campos: [
      { campo: 'direccion_casa', nombre: 'Dirección de la casa' },
      { campo: 'barrio', nombre: 'Barrio' },
      { campo: 'ciudad', nombre: 'Ciudad' },
      { campo: 'tipo_vivienda', nombre: 'Tipo de vivienda' },
      { campo: 'tiempo_vivienda', nombre: 'Tiempo en la vivienda' },
    ],
  },
  {
    titulo: 'Trabajo',
    campos: [
      { campo: 'ocupacion', nombre: 'Ocupación' },
      { campo: 'negocio_empresa', nombre: 'Negocio o empresa' },
      { campo: 'direccion_trabajo', nombre: 'Dirección del trabajo' },
      { campo: 'ingresos', nombre: 'Ingresos aproximados' },
    ],
  },
  {
    titulo: 'Referencias',
    campos: [
      { campo: 'referencia_1', nombre: 'Referencia 1' },
      { campo: 'referencia_2', nombre: 'Referencia 2' },
    ],
  },
]

/** Texto para comparar nombres: sin tildes, en mayúsculas y con espacios simples. */
export function normalizarTexto(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

const soloDigitos = (s: string) => s.replace(/\D/g, '')

/**
 * Compara lo que envió el prospecto con lo que el dueño leyó del código. Sin
 * lectura: sin verificar. Solo se comparan los campos que el código trae; la
 * fecha, el sexo y el RH, solo si el prospecto los envió.
 */
export function compararConCedula(
  datos: DatosFicha,
  leidos: CamposCedula | null,
): { resultado: Verificacion; distintos: Partial<Record<CampoIdentidad, string>> } {
  if (!leidos) return { resultado: 'sin_verificar', distintos: {} }
  const distintos: Partial<Record<CampoIdentidad, string>> = {}
  if (soloDigitos(datos.cedula ?? '') !== soloDigitos(leidos.cedula)) distintos.cedula = leidos.cedula
  if (normalizarTexto(datos.nombres ?? '') !== normalizarTexto(leidos.nombres)) distintos.nombres = leidos.nombres
  if (normalizarTexto(datos.apellidos ?? '') !== normalizarTexto(leidos.apellidos)) distintos.apellidos = leidos.apellidos
  if (datos.fecha_nacimiento && leidos.fecha_nacimiento && datos.fecha_nacimiento !== leidos.fecha_nacimiento) {
    distintos.fecha_nacimiento = leidos.fecha_nacimiento
  }
  if (datos.sexo && leidos.sexo && datos.sexo !== leidos.sexo) distintos.sexo = leidos.sexo
  if (datos.rh && leidos.rh && datos.rh !== leidos.rh) distintos.rh = leidos.rh
  return { resultado: Object.keys(distintos).length ? 'discrepancia' : 'verificado', distintos }
}

/** Igualdad de valores de la ficha (textos o referencias), sin importar el orden de las llaves. */
export function mismoValor(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): string =>
    v === undefined || v === null || v === ''
      ? ''
      : typeof v === 'object'
        ? JSON.stringify(Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y))))
        : String(v)
  return norm(a) === norm(b)
}

/** Origen de un dato, igual que en aprobar_solicitud (migración 039). */
export function origenDe(
  campo: CampoRevision,
  original: unknown,
  actual: unknown,
  verificacion: Verificacion | null,
  detalle: Partial<Record<string, string>> | null,
): OrigenDato {
  if (campo === 'celular') return 'enlace'
  if (!mismoValor(original, actual)) return 'dueno'
  if (esIdentidad(campo)) {
    if (verificacion === 'discrepancia' && detalle && campo in detalle) return 'discrepancia'
    if (verificacion === 'verificado' || verificacion === 'discrepancia') return 'cedula'
    return 'sin_verificar'
  }
  return 'prospecto'
}

/** Campos que el dueño cambió respecto de lo enviado. */
export function camposCorregidos(original: DatosFicha, editado: DatosFicha): CampoRevision[] {
  const campos = new Set([...Object.keys(original), ...Object.keys(editado)]) as Set<CampoRevision>
  return [...campos].filter((c) => !mismoValor(original[c as keyof DatosFicha], editado[c as keyof DatosFicha]))
}

/** 1000000089 → '1.000.000.089' */
export function formatearCedula(cedula: string): string {
  const d = soloDigitos(cedula)
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : cedula
}

const VIVIENDA: Record<string, string> = { propia: 'Propia', arriendo: 'Arriendo', familiar: 'Familiar' }

/** Valor de un campo tal como se muestra en la revisión y en la ficha del cliente. */
export function valorVisible(campo: CampoRevision, valor: unknown): string {
  if (valor === undefined || valor === null || valor === '') return ''
  if (campo === 'referencia_1' || campo === 'referencia_2') {
    const r = valor as Partial<Referencia>
    return [r.nombre, r.telefono ? formatearCelular(r.telefono) : '', r.parentesco].filter(Boolean).join(' · ')
  }
  const v = String(valor)
  switch (campo) {
    case 'cedula':
      return formatearCedula(v)
    case 'fecha_nacimiento': {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
      return m ? fmtFecha(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : v
    }
    case 'celular':
    case 'telefono_alterno':
      return formatearCelular(v)
    case 'tipo_vivienda':
      return VIVIENDA[v] ?? v
    case 'ingresos':
      return /^\d+$/.test(v) ? `${fmtCOP(Number(v))} al mes` : v
    case 'sexo':
      return v === 'F' ? 'Femenino' : v === 'M' ? 'Masculino' : v
    default:
      return v
  }
}
