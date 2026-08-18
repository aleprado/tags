# Handoff: Huellitas (TagConnect) — MVP

## Overview
Plataforma web para gestionar perfiles digitales vinculados a llaveros físicos con QR. V1 enfocado 100% en mascotas (perros/gatos); arquitectura de datos pensada para agregar "objetos" (mochilas, llaves) en v2 sin rediseñar.

Repo destino: `aleprado/tags` (vacío — este es el punto de partida).

## About the design files
`Huellitas.dc.html` es un **prototipo de referencia visual en HTML** (no código de producción). Muestra look & feel, layout y comportamiento de cada pantalla en modo Móvil y Escritorio (toggle arriba de la página). La tarea es **recrear estas pantallas en el stack real** (ver abajo) usando los tokens y componentes documentados, no copiar el HTML tal cual.

## Fidelity
**Alta fidelidad (hifi)**: colores, tipografía, espaciado y componentes son finales (sistema de diseño "Organic"). Recrear pixel-a-pixel usando los tokens listados abajo.

## Stack recomendado
- **Frontend**: React + Vite (SPA), desplegado en **Firebase Hosting**.
- **Backend**: **Cloud Functions** (Node/TypeScript) — sin servidor propio, costo 0 en capa gratuita mientras el volumen sea bajo.
- **Auth**: **Firebase Authentication** (email/password + Google).
- **DB**: **Firestore** (capa gratuita: 1GB storage, 50k lecturas/día).
- **Storage**: **Firebase Storage** (fotos de mascotas/objetos).
- **Pagos**: **Mercado Pago Checkout Pro** — se integra con una Cloud Function que crea la preferencia de pago y un webhook que confirma el pago y genera el código.
- **Notificaciones**: usar **Firebase Extensions "Trigger Email"** (gratis, requiere SMTP propio o SendGrid free tier) para email; WhatsApp requiere WhatsApp Business API (Meta) o Twilio — **ambos tienen costo por mensaje fuera de un tier de prueba**; para no romper el costo 0 en v1, dejar el botón "Escribir por WhatsApp" como `wa.me` link directo (gratis, sin API) en lugar de enviar mensajes desde el backend.
- **QR**: generado en una Cloud Function con una librería como `qrcode` (Node), guardado como PNG/SVG en Storage; el código codifica solo un ID corto (ej. `huellitas.app/p/{tagId}`), nunca datos sensibles.

Todo elegido para mantenerse en capa gratuita de Firebase el mayor tiempo posible; escalar a plan Blaze (pago por uso) recién cuando el tráfico lo requiera.

## Screens
Referencia visual completa en `Huellitas.dc.html` (abrir directo en el navegador). Toggle "Móvil / Escritorio" arriba de la página cambia el layout de las 5 pantallas.

### 1. Perfil público (escaneo QR) — `/p/:tagId`
- **Propósito**: landing pública a la que llega cualquiera que escanee el QR físico. Sin login.
- **Layout móvil**: columna centrada — avatar circular 132px (foto lavada/`washed`), nombre (Caprasimo 26px), chips de raza y estado (Activo/Inactivo), luego 3 tarjetas: Salud, Contacto del dueño (botones WhatsApp `wa.me` y Llamar `tel:`), Última ubicación (mapa placeholder con pin).
- **Layout escritorio**: dos columnas — foto/nombre/estado a la izquierda (240px fijo), tarjetas apiladas a la derecha.
- **Si el tag está Inactivo**: mostrar el chip "Inactivo" pero seguir mostrando los datos de contacto (el dueño puede haber desactivado el tag temporalmente sin perder la vía de contacto) — confirmar este criterio con el cliente antes de implementar.
- **Contenido**: foto, nombre, especie/raza, condiciones de salud/alergias, nombre del dueño, botón WhatsApp, botón llamar, mapa de última ubicación conocida.

### 2. Login / Registro — `/login`
- Formulario simple: email + contraseña, botón "Continuar con Google", link a registro. Meta: completar en <2 min.
- Mismo layout en ambos modos, centrado, max-width 380px.

### 3. Dashboard — `/app/tags`
- **Propósito**: usuario logueado gestiona sus tags.
- **Móvil**: lista vertical de tarjetas (avatar 48px, nombre, chip de tipo, switch activo/inactivo a la derecha). Botón "+ Nuevo tag" al final.
- **Escritorio**: grilla de 3 columnas, mismo contenido por tarjeta pero centrado verticalmente; botón "Nuevo tag" arriba a la derecha.
- El switch activo/inactivo cambia el estado en tiempo real (no afecta el QR físico).

### 4. Crear/editar tag — `/app/tags/nuevo` y `/app/tags/:id/editar`
- Selector de tipo de tag (segmented: Mascota / Objeto) — **Objeto** en v1 muestra un estado "Próximamente" (placeholder), pero el selector y la estructura de datos ya deben soportarlo.
- Si Mascota: selector Perro/Gato, foto (upload a Storage), nombre, edad, condiciones de salud/alergias (textarea), nombre del dueño, teléfono de contacto, switch "Tag activo", botón Guardar.
- **Móvil**: todo en una columna. **Escritorio**: foto + selectores a la izquierda (260px), campos en grilla de 2 columnas a la derecha.

### 5. Onboarding de activación — `/activar`
- 4 pasos con indicador de progreso (dots): 1) Escanear QR, 2) Crear cuenta, 3) Completar perfil, 4) Confirmación.
- Botones Atrás/Siguiente; el paso 4 lleva al Dashboard.
- Nota: este flujo es para cuando el comprador reclama un código que ya trae el llavero físico (ver "Compra y activación" abajo).

### 6. Admin (no mockeada — a diseñar/construir según esta spec)
Pantalla interna (roles: `admin`) para:
- Generar lotes de códigos/QR únicos (definir cantidad, descargar PNGs/SVGs para imprimir en los llaveros).
- Ver el estado de cada código: `sin_vender` → `vendido_sin_reclamar` → `reclamado` (vinculado a un tag activo).
- Marcar códigos como vendidos manualmente (para ventas por Mercado Libre/marketplaces, donde el pago no pasa por el checkout propio).
- Buscar por código / usuario / email.

## Compra y activación (flujo completo)
1. Admin genera un lote de códigos únicos + QR (estado `sin_vender`).
2. Venta por canal propio (Mercado Pago Checkout Pro) → Cloud Function marca el código `vendido_sin_reclamar` al confirmar el pago (webhook).
3. Venta por Mercado Libre/otro marketplace → un admin marca manualmente el código como `vendido_sin_reclamar` desde el panel admin (no hay integración automática con ML en v1).
4. El comprador recibe el llavero físico, escanea el QR → onboarding de 4 pasos → el código pasa a `reclamado` y queda vinculado a su cuenta y a un tag activo.
5. Un código nunca se reutiliza; si se pierde el llavero, el usuario simplemente desactiva el tag desde el dashboard (el QR físico no cambia).

## Interactions & behavior
- Switch activo/inactivo: toggle inmediato, optimista en UI, persistido en Firestore (`tags/{id}.active`).
- Formularios: validación básica (campos requeridos: nombre, tipo, contacto) antes de habilitar "Guardar".
- Botón WhatsApp: `https://wa.me/{telefono}?text=...` — abre WhatsApp directo, sin backend.
- Botón Llamar: `tel:{telefono}`.
- Selector Mascota/Objeto en el alta: cambia los campos mostrados sin recargar la página (mismo componente, distinto set de campos — ver estructura de datos).

## Data model (Firestore, sugerido)
```
users/{uid}: { name, email, phone, createdAt }
tags/{tagId}: {
  code: string,           // el código impreso en el QR físico
  ownerUid: string,
  type: 'mascota' | 'objeto',
  active: boolean,
  createdAt, updatedAt,
  // si type === 'mascota'
  petName, species: 'perro'|'gato', breed, age, healthNotes, ownerName, ownerPhone, photoUrl,
  // si type === 'objeto' (v2)
  objectDescription, rewardAmount, contactPhone, photoUrl
}
codes/{code}: { status: 'sin_vender'|'vendido_sin_reclamar'|'reclamado', tagId?, soldChannel?: 'checkout'|'ml', soldAt?, claimedAt? }
```

## Design tokens (sistema "Organic")
- Color: fondo `#f5ead8`, texto `#201e1d`, acento `#c67139` (ramp 100–900), acento 2 `#7a8a5e` (ramp 100–900). Ver `_ds/organic-.../styles.css` para la ramp completa.
- Tipografía: títulos **Caprasimo**, cuerpo **Figtree**.
- Radios: 8/16/28px, botones e inputs a 999px (pill).
- Sombras: `--shadow-sm/md/lg` ya definidas en el CSS.
- Componentes con clases documentadas: `.btn`, `.field`/`.input`, `.card`, `.tag`, `.seg`. No inventar estilos nuevos — reusar estas clases o sus equivalentes en el sistema de diseño real del frontend.

## Assets
- `Huellitas.dc.html`: prototipo completo (5 pantallas × 2 modos).
- `_ds/`: sistema de diseño Organic (tokens, guía, bundle) — usar como referencia de valores exactos, no cargarlo en la app final (es solo para el prototipo).

## Files in this bundle
- `README.md` — este documento.
- `Huellitas.dc.html` — prototipo de referencia (abrir en cualquier navegador).
- `design-tokens.css` — extracto de tokens de color/tipografía/espaciado del sistema Organic, para copiar valores exactos al implementar.
