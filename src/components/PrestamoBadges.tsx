import type { ModoInteres } from '@/lib/motor-prestamos'
import EtiquetaEstado, { type Estado } from '@/components/ui/EtiquetaEstado'

export const MODO_LABEL: Record<ModoInteres, string> = {
  sobre_saldo: 'Sobre saldo',
  sobre_capital_inicial: 'Fijo sobre el monto',
}

// Estado del préstamo → estado visual del sistema (color fijo + ícono + palabra).
const ESTADO_INFO: Record<string, { label: string; estado: Estado }> = {
  activo: { label: 'Activo', estado: 'al-dia' },
  en_mora: { label: 'En mora', estado: 'mora' },
  pagado: { label: 'Pagado', estado: 'pagado' },
  cancelado: { label: 'Cancelado', estado: 'inactivo' },
}

/** Tasa mensual (decimal) a texto: 0.1 -> "10% mensual". */
export function tasaMensualTexto(tasa: number): string {
  return `${(tasa * 100).toLocaleString('es-CO', { maximumFractionDigits: 2 })}% mensual`
}

export function EstadoBadge({ estado }: { estado: string }) {
  const info = ESTADO_INFO[estado] ?? { label: estado, estado: 'pendiente' }
  return <EtiquetaEstado estado={info.estado}>{info.label}</EtiquetaEstado>
}

// Modo y tipo NO son estados: insignia neutra (la marca va solo en el marco).
const INSIGNIA_NEUTRA = 'badge border border-borde bg-superficie-2 text-tinta-2'

export function ModoBadge({ modo }: { modo: string }) {
  const label = MODO_LABEL[modo as ModoInteres] ?? modo
  return <span className={INSIGNIA_NEUTRA}>{label}</span>
}

/** Badge según el tipo de préstamo: "Cuotas"/"Cuota fija" si aplica, si no el modo de interés. */
export function TipoOModoBadge({ tipo, modo }: { tipo: string; modo: string }) {
  if (tipo === 'cuotas') return <span className={INSIGNIA_NEUTRA}>Cuotas</span>
  if (tipo === 'cuota_fija') return <span className={INSIGNIA_NEUTRA}>Cuota fija</span>
  return <ModoBadge modo={modo} />
}
