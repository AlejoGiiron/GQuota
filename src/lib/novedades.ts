/**
 * Guía de novedades: textos por versión y cuándo se abre sola. Lógica pura, con
 * pruebas. Qué le falta ver a cada usuario vive en la tabla novedades_usuario
 * (migración 038): una fila 'pendiente' por usuario que existía al publicar la
 * versión; quien se crea después no tiene fila y no la ve.
 *
 * Una versión nueva = una migración que inserta sus filas + sus pasos aquí.
 */

/** Versión vigente de la guía (la del sistema de diseño 2a). */
export const VERSION_NOVEDADES = 'diseno-2a'

/** Soporte de G-Quota: aparece en el último paso de la guía. */
export const CONTACTO_SOPORTE = 'WhatsApp 316 151 3882'

export type RolGuia = 'dueno' | 'cobrador'
export type PantallaGuia = 'celular' | 'computador'
/** Dibujo que acompaña al paso (componente IlustracionNovedad). */
export type IlustracionPaso = 'diseno' | 'menu' | 'estados' | 'cuenta'

export interface PasoNovedad {
  titulo: string
  parrafos: string[]
  ilustracion: IlustracionPaso
}

export interface FilaNovedad {
  version: string
  estado: string
  mostrar_desde: string
}

/** ¿La guía se abre sola? Si está pendiente y ya llegó su fecha ("Ver después" la corre). */
export function seAbreSola(fila: FilaNovedad | null, ahora: Date): boolean {
  return fila !== null && fila.estado === 'pendiente' && new Date(fila.mostrar_desde).getTime() <= ahora.getTime()
}

/** "Ver después": mañana a las 00:00, en la hora del celular. */
export function mananaTemprano(ahora: Date): Date {
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1)
}

const CIERRE = [
  `Si algo no lo encuentra o no se ve bien, escríbanos a ${CONTACTO_SOPORTE}.`,
  'Puede volver a ver esta guía en su cuenta, en «Novedades».',
]

/** Pasos de la versión 'diseno-2a': 4 para el dueño y 3 para el cobrador. */
export function pasosDiseno2a(rol: RolGuia, pantalla: PantallaGuia): PasoNovedad[] {
  const diseno: PasoNovedad = {
    titulo: 'G-Quota tiene un diseño nuevo',
    parrafos: [
      'Lo renovamos para que se lea mejor, sobre todo en el celular.',
      'Sus clientes, préstamos, pagos y cuentas siguen exactamente igual: no cambió ningún dato ni ningún cálculo.',
      'Las imágenes que les envía a sus clientes (comprobantes y cronogramas) se ven igual que antes.',
    ],
    ilustracion: 'diseno',
  }
  const estados = [
    'Cada estado ahora trae un ícono y su nombre, que es el mismo de antes.',
    'Verde: activo o pagado. Rojo: en mora. Azul: cuota con pago parcial.',
  ]

  if (rol === 'dueno') {
    return [
      diseno,
      {
        titulo: 'Dónde quedó cada cosa',
        parrafos:
          pantalla === 'celular'
            ? [
                'Abajo siguen Inicio, Clientes, Préstamos y Cobros, en el mismo orden.',
                'Equipo, Configuración y Cerrar sesión están arriba a la derecha, en el botón de su cuenta.',
              ]
            : [
                'El menú sigue a la izquierda, ahora con el nombre de su negocio arriba.',
                'Su cuenta y Cerrar sesión pasaron abajo a la izquierda.',
              ],
        ilustracion: 'menu',
      },
      { titulo: 'Los estados se ven más claros', parrafos: estados, ilustracion: 'estados' },
      {
        titulo: '¿Tiene que hacer algo?',
        parrafos: ['No, todo sigue funcionando igual.', ...CIERRE],
        ilustracion: 'cuenta',
      },
    ]
  }

  return [
    diseno,
    {
      titulo: 'Dónde quedó cada cosa',
      parrafos:
        pantalla === 'celular'
          ? ['Abajo siguen Clientes, Préstamos y Cobros.', 'Cerrar sesión está arriba a la derecha, en el botón de su cuenta.']
          : ['El menú sigue a la izquierda.', 'Su cuenta y Cerrar sesión pasaron abajo a la izquierda.'],
      ilustracion: 'menu',
    },
    {
      titulo: 'Los estados se ven más claros',
      parrafos: [...estados, 'No tiene que hacer nada: todo sigue funcionando igual.', ...CIERRE],
      ilustracion: 'estados',
    },
  ]
}

const GUIAS: Record<string, (rol: RolGuia, pantalla: PantallaGuia) => PasoNovedad[]> = {
  'diseno-2a': pasosDiseno2a,
}

/** Pasos de una versión; [] si la versión no existe. */
export function pasosDe(version: string, rol: RolGuia, pantalla: PantallaGuia): PasoNovedad[] {
  return GUIAS[version]?.(rol, pantalla) ?? []
}
