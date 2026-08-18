import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type User,
} from 'firebase/auth'
import { auth, isConfigured } from '../lib/firebase'
import { ensureUserDoc, getUserRole } from '../lib/firestore'

interface AuthState {
  user: User | null
  role: 'user' | 'admin'
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, role: 'user', loading: true })

  useEffect(() => {
    if (!isConfigured) {
      setState({ user: null, role: 'user', loading: false })
      return
    }
    return onAuthStateChanged(auth, async user => {
      if (user) {
        const role = await getUserRole(user.uid)
        setState({ user, role, loading: false })
      } else {
        setState({ user: null, role: 'user', loading: false })
      }
    })
  }, [])

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function register(email: string, password: string, name: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await ensureUserDoc(cred.user.uid, name, email)
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider()
    const cred = await signInWithPopup(auth, provider)
    await ensureUserDoc(cred.user.uid, cred.user.displayName ?? '', cred.user.email ?? '')
  }

  async function logout() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ ...state, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
