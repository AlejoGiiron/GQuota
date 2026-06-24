import { Outlet } from 'react-router-dom'
import { useConfiguracion } from '@/contexts/ConfiguracionContext'
import PantallaCargando from '@/components/PantallaCargando'
import SinNegocioPage from '@/pages/SinNegocioPage'

/**
 * Guard para las rutas privadas: exige que el usuario tenga un NEGOCIO. Sin él
 * (registro a medias, o acceso removido) muestra la pantalla "crea tu negocio"
 * en vez de la app vacía/rota. Va anidado dentro de ProtectedRoute, así que aquí
 * ya hay sesión garantizada; lo único que falta validar es el negocio.
 */
export default function RequiereNegocio() {
  const { negocio, loading } = useConfiguracion()

  if (loading) return <PantallaCargando />
  if (!negocio) return <SinNegocioPage />
  return <Outlet />
}
