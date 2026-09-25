/**
 * Lista de préstamos: "por cobrar" (activos y en mora, la mora primero) y "pagados"
 * (pagados y cancelados). Lógica pura, con pruebas. La usan la lista de Préstamos y
 * la ficha del cliente, para dueño y cobrador (la RLS ya limita lo que ve cada uno).
 *
 * Se separa por estado y no por saldo en 0: un préstamo de cuotas puede tener el
 * capital en 0 y todavía deber interés (sigue activo).
 */
import type { Prestamo } from '@/types/db'

export type FiltroPrestamos = 'por_cobrar' | 'pagados'

export const esPorCobrar = (p: Pick<Prestamo, 'estado'>) => p.estado === 'activo' || p.estado === 'en_mora'

/** Separa y ordena, conservando el orden de llegada dentro de cada grupo. */
export function separarPrestamos<T extends Pick<Prestamo, 'estado'>>(prestamos: ReadonlyArray<T>): { porCobrar: T[]; pagados: T[] } {
  const porCobrar = prestamos.filter(esPorCobrar)
  // La mora primero (sort estable: el resto queda en el orden en que llegó).
  porCobrar.sort((a, b) => Number(b.estado === 'en_mora') - Number(a.estado === 'en_mora'))
  return { porCobrar, pagados: prestamos.filter((p) => !esPorCobrar(p)) }
}
