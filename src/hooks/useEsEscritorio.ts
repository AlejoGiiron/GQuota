import { useEffect, useState } from 'react'

const CONSULTA = '(min-width: 768px)' // el mismo corte `md` del layout

/** true en escritorio (≥ 768 px), false en el celular. Sigue los cambios de tamaño. */
export function useEsEscritorio(): boolean {
  const [escritorio, setEscritorio] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(CONSULTA).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(CONSULTA)
    const alCambiar = () => setEscritorio(mq.matches)
    alCambiar()
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])
  return escritorio
}
