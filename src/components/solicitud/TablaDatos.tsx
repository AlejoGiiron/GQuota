import EtiquetaEstado from '@/components/ui/EtiquetaEstado'
import {
  ETIQUETA_ORIGEN,
  GRUPOS_REVISION,
  valorVisible,
  type CampoRevision,
  type DatosRevision,
  type OrigenDato,
} from '@/lib/revision'

/** Origen de un dato. Los que importan para confiar en el dato van con ícono y palabra. */
export function Origen({ origen }: { origen: OrigenDato | undefined }) {
  if (!origen) return null
  const texto = ETIQUETA_ORIGEN[origen]
  switch (origen) {
    case 'cedula':
      return <EtiquetaEstado estado="al-dia">{texto}</EtiquetaEstado>
    case 'discrepancia':
      return <EtiquetaEstado estado="mora">{texto}</EtiquetaEstado>
    case 'sin_verificar':
      return <EtiquetaEstado estado="pendiente">{texto}</EtiquetaEstado>
    case 'dueno':
      return <EtiquetaEstado estado="completada">{texto}</EtiquetaEstado>
    default:
      return <span className="text-[13px] text-tinta-3">{texto}</span>
  }
}

/**
 * Tabla "Dato · Valor · Origen" agrupada (design/paquete-2a, Solicitudes 4). Solo
 * muestra los campos con valor. `aviso` pone una nota bajo un campo (p. ej. lo
 * que dice el código de barras cuando no coincide). `compacta` apila dato, valor y
 * origen siempre (para paneles angostos como la ficha del cliente en escritorio).
 */
export default function TablaDatos({
  datos,
  origenes,
  avisos = {},
  compacta = false,
}: {
  datos: DatosRevision
  origenes: Partial<Record<CampoRevision, OrigenDato>>
  avisos?: Partial<Record<CampoRevision, string>>
  compacta?: boolean
}) {
  // Clases completas (Tailwind purga las que no encuentra escritas tal cual).
  const fila = compacta
    ? 'grid grid-cols-1 gap-1 border-b border-borde-fila px-4 py-3 last:border-b-0'
    : 'grid grid-cols-1 gap-1 border-b border-borde-fila px-4 py-3 last:border-b-0 md:grid-cols-[190px_1fr_auto] md:items-start md:gap-4 md:px-5'
  const grupos = GRUPOS_REVISION.map((g) => ({
    ...g,
    filas: g.campos
      .map((c) => ({ ...c, valor: valorVisible(c.campo, datos[c.campo]) }))
      .filter((c) => c.valor !== ''),
  })).filter((g) => g.filas.length > 0)

  return (
    <div className="tarjeta overflow-hidden">
      <div className={compacta ? 'hidden' : 'hidden grid-cols-[190px_1fr_auto] gap-4 border-b border-borde bg-superficie-2 px-5 py-2.5 text-[12.5px] font-semibold text-tinta-2 md:grid'}>
        <span>Dato</span>
        <span>Valor</span>
        <span>Origen</span>
      </div>
      {grupos.map((g) => (
        <section key={g.titulo} aria-label={g.titulo}>
          <h3 className={compacta ? 'border-b border-borde-fila bg-superficie-2 px-4 py-2 text-[13px] font-semibold text-tinta' : 'border-b border-borde-fila bg-superficie-2 px-4 py-2 text-[13px] font-semibold text-tinta md:px-5'}>
            {g.titulo}
          </h3>
          <dl>
            {g.filas.map((f) => (
              <div key={f.campo} className={fila}>
                <dt className={compacta ? 'text-[13px] text-tinta-3' : 'text-[13px] text-tinta-3 md:text-[14px]'}>{f.nombre}</dt>
                <dd className={compacta ? 'min-w-0 break-words text-[15px] text-tinta' : 'min-w-0 break-words text-[15px] text-tinta md:text-[14.5px]'}>
                  <span className="cifra">{f.valor}</span>
                  {avisos[f.campo] && <p className="mt-1 text-[13px] text-estado-mora">{avisos[f.campo]}</p>}
                </dd>
                <dd className={compacta ? undefined : 'md:text-right'}>
                  <Origen origen={origenes[f.campo]} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
