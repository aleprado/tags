/**
 * Dispara la descarga de un Blob con el nombre dado.
 *
 * Se usa un object URL (same-origin) en vez de linkear directo al asset de
 * Storage: el atributo `download` se ignora en links cross-origin, que es
 * justamente por qué el QR se abría en una pestaña en vez de descargarse.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revocar sincrónicamente aborta la descarga en Safari (y a veces en Firefox
  // con archivos grandes): el navegador todavía no leyó el blob.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
