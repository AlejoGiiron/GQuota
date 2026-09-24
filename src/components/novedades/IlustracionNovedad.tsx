import EtiquetaEstado from '@/components/ui/EtiquetaEstado'
import type { IlustracionPaso, PantallaGuia, RolGuia } from '@/lib/novedades'

/*
 * Esquemas de la guía de novedades: dibujos simples de la app hechos con los
 * tokens (no capturas: no pesan ni se desactualizan). Son decorativos: el texto
 * del paso dice lo mismo. La zona que el paso explica va resaltada con la marca.
 */

const RESALTE = 'ring-2 ring-marca ring-offset-2 ring-offset-superficie-2'

const MENU_CELULAR: Record<RolGuia, string[]> = {
  dueno: ['Inicio', 'Clientes', 'Préstamos', 'Cobros'],
  cobrador: ['Clientes', 'Préstamos', 'Cobros'],
}
const MENU_COMPUTADOR: Record<RolGuia, string[]> = {
  dueno: ['Inicio', 'Clientes', 'Préstamos', 'Cobros', 'Equipo', 'Configuración'],
  cobrador: ['Clientes', 'Préstamos', 'Cobros'],
}

function Linea({ ancho }: { ancho: string }) {
  return <span className={`block h-1 rounded-full bg-borde-control ${ancho}`} />
}

function Tarjetas({ n }: { n: number }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 p-2">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="flex h-5 items-center rounded-[3px] border border-borde bg-superficie px-1.5">
          <Linea ancho={i % 2 ? 'w-8' : 'w-12'} />
        </span>
      ))}
    </div>
  )
}

/** Celular: encabezado con la cuenta, contenido y barra inferior. */
function Celular({ rol, conNombres, resaltarCuenta }: { rol: RolGuia; conNombres: boolean; resaltarCuenta: boolean }) {
  const items = MENU_CELULAR[rol]
  return (
    <div className="flex h-[118px] w-[176px] flex-col overflow-hidden rounded-[10px] border border-borde-control bg-fondo">
      <div className="flex h-6 shrink-0 items-center gap-1.5 border-b border-borde bg-superficie px-2">
        <span className="h-3 w-3 rounded-[3px] bg-marca" />
        <Linea ancho="w-14" />
        <span className={`ml-auto h-3.5 w-3.5 rounded-full border border-borde-control bg-superficie-2 ${resaltarCuenta ? RESALTE : ''}`} />
      </div>
      <Tarjetas n={2} />
      <div className="flex h-7 shrink-0 border-t border-borde bg-superficie">
        {items.map((nombre, i) => (
          <span key={nombre} className="relative flex flex-1 flex-col items-center justify-center gap-0.5">
            {i === 0 && <span className="absolute left-[30%] right-[30%] top-0 h-0.5 bg-marca" />}
            <span className={`h-2 w-2 rounded-[2px] ${i === 0 ? 'bg-tinta-2' : 'bg-borde-control'}`} />
            {conNombres && <span className="text-[8px] font-semibold leading-none text-tinta-2">{nombre}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Computador: menú lateral blanco con la cuenta abajo, y contenido. */
function Computador({ rol, conNombres, resaltarCuenta }: { rol: RolGuia; conNombres: boolean; resaltarCuenta: boolean }) {
  const items = MENU_COMPUTADOR[rol]
  return (
    <div className="flex h-[140px] w-[236px] overflow-hidden rounded-[6px] border border-borde-control bg-fondo">
      <div className="flex w-[84px] shrink-0 flex-col border-r border-borde bg-superficie px-1.5 py-1.5">
        <div className="flex items-center gap-1 border-b border-borde pb-1">
          <span className="h-3 w-3 rounded-[3px] bg-marca" />
          <Linea ancho="w-10" />
        </div>
        <div className="mt-1 flex flex-col gap-[3px]">
          {items.map((nombre, i) => (
            <span
              key={nombre}
              className={`flex h-[9px] items-center gap-1 rounded-[2px] px-0.5 ${i === 0 ? 'bg-marca-suave' : ''}`}
            >
              <span className={`h-1.5 w-1.5 rounded-[1px] ${i === 0 ? 'bg-tinta-2' : 'bg-borde-control'}`} />
              {conNombres ? (
                <span className="text-[7px] font-semibold leading-none text-tinta-2">{nombre}</span>
              ) : (
                <Linea ancho="w-8" />
              )}
            </span>
          ))}
        </div>
        <div className={`mt-auto flex items-center gap-1 rounded-[3px] px-0.5 py-0.5 ${resaltarCuenta ? RESALTE : ''}`}>
          <span className="h-2.5 w-2.5 rounded-full border border-borde-control bg-superficie-2" />
          <Linea ancho="w-9" />
        </div>
      </div>
      <Tarjetas n={3} />
    </div>
  )
}

/** Menú de la cuenta con "Novedades" resaltado. */
function MenuCuenta({ rol, pantalla }: { rol: RolGuia; pantalla: PantallaGuia }) {
  const items = [
    ...(rol === 'dueno' && pantalla === 'celular' ? ['Equipo', 'Configuración'] : []),
    'Novedades',
  ]
  return (
    <div className="w-[200px] overflow-hidden rounded-[6px] border border-borde bg-superficie text-[11px]">
      <div className="border-b border-borde-fila px-2.5 py-1.5 font-semibold text-tinta-3">
        Sesión · {rol === 'dueno' ? 'Dueño' : 'Cobrador'}
      </div>
      {items.map((nombre) => (
        <div
          key={nombre}
          className={`flex items-center px-2.5 py-1.5 font-medium text-tinta ${
            nombre === 'Novedades' ? `m-1 rounded-[3px] bg-marca-suave font-semibold ${RESALTE}` : ''
          }`}
        >
          {nombre}
        </div>
      ))}
      <div className="px-2.5 py-1.5 font-semibold text-estado-mora">Cerrar sesión</div>
    </div>
  )
}

export default function IlustracionNovedad({
  tipo,
  rol,
  pantalla,
}: {
  tipo: IlustracionPaso
  rol: RolGuia
  pantalla: PantallaGuia
}) {
  const Marco = pantalla === 'celular' ? Celular : Computador
  return (
    <div
      className="flex min-h-[148px] items-center justify-center rounded-tarjeta border border-borde bg-superficie-2 p-4"
      aria-hidden="true"
    >
      {tipo === 'diseno' && <Marco rol={rol} conNombres={false} resaltarCuenta={false} />}
      {tipo === 'menu' && <Marco rol={rol} conNombres resaltarCuenta />}
      {tipo === 'estados' && (
        <div className="flex max-w-[300px] flex-wrap justify-center gap-2">
          <EtiquetaEstado estado="al-dia">Activo</EtiquetaEstado>
          <EtiquetaEstado estado="pagado">Pagado</EtiquetaEstado>
          <EtiquetaEstado estado="mora">En mora</EtiquetaEstado>
          <EtiquetaEstado estado="parcial">Parcial</EtiquetaEstado>
        </div>
      )}
      {tipo === 'cuenta' && <MenuCuenta rol={rol} pantalla={pantalla} />}
    </div>
  )
}
