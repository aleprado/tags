import { useEffect, useRef, useState } from 'react'
import { useRafTime } from '../hooks/useRafTime'
import { playBark } from '../lib/bark'

const C_ACCENT = '#c67139'
const C_ACCENT_DARK = '#8f5027'
const C_ACCENT2 = '#7a8a5e'
const C_BG = '#f5ead8'
const C_TEXT = '#201e1d'

interface Props {
  onDone: (subscribed: boolean) => void
  onSubscribe: () => Promise<void>
}

function clamp01(t: number) { return Math.max(0, Math.min(1, t)) }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3) }
function easeOutBack(t: number) {
  const c1 = 1.70158, c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

const CONFETTI = [
  { angle: -110, dist: 120, size: 12, color: C_ACCENT, delay: 0 },
  { angle: -70, dist: 140, size: 9, color: C_ACCENT2, delay: 0.04 },
  { angle: -30, dist: 130, size: 11, color: C_ACCENT_DARK, delay: 0.08 },
  { angle: 10, dist: 145, size: 8, color: C_ACCENT2, delay: 0.02 },
  { angle: 50, dist: 125, size: 13, color: C_ACCENT, delay: 0.06 },
  { angle: 90, dist: 135, size: 9, color: C_ACCENT_DARK, delay: 0.12 },
  { angle: 130, dist: 115, size: 10, color: C_ACCENT2, delay: 0.05 },
  { angle: 170, dist: 140, size: 8, color: C_ACCENT, delay: 0.1 },
  { angle: -150, dist: 130, size: 11, color: C_ACCENT2, delay: 0.14 },
  { angle: 0, dist: 150, size: 10, color: C_ACCENT_DARK, delay: 0.16 },
]

function FlatPaw({ size, color }: { size: number; color: string }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div style={{ position: 'absolute', left: '24%', top: '48%', width: '52%', height: '44%', borderRadius: '50%', background: color }} />
      <div style={{ position: 'absolute', top: '26%', left: '2%', width: '25%', height: '25%', borderRadius: '50%', background: color }} />
      <div style={{ position: 'absolute', top: '2%', left: '25%', width: '25%', height: '25%', borderRadius: '50%', background: color }} />
      <div style={{ position: 'absolute', top: '2%', left: '51%', width: '25%', height: '25%', borderRadius: '50%', background: color }} />
      <div style={{ position: 'absolute', top: '26%', left: '74%', width: '25%', height: '25%', borderRadius: '50%', background: color }} />
    </div>
  )
}

export default function AlertOnboarding({ onDone, onSubscribe }: Props) {
  const globalT = useRafTime()
  const [step, setStep] = useState(0)
  const [stepStartTime, setStepStartTime] = useState(0)
  const [busy, setBusy] = useState(false)
  const [subError, setSubError] = useState('')
  const stepTimeRef = useRef(0)

  useEffect(() => {
    stepTimeRef.current = globalT
    setStepStartTime(globalT)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const t = globalT - stepStartTime
  const fadeIn = clamp01(globalT / 0.5)

  function goTo(next: number) {
    setStep(next)
  }

  async function handleActivate() {
    setBusy(true)
    setSubError('')
    try {
      await onSubscribe()
      playBark()
      goTo(3)
    } catch {
      const denied = typeof Notification !== 'undefined' && Notification.permission === 'denied'
      setSubError(denied
        ? 'Las notificaciones estan bloqueadas. Habilitalas desde el candado en la barra de direcciones y recarga la pagina.'
        : 'No se pudieron activar las alertas. Podes intentarlo luego desde tu panel.')
      setBusy(false)
    }
  }

  const iconEnter = easeOutBack(clamp01(t / 0.6))
  const titleEnter = easeOutCubic(clamp01((t - 0.2) / 0.4))
  const bodyEnter = easeOutCubic(clamp01((t - 0.35) / 0.4))
  const btnEnter = easeOutCubic(clamp01((t - 0.5) / 0.4))

  const ring1Scale = easeOutCubic(clamp01((t - 0.1) / 1.0))
  const ring1Opacity = 0.4 * (1 - easeOutCubic(clamp01((t - 0.1) / 1.0)))
  const ring2Scale = easeOutCubic(clamp01((t - 0.35) / 1.0))
  const ring2Opacity = 0.3 * (1 - easeOutCubic(clamp01((t - 0.35) / 1.0)))

  const dots = (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 28 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          width: i === step ? 20 : 8, height: 8, borderRadius: 99,
          background: i === step ? C_ACCENT : `${C_TEXT}18`,
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }} />
      ))}
    </div>
  )

  function iconArea(children: React.ReactNode, ringColor: string) {
    return (
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `2.5px solid ${ringColor}`,
          transform: `scale(${0.5 + ring1Scale * 0.8})`,
          opacity: ring1Opacity,
        }} />
        <div style={{
          position: 'absolute', inset: -8, borderRadius: '50%',
          border: `2px solid ${ringColor}`,
          transform: `scale(${0.5 + ring2Scale * 0.8})`,
          opacity: ring2Opacity,
        }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: `linear-gradient(135deg, ${ringColor}18, ${ringColor}08)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `scale(${iconEnter})`,
          boxShadow: `0 8px 24px ${ringColor}20`,
        }}>
          {children}
        </div>
      </div>
    )
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <>
            {iconArea(
              <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke={C_ACCENT2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>,
              C_ACCENT2,
            )}
            <h2 style={{
              margin: 0, fontSize: 24, color: C_TEXT,
              fontFamily: 'var(--font-heading)', lineHeight: 1.2,
              opacity: titleEnter, transform: `translateY(${12 * (1 - titleEnter)}px)`,
            }}>
              Tu mascota esta protegida
            </h2>
            <p style={{
              margin: 0, fontSize: 14, color: C_TEXT, opacity: bodyEnter * 0.65,
              lineHeight: 1.7, maxWidth: 280,
              transform: `translateY(${10 * (1 - bodyEnter)}px)`,
            }}>
              Si alguien la encuentra, podra escanear el tag y contactarte al instante.
            </p>
            <button
              className="btn btn-primary"
              style={{
                padding: '13px 36px', fontSize: 15, borderRadius: 999,
                opacity: btnEnter, transform: `translateY(${8 * (1 - btnEnter)}px)`,
              }}
              onClick={() => goTo(1)}
            >
              Continuar
            </button>
          </>
        )
      case 1:
        return (
          <>
            {iconArea(
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={C_ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>,
              C_ACCENT,
            )}
            <h2 style={{
              margin: 0, fontSize: 24, color: C_TEXT,
              fontFamily: 'var(--font-heading)', lineHeight: 1.2,
              opacity: titleEnter, transform: `translateY(${12 * (1 - titleEnter)}px)`,
            }}>
              Ayuda a tu barrio
            </h2>
            <p style={{
              margin: 0, fontSize: 14, color: C_TEXT, opacity: bodyEnter * 0.65,
              lineHeight: 1.7, maxWidth: 280,
              transform: `translateY(${10 * (1 - bodyEnter)}px)`,
            }}>
              Cuando una mascota cerca tuyo se pierde, te avisamos para que puedas estar atento y ayudar a encontrarla.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: btnEnter, transform: `translateY(${8 * (1 - btnEnter)}px)` }}>
              <button
                className="btn btn-primary"
                style={{ padding: '13px 36px', fontSize: 15, borderRadius: 999 }}
                onClick={() => goTo(2)}
              >
                Me interesa
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 13, opacity: 0.55 }}
                onClick={() => onDone(false)}
              >
                Ahora no
              </button>
            </div>
          </>
        )
      case 2:
        return (
          <>
            {iconArea(
              <div style={{ position: 'relative' }}>
                <FlatPaw size={52} color={C_ACCENT_DARK} />
                <div style={{
                  position: 'absolute', top: -8, right: -12,
                  width: 26, height: 26, borderRadius: '50%',
                  background: C_ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                </div>
              </div>,
              C_ACCENT,
            )}
            <h2 style={{
              margin: 0, fontSize: 24, color: C_TEXT,
              fontFamily: 'var(--font-heading)', lineHeight: 1.2,
              opacity: titleEnter, transform: `translateY(${12 * (1 - titleEnter)}px)`,
            }}>
              Activar alertas
            </h2>
            <p style={{
              margin: 0, fontSize: 14, color: C_TEXT, opacity: bodyEnter * 0.65,
              lineHeight: 1.7, maxWidth: 280,
              transform: `translateY(${10 * (1 - bodyEnter)}px)`,
            }}>
              Te pediremos permiso para notificaciones. Solo las usamos para alertas de mascotas perdidas en tu zona.
            </p>
            {subError && (
              <p style={{ margin: 0, fontSize: 13, color: '#c0392b', maxWidth: 280, textAlign: 'center', lineHeight: 1.5 }}>
                {subError}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: btnEnter, transform: `translateY(${8 * (1 - btnEnter)}px)` }}>
              <button
                className="btn btn-primary"
                style={{ padding: '13px 36px', fontSize: 15, borderRadius: 999 }}
                disabled={busy}
                onClick={handleActivate}
              >
                {busy ? 'Activando...' : 'Activar alertas'}
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 13, opacity: 0.55 }}
                onClick={() => onDone(false)}
              >
                Ahora no
              </button>
            </div>
          </>
        )
      case 3: {
        const checkScale = easeOutBack(clamp01(t / 0.5))
        const checkBounce = Math.sin(clamp01((t - 0.5) / 0.3) * Math.PI) * 0.08
        return (
          <>
            <div style={{ position: 'relative', width: 120, height: 120 }}>
              {/* Confetti */}
              {CONFETTI.map((c, i) => {
                const start = 0.15 + c.delay
                const p = easeOutCubic(clamp01((t - start) / 0.7))
                const fade = 1 - easeOutCubic(clamp01((t - start - 0.35) / 0.5))
                const rad = (c.angle * Math.PI) / 180
                const x = Math.cos(rad) * c.dist * p
                const y = Math.sin(rad) * c.dist * p
                return (
                  <div key={i} style={{
                    position: 'absolute', left: '50%', top: '50%',
                    width: c.size, height: c.size, borderRadius: '50%',
                    background: c.color,
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                    opacity: fade,
                  }} />
                )
              })}
              {/* Check circle */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: C_ACCENT2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: `scale(${checkScale * (1 + checkBounce)})`,
                boxShadow: '0 8px 24px rgba(122,138,94,0.3)',
              }}>
                <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
            </div>
            <h2 style={{
              margin: 0, fontSize: 26, color: C_TEXT,
              fontFamily: 'var(--font-heading)', lineHeight: 1.2,
              opacity: titleEnter, transform: `translateY(${12 * (1 - titleEnter)}px)`,
            }}>
              Listo!
            </h2>
            <p style={{
              margin: 0, fontSize: 14, color: C_TEXT, opacity: bodyEnter * 0.65,
              lineHeight: 1.7, maxWidth: 280,
              transform: `translateY(${10 * (1 - bodyEnter)}px)`,
            }}>
              Vas a recibir alertas cuando una mascota de tu barrio se pierda. Podes desactivarlas desde tu panel.
            </p>
            <button
              className="btn btn-primary"
              style={{
                padding: '13px 36px', fontSize: 15, borderRadius: 999,
                opacity: btnEnter, transform: `translateY(${8 * (1 - btnEnter)}px)`,
              }}
              onClick={() => onDone(true)}
            >
              Ir a mis tags
            </button>
          </>
        )
      }
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: C_BG,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      opacity: fadeIn,
      fontFamily: 'var(--font-body, Figtree, sans-serif)',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 20, textAlign: 'center',
        maxWidth: 340, width: '100%',
      }}>
        {renderStep()}
        {dots}
      </div>
    </div>
  )
}
