/**
 * Primitivas de malla para las chapitas 3D.
 *
 * Siluetas soportadas:
 *  - Gota clásica (dropOutline)
 *  - Hueso de collar (boneBodyOutline + boneOutline)
 *  - Pasador de collar (roundedRectOutline + addCollarSlideSlab con ranuras y canal posterior)
 */

import type { TriSink, Vec3 } from './stl'

export interface Vec2 { x: number; y: number }

// ─── Cajas ───────────────────────────────────────────────────────────────────

export function addBox(
  s: TriSink,
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
): void {
  const a: Vec3 = [x0, y0, z0], b: Vec3 = [x1, y0, z0]
  const c: Vec3 = [x1, y1, z0], d: Vec3 = [x0, y1, z0]
  const A: Vec3 = [x0, y0, z1], B: Vec3 = [x1, y0, z1]
  const C: Vec3 = [x1, y1, z1], D: Vec3 = [x0, y1, z1]

  s.tri(A, B, C); s.tri(A, C, D)   // +Z
  s.tri(a, d, c); s.tri(a, c, b)   // −Z
  s.tri(a, b, B); s.tri(a, B, A)   // −Y
  s.tri(c, d, D); s.tri(c, D, C)   // +Y
  s.tri(a, A, D); s.tri(a, D, d)   // −X
  s.tri(b, c, C); s.tri(b, C, B)   // +X
}

// ─── Contorno del rectángulo redondeado ──────────────────────────────────────

export function roundedRectOutline(
  cx: number, cy: number, w: number, h: number, r: number, step = 0.6,
): Vec2[] {
  const hw = w / 2, hh = h / 2
  const rr = Math.max(0, Math.min(r, hw, hh))
  const ix = hw - rr, iy = hh - rr
  const pts: Vec2[] = []

  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const d = Math.hypot(x1 - x0, y1 - y0)
    if (d < 1e-9) return
    const n = Math.max(1, Math.ceil(d / step))
    for (let i = 0; i < n; i++) {
      const t = i / n
      pts.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t })
    }
  }
  const arc = (ax: number, ay: number, a0: number, a1: number) => {
    if (rr < 1e-9) return
    const sweep = a1 - a0
    const n = Math.max(1, Math.ceil((Math.abs(sweep) * rr) / step))
    for (let i = 0; i < n; i++) {
      const t = a0 + sweep * (i / n)
      pts.push({ x: ax + rr * Math.cos(t), y: ay + rr * Math.sin(t) })
    }
  }

  const Q = Math.PI / 2
  line(cx + hw, cy - iy, cx + hw, cy + iy)   // derecha, hacia arriba
  arc(cx + ix, cy + iy, 0, Q)                // esquina sup-der
  line(cx + ix, cy + hh, cx - ix, cy + hh)   // arriba, hacia la izquierda
  arc(cx - ix, cy + iy, Q, 2 * Q)            // esquina sup-izq
  line(cx - hw, cy + iy, cx - hw, cy - iy)   // izquierda, hacia abajo
  arc(cx - ix, cy - iy, 2 * Q, 3 * Q)        // esquina inf-izq
  line(cx - ix, cy - hh, cx + ix, cy - hh)   // abajo, hacia la derecha
  arc(cx + ix, cy - iy, 3 * Q, 4 * Q)        // esquina inf-der
  return pts
}

// ─── Contorno tipo gota ──────────────────────────────────────────────────────

export function dropOutline(
  cx: number, cy: number,
  w: number, h: number,
  topR: number,
  step = 0.6,
): Vec2[] {
  const Rb = w / 2
  const Rt = Math.max(topR, 0.5)
  const by = cy - h / 2 + Rb
  const ty = cy + h / 2 - Rt
  const d = ty - by

  if (d <= 0 || Rb <= Rt || Rb - Rt >= d) {
    throw new Error('dropOutline: dimensiones inválidas (alto insuficiente o radios fuera de rango)')
  }

  const sinA = (Rb - Rt) / d
  const cosA = Math.sqrt(1 - sinA * sinA)
  const A = Math.asin(sinA)

  const pts: Vec2[] = []

  const arc = (ax: number, ay: number, a0: number, sweep: number, r: number) => {
    const n = Math.max(1, Math.ceil(Math.abs(sweep) * r / step))
    for (let i = 0; i < n; i++) {
      const t = a0 + sweep * (i / n)
      pts.push({ x: ax + r * Math.cos(t), y: ay + r * Math.sin(t) })
    }
  }

  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0)
    if (len < 1e-9) return
    const n = Math.max(1, Math.ceil(len / step))
    for (let i = 0; i < n; i++) {
      const t = i / n
      pts.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t })
    }
  }

  const bRx = cx + Rb * cosA, bRy = by + Rb * sinA
  const bLx = cx - Rb * cosA, bLy = by + Rb * sinA
  const tRx = cx + Rt * cosA, tRy = ty + Rt * sinA
  const tLx = cx - Rt * cosA, tLy = ty + Rt * sinA

  arc(cx, by, A, -(Math.PI + 2 * A), Rb)
  line(bLx, bLy, tLx, tLy)
  arc(cx, ty, Math.PI - A, 2 * A - Math.PI, Rt)
  line(tRx, tRy, bRx, bRy)

  pts.reverse()
  return pts
}

// ─── Contornos de Hueso ──────────────────────────────────────────────────────

export function boneBodyOutline(
  cx: number, cy: number,
  w: number, h: number,
  lobeR = 9.5,
  step = 0.4,
): Vec2[] {
  const R = Math.max(4, Math.min(lobeR, w / 4, h / 2.1))
  const dx = w / 2 - R
  const dy = Math.max(2, h / 2 - R)
  const dist = Math.sqrt(Math.max(0.1, R * R - dy * dy))
  const alpha = Math.atan2(dy, dist)

  const topY = cy + dy
  const botY = cy - dy - R
  const pts: Vec2[] = []

  const arc = (ax: number, ay: number, a0: number, sweep: number, r: number) => {
    const n = Math.max(1, Math.ceil(Math.abs(sweep) * r / step))
    for (let k = 0; k < n; k++) {
      const a = a0 + sweep * (k / n)
      pts.push({ x: ax + r * Math.cos(a), y: ay + r * Math.sin(a) })
    }
  }

  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0)
    if (len < 1e-9) return
    const n = Math.max(1, Math.ceil(len / step))
    for (let k = 0; k < n; k++) {
      const t = k / n
      pts.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t })
    }
  }

  arc(cx + dx, cy - dy, -Math.PI / 2, Math.PI / 2 + alpha, R)
  arc(cx + dx, cy + dy, -alpha, Math.PI + alpha, R)
  line(cx + dx - R, topY, cx - (dx - R), topY)
  arc(cx - dx, cy + dy, 0, Math.PI + alpha, R)
  arc(cx - dx, cy - dy, Math.PI - alpha, Math.PI / 2 + alpha, R)
  line(cx - dx, botY, cx + dx, botY)

  return pts
}

export function boneOutline(
  cx: number, cy: number,
  w: number, h: number,
  lobeR = 9.5,
  step = 0.4,
  eyelet: boolean | { holeD?: number; eyeletR?: number } = true,
): Vec2[] {
  if (eyelet === false) return boneBodyOutline(cx, cy, w, h, lobeR, step)

  const R = Math.max(4, Math.min(lobeR, w / 4, h / 2.1))
  const dx = w / 2 - R
  const dy = Math.max(2, h / 2 - R)
  const dist = Math.sqrt(Math.max(0.1, R * R - dy * dy))
  const alpha = Math.atan2(dy, dist)

  const topY = cy + dy
  const botY = cy - dy - R

  const holeD = typeof eyelet === 'object' && eyelet?.holeD ? eyelet.holeD : 3.6
  const holeR = holeD / 2
  const eyeR = typeof eyelet === 'object' && eyelet?.eyeletR ? eyelet.eyeletR : 4.2
  const eyeCy = topY + holeR + 0.6
  const blendR = 1.8
  const blendCy = topY + blendR
  const dyE = blendCy - eyeCy
  const dxE = Math.sqrt(Math.max(0.1, (eyeR + blendR) ** 2 - dyE ** 2))
  const blendRightCx = cx + dxE
  const blendLeftCx = cx - dxE
  const beta = Math.atan2(dyE, dxE)

  const pts: Vec2[] = []

  const arc = (ax: number, ay: number, a0: number, sweep: number, r: number) => {
    const n = Math.max(1, Math.ceil(Math.abs(sweep) * r / step))
    for (let k = 0; k < n; k++) {
      const a = a0 + sweep * (k / n)
      pts.push({ x: ax + r * Math.cos(a), y: ay + r * Math.sin(a) })
    }
  }

  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0)
    if (len < 1e-9) return
    const n = Math.max(1, Math.ceil(len / step))
    for (let k = 0; k < n; k++) {
      const t = k / n
      pts.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t })
    }
  }

  arc(cx + dx, cy - dy, -Math.PI / 2, Math.PI / 2 + alpha, R)
  arc(cx + dx, cy + dy, -alpha, Math.PI + alpha, R)
  line(cx + dx - R, topY, blendRightCx, topY)
  arc(blendRightCx, blendCy, -Math.PI / 2, -Math.PI / 2 + beta, blendR)
  arc(cx, eyeCy, beta, Math.PI - 2 * beta, eyeR)
  arc(blendLeftCx, blendCy, -beta, -Math.PI / 2 + beta, blendR)
  line(blendLeftCx, topY, cx - (dx - R), topY)
  arc(cx - dx, cy + dy, 0, Math.PI + alpha, R)
  arc(cx - dx, cy - dy, Math.PI - alpha, Math.PI / 2 + alpha, R)
  line(cx - dx, botY, cx + dx, botY)

  return pts
}

// ─── Inset de contorno (para chamfer) ────────────────────────────────────────

export function insetContour(pts: Vec2[], amount: number): Vec2[] {
  const n = pts.length
  const result: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]
    const curr = pts[i]
    const next = pts[(i + 1) % n]
    const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y
    const len1 = Math.hypot(dx1, dy1)
    const dx2 = next.x - curr.x, dy2 = next.y - curr.y
    const len2 = Math.hypot(dx2, dy2)
    if (len1 < 1e-9 || len2 < 1e-9) { result.push({ x: curr.x, y: curr.y }); continue }
    const nx1 = -dy1 / len1, ny1 = dx1 / len1
    const nx2 = -dy2 / len2, ny2 = dx2 / len2
    let nx = nx1 + nx2, ny = ny1 + ny2
    const len = Math.hypot(nx, ny)
    if (len < 1e-9) { result.push({ x: curr.x, y: curr.y }); continue }
    nx /= len; ny /= len
    result.push({ x: curr.x + amount * nx, y: curr.y + amount * ny })
  }
  return result
}

// ─── Borde en relieve ────────────────────────────────────────────────────────

export function addBorderRidge(
  s: TriSink,
  outline: Vec2[],
  widthMm: number,
  z0: number,
  z1: number,
): void {
  const inner = insetContour(outline, widthMm)
  emitRing(s, outline, inner, outline, inner, z0, z1)
}

// ─── Losa con agujero (Soporta estrella y polígonos cóncavos con Ear-clipping) ─

function wrapPi(a: number): number {
  while (a <= -Math.PI) a += 2 * Math.PI
  while (a > Math.PI) a -= 2 * Math.PI
  return a
}

function emitRing(
  s: TriSink,
  outerBot: Vec2[], innerBot: Vec2[],
  outerTop: Vec2[], innerTop: Vec2[],
  z0: number, z1: number,
): void {
  const n = outerBot.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const Ab: Vec3 = [innerBot[i].x, innerBot[i].y, z0]
    const Bb: Vec3 = [outerBot[i].x, outerBot[i].y, z0]
    const Cb: Vec3 = [outerBot[j].x, outerBot[j].y, z0]
    const Db: Vec3 = [innerBot[j].x, innerBot[j].y, z0]
    const At: Vec3 = [innerTop[i].x, innerTop[i].y, z1]
    const Bt: Vec3 = [outerTop[i].x, outerTop[i].y, z1]
    const Ct: Vec3 = [outerTop[j].x, outerTop[j].y, z1]
    const Dt: Vec3 = [innerTop[j].x, innerTop[j].y, z1]
    s.tri(At, Bt, Ct); s.tri(At, Ct, Dt)
    s.tri(Db, Cb, Bb); s.tri(Db, Bb, Ab)
    s.tri(Bb, Cb, Ct); s.tri(Bb, Ct, Bt)
    s.tri(Ab, At, Dt); s.tri(Ab, Dt, Db)
  }
}

/** Triangula un polígono con agujero usando ear clipping (para huesos u otras formas no convexas) */
function triangulateWithHoleEarClip(outer: Vec2[], hole: { cx: number; cy: number; r: number }, holeSegs = 24): [Vec2, Vec2, Vec2][] {
  const holePts: Vec2[] = []
  for (let i = 0; i < holeSegs; i++) {
    const a = -(i * 2 * Math.PI) / holeSegs
    holePts.push({ x: hole.cx + hole.r * Math.cos(a), y: hole.cy + hole.r * Math.sin(a) })
  }
  let bestHoleIdx = 0
  for (let i = 1; i < holePts.length; i++) {
    if (holePts[i].x > holePts[bestHoleIdx].x) bestHoleIdx = i
  }
  const hPt = holePts[bestHoleIdx]
  let bestDist = Infinity
  let bestOuterIdx = 0
  for (let i = 0; i < outer.length; i++) {
    const d = Math.hypot(outer[i].x - hPt.x, outer[i].y - hPt.y)
    if (d < bestDist) { bestDist = d; bestOuterIdx = i }
  }

  const poly: Vec2[] = []
  for (let i = 0; i <= bestOuterIdx; i++) poly.push(outer[i])
  for (let i = 0; i < holeSegs; i++) poly.push(holePts[(bestHoleIdx + i) % holeSegs])
  poly.push(holePts[bestHoleIdx])
  for (let i = bestOuterIdx; i < outer.length; i++) poly.push(outer[i])

  const tris: [Vec2, Vec2, Vec2][] = []
  const verts = [...poly]
  let guard = 0
  const maxIter = verts.length * 3
  while (verts.length > 3 && guard < maxIter) {
    let earFound = false
    for (let i = 0; i < verts.length; i++) {
      const prev = verts[(i - 1 + verts.length) % verts.length]
      const curr = verts[i]
      const next = verts[(i + 1) % verts.length]

      const cross = (curr.x - prev.x) * (next.y - prev.y) - (curr.y - prev.y) * (next.x - prev.x)
      if (cross <= 1e-9) continue

      let hasPointInside = false
      for (let j = 0; j < verts.length; j++) {
        if (j === (i - 1 + verts.length) % verts.length || j === i || j === (i + 1) % verts.length) continue
        const p = verts[j]
        const c1 = (curr.x - prev.x) * (p.y - prev.y) - (curr.y - prev.y) * (p.x - prev.x)
        const c2 = (next.x - curr.x) * (p.y - curr.y) - (next.y - curr.y) * (p.x - curr.x)
        const c3 = (prev.x - next.x) * (p.y - next.y) - (prev.y - next.y) * (p.x - next.x)
        if (c1 >= 0 && c2 >= 0 && c3 >= 0) { hasPointInside = true; break }
      }

      if (!hasPointInside) {
        tris.push([prev, curr, next])
        verts.splice(i, 1)
        earFound = true
        break
      }
    }
    if (!earFound) break
    guard++
  }
  if (verts.length === 3) tris.push([verts[0], verts[1], verts[2]])
  return tris
}

export function addSlabWithHole(
  s: TriSink,
  outer: Vec2[],
  hole: { cx: number; cy: number; r: number },
  z0: number,
  z1: number,
  maxSagittaMm = 0.05,
  chamfer = 0,
  filletSegs = 6,
  filletSide: 'top' | 'bottom' = 'top',
): void {
  const n = outer.length
  if (n < 3) throw new Error('addSlabWithHole: el contorno necesita al menos 3 vértices')

  const theta = new Float64Array(n)
  for (let i = 0; i < n; i++) theta[i] = Math.atan2(outer[i].y - hole.cy, outer[i].x - hole.cx)

  let sum = 0
  let maxStep = 0
  let isStar = true
  for (let i = 0; i < n; i++) {
    const d = wrapPi(theta[(i + 1) % n] - theta[i])
    if (d <= 1e-9) { isStar = false; break }
    sum += d
    if (d > maxStep) maxStep = d
  }
  if (Math.abs(sum - 2 * Math.PI) > 1e-6) isStar = false

  if (!isStar) {
    const tris = triangulateWithHoleEarClip(outer, hole, 24)
    for (const [p1, p2, p3] of tris) {
      s.tri([p1.x, p1.y, z1], [p2.x, p2.y, z1], [p3.x, p3.y, z1])
      s.tri([p3.x, p3.y, z0], [p2.x, p2.y, z0], [p1.x, p1.y, z0])
    }
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n
      const b0: Vec3 = [outer[i].x, outer[i].y, z0]
      const b1: Vec3 = [outer[next].x, outer[next].y, z0]
      const t0: Vec3 = [outer[i].x, outer[i].y, z1]
      const t1: Vec3 = [outer[next].x, outer[next].y, z1]
      s.tri(b0, b1, t1); s.tri(b0, t1, t0)
    }
    const hSegs = 24
    for (let i = 0; i < hSegs; i++) {
      const a0 = (i * 2 * Math.PI) / hSegs
      const a1 = ((i + 1) * 2 * Math.PI) / hSegs
      const b0: Vec3 = [hole.cx + hole.r * Math.cos(a0), hole.cy + hole.r * Math.sin(a0), z0]
      const b1: Vec3 = [hole.cx + hole.r * Math.cos(a1), hole.cy + hole.r * Math.sin(a1), z0]
      const t0: Vec3 = [hole.cx + hole.r * Math.cos(a0), hole.cy + hole.r * Math.sin(a0), z1]
      const t1: Vec3 = [hole.cx + hole.r * Math.cos(a1), hole.cy + hole.r * Math.sin(a1), z1]
      s.tri(b1, b0, t0); s.tri(b1, t0, t1)
    }
    return
  }

  const sagitta = hole.r * (1 - Math.cos(maxStep / 2))
  if (sagitta > maxSagittaMm) {
    throw new Error(`addSlabWithHole: contorno mal densificado — el agujero quedaría con una sagita de ${sagitta.toFixed(3)} mm (máx ${maxSagittaMm}). Bajá outlineStep.`)
  }

  const inner: Vec2[] = outer.map((_, i) => ({
    x: hole.cx + hole.r * Math.cos(theta[i]),
    y: hole.cy + hole.r * Math.sin(theta[i]),
  }))

  const makeInsetRing = (inset: number) => ({
    outer: inset > 1e-9 ? insetContour(outer, inset) : outer,
    inner: outer.map((_, i) => ({
      x: hole.cx + (hole.r + inset) * Math.cos(theta[i]),
      y: hole.cy + (hole.r + inset) * Math.sin(theta[i]),
    })),
  })

  const R = Math.max(0, Math.min(chamfer, (z1 - z0) * 0.4))
  if (R > 0) {
    const segs = Math.max(2, filletSegs)
    if (filletSide === 'top') {
      const zStart = z1 - R
      emitRing(s, outer, inner, outer, inner, z0, zStart)
      for (let k = 0; k < segs; k++) {
        const a0 = (k / segs) * (Math.PI / 2)
        const a1 = ((k + 1) / segs) * (Math.PI / 2)
        const bot = makeInsetRing(R * Math.sin(a0))
        const top = makeInsetRing(R * Math.sin(a1))
        emitRing(s, bot.outer, bot.inner, top.outer, top.inner,
          zStart + R * (1 - Math.cos(a0)), zStart + R * (1 - Math.cos(a1)))
      }
    } else {
      for (let k = 0; k < segs; k++) {
        const a0 = (k / segs) * (Math.PI / 2)
        const a1 = ((k + 1) / segs) * (Math.PI / 2)
        const bot = makeInsetRing(R * Math.cos(a0))
        const top = makeInsetRing(R * Math.cos(a1))
        emitRing(s, bot.outer, bot.inner, top.outer, top.inner,
          z0 + R * Math.sin(a0), z0 + R * Math.sin(a1))
      }
      emitRing(s, outer, inner, outer, inner, z0 + R, z1)
    }
  } else {
    emitRing(s, outer, inner, outer, inner, z0, z1)
  }
}

// ─── Losa de Pasador con Ranuras y Canal Posterior (Anti-Ondulado) ────────────

/**
 * Genera la losa de pasador de collar con 2 ranuras pasantes y un CANAL posterior
 * rehundido entre ranuras para que la cinta del collar no quede aplastada ni ondulada.
 *
 * z0: base inferior exterior (Z = 0)
 * z1: cara frontal donde nace el QR (Z = baseThickness)
 * channelDepth: profundidad del canal trasero de paso de cinta (ej. 1.2 a 2.0 mm)
 */
export function addCollarSlideSlab(
  s: TriSink,
  cx: number, cy: number,
  w: number, h: number,
  cornerR: number,
  slotW: number, slotH: number,
  slotMargin: number,
  z0: number, z1: number,
  outlineStep = 0.6,
  channelDepth = 1.4,
): void {
  const outer = roundedRectOutline(cx, cy, w, h, cornerR, outlineStep)
  const n = outer.length

  const topSlotTop = cy + h / 2 - slotMargin
  const topSlotBot = topSlotTop - slotH
  const botSlotBot = cy - h / 2 + slotMargin
  const botSlotTop = botSlotBot + slotH

  const sl = cx - slotW / 2
  const sr = cx + slotW / 2
  const pl = cx - w / 2
  const pr = cx + w / 2

  // Canal trasero entre ranuras (despeja el paso recto del collar)
  // zChan: fondo del canal deprimido en la cara posterior
  const maxChanDepth = Math.max(0, Math.min(channelDepth, (z1 - z0) * 0.65))
  const zChan = z0 + maxChanDepth

  // Función helper para triangular abanicos de polígonos cerrados
  const fan = (pts: Vec2[], zFloor: number, zCeil: number) => {
    if (pts.length < 3) return
    for (let i = 1; i < pts.length - 1; i++) {
      s.tri([pts[0].x, pts[0].y, zCeil], [pts[i].x, pts[i].y, zCeil], [pts[i + 1].x, pts[i + 1].y, zCeil])
      s.tri([pts[0].x, pts[0].y, zFloor], [pts[i + 1].x, pts[i + 1].y, zFloor], [pts[i].x, pts[i].y, zFloor])
    }
  }

  // Helper para quad entre dos niveles Z (zFloor a zCeil)
  const quadZ = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, zFloor: number, zCeil: number) => {
    // cara superior (+Z)
    s.tri([p0.x, p0.y, zCeil], [p1.x, p1.y, zCeil], [p2.x, p2.y, zCeil])
    s.tri([p0.x, p0.y, zCeil], [p2.x, p2.y, zCeil], [p3.x, p3.y, zCeil])
    // cara inferior (-Z)
    s.tri([p0.x, p0.y, zFloor], [p2.x, p2.y, zFloor], [p1.x, p1.y, zFloor])
    s.tri([p0.x, p0.y, zFloor], [p3.x, p3.y, zFloor], [p2.x, p2.y, zFloor])
  }

  // 1. Franja Superior (arriba de la ranura superior) -> z0 a z1
  const topPoly: Vec2[] = [{ x: pr, y: topSlotTop }]
  for (let i = 0; i < n; i++) if (outer[i].y > topSlotTop) topPoly.push(outer[i])
  topPoly.push({ x: pl, y: topSlotTop })
  fan(topPoly, z0, z1)

  // 2. Laterales de la ranura superior -> z0 a z1
  quadZ({ x: pl, y: topSlotBot }, { x: sl, y: topSlotBot }, { x: sl, y: topSlotTop }, { x: pl, y: topSlotTop }, z0, z1)
  quadZ({ x: sr, y: topSlotBot }, { x: pr, y: topSlotBot }, { x: pr, y: topSlotTop }, { x: sr, y: topSlotTop }, z0, z1)

  // 3. Franja Central:
  //    - Los lados izquierdo y derecho fuera del canal quedan macizos de z0 a z1
  //    - La zona central (donde pasa el collar) tiene canal trasero rehundido a zChan
  if (maxChanDepth > 0) {
    // Paredes laterales sólidas a z0..z1
    quadZ({ x: pl, y: botSlotTop }, { x: sl, y: botSlotTop }, { x: sl, y: topSlotBot }, { x: pl, y: topSlotBot }, z0, z1)
    quadZ({ x: sr, y: botSlotTop }, { x: pr, y: botSlotTop }, { x: pr, y: topSlotBot }, { x: sr, y: topSlotBot }, z0, z1)

    // Zona central con canal: zChan a z1
    quadZ({ x: sl, y: botSlotTop }, { x: sr, y: botSlotTop }, { x: sr, y: topSlotBot }, { x: sl, y: topSlotBot }, zChan, z1)

    // Paredes escalonadas del canal en la espalda (de z0 a zChan)
    // Pared izquierda del canal (x = sl)
    s.tri([sl, botSlotTop, z0], [sl, topSlotBot, z0], [sl, topSlotBot, zChan])
    s.tri([sl, botSlotTop, z0], [sl, topSlotBot, zChan], [sl, botSlotTop, zChan])
    // Pared derecha del canal (x = sr)
    s.tri([sr, topSlotBot, z0], [sr, botSlotTop, z0], [sr, botSlotTop, zChan])
    s.tri([sr, topSlotBot, z0], [sr, botSlotTop, zChan], [sr, topSlotBot, zChan])
  } else {
    // Sin canal rehundido
    quadZ({ x: pl, y: botSlotTop }, { x: pr, y: botSlotTop }, { x: pr, y: topSlotBot }, { x: pl, y: topSlotBot }, z0, z1)
  }

  // 4. Laterales de la ranura inferior -> z0 a z1
  quadZ({ x: pl, y: botSlotBot }, { x: sl, y: botSlotBot }, { x: sl, y: botSlotTop }, { x: pl, y: botSlotTop }, z0, z1)
  quadZ({ x: sr, y: botSlotBot }, { x: pr, y: botSlotBot }, { x: pr, y: botSlotTop }, { x: sr, y: botSlotTop }, z0, z1)

  // 5. Franja Inferior (debajo de la ranura inferior) -> z0 a z1
  const botPoly: Vec2[] = [{ x: pl, y: botSlotBot }]
  for (let i = 0; i < n; i++) if (outer[i].y < botSlotBot) botPoly.push(outer[i])
  botPoly.push({ x: pr, y: botSlotBot })
  fan(botPoly, z0, z1)

  // 6. Paredes exteriores del perímetro redondeado
  for (let i = 0; i < n; i++) {
    const pA = outer[i]
    const pB = outer[(i + 1) % n]
    s.tri([pA.x, pA.y, z0], [pB.x, pB.y, z0], [pB.x, pB.y, z1])
    s.tri([pA.x, pA.y, z0], [pB.x, pB.y, z1], [pA.x, pA.y, z1])
  }

  // 7. Paredes internas de las 2 ranuras
  const slotWalls = (yBottom: number, yTop: number, isUpperSlot: boolean) => {
    // Si la ranura toca el canal central, su pared interior colinda con zChan en vez de z0
    const slotZBot_inner = isUpperSlot ? zChan : z0
    const slotZBot_outer = isUpperSlot ? z0 : zChan

    // Pared abajo
    s.tri([sl, yBottom, slotZBot_outer], [sr, yBottom, slotZBot_outer], [sr, yBottom, z1])
    s.tri([sl, yBottom, slotZBot_outer], [sr, yBottom, z1], [sl, yBottom, z1])
    // Pared arriba
    s.tri([sr, yTop, slotZBot_inner], [sl, yTop, slotZBot_inner], [sl, yTop, z1])
    s.tri([sr, yTop, slotZBot_inner], [sl, yTop, z1], [sr, yTop, z1])
    // Pared izquierda
    s.tri([sl, yTop, z0], [sl, yBottom, z0], [sl, yBottom, z1])
    s.tri([sl, yTop, z0], [sl, yBottom, z1], [sl, yTop, z1])
    // Pared derecha
    s.tri([sr, yBottom, z0], [sr, yTop, z0], [sr, yTop, z1])
    s.tri([sr, yBottom, z0], [sr, yTop, z1], [sr, yBottom, z1])
  }

  slotWalls(topSlotBot, topSlotTop, true)
  slotWalls(botSlotBot, botSlotTop, false)
}

// ─── Relieve desde una matriz booleana ───────────────────────────────────────

export interface Rect { x: number; y: number; w: number; h: number }

export function greedyRects(data: Uint8Array, w: number, h: number): Rect[] {
  const used = new Uint8Array(w * h)
  const out: Rect[] = []

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const i = row * w + col
      if (!data[i] || used[i]) continue

      let end = col
      while (end < w && data[row * w + end] && !used[row * w + end]) end++
      const rw = end - col

      let rh = 1
      grow: while (row + rh < h) {
        const r2 = row + rh
        for (let c = col; c < end; c++) {
          const k = r2 * w + c
          if (!data[k] || used[k]) break grow
        }
        rh++
      }

      for (let r2 = row; r2 < row + rh; r2++) {
        for (let c = col; c < end; c++) used[r2 * w + c] = 1
      }
      out.push({ x: col, y: row, w: rw, h: rh })
    }
  }
  return out
}

export function addGridRelief(
  s: TriSink,
  data: Uint8Array, w: number, h: number,
  ox: number, oy: number, cell: number,
  z0: number, z1: number,
): Rect[] {
  const rects = greedyRects(data, w, h)
  for (const r of rects) {
    addBox(
      s,
      ox + r.x * cell,
      oy + (h - r.y - r.h) * cell,
      z0,
      ox + (r.x + r.w) * cell,
      oy + (h - r.y) * cell,
      z1,
    )
  }
  return rects
}

// ─── Elipse / disco en relieve ───────────────────────────────────────────────

export function addEllipseRelief(
  s: TriSink,
  cx: number, cy: number,
  rx: number, ry: number,
  z0: number, z1: number,
  step = 0.6,
): void {
  const perim = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2)
  const n = Math.max(8, Math.ceil(perim / step))
  const xs = new Float64Array(n)
  const ys = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n
    xs[i] = cx + rx * Math.cos(t)
    ys[i] = cy + ry * Math.sin(t)
  }

  const cTop: Vec3 = [cx, cy, z1]
  const cBot: Vec3 = [cx, cy, z0]
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const Ai: Vec3 = [xs[i], ys[i], z0]
    const Aj: Vec3 = [xs[j], ys[j], z0]
    const Bi: Vec3 = [xs[i], ys[i], z1]
    const Bj: Vec3 = [xs[j], ys[j], z1]
    s.tri(cTop, Bi, Bj)
    s.tri(cBot, Aj, Ai)
    s.tri(Ai, Aj, Bj); s.tri(Ai, Bj, Bi)
  }
}

// ─── Rasterizado de Texto para Grabado Trasero (Bajo Relieve) ────────────────

export interface RasterText {
  data: Uint8Array
  cols: number
  rows: number
  widthMm: number
  heightMm: number
  pixelMm: number
}

export function rasterizeText(
  text: string,
  targetHeightMm = 3.6,
  pixelMm = 0.35,
  fontFamily = '"Figtree", system-ui, sans-serif',
  fontWeight = 'bold',
): RasterText {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('rasterizeText: no se pudo obtener contexto 2D de canvas')

  const fontPx = 64
  ctx.font = `${fontWeight} ${fontPx}px ${fontFamily}`
  const metrics = ctx.measureText(text)
  const textH = (metrics.actualBoundingBoxAscent ?? fontPx * 0.8) + (metrics.actualBoundingBoxDescent ?? fontPx * 0.2)
  const textW = metrics.width

  const pad = 8
  canvas.width = Math.ceil(textW + pad * 2)
  canvas.height = Math.ceil(textH + pad * 2)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = `${fontWeight} ${fontPx}px ${fontFamily}`
  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'top'
  ctx.fillText(text, pad, pad)

  const scale = targetHeightMm / textH
  const widthMm = textW * scale
  const cols = Math.max(8, Math.ceil(widthMm / pixelMm))
  const rows = Math.max(6, Math.ceil(targetHeightMm / pixelMm))

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = new Uint8Array(cols * rows)

  for (let r = 0; r < rows; r++) {
    const py = Math.min(canvas.height - 1, Math.floor(pad + (r / rows) * textH))
    for (let c = 0; c < cols; c++) {
      const px = Math.min(canvas.width - 1, Math.floor(pad + (c / cols) * textW))
      const idx = (py * canvas.width + px) * 4
      const lum = (img.data[idx] + img.data[idx + 1] + img.data[idx + 2]) / 3
      if (lum < 160) data[r * cols + c] = 1
    }
  }

  return { data, cols, rows, widthMm: cols * pixelMm, heightMm: rows * pixelMm, pixelMm }
}

/**
 * Graba texto en bajo relieve (deboss) en la cara inferior.
 * IMPORTANTE: El texto se espeja en X para que al mirar la chapa desde atrás
 * quede legible al derecho.
 */
export function addDebossedText(
  s: TriSink,
  text: string,
  cx: number, cy: number,
  zBottom = 0,
  depth = 0.6,
  targetHeightMm = 3.2,
  pixelMm = 0.35,
): void {
  const r = rasterizeText(text, targetHeightMm, pixelMm)
  // Invertir texto: fondo = 1 (relleno), glifo = 0 (cavidad vacía).
  // Y espejar en X para lectura correcta desde el dorso de la chapa.
  const inv = new Uint8Array(r.cols * r.rows)
  for (let row = 0; row < r.rows; row++) {
    for (let col = 0; col < r.cols; col++) {
      const srcIdx = row * r.cols + col
      const dstCol = r.cols - 1 - col // espejado en X
      inv[row * r.cols + dstCol] = r.data[srcIdx] === 1 ? 0 : 1
    }
  }

  const ox = cx - r.widthMm / 2
  const oy = cy - r.heightMm / 2

  const rects = greedyRects(inv, r.cols, r.rows)
  for (const rc of rects) {
    addBox(
      s,
      ox + rc.x * r.pixelMm,
      oy + (r.rows - rc.y - rc.h) * r.pixelMm,
      zBottom,
      ox + (rc.x + rc.w) * r.pixelMm,
      oy + (r.rows - rc.y) * r.pixelMm,
      zBottom + depth,
    )
  }
}

// ─── Verificación ────────────────────────────────────────────────────────────

export class ManifoldChecker implements TriSink {
  private edges = new Map<string, number>()
  private n = 0

  private static key(p: Vec3): string {
    return `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)},${Math.round(p[2] * 1e6)}`
  }

  tri(a: Vec3, b: Vec3, c: Vec3): void {
    const ka = ManifoldChecker.key(a)
    const kb = ManifoldChecker.key(b)
    const kc = ManifoldChecker.key(c)
    if (ka === kb || kb === kc || kc === ka) return
    this.n++
    for (const k of [`${ka}>${kb}`, `${kb}>${kc}`, `${kc}>${ka}`]) {
      this.edges.set(k, (this.edges.get(k) ?? 0) + 1)
    }
  }

  get result(): { ok: boolean; badEdges: number; triangles: number } {
    let bad = 0
    for (const [k, count] of this.edges) {
      if (count !== 1) { bad++; continue }
      const [u, v] = k.split('>')
      if ((this.edges.get(`${v}>${u}`) ?? 0) !== 1) bad++
    }
    return { ok: bad === 0, badEdges: bad, triangles: this.n }
  }
}
