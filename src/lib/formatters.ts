// Formateadores compartidos de G-Quota.
// Toda la UI debe usar estas funciones; no reimplementar formatos de dinero/fecha.

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

/**
 * Formatea un monto en pesos colombianos, sin decimales.
 * fmtCOP(1000000) => "$1.000.000"
 *
 * Nota: es-CO inserta un espacio (NBSP) entre el símbolo y la cifra
 * ("$ 1.000.000"); lo quitamos para que quede pegado como "$1.000.000".
 * El separador de miles es "." así que no hay otros espacios significativos.
 */
export function fmtCOP(n: number): string {
  return copFormatter.format(n).replace(/\s/g, '')
}

const fechaFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/**
 * Formatea una fecha en formato local dd/mm/aaaa.
 * Acepta un Date o un string. Los strings tipo 'aaaa-mm-dd' (columnas
 * `date` de Supabase) se interpretan como fecha local para evitar el
 * desfase de un día por zona horaria.
 * fmtFecha('2026-06-04') => "04/06/2026"
 */
export function fmtFecha(d: Date | string): string {
  let fecha: Date
  if (typeof d === 'string') {
    const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
    fecha = soloFecha
      ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
      : new Date(d)
  } else {
    fecha = d
  }
  return fechaFormatter.format(fecha)
}
