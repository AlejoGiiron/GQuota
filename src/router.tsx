import { createBrowserRouter } from 'react-router-dom'
import ProtectedRoute from '@/components/ProtectedRoute'
import PublicOnlyRoute from '@/components/PublicOnlyRoute'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import InicioPage from '@/pages/InicioPage'
import ClientesPage from '@/pages/ClientesPage'
import ClienteFicha from '@/components/ClienteFicha'
import PrestamosPage from '@/pages/PrestamosPage'
import PrestamoFicha from '@/components/PrestamoFicha'
import CobrosPage from '@/pages/CobrosPage'
import ConfiguracionPage from '@/pages/ConfiguracionPage'
import EquipoPage from '@/pages/EquipoPage'

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <InicioPage /> },
          {
            path: 'clientes',
            element: <ClientesPage />,
            children: [{ path: ':clienteId', element: <ClienteFicha /> }],
          },
          {
            path: 'prestamos',
            element: <PrestamosPage />,
            children: [{ path: ':prestamoId', element: <PrestamoFicha /> }],
          },
          { path: 'cobros', element: <CobrosPage /> },
          { path: 'equipo', element: <EquipoPage /> },
          { path: 'configuracion', element: <ConfiguracionPage /> },
        ],
      },
    ],
  },
])
