/**
 * Escritor de STL binario.
 *
 * Formato: 80 bytes de header + uint32 con la cantidad de triángulos +
 * 50 bytes por triángulo (normal 3×f32, 3 vértices 3×f32, uint16 attribute).
 * Todo little-endian. El STL es adimensional; los slicers asumen milímetros.
 */

export type Vec3 = readonly [number, number, number]

export interface TriSink {
  tri(a: Vec3, b: Vec3, c: Vec3): void
}

const TRI_BYTES = 50
const TRIS_PER_CHUNK = 4096
const CHUNK_BYTES = TRI_BYTES * TRIS_PER_CHUNK

export class StlWriter implements TriSink {
  private chunks: Uint8Array[] = []
  private view!: DataView
  private off = 0
  private n = 0
  private readonly header: string

  constructor(header = 'huellitas.app tag3d v1') {
    // Varios parsers deciden ASCII-vs-binario mirando si el archivo arranca
    // con "solid", así que el header no puede empezar así.
    this.header = header.startsWith('solid') ? `# ${header}` : header
    this.pushChunk()
  }

  private pushChunk(): void {
    const buf = new Uint8Array(CHUNK_BYTES)
    this.chunks.push(buf)
    this.view = new DataView(buf.buffer)
    this.off = 0
  }

  get count(): number {
    return this.n
  }

  /** `a,b,c` en sentido antihorario visto desde afuera del sólido. */
  tri(a: Vec3, b: Vec3, c: Vec3): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
    // Descartar degenerados es seguro para la manifoldness: en un triángulo con
    // dos vértices coincidentes las aristas restantes se cancelan entre sí.
    if (len < 1e-9) return
    nx /= len; ny /= len; nz /= len

    if (this.off === CHUNK_BYTES) this.pushChunk()
    const v = this.view
    const o = this.off
    v.setFloat32(o, nx, true); v.setFloat32(o + 4, ny, true); v.setFloat32(o + 8, nz, true)
    v.setFloat32(o + 12, a[0], true); v.setFloat32(o + 16, a[1], true); v.setFloat32(o + 20, a[2], true)
    v.setFloat32(o + 24, b[0], true); v.setFloat32(o + 28, b[1], true); v.setFloat32(o + 32, b[2], true)
    v.setFloat32(o + 36, c[0], true); v.setFloat32(o + 40, c[1], true); v.setFloat32(o + 44, c[2], true)
    v.setUint16(o + 48, 0, true)
    this.off += TRI_BYTES
    this.n++
  }

  /** Tamaño exacto del archivo resultante. Invariante barata de verificación. */
  get byteLength(): number {
    return 84 + TRI_BYTES * this.n
  }

  private parts(): Uint8Array[] {
    const head = new Uint8Array(80)
    head.set(new TextEncoder().encode(this.header).subarray(0, 80))
    const count = new Uint8Array(4)
    new DataView(count.buffer).setUint32(0, this.n, true)

    const out: Uint8Array[] = [head, count]
    for (let i = 0; i < this.chunks.length; i++) {
      const last = i === this.chunks.length - 1
      out.push(last ? this.chunks[i].subarray(0, this.off) : this.chunks[i])
    }
    return out
  }

  toBlob(): Blob {
    // El Blob toma las partes tal cual; no hay una concatenación grande en JS.
    return new Blob(this.parts() as BlobPart[], { type: 'model/stl' })
  }

  toUint8Array(): Uint8Array {
    const out = new Uint8Array(this.byteLength)
    let o = 0
    for (const p of this.parts()) { out.set(p, o); o += p.length }
    return out
  }
}

/** Bounding box de un STL binario ya serializado. Para verificar escala. */
export function stlBounds(bytes: Uint8Array): {
  triangles: number
  min: [number, number, number]
  max: [number, number, number]
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const triangles = view.getUint32(80, true)
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let t = 0; t < triangles; t++) {
    const base = 84 + t * TRI_BYTES + 12
    for (let v = 0; v < 3; v++) {
      for (let axis = 0; axis < 3; axis++) {
        const val = view.getFloat32(base + v * 12 + axis * 4, true)
        if (val < min[axis]) min[axis] = val
        if (val > max[axis]) max[axis] = val
      }
    }
  }
  return { triangles, min, max }
}
