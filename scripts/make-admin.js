// Script de uso único para promover un usuario a admin.
// Uso: node scripts/make-admin.js <email>
// Requiere estar logueado con firebase CLI (firebase login).

const { initializeApp, cert } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')

const email = process.argv[2]
if (!email) {
  console.error('Uso: node scripts/make-admin.js <email>')
  process.exit(1)
}

// Usa Application Default Credentials (se obtienen via `firebase login`)
initializeApp({ projectId: 'tags-8bcd8' })

const auth = getAuth()
const db = getFirestore()

async function main() {
  const user = await auth.getUserByEmail(email)
  await db.collection('users').doc(user.uid).set(
    { role: 'admin' },
    { merge: true }
  )
  console.log(`✅ ${email} (uid: ${user.uid}) ahora es admin.`)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
