import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const STEPS = [
  {
    icon: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8c491a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <path d="M14 14h3v3h-3zM17.5 17.5H21V21h-3.5z"/>
      </svg>
    ),
    title: 'Escaneá el QR de tu llavero',
    description: 'Usá la cámara de tu teléfono para leer el código único del tag físico.',
  },
  {
    icon: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8c491a" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Creá tu cuenta',
    description: 'Solo necesitamos tu email y una contraseña.',
  },
  {
    icon: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8c491a" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/>
        <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>
      </svg>
    ),
    title: 'Completá el perfil',
    description: 'Foto, nombre y los datos clave de tu mascota u objeto.',
  },
  {
    icon: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#7a8a5e" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="m9 12 2 2 4-4"/>
      </svg>
    ),
    title: '¡Listo!',
    description: 'Tu tag ya está activo y funcionando. Cualquiera que lo escanee verá el perfil que creaste.',
  },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const [step, setStep] = useState(0)

  function goNext() {
    if (step === STEPS.length - 1) {
      navigate(code ? `/login?code=${code}` : '/login')
    } else {
      setStep(s => s + 1)
    }
  }

  function goBack() {
    setStep(s => Math.max(0, s - 1))
  }

  const current = STEPS[step]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 22px' }}>
      <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-accent-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8c491a" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/>
              <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>Huellitas</span>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, alignSelf: 'center' }}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === step ? 22 : 8,
                height: 8,
                borderRadius: 999,
                background: i <= step ? 'var(--color-accent)' : 'var(--color-neutral-300)',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>

        {/* Step content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, padding: '24px 0', flex: 1 }}>
          {current.icon}
          <h2 style={{ margin: 0, fontSize: 20 }}>{current.title}</h2>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.7, maxWidth: '28ch' }}>{current.description}</p>
          {code && step === 0 && (
            <div style={{ marginTop: 4, fontSize: 12, background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', padding: '6px 14px', borderRadius: 999 }}>
              Código: <strong>{code}</strong>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={goBack}
            style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
          >
            Atrás
          </button>
          <button type="button" className="btn btn-primary btn-block" onClick={goNext}>
            {step === STEPS.length - 1 ? 'Ir a mi cuenta' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}
