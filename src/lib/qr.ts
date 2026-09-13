// ── SYNC ─────────────────────────────────────────────────────────────────────
// `buildQrSvg` es un port literal de functions/src/index.ts::buildQRSvg.
// El SVG que sube la Cloud Function a Storage y el que se descarga desde el
// panel admin tienen que salir byte-idénticos: si tocás uno, tocá el otro.
// ─────────────────────────────────────────────────────────────────────────────

export const APP_ORIGIN = 'https://huellis.art'
const QR_STORAGE_BASE = 'https://storage.googleapis.com/tags-8bcd8.firebasestorage.app/qr'

/** URL que codifica el QR de un código. */
export function codeUrl(code: string): string {
  return `${APP_ORIGIN}/p/${code}`
}

/** SVG ya subido a Storage. Sólo para `<img>` de preview — para descargar
 *  usá `qrSvgForCode`, porque `download` no funciona cross-origin. */
export function qrStorageUrl(code: string): string {
  return `${QR_STORAGE_BASE}/${code}.svg`
}

export type Ecl = 'L' | 'M' | 'Q' | 'H'

// `qrcode` se carga con import() dinámico para que no entre en el chunk
// principal: sólo lo necesita el panel admin, y recién al descargar.
// NO agregar un import estático de 'qrcode' en este archivo.
let qrLibPromise: Promise<typeof import('qrcode')> | null = null

function loadQrLib(): Promise<typeof import('qrcode')> {
  if (!qrLibPromise) {
    qrLibPromise = import('qrcode').then(mod => {
      // esbuild (dev) y rollup (build) difieren en dónde dejan los named
      // exports de un módulo CJS.
      const m = mod as unknown as { default?: typeof import('qrcode') }
      return m.default ?? (mod as unknown as typeof import('qrcode'))
    })
  }
  return qrLibPromise
}

/** Matriz de módulos del QR. `row 0` es la fila de ARRIBA, `col 0` la columna
 *  de la IZQUIERDA — igual que el SVG resultante. */
export interface QrGrid {
  size: number
  version: number
  /** row-major, 1 = módulo oscuro */
  data: Uint8Array
  get(row: number, col: number): boolean
}

export async function createQrGrid(text: string, ecl: Ecl = 'M'): Promise<QrGrid> {
  const QRCode = await loadQrLib()
  const qr = QRCode.create(text, { errorCorrectionLevel: ecl })
  const size = qr.modules.size
  const data = new Uint8Array(size * size)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      // modules.get() devuelve number, no boolean.
      data[row * size + col] = qr.modules.get(row, col) ? 1 : 0
    }
  }
  return {
    size,
    version: qr.version,
    data,
    get: (row, col) => data[row * size + col] === 1,
  }
}

/** Plantilla del finder pattern: anillo lleno, anillo vacío, núcleo lleno. */
const FINDER = [
  0b1111111,
  0b1000001,
  0b1011101,
  0b1011101,
  0b1011101,
  0b1000001,
  0b1111111,
]

function hasFinder(grid: QrGrid, row0: number, col0: number): boolean {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const expected = ((FINDER[r] >> (6 - c)) & 1) === 1
      if (grid.get(row0 + r, col0 + c) !== expected) return false
    }
  }
  return true
}

/**
 * Verifica que la orientación de la matriz sea la esperada, comparando los tres
 * finder patterns contra la plantilla completa de 7×7. Es lo que fija que
 * `row 0` sea la fila de arriba y `col 0` la columna de la izquierda.
 *
 * Los tres finders cubren espejado y rotación: forman una L en arriba-izquierda,
 * arriba-derecha y abajo-izquierda. Espejar manda ese conjunto a {TR, TL, BR} y
 * rotar 90° a {TR, BR, TL} — en los dos casos abajo-izquierda se queda sin finder.
 *
 * No cubren la TRANSPUESTA, que manda {TL,TR,BL} a {TL,BL,TR}: el mismo conjunto.
 * Por eso se suma el "dark module" del spec, en (4·version + 9, 8), que siempre
 * vale 1 y no es simétrico respecto de la diagonal. Atrapa ~2/3 de las
 * transpuestas (en el resto cae sobre un módulo de data que vale 1 por azar).
 *
 * NO mirar módulos sueltos fuera de los patrones fijos: el resto de la matriz es
 * data + máscara y cambia con cada código. La versión anterior de esta función
 * exigía que la esquina (n-1, n-1) fuera 0 y rechazaba el 16% de los códigos
 * válidos.
 */
export function checkQrOrientation(grid: QrGrid): boolean {
  const n = grid.size
  return (
    hasFinder(grid, 0, 0) &&
    hasFinder(grid, 0, n - 7) &&
    hasFinder(grid, n - 7, 0) &&
    grid.get(4 * grid.version + 9, 8)
  )
}

/**
 * SVG de etiqueta: dots redondeados + pata al centro, corrección H.
 * Port literal de functions/src/index.ts::buildQRSvg — ver nota SYNC arriba.
 */
export async function buildQrSvg(url: string): Promise<string> {
  const QRCode = await loadQrLib()
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' })
  const sz = qr.modules.size
  const margin = 2
  const total = sz + margin * 2
  const bg = '#f5ead8'
  const fg = '#201e1d'
  const f = (n: number) => n.toFixed(3)

  let dots = ''
  for (let row = 0; row < sz; row++) {
    for (let col = 0; col < sz; col++) {
      if (!qr.modules.get(row, col)) continue
      dots += `<rect x="${f(col + margin + 0.07)}" y="${f(row + margin + 0.07)}" width=".86" height=".86" rx=".35" ry=".35" fill="${fg}"/>`
    }
  }

  const c = total / 2
  const paw = [
    `<circle cx="${f(c)}" cy="${f(c)}" r="${f(total * 0.135)}" fill="${bg}"/>`,
    `<ellipse cx="${f(c)}" cy="${f(c + total * 0.025)}" rx="${f(total * 0.078)}" ry="${f(total * 0.058)}" fill="${fg}"/>`,
    `<circle cx="${f(c - total * 0.085)}" cy="${f(c - total * 0.037)}" r="${f(total * 0.030)}" fill="${fg}"/>`,
    `<circle cx="${f(c - total * 0.027)}" cy="${f(c - total * 0.060)}" r="${f(total * 0.030)}" fill="${fg}"/>`,
    `<circle cx="${f(c + total * 0.027)}" cy="${f(c - total * 0.060)}" r="${f(total * 0.030)}" fill="${fg}"/>`,
    `<circle cx="${f(c + total * 0.085)}" cy="${f(c - total * 0.037)}" r="${f(total * 0.030)}" fill="${fg}"/>`,
  ].join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}">` +
    `<rect width="${total}" height="${total}" fill="${bg}" rx="1.5" ry="1.5"/>` +
    dots + paw + `</svg>`
}

/** SVG de etiqueta para un código, idéntico al que está en Storage. */
export function qrSvgForCode(code: string): Promise<string> {
  return buildQrSvg(codeUrl(code))
}
