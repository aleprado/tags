import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isConfigured } from '../lib/firebase'

const PawIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8c491a" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/>
    <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>
  </svg>
)

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

type Mode = 'login' | 'register'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const { user, loading, login, register, loginWithGoogle } = useAuth()

  useEffect(() => {
    if (!loading && user) {
      navigate(code ? `/app/tags/nuevo?code=${code}` : '/app/tags', { replace: true })
    }
  }, [user, loading, code, navigate])

  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, name)
      }
      navigate(code ? `/app/tags/nuevo?code=${code}` : '/app/tags')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión'
      setError(msg.includes('invalid-credential') ? 'Email o contraseña incorrectos' : msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setSubmitting(true)
    try {
      await loginWithGoogle()
      navigate(code ? `/app/tags/nuevo?code=${code}` : '/app/tags')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error con Google'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {!isConfigured && (
          <div style={{ background: 'var(--color-accent-100)', border: '1px solid var(--color-accent-300)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 'var(--space-4)', fontSize: 13, color: 'var(--color-accent-800)' }}>
            <strong>Firebase no configurado.</strong> Copiá <code>.env.example</code> a <code>.env</code> y completá las credenciales de tu proyecto Firebase.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 'var(--space-6)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-accent-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PawIcon />
          </div>
          <h2 style={{ margin: 0, fontSize: 22, textAlign: 'center' }}>
            {mode === 'login' ? 'Bienvenido a Huellitas' : 'Crear cuenta'}
          </h2>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 13, opacity: 0.7 }}>
            {mode === 'login' ? 'Configurá tu tag en menos de 2 minutos' : 'Ingresá tus datos para comenzar'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="hu-name">Nombre completo</label>
              <input className="input" id="hu-name" placeholder="Tu nombre" value={name} onChange={e => setName(e.target.value)} required />
            </div>
          )}
          <div className="field">
            <label htmlFor="hu-email">Email</label>
            <input className="input" id="hu-email" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="hu-pass">Contraseña</label>
            <input className="input" id="hu-pass" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: 'var(--color-accent-700)', background: 'var(--color-accent-100)', padding: '8px 14px', borderRadius: 999 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ marginTop: 'var(--space-1)' }}>
            {submitting ? 'Cargando…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 'var(--space-3) 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--color-divider)' }} />
          <span style={{ fontSize: 11, opacity: 0.55 }}>o continuá con</span>
          <div style={{ flex: 1, height: 1, background: 'var(--color-divider)' }} />
        </div>

        <button type="button" className="btn btn-secondary btn-block" onClick={handleGoogle} disabled={submitting}>
          <GoogleIcon /> Continuar con Google
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          style={{ display: 'block', margin: '12px auto 0' }}
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
        >
          {mode === 'login' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
        </button>

        {mode === 'login' && (
          <p style={{ textAlign: 'center', marginTop: 8 }}>
            <Link to="/activar" style={{ fontSize: 12, opacity: 0.6 }}>Activar un nuevo tag</Link>
          </p>
        )}
      </div>
    </div>
  )
}
