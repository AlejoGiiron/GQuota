/**
 * Configuración de la ficha de cliente por enlace (negocios.ficha_config).
 *
 * Las reglas (campos, valores por defecto, validación del envío) viven en
 * supabase/functions/_shared/ficha.ts, compartidas con la Edge Function
 * ficha-publica: un solo lugar para el navegador y el servidor. Aquí solo va lo
 * de pantalla (secciones y vista previa de los pasos).
 */
import { campoActivo, type CampoFicha, type FichaConfig } from '../../supabase/functions/_shared/ficha.ts'

export {
  CAMPOS,
  CAMPOS_FIJOS,
  CAMPOS_LEIBLES,
  CAMPOS_TEXTO,
  FICHA_POR_DEFECTO,
  VERSIONES_AUTORIZACION,
  aplicarReglas,
  bloqueo,
  campoActivo,
  contarModos,
  leerFicha,
  mismaFicha,
  modosPermitidos,
  validarCampo,
  validarEnvio,
  validarReferencia,
} from '../../supabase/functions/_shared/ficha.ts'
export type {
  CampoFicha,
  CampoLeible,
  CampoTexto,
  DatosFicha,
  FichaConfig,
  ModoCampo,
  Origen,
  OrigenFicha,
  Referencia,
  ResultadoEnvio,
  TipoVivienda,
} from '../../supabase/functions/_shared/ficha.ts'

export type FilaFicha = { campo: CampoFicha; nombre: string; detalle?: string }
export type SeccionFicha = { id: string; titulo: string; paso: string; nota: string; filas: FilaFicha[] }

/** Secciones y textos de "Configurar la ficha" (design/paquete-2a, Solicitudes pantalla 3). */
export const SECCIONES_FICHA: ReadonlyArray<SeccionFicha> = [
  {
    id: 'fotos', titulo: 'Fotos de la cédula', paso: 'Fotos de la cédula', nota: 'Paso 1 del formulario',
    filas: [
      { campo: 'cedula_frente', nombre: 'Cédula por delante' },
      { campo: 'cedula_reverso', nombre: 'Cédula por detrás', detalle: 'Tiene el código de barras y la huella: el prospecto decide si la entrega' },
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

export type PasoFormulario = { titulo: string; detalle: string; numero: number | null }

/** Pasos que verá el prospecto (vista previa de "Configurar la ficha"). */
export function pasosFormulario(config: FichaConfig): PasoFormulario[] {
  let numero = 0
  const pasos: PasoFormulario[] = [{ titulo: 'Autorización', detalle: 'Siempre se pide, antes de cualquier dato', numero: ++numero }]
  for (const s of SECCIONES_FICHA) {
    const activos = s.filas.filter((f) => campoActivo(config, f.campo)).length
    const visible = s.id === 'datos' || s.id === 'fotos' || activos > 0
    let detalle = !visible ? 'Apagado: no se muestra' : `${activos} ${activos === 1 ? 'dato' : 'datos'}`
    if (visible && s.id === 'datos' && config.lectura_automatica) {
      detalle += ' · si entrega el respaldo, número, nombres, apellidos y fecha salen del código de barras'
    }
    pasos.push({ titulo: s.paso, detalle, numero: visible ? ++numero : null })
  }
  pasos.push({ titulo: 'Revisar y enviar', detalle: 'Ve todo antes de enviar', numero: numero + 1 })
  return pasos
}
