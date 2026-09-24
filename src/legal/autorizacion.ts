/**
 * Autorización de tratamiento de datos personales (Ley 1581 de 2012 y Decreto
 * 1377 de 2013) que acepta el prospecto en el formulario por enlace.
 *
 * VERSIONADO: un texto aceptado no se edita nunca. Para cambiarlo, crear una
 * versión nueva (v2…), agregarla a VERSIONES_AUTORIZACION en
 * supabase/functions/_shared/ficha.ts y dejar las anteriores. Cada solicitud
 * guarda la versión que aceptó (solicitudes.autorizacion_version).
 */

export const VERSION_AUTORIZACION = 'v1'

export type TextoAutorizacion = {
  /** Casilla (a): datos personales. Obligatoria para continuar. */
  datos: string[]
  /** Casilla (b): foto del respaldo de la cédula (huella). Opcional. */
  respaldo: string
}

/**
 * Texto v1. `negocio`: responsable del tratamiento. `contacto`: canal para
 * ejercer los derechos (negocios.contacto_datos). `pideFachada`: si la ficha
 * pide la foto de la fachada.
 */
export function autorizacionV1(negocio: string, contacto: string, pideFachada: boolean): TextoAutorizacion {
  const fotos = pideFachada ? 'la foto de mi cédula por delante y la de la fachada de mi negocio' : 'la foto de mi cédula por delante'
  return {
    datos: [
      `Autorizo a ${negocio}, como responsable del tratamiento, para recolectar, guardar, usar y consultar los datos personales que entrego en este formulario: identificación, contacto, vivienda, trabajo, referencias y ${fotos}.`,
      `La finalidad es estudiar mi solicitud de crédito y, si es aprobada, gestionar la relación: desembolso, cobro y comunicaciones sobre el préstamo. Los datos se guardan en la plataforma G-Quota, que los trata por cuenta de ${negocio}.`,
      `Como titular tengo derecho a conocer, actualizar, rectificar y suprimir mis datos, y a revocar esta autorización, escribiendo a ${contacto}.`,
      'Declaro que las personas que doy como referencia saben que las pueden contactar para verificar mis datos.',
    ],
    respaldo: `Autorizo a ${negocio} a tratar la foto de mi cédula por detrás para leer mis datos del código de barras. Sé que esa foto contiene mi huella dactilar, que es un dato sensible, y que no estoy obligado a entregarla: si no la autorizo, escribo mis datos a mano y mi solicitud sigue igual.`,
  }
}
