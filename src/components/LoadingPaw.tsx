import { useRafTime } from '../hooks/useRafTime'

const C_ACCENT_BASE = '#a8592a'
const C_ACCENT_DARK = '#5c2f18'
const C_BG = '#f5ead8'
const C_TEXT_MUTED = '#7a6f5c'

function Paw3D({ size, pulse }: { size: number; pulse?: number }) {
  const shared: React.CSSProperties = {
    position: 'absolute', borderRadius: '50%',
    background: 'linear-gradient(155deg, #dfa578 0%, #a8592a 55%, #5c2f18 100%)',
    boxShadow: 'inset -6% -8% 14% rgba(0,0,0,0.28), inset 6% 8% 10% rgba(255,255,255,0.35), 0 6% 10% rgba(0,0,0,0.18)',
  }
  return (
    <div style={{ position: 'relative', width: size, height: size, transform: `rotate(-12deg) scale(${pulse ?? 1})` }}>
      <div style={{ ...shared, left: '22%', top: '46%', width: '56%', height: '48%' }} />
      <div style={{ ...shared, width: '27%', height: '27%', left: '9%', top: '20%' }} />
      <div style={{ ...shared, width: '27%', height: '27%', left: '36.5%', top: '8%' }} />
      <div style={{ ...shared, width: '27%', height: '27%', left: '64%', top: '20%' }} />
    </div>
  )
}

export default function LoadingPaw() {
  const T = useRafTime()
  const period = 1.6
  const cycle = (T % period) / period
  const pulse = 0.85 + 0.15 * (0.5 - 0.5 * Math.cos(cycle * Math.PI * 2))
  const dotsCount = 1 + Math.floor((T % 1.2) / 0.4)
  const wordPulse = 0.9 + 0.1 * (0.5 - 0.5 * Math.cos(((T % 1.2) / 1.2) * Math.PI * 2))

  const rings = [0, 0.53, 1.06].map((offset) => {
    const local = ((T + offset) % period) / period
    return { scale: 0.6 + local * 1.1, opacity: 0.45 * (1 - local) }
  })

  const orbitAngle = (T / 3.2) * Math.PI * 2
  const orbitDots = [0, 1, 2, 3].map((i) => {
    const a = orbitAngle + (i * Math.PI) / 2
    return { x: Math.cos(a) * 78, y: Math.sin(a) * 78, s: Math.max(4, 6 + 2 * Math.sin(a * 2 + T)) }
  })

  return (
    <div style={{
      width: '100%', height: '100vh', background: C_BG, position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28,
      fontFamily: 'var(--font-body, Figtree, sans-serif)', overflow: 'hidden',
    }}>
      <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {rings.map((r, i) => (
          <div key={i} style={{
            position: 'absolute', width: 140, height: 140, borderRadius: '999px',
            border: `2px solid ${C_ACCENT_BASE}`, opacity: r.opacity,
            transform: `scale(${r.scale})`,
          }} />
        ))}
        {orbitDots.map((d, i) => (
          <div key={i} style={{
            position: 'absolute', width: d.s, height: d.s, borderRadius: '999px', background: C_ACCENT_DARK,
            opacity: 0.55, transform: `translate(${d.x}px, ${d.y}px)`,
          }} />
        ))}
        <div style={{
          width: 116, height: 116, borderRadius: '999px', background: '#fffaf1',
          boxShadow: '0 10px 28px rgba(92,47,24,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, position: 'relative',
        }}>
          <Paw3D size={72} pulse={pulse} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ fontFamily: 'var(--font-heading, Caprasimo, serif)', fontSize: 26, color: C_ACCENT_DARK }}>
          Huellitas
        </div>
        <div style={{ fontSize: 16, color: C_TEXT_MUTED, letterSpacing: 0.2 }}>
          Siguiendo el{' '}
          <span style={{ color: C_ACCENT_DARK, fontWeight: 700, display: 'inline-block', transform: `scale(${wordPulse})` }}>
            rastro
          </span>
          {'.'.repeat(dotsCount)}
        </div>
      </div>
    </div>
  )
}
