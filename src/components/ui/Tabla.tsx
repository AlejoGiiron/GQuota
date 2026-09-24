import type { ReactNode } from 'react'

export type ColumnaTabla<T> = {
  clave: string
  titulo: ReactNode
  /** Cifras: alineadas a la derecha (los números ya son tabulares en toda la tabla). */
  numerica?: boolean
  celda: (fila: T) => ReactNode
  /** Contenido de esta columna en la fila de totales. */
  total?: ReactNode
  /** Clases extra para la columna (ancho, color). */
  className?: string
}

/**
 * Tabla del sistema: encabezado gris 12,5/600, filas de 48 px con separador fino,
 * cifras tabulares a la derecha y fila de totales opcional (si alguna columna
 * define `total`). Hace scroll horizontal en pantallas angostas.
 */
export default function Tabla<T>({
  columnas,
  filas,
  claveFila,
  etiqueta,
  vacio,
}: {
  columnas: ReadonlyArray<ColumnaTabla<T>>
  filas: ReadonlyArray<T>
  claveFila: (fila: T) => string
  /** Descripción para lectores de pantalla. */
  etiqueta: string
  /** Qué mostrar si no hay filas. */
  vacio?: ReactNode
}) {
  const hayTotales = columnas.some((c) => c.total !== undefined)
  const clase = (c: ColumnaTabla<T>) => [c.numerica ? 'num' : '', c.className ?? ''].filter(Boolean).join(' ') || undefined

  return (
    <div className="tabla-contenedor">
      <table className="tabla">
        <caption className="sr-only">{etiqueta}</caption>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.clave} scope="col" className={clase(c)}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr>
              <td colSpan={columnas.length} className="text-center text-tinta-3">
                {vacio ?? 'No hay datos.'}
              </td>
            </tr>
          ) : (
            filas.map((f) => (
              <tr key={claveFila(f)}>
                {columnas.map((c) => (
                  <td key={c.clave} className={clase(c)}>
                    {c.celda(f)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {hayTotales && filas.length > 0 && (
          <tfoot>
            <tr>
              {columnas.map((c) => (
                <td key={c.clave} className={clase(c)}>
                  {c.total}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
