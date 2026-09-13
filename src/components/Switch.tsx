export default function Switch({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={active ? 'Desactivar' : 'Activar'}
      style={{
        width: 44, height: 26, borderRadius: 999, border: 'none', padding: 2,
        cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0,
        background: active ? 'var(--color-accent)' : 'var(--color-neutral-300)',
        transition: 'background 0.15s',
      }}
    >
      <span style={{
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        display: 'block', boxShadow: 'var(--shadow-sm)',
        transform: `translateX(${active ? '18px' : '0px'})`,
        transition: 'transform 0.15s',
      }} />
    </button>
  )
}
