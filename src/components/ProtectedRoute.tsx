import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  adminOnly?: boolean
}

export default function ProtectedRoute({ children, adminOnly = false }: Props) {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent)', fontSize: 18 }}>
          Cargando…
        </div>
      </div>
    )
  }

  if (!user) {
    // Preserve ?code= param so the login page can redirect back with it
    const code = new URLSearchParams(location.search).get('code')
    return <Navigate to={code ? `/login?code=${code}` : '/login'} replace />
  }
  if (adminOnly && role !== 'admin') return <Navigate to="/app/tags" replace />

  return <>{children}</>
}
