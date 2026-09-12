import { useEffect, useRef } from 'react'
import { useRafTime } from '../hooks/useRafTime'

const C_ACCENT = '#c67139'
const C_ACCENT_DARK = '#8f5027'
const C_ACCENT2 = '#7a8a5e'
const C_BG = '#f5ead8'
const C_TEXT = '#201e1d'
const C_SURFACE = '#fffaf1'

const CUES = { Escaneo: 0, Activando: 2.5, Confirmado: 4.5, Cierre: 7.5 }
const TOTAL = 8.5

const QR_PATTERN = [
  1,1,1,0,1,1,1,
  1,0,1,0,0,0,1,
  1,0,1,1,1,0,1,
  0,0,0,1,0,0,0,
  1,0,1,0,1,0,1,
  1,0,0,0,1,0,1,
  1,1,1,0,1,1,1,
]

const CONFETTI = [
  { angle: -100, dist: 140, size: 14, color: C_ACCENT, delay: 0 },
  { angle: -60, dist: 160, size: 10, color: C_ACCENT2, delay: 0.05 },
  { angle: -20, dist: 150, size: 12, color: C_ACCENT_DARK, delay: 0.1 },
  { angle: 20, dist: 165, size: 9, color: C_ACCENT2, delay: 0.02 },
  { angle: 60, dist: 145, size: 13, color: C_ACCENT, delay: 0.08 },
  { angle: 100, dist: 155, size: 10, color: C_ACCENT_DARK, delay: 0.14 },
  { angle: 140, dist: 135, size: 11, color: C_ACCENT2, delay: 0.06 },
  { angle: -140, dist: 150, size: 9, color: C_ACCENT, delay: 0.12 },
  { angle: 180, dist: 160, size: 12, color: C_ACCENT2, delay: 0.16 },
  { angle: 0, dist: 170, size: 10, color: C_ACCENT, delay: 0.18 },
]

function clamp01(t: number) { return Math.max(0, Math.min(1, t)) }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3) }
function easeInCubic(t: number) { return t * t * t }
function easeOutBack(t: number) {
  const c1 = 1.70158, c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
function anim(from: number, to: number, start: number, end: number, ease: (t: number) => number, T: number) {
  return lerp(from, to, ease(clamp01((T - start) / (end - start))))
}

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

interface ActivationSceneProps {
  petName: string
  onDone: () => void
}

export default function ActivationScene({ petName, onDone }: ActivationSceneProps) {
  const T = useRafTime()
  const doneCalled = useRef(false)

  useEffect(() => {
    if (T >= TOTAL && !doneCalled.current) {
      doneCalled.current = true
      onDone()
    }
  }, [T, onDone])

  // QR phase
  const qrEnter = anim(0, 1, CUES.Escaneo, CUES.Escaneo + 0.5, easeOutCubic, T)
  const qrOutT = anim(0, 1, CUES.Activando - 0.3, CUES.Activando + 0.1, easeInCubic, T)
  const qrScale = qrEnter * (1 - qrOutT * 0.3)
  const qrOpacity = qrEnter * (1 - qrOutT)

  const scanPeriod = 1.1
  const qrElapsed = Math.max(0, T - CUES.Escaneo)
  const scanCycle = qrElapsed % (scanPeriod * 2)
  const scanProgress = scanCycle < scanPeriod ? scanCycle / scanPeriod : 2 - scanCycle / scanPeriod

  // Rings
  const ringScale = anim(0.3, 1.6, CUES.Activando, CUES.Activando + 1.4, easeOutCubic, T)
  const ringOpacity = anim(0.5, 0, CUES.Activando, CUES.Activando + 1.4, easeOutCubic, T)
  const ring2Scale = anim(0.3, 1.6, CUES.Activando + 0.3, CUES.Activando + 1.7, easeOutCubic, T)
  const ring2Opacity = anim(0.4, 0, CUES.Activando + 0.3, CUES.Activando + 1.7, easeOutCubic, T)

  // Paw circle
  const pawScale = anim(0, 1, CUES.Activando + 0.3, CUES.Activando + 1.0, easeOutBack, T)
  const pawFinalFade = anim(1, 0, CUES.Cierre, CUES.Cierre + 0.6, easeInCubic, T)

  // Badge
  const badgeScale = anim(0, 1, CUES.Confirmado - 0.3, CUES.Confirmado + 0.2, easeOutBack, T)

  // Title + pet chip
  const titleT = anim(0, 1, CUES.Confirmado, CUES.Confirmado + 0.5, easeOutCubic, T)
  const titleY = 16 * (1 - titleT)
  const petT = anim(0, 1, CUES.Confirmado + 0.25, CUES.Confirmado + 0.75, easeOutCubic, T)
  const petY = 16 * (1 - petT)

  // Scene fade
  const sceneFadeOut = anim(1, 0, CUES.Cierre, CUES.Cierre + 0.7, easeInCubic, T)

  const showQR = T < CUES.Activando + 0.2

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: C_BG, fontFamily: 'var(--font-body, Figtree, sans-serif)',
      overflow: 'hidden',
    }}>
      {/* QR Card */}
      {showQR && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: `translate(-50%, -50%) scale(${qrScale})`,
          opacity: qrOpacity, width: 260, height: 260,
        }}>
          <div style={{
            width: '100%', height: '100%', background: C_SURFACE, borderRadius: 24,
            boxShadow: '0 12px 32px rgba(32,30,29,0.14)', padding: 20,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(7, 1fr)',
              gap: 3, width: '100%', height: '100%',
            }}>
              {QR_PATTERN.map((v, i) => (
                <div key={i} style={{ borderRadius: 2, background: v ? C_TEXT : 'transparent' }} />
              ))}
            </div>
            <div style={{
              position: 'absolute', left: 8, right: 8, height: 3, background: C_ACCENT2,
              borderRadius: 2, top: 12 + scanProgress * 196, boxShadow: `0 0 12px ${C_ACCENT2}`,
            }} />
          </div>
        </div>
      )}

      {/* Main scene: rings + paw + confetti centered at 38% height */}
      <div style={{
        position: 'absolute', left: '50%', top: '38%', width: 400, height: 400,
        transform: 'translate(-50%,-50%)', opacity: sceneFadeOut,
      }}>
        <div style={{
          position: 'absolute', left: '50%', top: '50%', width: 180, height: 180,
          transform: `translate(-50%,-50%) scale(${ringScale})`, opacity: ringOpacity,
          borderRadius: '999px', border: `3px solid ${C_ACCENT}`,
        }} />
        <div style={{
          position: 'absolute', left: '50%', top: '50%', width: 180, height: 180,
          transform: `translate(-50%,-50%) scale(${ring2Scale})`, opacity: ring2Opacity,
          borderRadius: '999px', border: `3px solid ${C_ACCENT2}`,
        }} />

        {/* Paw circle */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 180, height: 180, borderRadius: '999px', background: C_SURFACE,
          boxShadow: '0 16px 40px rgba(32,30,29,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `translate(-50%,-50%) scale(${pawScale * pawFinalFade})`,
          opacity: pawFinalFade,
        }}>
          <FlatPaw size={100} color={C_ACCENT_DARK} />
          <div style={{
            position: 'absolute', right: -6, bottom: -6, width: 56, height: 56, borderRadius: '999px',
            background: C_ACCENT2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: `scale(${badgeScale})`, boxShadow: '0 6px 14px rgba(32,30,29,0.2)',
          }}>
            <span style={{ color: C_SURFACE, fontSize: 30, fontWeight: 700, lineHeight: 1 }}>✓</span>
          </div>
        </div>

        {/* Confetti particles */}
        {CONFETTI.map((c, i) => {
          const start = CUES.Confirmado - 0.3 + c.delay
          const p = anim(0, 1, start, start + 0.7, easeOutCubic, T)
          const fade = anim(1, 0, start + 0.3, start + 0.9, easeInCubic, T)
          const rad = (c.angle * Math.PI) / 180
          const x = Math.cos(rad) * c.dist * p
          const y = Math.sin(rad) * c.dist * p
          return (
            <div key={i} style={{
              position: 'absolute', left: '50%', top: '50%', width: c.size, height: c.size,
              borderRadius: '999px', background: c.color,
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              opacity: fade * sceneFadeOut,
            }} />
          )
        })}
      </div>

      {/* Title */}
      <div style={{
        position: 'absolute', left: '50%', top: '68%', width: '80%', textAlign: 'center',
        transform: `translate(-50%, ${titleY}px)`, opacity: titleT * sceneFadeOut,
      }}>
        <div style={{
          fontFamily: 'var(--font-heading, Caprasimo, serif)', fontSize: 46, color: C_TEXT, lineHeight: 1.1,
        }}>
          ¡Tag activado!
        </div>
      </div>

      {/* Pet chip */}
      <div style={{
        position: 'absolute', left: '50%', top: '78%',
        transform: `translate(-50%, ${petY}px)`, opacity: petT * sceneFadeOut,
        whiteSpace: 'nowrap',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 999,
          background: C_ACCENT, color: C_SURFACE, fontSize: 20, fontWeight: 600,
        }}>
          {petName || 'Tu mascota'} ya tiene su identidad
        </div>
      </div>

      {/* Skip button */}
      <button
        onClick={() => { doneCalled.current = true; onDone() }}
        style={{
          position: 'absolute', right: 20, top: 20, padding: '8px 16px', borderRadius: 999,
          border: 'none', background: 'rgba(92,47,24,0.12)', color: C_ACCENT_DARK,
          fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body, Figtree, sans-serif)',
          fontWeight: 500,
        }}
      >
        Continuar
      </button>
    </div>
  )
}
