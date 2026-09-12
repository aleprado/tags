# Huellitas / TagConnect — Contexto para Claude Code

## Qué es el proyecto
SPA de tags QR para mascotas. Cada llavero físico tiene un QR que lleva a `/p/{code}`. Si el tag está activado, muestra el perfil de la mascota y permite contactar al dueño por WhatsApp o llamada. Si no está activado, invita al dueño a configurarlo.

**Repo GitHub:** `aleprado/tags`
**Firebase project:** `tags-8bcd8` (SIEMPRE usar `--project tags-8bcd8` en todos los comandos firebase, hay otro proyecto en la cuenta que no debe tocarse)
**URL producción:** https://tags-8bcd8.web.app

---

## Stack
- **Frontend:** React 18 + TypeScript + Vite, sin librería UI (CSS custom con tokens)
- **Backend:** Firebase Hosting + Cloud Functions v2 (Node.js 22, Cloud Run)
- **DB:** Firestore
- **Auth:** Firebase Auth (email/password + Google)
- **Storage:** Firebase Storage (fotos de mascotas, QR SVGs)
- **Pagos:** MercadoPago (webhook + preferencias)

---

## Estructura de archivos clave

```
src/
  App.tsx                  — Router principal (rutas públicas y protegidas)
  context/AuthContext.tsx  — Provider de auth: user, role, login/logout/register
  lib/
    firebase.ts            — initializeApp; exporta auth, db, storage, isConfigured
    firestore.ts           — Helpers de Firestore (getTag, getCode, claimCode, saveScan…)
    types.ts               — TagDoc, CodeDoc, UserDoc
    qr.ts                  — codeUrl, qrStorageUrl, createQrGrid, buildQrSvg, checkQrOrientation
                             (buildQrSvg es port LITERAL de functions/src/index.ts::buildQRSvg)
    download.ts            — downloadBlob(blob, filename)
    zip.ts                 — zipFiles(): escritor de ZIP sin dependencias
    stl.ts                 — StlWriter (STL binario), stlBounds
    mesh.ts                — addBox, roundedRectOutline, addSlabWithHole, greedyRects,
                             addGridRelief, ManifoldChecker
    tag3d.ts               — Chapita 3D: DEFAULT_TAG3D, computeLayout, rasterText,
                             buildPlate, plateFootprint, buildSheet, chunkSheets
  hooks/
    useRafTime.ts          — RAF loop → retorna elapsed time (segundos); usado para animaciones 60fps
  components/
    LoadingPaw.tsx         — Pantalla de carga full-screen (pata 3D + anillos + dots orbitales)
    ActivationScene.tsx    — Animación de 8.5s al activar tag (QR → pata → confetti → "¡Tag activado!")
    ProtectedRoute.tsx     — Guard de rutas; acepta prop `adminOnly`
  layouts/
    AppLayout.tsx          — Shell autenticado (nav + contenido)
  pages/
    PublicProfile.tsx      — Perfil público de mascota (ruta /p/:tagId, sin auth)
    TagForm.tsx            — Alta y edición de tags (ruta /app/tags/nuevo y /app/tags/:id/editar)
    Dashboard.tsx          — Lista de tags del usuario (/app/tags)
    Login.tsx              — Login/registro (/login)
    Onboarding.tsx         — Flujo de activación para usuarios nuevos (/activar?code=HU-xxx)
    Admin.tsx              — Panel admin: generar códigos, listar, imprimir (/admin)
    PrintLabels.tsx        — Vista de impresión de etiquetas QR en papel (/admin/print)
    Print3D.tsx            — Generador de STL para impresión 3D (/admin/print3d)
  styles/tokens.css        — Design tokens (colores, tipografía, espaciado, sombras)

functions/src/
  index.ts                 — Cloud Functions:
    generateQRBatch        — Admin: genera N códigos, sube SVGs al Storage
    claimCode              — Usuario: vincula code → tag (crea el tag en Firestore)
    deleteTag              — Usuario: elimina tag y libera el code
    createMPPreference     — Crea preferencia de pago en MercadoPago
    mpWebhook              — Webhook de MercadoPago (marca código como vendido)

firestore.rules            — Reglas de seguridad
public/paw.svg             — Favicon (pata con gradiente marrón, -12° rotación)
```

---

## Colecciones de Firestore

### `codes/{codeId}`
```
status: 'sin_vender' | 'vendido_sin_reclamar' | 'reclamado'
tagId?: string          — se llena al reclamar
soldChannel?: 'checkout' | 'ml'
soldAt?, claimedAt?, createdAt: Timestamp
```
- **Lectura pública** (`allow read: if true`)
- Solo Cloud Functions pueden crear/borrar; admins pueden actualizar

### `tags/{tagId}`
```
code: string            — el código HU-xxx asociado
ownerUid: string
type: 'mascota' | 'objeto'
active: boolean
petName?, species?, breed?, age?, healthNotes?
ownerName?, ownerPhone?  — ownerPhone incluye +54 como prefijo
photoUrl?, homeLocation?: { lat, lng }
createdAt, updatedAt: Timestamp
```
- **Lectura pública** (`allow read: if true`)
- Solo el dueño puede escribir

### `tags/{tagId}/scans/{scanId}`
```
lat, lng: number | null
scannedAt: Timestamp
```
- Cualquiera puede crear (quien encuentra al perro)
- Solo el dueño puede leer

### `users/{uid}`
```
name, email, phone?
role?: 'user' | 'admin'
createdAt: Timestamp
```

---

## Rutas de la app

| Ruta | Componente | Auth |
|------|-----------|------|
| `/p/:tagId` | PublicProfile | pública |
| `/login` | Login | pública |
| `/activar?code=HU-xxx` | Onboarding | pública |
| `/app/tags` | Dashboard | autenticado |
| `/app/tags/nuevo?code=HU-xxx` | TagForm | autenticado |
| `/app/tags/:id/editar` | TagForm | autenticado |
| `/admin` | Admin | admin |
| `/admin/print` | PrintLabels | admin |
| `/admin/print3d?codes=A,B,C` | Print3D | admin |

`Admin`, `PrintLabels` y `Print3D` se cargan con `React.lazy` (chunks aparte): no
tienen por qué viajar en el bundle que descarga alguien que sólo escanea un QR.

---

## Flujos principales

### Escaneo de tag activado
`/p/HU-xxx` → `getCode(HU-xxx)` → tiene `tagId` → `getTag(tagId)` → muestra perfil

### Escaneo de tag nuevo (sin activar)
`/p/HU-xxx` → `getCode(HU-xxx)` → sin `tagId` → pantalla "Tag sin activar" → botón "Activar" → `/activar?code=HU-xxx` (o `/app/tags/nuevo?code=HU-xxx` si ya está logueado)

### Activación de tag
1. Usuario completa el form en TagForm
2. Click en "Guardar" → animación `ActivationScene` arranca **de inmediato**
3. En background: sube foto a Storage → llama Cloud Function `claimCode` (crea tag + vincula code)
4. Al terminar la animación (8.5s), awaita el save y navega a `/app/tags`
5. Si el save falla antes que termine la animación → cierra animación, muestra error

### Contacto desde perfil público
Botón WhatsApp → pide geolocalización → guarda scan en Firestore → abre `wa.me/...` con ubicación
- Usa `window.location.href` (no `window.open`) para compatibilidad iOS (universal links)
- `tel:` link preserva el `+` del número (no eliminar caracteres especiales excepto espacios)

---

## Animaciones

### `LoadingPaw` (pantalla de carga)
- `useRafTime` → 60fps, elapsed en segundos
- Pata 3D con CSS gradient + box-shadow; 3 anillos expandiéndose; 4 dots orbitales
- Se muestra mientras `status === 'loading'` en PublicProfile

### `ActivationScene` (celebración al activar)
- Duración total: 8.5s. Cues: Escaneo=0s, Activando=2.5s, Confirmado=4.5s, Cierre=7.5s
- Fases: QR card con scan line → anillos → pata en círculo + badge ✓ → confetti → "¡Tag activado!" + chip con nombre
- Botón "Continuar" para saltar
- `doneCalled` ref previene double-calling de `onDone`
- `onDone` es async en TagForm: awaita `savePromiseRef.current` antes de navegar

---

## QR codes

- Generados por la Cloud Function `generateQRBatch` (solo admins)
- SVG custom con dots redondeados (`<rect rx=".35">`) usando `QRCode.create()` (matrix de módulos)
- Overlay de pata en el centro del QR, corrección de errores **H**
- Colores: fondo `#f5ead8`, dots `#201e1d`
- Subidos a `Storage/qr/{code}.svg` con acceso público
- URL codificada: `https://tags-8bcd8.web.app/p/{code}` — 46 bytes con un código de 17 chars

**Descargar el SVG NO usa Storage.** `<a href download>` a `storage.googleapis.com`
no descarga: el atributo `download` se ignora en links cross-origin y el navegador
abre el SVG en una pestaña. El cliente regenera el SVG con `qrSvgForCode()` y lo baja
como Blob. Eso evita configurar CORS del bucket y funciona retroactivo para todos los
códigos que ya existen.

`src/lib/qr.ts::buildQrSvg` tiene que producir el SVG **byte-idéntico** al de
`functions/src/index.ts::buildQRSvg` (ambos tienen un comentario `// ── SYNC ──`).
Para verificarlo: extraer la función de `functions/src/index.ts`, correr ambas sobre
la misma URL y comparar strings.

---

## Chapitas 3D (Bambu Lab A1 mini)

`/admin/print3d?codes=…` genera un `.stl` por placa con las chapas ya posicionadas
en la grilla. Cada chapa lleva un QR distinto, por eso la placa entera se genera
como un solo archivo.

**Números verificados corriendo `qrcode`, no estimados:**

| URL de 46 bytes | ECC L | ECC M | ECC Q | ECC H |
|---|---|---|---|---|
| versión / módulos | v3 / 29 | **v3 / 29** | v4 / 33 | v5 / 37 |

`qrcode` parte la URL en modo **byte** (`https://tags-8bcd8.web.app/p/`, minúsculas)
y modo **alfanumérico** (`HU-M8K2J4XZ-ABCDE`: mayúsculas, dígitos y guión son
alfanuméricos QR). Por eso 46 bytes entran en v3. En la versión 3D se saca la pata
del centro, lo que permite bajar de H a M.

**Geometría** (`DEFAULT_TAG3D` en `tag3d.ts`, todos los valores editables en la UI):
chapa 45×45mm, esquinas r=4, base 2.0mm (10 capas → 100% sólida sin infill),
relieve QR 0.8mm / texto 0.6mm, agujero Ø3.5 a 2.6mm del borde, texto
"huellitas.app" de 3.2mm, grilla 3×3 con paso 50mm → **9 chapas por placa**.

`qrSize` **se deriva** del presupuesto vertical, no se fija:
```
plateH = holeMarginTop + holeD + quiet + qrSize + quiet + texto + margen
quiet  = quietModules · (qrSize / qrModules)
⇒ qrSize = disponible / (1 + 2·quietModules/qrModules) = 29.000mm
⇒ moduleMm = 29/29 = 1.000mm exacto  (piso duro: 0.85mm)
```
Si cambia el alto de la chapa o del texto, el QR se adapta y `moduleMm` es el número
a vigilar. **Nunca hardcodear el conteo de módulos**: leerlo de `qr.modules.size`.

**Arquitectura**: QR y texto se reducen ambos a una matriz booleana y se extruyen con
el mismo código (`addGridRelief`). El texto se rasteriza con Canvas 2D, lo que evita
opentype.js, earcut y triangular glifos con agujeros. Consecuencia: el pipeline sólo
UNE, no resta — no se puede grabar el texto sin CSG. Para pintar el contraste a mano
el relieve es lo correcto igual.

**La losa** (rectángulo redondeado con agujero descentrado) se triangula proyectando
cada vértice del contorno sobre el círculo del agujero por su ángulo. Es válido porque
el contorno es convexo y por lo tanto star-shaped respecto de cualquier punto interior.
La dirección importa: contorno → círculo, no al revés — así no hay matemática de
intersección rayo↔arco y el contorno queda exacto.

**El mesh completo NO es 2-manifold, y está bien.** Las cajas del relieve se hunden
`sinkEps = 0.30mm` dentro de la losa a propósito. Los slicers derivados de libslic3r
(incluido Bambu Studio) cortan por plano Z y unen polígonos 2D, así que el solape se
resuelve solo. Bambu Studio va a ofrecer "reparar": aceptar o ignorar, rebana bien
igual. Para verificar la geometría usar `ManifoldChecker` **sólo sobre la losa**
(con los relieves en 0): ahí sí tiene que dar `badEdges: 0`.

---

## Deployment

**Regla crítica:** SIEMPRE usar `--project tags-8bcd8`. Hay otro proyecto en la cuenta que no debe tocarse.

**Patrón correcto (nunca juntar hosting + functions, da timeout):**
```bash
npm run build
firebase deploy --only hosting --project tags-8bcd8
firebase deploy --only functions --project tags-8bcd8
```

**Solo hosting (cambios de UI):**
```bash
npm run build && firebase deploy --only hosting --project tags-8bcd8
```

**Solo functions (cambios de backend):**
```bash
cd functions && npm run build
firebase deploy --only functions --project tags-8bcd8
```

**Variables de entorno de functions:**
```bash
firebase functions:secrets:set MP_ACCESS_TOKEN --project tags-8bcd8
firebase functions:secrets:set APP_URL --project tags-8bcd8
```

---

## Gotchas conocidos

### Firebase Functions: lazy require
Los módulos externos (como `qrcode`, `cors`) deben importarse con `require()` dentro del handler, NO en el top level. El analizador de firebase-tools cuelga con imports top-level de módulos con código nativo.

```typescript
// ✅ Correcto
export const myFn = onCall({}, async (req) => {
  const QRCode = require('qrcode')
  // ...
})

// ❌ Incorrecto
import QRCode from 'qrcode'  // o require('qrcode') top-level
```

### Firestore Listen channel 400
El SDK de Firestore establece un WebSocket de fondo que a veces retorna 400 (error transitorio de reconexión). Para que la app no quede colgada en loading:
- `PublicProfile.tsx` tiene `.catch(() => setStatus('not_found'))` + timeout de 10s en el useEffect
- Sin esto, si `getDoc()` falla silenciosamente, `status` queda en `'loading'` para siempre

### iOS WhatsApp
`window.open(url, '_blank')` queda bloqueado en callbacks async por el popup blocker de iOS Safari. Usar `window.location.href = 'https://wa.me/...'` que activa el universal link handler nativo.

### Teléfono: conservar el +
Al linkear `tel:`, no usar `replace(/[\s\-()+]/g, '')` porque elimina el `+` del código de país. Usar solo `replace(/\s/g, '')` para eliminar espacios, y `href="tel:${phoneNum}"` sin agregar `+` extra.

### `qr.modules.get()` devuelve `number`, no `boolean`
El tipo de `@types/qrcode` es `get(row, col): number`. En `functions/src/index.ts`
funciona por truthiness, pero al copiar código conviene normalizar con `? 1 : 0`.

### Sólo los patrones fijos del QR son predecibles
Al validar una matriz de QR, mirar **únicamente** finder patterns, timing patterns y
el dark module en `(4·version + 9, 8)`. Todo lo demás es data + máscara y cambia con
cada código.

Esto ya rompió una vez: `checkQrOrientation` exigía que la esquina `(n-1, n-1)` fuera
0 "porque ahí no hay finder". Esa esquina es un módulo de data, así que la guarda
rechazaba el **16%** de los códigos válidos y abortaba la generación del STL. Los dos
códigos con los que se había probado cayeron en 0 por casualidad.

Nota sobre el chequeo actual: los tres finders detectan espejado y rotación, pero
**no** la transpuesta, porque `{TL,TR,BL}` es invariante al espejo diagonal. Por eso
se suma el dark module, que cubre ~2/3 de ese caso. La verificación decisiva sigue
siendo decodificar el render (ver abajo).

### Verificar un QR generado sin imprimirlo
`html5-qrcode` ya es dependencia (se usa como lector de cámara en `TagForm`), y
también **decodifica desde un archivo**. Rasterizar los mismos rects que alimentan
la malla a un canvas, pasarlos por `Html5Qrcode.scanFile()` y comparar contra
`codeUrl(code)` descarta espejado y rotación de punta a punta. Es la verificación
más valiosa antes de mandar a imprimir un lote físico.

Desde la consola del navegador, los specifiers pelados no resuelven; hay que usar
`await import('/node_modules/.vite/deps/html5-qrcode.js')`.

### `qrcode` en el cliente: sólo import dinámico
`src/lib/qr.ts` carga la librería con `await import('qrcode')` para que no entre en
el chunk principal. **No agregar un import estático** o Rollup la colapsa al bundle
grande. Verificar en el build que aparezca un `browser-*.js` de ~24 KB aparte.

El patrón `(mod as {default?}).default ?? mod` cubre la diferencia de interop CJS
entre esbuild (dev) y rollup (build). Vite resuelve el campo `browser` del package,
que apunta a `lib/browser.js` y no arrastra `fs` ni `pngjs`.

### React + RAF a 60fps
`useRafTime` llama `setState` 60 veces por segundo dentro de `LoadingPaw` y `ActivationScene`. Esto es normal y no bloquea otras actualizaciones de estado en React 18 (concurrent mode). No agregar `useMemo` o `useCallback` innecesarios en componentes padre que renderizan estas animaciones.

---

## Estado actual (agosto 2025)

### Implementado y funcionando en prod
- Auth completo (email/pw + Google)
- CRUD de tags (alta, edición, eliminación)
- Perfil público de mascota (sin auth)
- Activación de tag con animación celebratoria
- Loading animation (LoadingPaw)
- QR codes con dots redondeados y pata overlay
- Localización en WhatsApp (geolocation + saveScan)
- Mapa Google Maps embed en perfil público
- Panel admin (generar QR batch, imprimir labels)
- Descarga de QR: SVG individual o lote en ZIP, generados en el cliente
- Generador de STL para impresión 3D (`/admin/print3d`)
- Flujo de pago MercadoPago + webhook

### Deuda conocida
- **La chapa 3D dice "huellitas.app" pero el QR lleva a `tags-8bcd8.web.app`.** Fue
  una decisión explícita, pero quien lea el texto y lo tipee a mano no llega a ningún
  lado. Si se compra el dominio, cambiar `APP_ORIGIN` en `src/lib/qr.ts` **y**
  `process.env.APP_URL` de las functions ANTES de imprimir un lote: las chapas ya
  impresas quedan atadas al dominio viejo para siempre.
- El bundle principal sigue en ~1 MB, y es casi todo `firebase`. El code splitting de
  las rutas admin ya está hecho; lo que falta sería importar los SDKs de Firebase por
  separado (auth/firestore/storage/functions) en vez del paquete entero.

### Pendiente / ideas futuras
- Tags tipo "objeto" (los campos están en la DB, la UI dice "próximamente")
- Notificaciones push al dueño cuando escanean el tag
- Dashboard con estadísticas de scans
- Soporte para múltiples fotos de mascota
- App nativa (React Native / Expo) si crece la demanda
