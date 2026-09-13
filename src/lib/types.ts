import type { Timestamp } from 'firebase/firestore'

export interface UserDoc {
  name: string
  email: string
  phone?: string
  role?: 'user' | 'admin'
  createdAt: Timestamp
}

export interface TagDoc {
  code: string
  ownerUid: string
  type: 'mascota' | 'objeto'
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  // mascota fields
  petName?: string
  species?: 'perro' | 'gato'
  breed?: string
  age?: string
  healthNotes?: string
  ownerName?: string
  ownerPhone?: string
  photoUrl?: string
  homeLocation?: { lat: number; lng: number }
  lost?: boolean
  lostAt?: Timestamp
  // objeto fields
  objectCategory?: 'mochila' | 'cartera' | 'llaves' | 'indumentaria' | 'otro'
  objectDescription?: string
  rewardAmount?: number
  contactPhone?: string
}

export interface SubscriberDoc {
  uid: string
  fcmToken: string
  location: { lat: number; lng: number }
  geohash: string
  createdAt: Timestamp
}

export interface CodeDoc {
  status: 'sin_vender' | 'vendido_sin_reclamar' | 'reclamado'
  tagId?: string
  soldChannel?: 'checkout' | 'ml'
  soldAt?: Timestamp
  claimedAt?: Timestamp
  createdAt: Timestamp
}
