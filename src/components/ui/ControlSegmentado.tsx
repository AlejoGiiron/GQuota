export type OpcionSegmentada<T extends string> = {
  valor: T
  etiqueta: string
  /** Cantidad opcional que se muestra junto a la etiqueta ("Atrasados 2"). */
  cantidad?: number
}

/**
 * Control segmentado para filtrar una lista ("Todos 14 · Atrasados 2 · …").
 * La opción elegida va en tinta sólida (no en la marca: es un filtro, no una acción).
 */
export default function ControlSegmentado<T extends string>({
  opciones,
  valor,
  alCambiar,
  etiquetaAccesible,
}: {
  opciones: ReadonlyArray<OpcionSegmentada<T>>
  valor: T
  alCambiar: (valor: T) => void
  etiquetaAccesible: string
}) {
  return (
    <div className="segmentado" role="group" aria-label={etiquetaAccesible}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          className="segmentado__opcion"
          aria-pressed={o.valor === valor}
          onClick={() => alCambiar(o.valor)}
        >
          {o.etiqueta}
          {o.cantidad !== undefined && <span className="segmentado__cantidad">{o.cantidad}</span>}
        </button>
      ))}
    </div>
  )
}
