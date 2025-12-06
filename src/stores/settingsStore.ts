/**
 * Settings store with AsyncStorage persistence
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface Settings {
  showGrid: boolean
  flash: boolean
  sound: boolean
  autoSave: boolean
}

interface SettingsState {
  settings: Settings
  updateSettings: (partial: Partial<Settings>) => Promise<void>
  loadSettings: () => Promise<void>
}

const defaultSettings: Settings = {
  showGrid: true,
  flash: false,
  sound: true,
  autoSave: true,
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,

  updateSettings: async (partial) => {
    const newSettings = { ...get().settings, ...partial }
    await AsyncStorage.setItem('settings', JSON.stringify(newSettings))
    set({ settings: newSettings })
  },

  loadSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem('settings')
      if (stored) {
        const parsed = JSON.parse(stored)
        set({ settings: { ...defaultSettings, ...parsed } })
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  },
}))

// Initialize on import
;(async () => {
  await useSettingsStore.getState().loadSettings()
})()
