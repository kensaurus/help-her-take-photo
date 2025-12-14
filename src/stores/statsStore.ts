/**
 * Stats store - Track relationship-saving statistics
 * Syncs with both AsyncStorage (offline) and Supabase (cloud backup)
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { statsApi } from '../services/api'

interface Stats {
  photosTaken: number
  sessionsCompleted: number
  scoldingsSaved: number
  lastSessionDate: string | null
}

interface StatsState {
  stats: Stats
  deviceId: string | null
  setDeviceId: (id: string) => void
  incrementPhotos: () => Promise<void>
  incrementSessions: () => Promise<void>
  incrementScoldingsSaved: (count?: number) => Promise<void>
  getRank: () => string
  loadStats: () => Promise<void>
  syncToSupabase: () => Promise<void>
}

const defaultStats: Stats = {
  photosTaken: 0,
  sessionsCompleted: 0,
  scoldingsSaved: 0,
  lastSessionDate: null,
}

export const useStatsStore = create<StatsState>((set, get) => ({
  stats: defaultStats,
  deviceId: null,

  setDeviceId: (id: string) => {
    set({ deviceId: id })
  },

  incrementPhotos: async () => {
    const newStats = { 
      ...get().stats, 
      photosTaken: get().stats.photosTaken + 1,
    }
    await AsyncStorage.setItem('stats', JSON.stringify(newStats))
    set({ stats: newStats })
    
    // Sync to Supabase in background
    const { deviceId } = get()
    if (deviceId) {
      statsApi.incrementPhotos(deviceId, 'taken').catch(() => {})
    }
  },

  incrementSessions: async () => {
    const newStats = { 
      ...get().stats, 
      sessionsCompleted: get().stats.sessionsCompleted + 1,
      lastSessionDate: new Date().toISOString(),
    }
    await AsyncStorage.setItem('stats', JSON.stringify(newStats))
    set({ stats: newStats })
    
    // Sync to Supabase in background
    const { deviceId } = get()
    if (deviceId) {
      statsApi.addXP(deviceId, 10).catch(() => {})
    }
  },

  incrementScoldingsSaved: async (count = 1) => {
    const newStats = { 
      ...get().stats, 
      scoldingsSaved: get().stats.scoldingsSaved + count,
    }
    await AsyncStorage.setItem('stats', JSON.stringify(newStats))
    set({ stats: newStats })
  },

  getRank: () => {
    const { scoldingsSaved } = get().stats
    if (scoldingsSaved >= 100) return 'master'
    if (scoldingsSaved >= 50) return 'legend'
    if (scoldingsSaved >= 25) return 'pro'
    if (scoldingsSaved >= 10) return 'decent'
    if (scoldingsSaved >= 5) return 'amateur'
    return 'rookie'
  },

  loadStats: async () => {
    try {
      // First load from local storage
      const stored = await AsyncStorage.getItem('stats')
      if (stored) {
        const parsed = JSON.parse(stored)
        set({ stats: { ...defaultStats, ...parsed } })
      }
      
      // Then try to sync from Supabase (cloud backup)
      const { deviceId } = get()
      if (deviceId) {
        const { stats: cloudStats } = await statsApi.get(deviceId)
        if (cloudStats && cloudStats.photos_taken > 0) {
          // Merge cloud stats if they have more data
          const localStats = get().stats
          const mergedStats = {
            photosTaken: Math.max(localStats.photosTaken, cloudStats.photos_taken),
            sessionsCompleted: Math.max(localStats.sessionsCompleted, cloudStats.total_sessions),
            // "Scoldings avoided" should reflect successful photos (not sessions/other events)
            scoldingsSaved: Math.max(localStats.scoldingsSaved, cloudStats.photos_taken),
            lastSessionDate: localStats.lastSessionDate,
          }
          set({ stats: mergedStats })
          await AsyncStorage.setItem('stats', JSON.stringify(mergedStats))
        }
      }
    } catch (e) {
      console.error('Failed to load stats:', e)
    }
  },

  syncToSupabase: async () => {
    const { deviceId, stats } = get()
    if (!deviceId) return
    
    try {
      // This is a one-way sync to ensure Supabase has latest data
      // In production, you'd want proper conflict resolution
      await statsApi.addXP(deviceId, 0) // Just triggers an upsert
    } catch (e) {
      console.error('Failed to sync stats to Supabase:', e)
    }
  },
}))

// Note: Do NOT auto-initialize here - it must happen after native modules are ready
// Initialize in app/_layout.tsx instead
