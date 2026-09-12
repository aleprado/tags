import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import PublicProfile from './pages/PublicProfile'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import TagForm from './pages/TagForm'
import Onboarding from './pages/Onboarding'

// El panel admin viaja en chunks aparte: no tiene por qué descargarlo alguien
// que sólo escanea un QR. Print3D además arrastra el generador de STL.
const Admin = lazy(() => import('./pages/Admin'))
const PrintLabels = lazy(() => import('./pages/PrintLabels'))
const Print3D = lazy(() => import('./pages/Print3D'))

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent)', fontSize: 18 }}>
        Cargando…
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/p/:tagId" element={<PublicProfile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/activar" element={<Onboarding />} />
          <Route
            path="/app/tags"
            element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
          />
          <Route
            path="/app/tags/nuevo"
            element={<ProtectedRoute><TagForm /></ProtectedRoute>}
          />
          <Route
            path="/app/tags/:id/editar"
            element={<ProtectedRoute><TagForm /></ProtectedRoute>}
          />
          <Route
            path="/admin"
            element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>}
          />
          <Route
            path="/admin/print"
            element={<ProtectedRoute adminOnly><PrintLabels /></ProtectedRoute>}
          />
          <Route
            path="/admin/print3d"
            element={<ProtectedRoute adminOnly><Print3D /></ProtectedRoute>}
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
