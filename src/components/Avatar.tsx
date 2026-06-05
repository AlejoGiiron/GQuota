/** Paleta rotativa para avatares de iniciales (del sistema aprobado, av-1..av-8). */
const COLORES = [
  '#0d9488',
  '#0891b2',
  '#7c3aed',
  '#db7706',
  '#be185d',
  '#4d7c0f',
  '#475569',
  '#b45309',
]

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?'
}

function colorDe(nombre: string): string {
  let suma = 0
  for (let i = 0; i < nombre.length; i++) suma += nombre.charCodeAt(i)
  return COLORES[suma % COLORES.length]
}

/** Círculo con iniciales sobre color sólido (sin fotos), igual al dashboard aprobado. */
export default function Avatar({
  nombre,
  size = 42,
  className = '',
}: {
  nombre: string
  size?: number
  className?: string
}) {
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-xl font-bold text-white ${className}`}
      style={{ width: size, height: size, background: colorDe(nombre), fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {iniciales(nombre)}
    </div>
  )
}
