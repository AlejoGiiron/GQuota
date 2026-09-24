import type { SelectHTMLAttributes } from 'react'

/** Selector (select nativo) con el estilo del campo y la flecha del sistema. */
export default function Selector({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`select ${className}`} {...props} />
}
