import type { ModoInteres } from '@/lib/motor-prestamos'

export const MODO_LABEL: Record<ModoInteres, string> = {
  sobre_saldo: 'Sobre saldo',
  sobre_capital_inicial: 'Fijo sobre el monto',
}

const ESTADO_INFO: Record<string, { label: string; cls: string }> = {
  activo: { label: 'Activo', cls: 'badge--aldia' },
  en_mora: { label: 'En mora', cls: 'badge--vencido' },
  pagado: { label: 'Pagado', cls: 'badge--pagado' },
  cancelado: { label: 'Cancelado', cls: 'badge--pagado' },
}

/** Tasa mensual (decimal) a texto: 0.1 -> "10% mensual". */
export function tasaMensualTexto(tasa: number): string {
  return `${(tasa * 100).toLocaleString('es-CO', { maximumFractionDigits: 2 })}% mensual`
}

export function EstadoBadge({ estado }: { estado: string }) {
  const info = ESTADO_INFO[estado] ?? { label: estado, cls: 'badge--pagado' }
  return <span className={`badge ${info.cls}`}>{info.label}</span>
}

export function ModoBadge({ modo }: { modo: string }) {
  const label = MODO_LABEL[modo as ModoInteres] ?? modo
  return <span className="badge bg-bg text-text-2">{label}</span>
}
