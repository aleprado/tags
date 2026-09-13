let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function barkNote(ac: AudioContext, startTime: number, freq: number, duration: number, volume: number) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  const filter = ac.createBiquadFilter()

  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(freq, startTime)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, startTime + duration * 0.8)

  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(1800, startTime)
  filter.frequency.exponentialRampToValueAtTime(400, startTime + duration)
  filter.Q.value = 2

  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(ac.destination)

  osc.start(startTime)
  osc.stop(startTime + duration)
}

export function playBark() {
  try {
    const ac = getCtx()
    if (ac.state === 'suspended') ac.resume()
    const now = ac.currentTime
    barkNote(ac, now, 420, 0.12, 0.25)
    barkNote(ac, now + 0.15, 380, 0.15, 0.3)
  } catch { /* audio not available */ }
}

export function playDoubleBark() {
  try {
    const ac = getCtx()
    if (ac.state === 'suspended') ac.resume()
    const now = ac.currentTime
    barkNote(ac, now, 440, 0.1, 0.2)
    barkNote(ac, now + 0.13, 400, 0.12, 0.28)
    barkNote(ac, now + 0.45, 460, 0.1, 0.22)
    barkNote(ac, now + 0.58, 390, 0.14, 0.3)
  } catch { /* audio not available */ }
}

export function playAlertBark() {
  try {
    const ac = getCtx()
    if (ac.state === 'suspended') ac.resume()
    const now = ac.currentTime
    barkNote(ac, now, 500, 0.08, 0.3)
    barkNote(ac, now + 0.1, 460, 0.1, 0.35)
    barkNote(ac, now + 0.25, 520, 0.08, 0.3)
    barkNote(ac, now + 0.35, 470, 0.12, 0.35)
    barkNote(ac, now + 0.55, 540, 0.1, 0.25)
  } catch { /* audio not available */ }
}
