/**
 * Primitivas de malla para las chapitas 3D.
 *
 * Todo se construye con dos formas: cajas (relieve del QR y del texto) y una
 * losa anular (la base con el agujero del llavero). El sólido final es la unión
 * de ambas, emitida como sopa de triángulos con volúmenes solapados — ver la
 * nota sobre manifoldness en `addSlabWithHole`.
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

/**
 * Contorno CCW de un rectángulo redondeado centrado en (cx,cy), densificado a
 * segmentos de a lo sumo `step` mm.
 *
 * Densificar las rectas NO es cosmético: `addSlabWithHole` proyecta cada
 * vértice del contorno sobre el círculo del agujero, así que un contorno crudo
 * de 4 rectas + 4 arcos dejaría el agujero con 8 vértices y perdería un tercio
 * de su área.
 */
export function roundedRectOutline(
  cx: number, cy: number, w: number, h: number, r: number, step: number,
): Vec2[] {
  const hw = w / 2, hh = h / 2
  const rr = Math.max(0, Math.min(r, hw, hh))
  const ix = hw - rr, iy = hh - rr
  const pts: Vec2[] = []

  // Cada tramo emite su punto inicial pero no el final: el tramo siguiente
  // arranca exactamente ahí.
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

/**
 * Contorno CCW de una gota: círculo grande abajo + dos rectas tangentes +
 * círculo pequeño arriba. Es convexo, por lo que `addSlabWithHole` funciona
 * con cualquier punto interior como centro del agujero.
 *
 * Geometría: `Rb = w/2`, `by = cy - h/2 + Rb`, `ty = cy + h/2 - topR`.
 * Las rectas tangentes se calculan analíticamente (sin intersecciones rayo↔arco).
 */
export function dropOutline(
  cx: number, cy: number,
  w: number, h: number,
  topR: number,
  step: number,
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

  // Puntos de tangencia (simétricos respecto de cx)
  const bRx = cx + Rb * cosA, bRy = by + Rb * sinA   // tangencia derecha, círculo inferior
  const bLx = cx - Rb * cosA, bLy = by + Rb * sinA   // tangencia izquierda, círculo inferior
  const tRx = cx + Rt * cosA, tRy = ty + Rt * sinA   // tangencia derecha, círculo superior
  const tLx = cx - Rt * cosA, tLy = ty + Rt * sinA   // tangencia izquierda, círculo superior

  // 1. Arco inferior — horario (sweep negativo): desde ángulo A, da vuelta por abajo hasta π-A
  arc(cx, by, A, -(Math.PI + 2 * A), Rb)
  // 2. Recta izquierda — sube desde tangencia inferior izquierda hasta superior izquierda
  line(bLx, bLy, tLx, tLy)
  // 3. Arco superior — horario por encima: desde π-A hasta A (pasa por π/2 = cima)
  arc(cx, ty, Math.PI - A, 2 * A - Math.PI, Rt)
  // 4. Recta derecha — baja desde tangencia superior derecha hasta inferior derecha
  line(tRx, tRy, bRx, bRy)

  // La acumulación horaria produce un contorno CW. Invertir → CCW, que es lo
  // que requiere addSlabWithHole (ángulos crecientes vistos desde el agujero).
  pts.reverse()
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

// ─── Losa con agujero ────────────────────────────────────────────────────────

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

/**
 * Losa cerrada con agujero circular y fillet opcional en el borde superior.
 *
 * El contorno `outer` debe ser CCW y convexo (star-shaped respecto del agujero).
 * Con `chamfer > 0`, el borde superior se redondea con un cuarto de círculo de
 * radio `chamfer`, usando `filletSegs` anillos para la curva.
 */
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
  for (let i = 0; i < n; i++) {
    theta[i] = Math.atan2(outer[i].y - hole.cy, outer[i].x - hole.cx)
  }

  let sum = 0
  let maxStep = 0
  for (let i = 0; i < n; i++) {
    const d = wrapPi(theta[(i + 1) % n] - theta[i])
    if (d <= 1e-9) {
      throw new Error('addSlabWithHole: contorno no star-shaped respecto del agujero, o mal muestreado')
    }
    sum += d
    if (d > maxStep) maxStep = d
  }
  if (Math.abs(sum - 2 * Math.PI) > 1e-6) {
    throw new Error('addSlabWithHole: el contorno no da exactamente una vuelta alrededor del agujero')
  }

  const sagitta = hole.r * (1 - Math.cos(maxStep / 2))
  if (sagitta > maxSagittaMm) {
    throw new Error(
      `addSlabWithHole: contorno mal densificado — el agujero quedaría con una ` +
      `sagita de ${sagitta.toFixed(3)} mm (máx ${maxSagittaMm}). Bajá outlineStep.`,
    )
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

// ─── Relieve desde una matriz booleana ───────────────────────────────────────

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * Greedy meshing 2D: junta corridas horizontales de celdas encendidas y las
 * crece hacia abajo mientras las filas siguientes coincidan.
 * Medido sobre un QR v3: 435 celdas → 162 rectángulos.
 */
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

/**
 * Extruye una matriz booleana como relieve.
 * `(ox, oy)` es la esquina INFERIOR IZQUIERDA de la grilla en mm.
 * `row 0` de la matriz es la fila de ARRIBA, así que el eje Y se invierte.
 */
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

/**
 * Extruye una elipse (o círculo si rx === ry) como un sólido cerrado z0..z1.
 * Útil para los elementos de la pata: medallón de fondo, almohadilla y dedos.
 *
 * Los puntos del perímetro van CCW (ángulo creciente), lo que da normal +Z en
 * la cara superior — consistente con `addBox` y el resto de primitivas.
 */
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
    s.tri(cTop, Bi, Bj)          // cara superior, CCW desde +Z
    s.tri(cBot, Aj, Ai)          // cara inferior, CCW desde -Z
    s.tri(Ai, Aj, Bj); s.tri(Ai, Bj, Bi)  // pared lateral, normal radial hacia afuera
  }
}

// ─── Verificación ────────────────────────────────────────────────────────────

/**
 * `TriSink` que en vez de escribir verifica que la malla sea 2-manifold: cada
 * arista dirigida tiene que aparecer exactamente una vez, y su opuesta también.
 *
 * Usarlo sólo sobre la losa (con los relieves apagados). Sobre el mesh completo
 * va a reportar aristas malas por el solape intencional del relieve, y eso NO
 * es una falla.
 */
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
    if (ka === kb || kb === kc || kc === ka) return   // degenerado, igual que StlWriter
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
