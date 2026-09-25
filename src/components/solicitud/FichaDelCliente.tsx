import { useEffect, useState } from 'react'
import FotosSolicitud from '@/components/solicitud/FotosSolicitud'
import TablaDatos from '@/components/solicitud/TablaDatos'
import { useConfiguracion } from '@/contexts/ConfiguracionContext'
import type { FotosSolicitud as Fotos } from '@/hooks/useSolicitud'
import { fmtFecha } from '@/lib/formatters'
import type { CampoRevision, DatosRevision, OrigenDato } from '@/lib/revision'
import { supabase } from '@/lib/supabase'
import type { Cliente } from '@/types/db'

type Autorizacion = {
  fotos: Fotos | null
  fotos_borradas_en: string | null
  autorizacion_en: string | null
  autorizacion_version: string | null
  autorizacion_respaldo: boolean | null
}

/**
 * Ficha del cliente que llegó por una solicitud aprobada (fase 1C): los datos con
 * su origen y, solo para el dueño, las fotos y la autorización. Un cliente sin
 * ficha (todos los anteriores, los de Luis) no muestra nada: su pantalla no cambia.
 */
export default function FichaDelCliente({ cliente }: { cliente: Cliente }) {
  const { esDueno } = useConfiguracion()
  const [solicitud, setSolicitud] = useState<Autorizacion | null>(null)
  const ficha = cliente.ficha as DatosRevision | null

  useEffect(() => {
    // El cobrador no lee solicitudes (RLS) ni fotos (storage): ni se intenta.
    if (!esDueno || !cliente.solicitud_id) return
    let vigente = true
    void supabase
      .from('solicitudes')
      .select('fotos, fotos_borradas_en, autorizacion_en, autorizacion_version, autorizacion_respaldo')
      .eq('id', cliente.solicitud_id)
      .maybeSingle()
      .then(({ data }) => {
        if (vigente) setSolicitud((data as Autorizacion | null) ?? null)
      })
    return () => {
      vigente = false
    }
  }, [esDueno, cliente.solicitud_id])

  if (!ficha) return null
  const origenes = (cliente.ficha_origen ?? {}) as Partial<Record<CampoRevision, OrigenDato>>

  return (
    <>
      <section className="flex flex-col gap-3" aria-labelledby="titulo-ficha">
        <h3 id="titulo-ficha" className="text-sm font-bold text-text">
          Ficha de la solicitud
        </h3>
        <TablaDatos datos={ficha} origenes={origenes} compacta />
      </section>
      {esDueno && solicitud && (
        <section className="card flex flex-col gap-3 p-5" aria-labelledby="titulo-fotos-cliente">
          <h3 id="titulo-fotos-cliente" className="text-sm font-bold text-text">
            Fotos
          </h3>
          <FotosSolicitud fotos={solicitud.fotos} borradasEn={solicitud.fotos_borradas_en} />
          {solicitud.autorizacion_en && (
            <p className="text-[13px] text-text-2">
              Autorizó el tratamiento de datos el {fmtFecha(solicitud.autorizacion_en)} (texto {solicitud.autorizacion_version}). Foto
              de atrás de la cédula: {solicitud.autorizacion_respaldo ? 'autorizada' : 'no autorizada'}.
            </p>
          )}
        </section>
      )}
    </>
  )
}
