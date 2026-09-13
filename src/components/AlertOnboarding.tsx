import { useState } from 'react'
import { useRafTime } from '../hooks/useRafTime'

const C_ACCENT = '#c67139'
const C_ACCENT2 = '#7a8a5e'
const C_BG = '#f5ead8'
const C_TEXT = '#201e1d'
const C_SURFACE = '#fffaf1'

type Step = 0 | 1 | 2 | 3

interface Props {
  onDone: (subscribed: boolean) => void
  onSubscribe: () => Promise<void>
}

function PawIcon({ size = 56 }: { size?: number }) {
  const r = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <ellipse cx={r} cy={r * 1.05} rx={r * 0.38} ry={r * 0.28} fill={C_TEXT} />
      <circle cx={r - r * 0.42} cy={r - r * 0.18} r={r * 0.15} fill={C_TEXT} />
      <circle cx={r - r * 0.14} cy={r - r * 0.3} r={r * 0.15} fill={C_TEXT} />
      <circle cx={r + r * 0.14} cy={r - r * 0.3} r={r * 0.15} fill={C_TEXT} />
      <circle cx={r + r * 0.42} cy={r - r * 0.18} r={r * 0.15} fill={C_TEXT} />
    </svg>
  )
}

function BellIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C_ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function ShieldIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C_ACCENT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" stroke={C_ACCENT2} />
    </svg>
  )
}

function CheckCircle({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C_ACCENT2} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export default function AlertOnboarding({ onDone, onSubscribe }: Props) {
  const t = useRafTime()
  const [step, setStep] = useState<Step>(0)
  const [busy, setBusy] = useState(false)
  const [subError, setSubError] = useState('')

  const fadeIn = Math.min(1, t / 0.4)

  async function handleActivate() {
    setBusy(true)
    setSubError('')
    try {
      await onSubscribe()
      setStep(3)
    } catch {
      setSubError('No se pudieron activar las alertas. Podes intentarlo luego desde tu panel.')
      setBusy(false)
    }
  }

  const dots = (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 24 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: i === step ? C_ACCENT : 'rgba(32,30,29,0.15)',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  )

  function stepContent() {
    switch (step) {
      case 0:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C_ACCENT}22, ${C_ACCENT2}22)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldIcon size={52} />
            </div>
            <h2 style={{ margin: 0, fontSize: 22, color: C_TEXT, fontFamily: 'var(--font-heading)', lineHeight: 1.3 }}>
              Tu mascota ya esta protegida
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: C_TEXT, opacity: 0.7, lineHeight: 1.6, maxWidth: 280 }}>
              Si alguien encuentra a tu mascota, podra escanear el tag y contactarte al instante.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 8, padding: '12px 32px', fontSize: 15 }}
              onClick={() => setStep(1)}
            >
              Continuar
            </button>
          </div>
        )
      case 1:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C_ACCENT}22, ${C_ACCENT2}22)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BellIcon size={52} />
            </div>
            <h2 style={{ margin: 0, fontSize: 22, color: C_TEXT, fontFamily: 'var(--font-heading)', lineHeight: 1.3 }}>
              Ayuda a mascotas de tu barrio
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: C_TEXT, opacity: 0.7, lineHeight: 1.6, maxWidth: 280 }}>
              Cuando alguien cerca de tu zona marca a su mascota como perdida, te enviamos una notificacion para que puedas estar atento y ayudar.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 8, padding: '12px 32px', fontSize: 15 }}
              onClick={() => setStep(2)}
            >
              Me interesa
            </button>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 13, opacity: 0.6 }}
              onClick={() => onDone(false)}
            >
              Ahora no
            </button>
          </div>
        )
      case 2:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C_ACCENT}22, ${C_ACCENT2}22)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <PawIcon size={48} />
              <div style={{
                position: 'absolute', top: -2, right: -2,
                width: 28, height: 28, borderRadius: '50%',
                background: C_ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <BellIcon size={16} />
              </div>
            </div>
            <h2 style={{ margin: 0, fontSize: 22, color: C_TEXT, fontFamily: 'var(--font-heading)', lineHeight: 1.3 }}>
              Activar alertas
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: C_TEXT, opacity: 0.7, lineHeight: 1.6, maxWidth: 280 }}>
              Vamos a pedirte permiso para enviarte notificaciones. Solo las usamos para alertas de mascotas perdidas.
            </p>
            {subError && (
              <p style={{ margin: 0, fontSize: 13, color: '#c0392b', maxWidth: 280 }}>
                {subError}
              </p>
            )}
            <button
              className="btn btn-primary"
              style={{ marginTop: 8, padding: '12px 32px', fontSize: 15 }}
              disabled={busy}
              onClick={handleActivate}
            >
              {busy ? 'Activando...' : 'Activar alertas'}
            </button>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 13, opacity: 0.6 }}
              onClick={() => onDone(false)}
            >
              Ahora no
            </button>
          </div>
        )
      case 3:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
            <CheckCircle size={72} />
            <h2 style={{ margin: 0, fontSize: 22, color: C_TEXT, fontFamily: 'var(--font-heading)', lineHeight: 1.3 }}>
              Listo!
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: C_TEXT, opacity: 0.7, lineHeight: 1.6, maxWidth: 280 }}>
              Vas a recibir alertas cuando una mascota de tu barrio se pierda. Podes desactivarlas cuando quieras desde tu panel.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 8, padding: '12px 32px', fontSize: 15 }}
              onClick={() => onDone(true)}
            >
              Ir a mis tags
            </button>
          </div>
        )
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: C_BG,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32,
      opacity: fadeIn,
    }}>
      <div style={{
        background: C_SURFACE,
        borderRadius: 24,
        padding: '40px 28px 28px',
        maxWidth: 380,
        width: '100%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
      }}>
        {stepContent()}
        {dots}
      </div>
    </div>
  )
}
