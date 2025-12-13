/**
 * Pairing store with AsyncStorage persistence
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface PairingState {
  myDeviceId: string | null
  pairedDeviceId: string | null
  sessionId: string | null
  role: 'camera' | 'viewer' | null
  isPaired: boolean
  setMyDeviceId: (id: string) => void
  setPairedDeviceId: (id: string | null) => void
  setSessionId: (id: string | null) => void
  setRole: (role: 'camera' | 'viewer') => void
  clearPairing: () => void
  loadFromStorage: () => Promise<void>
}

export const usePairingStore = create<PairingState>((set, get) => ({
  myDeviceId: null,
  pairedDeviceId: null,
  sessionId: null,
  role: null,
  isPaired: false,

  setMyDeviceId: async (id) => {
    await AsyncStorage.setItem('myDeviceId', id)
    set({ myDeviceId: id })
  },

  setPairedDeviceId: async (id) => {
    if (id) {
      await AsyncStorage.setItem('pairedDeviceId', id)
    } else {
      await AsyncStorage.removeItem('pairedDeviceId')
    }
    set({ pairedDeviceId: id, isPaired: !!id })
  },

  setSessionId: async (id) => {
    if (id) {
      await AsyncStorage.setItem('sessionId', id)
    } else {
      await AsyncStorage.removeItem('sessionId')
    }
    set({ sessionId: id })
  },

  setRole: async (role) => {
    await AsyncStorage.setItem('role', role)
    set({ role })
  },

  clearPairing: async () => {
    await AsyncStorage.multiRemove(['pairedDeviceId', 'sessionId', 'role'])
    set({ pairedDeviceId: null, sessionId: null, role: null, isPaired: false })
  },

  loadFromStorage: async () => {
    try {
      const [myDeviceId, pairedDeviceId, sessionId, role] = await AsyncStorage.multiGet([
        'myDeviceId',
        'pairedDeviceId',
        'sessionId',
        'role',
      ])
      set({
        myDeviceId: myDeviceId[1],
        pairedDeviceId: pairedDeviceId[1],
        sessionId: sessionId[1],
        role: role[1] as 'camera' | 'viewer' | null,
        isPaired: !!pairedDeviceId[1],
      })
    } catch (e) {
      console.error('Failed to load from storage:', e)
    }
  },
}))

// Note: Do NOT auto-initialize here - it must happen after native modules are ready
// Initialize in app/_layout.tsx instead
