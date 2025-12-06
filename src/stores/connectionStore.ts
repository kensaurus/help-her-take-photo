import { create } from 'zustand'
import type { ConnectionStatus, PeerDevice, DeviceRole } from '../types'

interface ConnectionState {
  status: ConnectionStatus
  myRole: DeviceRole | null
  peerDevice: PeerDevice | null
  lastError: string | null
  latency: number | null
  
  // Actions
  setStatus: (status: ConnectionStatus) => void
  setRole: (role: DeviceRole) => void
  setPeerDevice: (device: PeerDevice | null) => void
  setError: (error: string | null) => void
  setLatency: (latency: number) => void
  reset: () => void
}

const initialState = {
  status: 'disconnected' as ConnectionStatus,
  myRole: null,
  peerDevice: null,
  lastError: null,
  latency: null,
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status, lastError: status === 'error' ? undefined : null }),
  
  setRole: (role) => set({ myRole: role }),
  
  setPeerDevice: (device) => set({ peerDevice: device }),
  
  setError: (error) => set({ lastError: error, status: error ? 'error' : 'disconnected' }),
  
  setLatency: (latency) => set({ latency }),
  
  reset: () => set(initialState),
}))

