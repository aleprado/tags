/**
 * Escritor de ZIP mínimo, sin dependencias.
 *
 * Existe porque descargar N archivos sueltos no funciona: Chrome pide permiso
 * para "descargar varios archivos" a partir del segundo y, si se deniega, del
 * 2 al 500 fallan en silencio. Y 500 SVGs sueltos en Descargas es inusable.
 *
 * Sin ZIP64: hasta 65535 entradas y 4 GiB.
 */

export interface ZipEntry {
  name: string
  data: Uint8Array | string
}

let crcTable: Uint32Array | null = null

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  crcTable = t
  return t
}

function crc32(data: Uint8Array): number {
  const t = getCrcTable()
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = t[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Deflate crudo vía CompressionStream. Devuelve null si no está disponible. */
async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob([data as BlobPart]).stream()
      .pipeThrough(new CompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

const DOS_DATE_1980_01_01 = 0x0021

export async function zipFiles(
  entries: ZipEntry[],
  opts: { compress?: boolean } = {},
): Promise<Blob> {
  if (entries.length > 0xffff) {
    throw new Error(`ZIP sin ZIP64: máximo 65535 archivos, se pidieron ${entries.length}`)
  }
  const compress = opts.compress ?? true
  const enc = new TextEncoder()
  const body: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name)
    const raw = typeof entry.data === 'string' ? enc.encode(entry.data) : entry.data
    const crc = crc32(raw)

    let method = 0
    let payload = raw
    if (compress) {
      const deflated = await deflateRaw(raw)
      if (deflated && deflated.length < raw.length) {
        method = 8
        payload = deflated
      }
    }

    // Local file header (30 + nombre). Se comprime ANTES de escribirlo para
    // conocer los tamaños y no necesitar data descriptor.
    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)                     // versión necesaria
    lv.setUint16(6, 0x0800, true)                 // flag: nombre en UTF-8
    lv.setUint16(8, method, true)
    lv.setUint16(10, 0, true)                     // hora
    lv.setUint16(12, DOS_DATE_1980_01_01, true)   // fecha fija ⇒ ZIP determinista
    lv.setUint32(14, crc, true)
    lv.setUint32(18, payload.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)                     // extra field
    local.set(nameBytes, 30)

    body.push(local, payload)

    // Central directory header (46 + nombre)
    const cd = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)                     // creado por
    cv.setUint16(6, 20, true)                     // versión necesaria
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, method, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, DOS_DATE_1980_01_01, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, payload.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true)                     // extra
    cv.setUint16(32, 0, true)                     // comentario
    cv.setUint16(34, 0, true)                     // disco inicial
    cv.setUint16(36, 0, true)                     // atributos internos
    cv.setUint32(38, 0, true)                     // atributos externos
    cv.setUint32(42, offset, true)                // offset del local header
    cd.set(nameBytes, 46)
    central.push(cd)

    offset += local.length + payload.length
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0)

  // End of central directory (22)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(4, 0, true)                        // disco actual
  ev.setUint16(6, 0, true)                        // disco del central dir
  ev.setUint16(8, entries.length, true)           // entradas en este disco
  ev.setUint16(10, entries.length, true)          // entradas totales
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)                  // offset del central dir
  ev.setUint16(20, 0, true)                       // comentario

  const parts = [...body, ...central, eocd] as BlobPart[]
  return new Blob(parts, { type: 'application/zip' })
}
