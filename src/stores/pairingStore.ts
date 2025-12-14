/**
 * Pairing store with AsyncStorage persistence
 * Includes display name management and connection history
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Connection history item
export interface ConnectionHistoryItem {
  id: string
  partnerDeviceId: string
  partnerDisplayName: string | null
  partnerAvatar: string
  sessionId: string | null
  role: 'camera' | 'viewer' | null
  status: 'connected' | 'disconnected'
  connectedAt: string
  disconnectedAt: string | null
  durationSeconds: number
}

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
  // Connection history (multi-session support)
  connectionHistory: ConnectionHistoryItem[]
  activeConnectionId: string | null
  // Actions
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
  // Connection history actions
  addConnectionToHistory: (connection: Omit<ConnectionHistoryItem, 'id'>) => Promise<void>
  updateConnectionHistory: (id: string, updates: Partial<ConnectionHistoryItem>) => Promise<void>
  setConnectionHistory: (history: ConnectionHistoryItem[]) => void
  setActiveConnectionId: (id: string | null) => void
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
  connectionHistory: [],
  activeConnectionId: null,

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
    const { activeConnectionId, connectionHistory } = get()
    
    // Update the active connection in history as disconnected
    if (activeConnectionId) {
      const updatedHistory = connectionHistory.map(conn => 
        conn.id === activeConnectionId 
          ? { 
              ...conn, 
              status: 'disconnected' as const, 
              disconnectedAt: new Date().toISOString(),
              durationSeconds: Math.floor((Date.now() - new Date(conn.connectedAt).getTime()) / 1000)
            }
          : conn
      )
      await AsyncStorage.setItem('connectionHistory', JSON.stringify(updatedHistory))
      set({ connectionHistory: updatedHistory })
    }
    
    await AsyncStorage.multiRemove(['pairedDeviceId', 'sessionId', 'role'])
    set({ 
      pairedDeviceId: null, 
      sessionId: null, 
      role: null, 
      isPaired: false,
      partnerDisplayName: null,
      partnerAvatar: '👤',
      activeConnectionId: null,
    })
  },

  loadFromStorage: async () => {
    try {
      const [myDeviceId, myDisplayName, myAvatar, pairedDeviceId, sessionId, role, hasSetupProfile, connectionHistoryStr] = await AsyncStorage.multiGet([
        'myDeviceId',
        'myDisplayName',
        'myAvatar',
        'pairedDeviceId',
        'sessionId',
        'role',
        'hasSetupProfile',
        'connectionHistory',
      ])
      
      let connectionHistory: ConnectionHistoryItem[] = []
      try {
        if (connectionHistoryStr[1]) {
          connectionHistory = JSON.parse(connectionHistoryStr[1])
        }
      } catch {
        // Invalid JSON, use empty array
      }
      
      set({
        myDeviceId: myDeviceId[1],
        myDisplayName: myDisplayName[1],
        myAvatar: myAvatar[1] || '👤',
        pairedDeviceId: pairedDeviceId[1],
        sessionId: sessionId[1],
        role: role[1] as 'camera' | 'viewer' | null,
        isPaired: !!pairedDeviceId[1],
        hasSetupProfile: hasSetupProfile[1] === 'true',
        connectionHistory,
      })
    } catch (e) {
      console.error('Failed to load from storage:', e)
    }
  },

  addConnectionToHistory: async (connection) => {
    const { connectionHistory } = get()
    const newConnection: ConnectionHistoryItem = {
      ...connection,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }
    
    // Keep only last 20 connections
    const updatedHistory = [newConnection, ...connectionHistory].slice(0, 20)
    
    await AsyncStorage.setItem('connectionHistory', JSON.stringify(updatedHistory))
    set({ 
      connectionHistory: updatedHistory, 
      activeConnectionId: newConnection.id 
    })
  },

  updateConnectionHistory: async (id, updates) => {
    const { connectionHistory } = get()
    const updatedHistory = connectionHistory.map(conn => 
      conn.id === id ? { ...conn, ...updates } : conn
    )
    
    await AsyncStorage.setItem('connectionHistory', JSON.stringify(updatedHistory))
    set({ connectionHistory: updatedHistory })
  },

  setConnectionHistory: (history) => {
    set({ connectionHistory: history })
  },

  setActiveConnectionId: (id) => {
    set({ activeConnectionId: id })
  },
}))
