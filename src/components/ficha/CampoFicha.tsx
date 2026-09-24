import type { InputHTMLAttributes } from 'react'
import Campo from '@/components/ui/Campo'
import EtiquetaEstado from '@/components/ui/EtiquetaEstado'
import type { Origen } from '@/lib/ficha'

/**
 * Campo de texto del formulario del prospecto. Si el dato se puede leer de la
 * cédula, muestra su origen: "Leído de la cédula" o "Escrito a mano · sin verificar".
 */
export default function CampoFicha({
  etiqueta,
  opcional = false,
  valor,
  alCambiar,
  error,
  ayuda,
  origen,
  ...props
}: {
  etiqueta: string
  opcional?: boolean
  valor: string
  alCambiar: (v: string) => void
  error?: string | null
  ayuda?: string
  origen?: Origen
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <Campo
      etiqueta={
        <span className="flex flex-wrap items-center gap-2">
          <span>
            {etiqueta} {opcional && <span className="font-normal text-tinta-3">(opcional)</span>}
          </span>
          {origen === 'cedula' && <EtiquetaEstado estado="al-dia">Leído de la cédula</EtiquetaEstado>}
          {origen === 'manual' && <EtiquetaEstado estado="pendiente">Escrito a mano · sin verificar</EtiquetaEstado>}
        </span>
      }
      error={error}
      ayuda={ayuda}
    >
      {(p) => <input {...p} {...props} className="input" value={valor} onChange={(e) => alCambiar(e.target.value)} />}
    </Campo>
  )
}
