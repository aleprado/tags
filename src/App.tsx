import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import PublicProfile from './pages/PublicProfile'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import TagForm from './pages/TagForm'
import Onboarding from './pages/Onboarding'
import Admin from './pages/Admin'

export default function App() {
  return (
    <AuthProvider>
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
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
