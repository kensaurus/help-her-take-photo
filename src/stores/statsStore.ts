/**
 * Stats store - Track relationship-saving statistics
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface Stats {
  photosTaken: number
  sessionsCompleted: number
  scoldingsSaved: number
  lastSessionDate: string | null
}

interface StatsState {
  stats: Stats
  incrementPhotos: () => Promise<void>
  incrementSessions: () => Promise<void>
  incrementScoldingsSaved: (count?: number) => Promise<void>
  getRank: () => string
  loadStats: () => Promise<void>
}

const defaultStats: Stats = {
  photosTaken: 0,
  sessionsCompleted: 0,
  scoldingsSaved: 0,
  lastSessionDate: null,
}

export const useStatsStore = create<StatsState>((set, get) => ({
  stats: defaultStats,

  incrementPhotos: async () => {
    const newStats = { 
      ...get().stats, 
      photosTaken: get().stats.photosTaken + 1,
      scoldingsSaved: get().stats.scoldingsSaved + 1,
    }
    await AsyncStorage.setItem('stats', JSON.stringify(newStats))
    set({ stats: newStats })
  },

  incrementSessions: async () => {
    const newStats = { 
      ...get().stats, 
      sessionsCompleted: get().stats.sessionsCompleted + 1,
      lastSessionDate: new Date().toISOString(),
      scoldingsSaved: get().stats.scoldingsSaved + 3,
    }
    await AsyncStorage.setItem('stats', JSON.stringify(newStats))
    set({ stats: newStats })
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
      const stored = await AsyncStorage.getItem('stats')
      if (stored) {
        const parsed = JSON.parse(stored)
        set({ stats: { ...defaultStats, ...parsed } })
      }
    } catch (e) {
      console.error('Failed to load stats:', e)
    }
  },
}))

// Initialize on import
;(async () => {
  await useStatsStore.getState().loadStats()
})()
