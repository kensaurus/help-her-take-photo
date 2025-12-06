/**
 * Pairing store with AsyncStorage persistence
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface PairingState {
  myDeviceId: string | null
  pairedDeviceId: string | null
  role: 'camera' | 'viewer' | null
  isPaired: boolean
  setMyDeviceId: (id: string) => void
  setPairedDeviceId: (id: string | null) => void
  setRole: (role: 'camera' | 'viewer') => void
  clearPairing: () => void
  loadFromStorage: () => Promise<void>
}

export const usePairingStore = create<PairingState>((set, get) => ({
  myDeviceId: null,
  pairedDeviceId: null,
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

  setRole: async (role) => {
    await AsyncStorage.setItem('role', role)
    set({ role })
  },

  clearPairing: async () => {
    await AsyncStorage.multiRemove(['pairedDeviceId', 'role'])
    set({ pairedDeviceId: null, role: null, isPaired: false })
  },

  loadFromStorage: async () => {
    try {
      const [myDeviceId, pairedDeviceId, role] = await AsyncStorage.multiGet([
        'myDeviceId',
        'pairedDeviceId',
        'role',
      ])
      set({
        myDeviceId: myDeviceId[1],
        pairedDeviceId: pairedDeviceId[1],
        role: role[1] as 'camera' | 'viewer' | null,
        isPaired: !!pairedDeviceId[1],
      })
    } catch (e) {
      console.error('Failed to load from storage:', e)
    }
  },
}))

// Initialize store on import
;(async () => {
  await usePairingStore.getState().loadFromStorage()
  
  // Generate device ID if not exists
  if (!usePairingStore.getState().myDeviceId) {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
    usePairingStore.getState().setMyDeviceId(uuid)
  }
})()
