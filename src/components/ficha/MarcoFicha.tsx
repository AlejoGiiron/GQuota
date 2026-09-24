import type { ReactNode } from 'react'
import { monograma } from '@/lib/marca'

/**
 * Marco de la página del prospecto: celular primero, centrado en pantallas
 * grandes. La marca del negocio va arriba (monograma + nombre); el avance y el
 * vencimiento debajo; la barra de acciones abajo, fija.
 */
export default function MarcoFicha({
  negocio,
  avance,
  acciones,
  children,
}: {
  negocio: string | null
  /** "Paso 2 de 6 · Vence hoy, 4:10 p. m." */
  avance?: string
  acciones?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-fondo md:py-10">
      <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col bg-superficie md:min-h-[760px] md:rounded-tarjeta md:border md:border-borde">
        <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-borde px-5">
          {negocio ? (
            <>
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[7px] bg-marca text-xs font-bold text-marca-sobre"
                aria-hidden="true"
              >
                {monograma(negocio)}
              </div>
              <span className="truncate text-[15px] font-semibold">{negocio}</span>
            </>
          ) : (
            <span className="text-[15px] font-semibold">G-Quota</span>
          )}
        </header>
        {avance && <p className="px-5 pt-4 text-[13px] text-tinta-3 cifra">{avance}</p>}
        <main className="flex flex-1 flex-col px-5 pb-6 pt-3">{children}</main>
        {acciones ? (
          <div className="sticky bottom-0 flex gap-2 border-t border-borde bg-superficie px-4 pb-5 pt-3">{acciones}</div>
        ) : (
          <footer className="pb-6 text-center text-xs text-tinta-3">con G-Quota</footer>
        )}
      </div>
    </div>
  )
}
