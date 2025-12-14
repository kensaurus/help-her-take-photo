/**
 * Pairing store with AsyncStorage persistence
 * Includes display name management
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface PairingState {
  myDeviceId: string | null
  myDisplayName: string | null
  myAvatar: string
  pairedDeviceId: string | null
  partnerDisplayName: string | null
  partnerAvatar: string
  sessionId: string | null
  role: 'camera' | 'viewer' | null
  isPaired: boolean
  hasSetupProfile: boolean
  setMyDeviceId: (id: string) => Promise<void>
  setMyDisplayName: (name: string) => Promise<void>
  setMyAvatar: (emoji: string) => Promise<void>
  setPairedDeviceId: (id: string | null) => Promise<void>
  setPartnerInfo: (name: string | null, avatar?: string) => void
  setSessionId: (id: string | null) => Promise<void>
  setRole: (role: 'camera' | 'viewer') => Promise<void>
  setHasSetupProfile: (value: boolean) => Promise<void>
  clearPairing: () => Promise<void>
  loadFromStorage: () => Promise<void>
}

export const usePairingStore = create<PairingState>((set, get) => ({
  myDeviceId: null,
  myDisplayName: null,
  myAvatar: '👤',
  pairedDeviceId: null,
  partnerDisplayName: null,
  partnerAvatar: '👤',
  sessionId: null,
  role: null,
  isPaired: false,
  hasSetupProfile: false,

  setMyDeviceId: async (id) => {
    await AsyncStorage.setItem('myDeviceId', id)
    set({ myDeviceId: id })
  },

  setMyDisplayName: async (name) => {
    await AsyncStorage.setItem('myDisplayName', name)
    set({ myDisplayName: name })
  },

  setMyAvatar: async (emoji) => {
    await AsyncStorage.setItem('myAvatar', emoji)
    set({ myAvatar: emoji })
  },

  setPairedDeviceId: async (id) => {
    if (id) {
      await AsyncStorage.setItem('pairedDeviceId', id)
    } else {
      await AsyncStorage.removeItem('pairedDeviceId')
    }
    set({ pairedDeviceId: id, isPaired: !!id })
  },

  setPartnerInfo: (name, avatar) => {
    set({ 
      partnerDisplayName: name,
      partnerAvatar: avatar || '👤',
    })
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

  setHasSetupProfile: async (value) => {
    await AsyncStorage.setItem('hasSetupProfile', value ? 'true' : 'false')
    set({ hasSetupProfile: value })
  },

  clearPairing: async () => {
    await AsyncStorage.multiRemove(['pairedDeviceId', 'sessionId', 'role'])
    set({ 
      pairedDeviceId: null, 
      sessionId: null, 
      role: null, 
      isPaired: false,
      partnerDisplayName: null,
      partnerAvatar: '👤',
    })
  },

  loadFromStorage: async () => {
    try {
      const [myDeviceId, myDisplayName, myAvatar, pairedDeviceId, sessionId, role, hasSetupProfile] = await AsyncStorage.multiGet([
        'myDeviceId',
        'myDisplayName',
        'myAvatar',
        'pairedDeviceId',
        'sessionId',
        'role',
        'hasSetupProfile',
      ])
      set({
        myDeviceId: myDeviceId[1],
        myDisplayName: myDisplayName[1],
        myAvatar: myAvatar[1] || '👤',
        pairedDeviceId: pairedDeviceId[1],
        sessionId: sessionId[1],
        role: role[1] as 'camera' | 'viewer' | null,
        isPaired: !!pairedDeviceId[1],
        hasSetupProfile: hasSetupProfile[1] === 'true',
      })
    } catch (e) {
      console.error('Failed to load from storage:', e)
    }
  },
}))
