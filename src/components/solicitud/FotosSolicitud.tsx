import { useEffect, useState } from 'react'
import Modal from '@/components/Modal'
import { urlFoto, type FotosSolicitud as Fotos, type NombreFoto } from '@/hooks/useSolicitud'
import { fmtFecha } from '@/lib/formatters'

const NOMBRE: Record<NombreFoto, string> = {
  frente: 'Cédula por delante',
  respaldo: 'Cédula por detrás',
  fachada: 'Fachada del negocio',
}
const ORDEN: NombreFoto[] = ['frente', 'respaldo', 'fachada']

/**
 * Fotos de una solicitud, solo para el dueño: URLs firmadas de 2 minutos (la
 * política de storage no deja firmar a nadie más). Tocar una la agranda.
 */
export default function FotosSolicitud({ fotos, borradasEn }: { fotos: Fotos | null; borradasEn: string | null }) {
  const [urls, setUrls] = useState<Partial<Record<NombreFoto, string | null>>>({})
  const [grande, setGrande] = useState<NombreFoto | null>(null)
  const presentes = ORDEN.filter((f) => fotos?.[f])

  useEffect(() => {
    let vigente = true
    void Promise.all(presentes.map(async (f) => [f, await urlFoto(fotos![f]!)] as const)).then((pares) => {
      if (vigente) setUrls(Object.fromEntries(pares))
    })
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(fotos)])

  if (borradasEn) {
    return <p className="text-[14px] text-tinta-2">Las fotos se borraron el {fmtFecha(borradasEn)}.</p>
  }
  if (presentes.length === 0) return <p className="text-[14px] text-tinta-2">No hay fotos.</p>

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {presentes.map((f) => (
          <li key={f}>
            <button
              type="button"
              onClick={() => setGrande(f)}
              disabled={!urls[f]}
              className="group block w-full overflow-hidden rounded-tarjeta border border-borde bg-superficie-2 text-left"
              aria-label={`Ver ${NOMBRE[f].toLowerCase()}`}
            >
              <span className="block aspect-[4/3] w-full">
                {urls[f] ? (
                  <img src={urls[f]!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-[13px] text-tinta-3">
                    {urls[f] === null ? 'No se pudo cargar' : 'Cargando…'}
                  </span>
                )}
              </span>
              <span className="block px-3 py-2 text-[13px] font-medium text-tinta">{NOMBRE[f]}</span>
            </button>
          </li>
        ))}
      </ul>
      <Modal open={grande !== null} onClose={() => setGrande(null)} titulo={grande ? NOMBRE[grande] : ''}>
        {grande && urls[grande] && <img src={urls[grande]!} alt={NOMBRE[grande]} className="w-full rounded-control" />}
      </Modal>
    </>
  )
}
