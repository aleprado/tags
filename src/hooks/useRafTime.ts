import { useEffect, useRef, useState } from 'react'

export function useRafTime() {
  const [t, setT] = useState(0)
  const startRef = useRef<number | null>(null)
  useEffect(() => {
    let raf: number
    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts
      setT((ts - startRef.current) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return t
}
