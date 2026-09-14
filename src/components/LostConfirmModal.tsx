import { useRafTime } from '../hooks/useRafTime'

const C_ACCENT = '#c67139'
const C_TEXT = '#201e1d'

function clamp01(t: number) { return Math.max(0, Math.min(1, t)) }
function easeOutBack(t: number) {
  const c1 = 1.70158, c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3) }

interface Props {
  petName: string
  hasLocation: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function LostConfirmModal({ petName, hasLocation, onConfirm, onCancel }: Props) {
  const t = useRafTime()

  const overlayFade = clamp01(t / 0.25)
  const cardScale = easeOutBack(clamp01(t / 0.4))
  const cardOpacity = clamp01(t / 0.2)
  const iconPulse = 1 + Math.sin(t * 3) * 0.04
  const iconEnter = easeOutBack(clamp01((t - 0.1) / 0.4))
  const textEnter = easeOutCubic(clamp01((t - 0.2) / 0.35))
  const btnEnter = easeOutCubic(clamp01((t - 0.35) / 0.3))

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: `rgba(0,0,0,${overlayFade * 0.5})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 360, width: '100%',
          background: '#fffaf1',
          borderRadius: 24,
          padding: '32px 28px 28px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 16, textAlign: 'center',
          transform: `scale(${cardScale})`,
          opacity: cardOpacity,
        }}
      >
        {/* Animated warning icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #c0392b18, #e74c3c10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `scale(${iconEnter * iconPulse})`,
          boxShadow: '0 4px 16px rgba(192,57,43,0.12)',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <div style={{ opacity: textEnter, transform: `translateY(${8 * (1 - textEnter)}px)` }}>
          <p style={{
            margin: 0, fontSize: 18, fontWeight: 700, color: C_TEXT,
            fontFamily: 'var(--font-heading)',
          }}>
            Reportar mascota perdida
          </p>
          <p style={{
            margin: '10px 0 0', fontSize: 14, color: C_TEXT, opacity: 0.65,
            lineHeight: 1.6,
          }}>
            Marcar a <strong style={{ color: C_ACCENT }}>{petName}</strong> como perdida?
          </p>
          <p style={{
            margin: '6px 0 0', fontSize: 13, color: C_TEXT, opacity: 0.5,
            lineHeight: 1.5,
          }}>
            {hasLocation
              ? 'Se notificara a vecinos de tu zona para ayudar a encontrarla.'
              : 'Para enviar alertas a vecinos, agrega la ubicacion de tu hogar al editar el tag.'}
          </p>
        </div>

        <div style={{
          display: 'flex', gap: 10, justifyContent: 'center', marginTop: 4, width: '100%',
          opacity: btnEnter, transform: `translateY(${6 * (1 - btnEnter)}px)`,
        }}>
          <button
            className="btn btn-ghost"
            onClick={onCancel}
            style={{ flex: 1, padding: '11px 0', borderRadius: 999, fontSize: 14 }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 999, fontSize: 14,
              background: '#c0392b', border: 'none',
            }}
          >
            Reportar perdida
          </button>
        </div>
      </div>
    </div>
  )
}
