/**
 * Theme store with dark mode support
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ThemeMode = 'light' | 'dark'

interface ThemeColors {
  background: string
  surface: string
  surfaceAlt: string
  text: string
  textSecondary: string
  textMuted: string
  border: string
  borderLight: string
  primary: string
  primaryText: string
  accent: string
  accentText: string
  success: string
  error: string
  overlay: string
}

const lightTheme: ThemeColors = {
  background: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5F3',
  text: '#0A0A0A',
  textSecondary: '#525252',
  textMuted: '#A1A1A1',
  border: '#E5E5E3',
  borderLight: '#F0F0EE',
  primary: '#0A0A0A',
  primaryText: '#FFFFFF',
  accent: '#6366F1',
  accentText: '#FFFFFF',
  success: '#10B981',
  error: '#EF4444',
  overlay: 'rgba(250, 250, 248, 0.95)',
}

const darkTheme: ThemeColors = {
  background: '#0A0A0A',
  surface: '#141414',
  surfaceAlt: '#1A1A1A',
  text: '#FAFAFA',
  textSecondary: '#A3A3A3',
  textMuted: '#6B6B6B',
  border: '#262626',
  borderLight: '#1F1F1F',
  primary: '#FAFAFA',
  primaryText: '#0A0A0A',
  accent: '#818CF8',
  accentText: '#0A0A0A',
  success: '#34D399',
  error: '#F87171',
  overlay: 'rgba(10, 10, 10, 0.95)',
}

interface ThemeState {
  mode: ThemeMode
  colors: ThemeColors
  setMode: (mode: ThemeMode) => Promise<void>
  toggleMode: () => Promise<void>
  loadTheme: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  colors: lightTheme,

  setMode: async (mode) => {
    await AsyncStorage.setItem('theme', mode)
    set({ mode, colors: mode === 'dark' ? darkTheme : lightTheme })
  },

  toggleMode: async () => {
    const newMode = get().mode === 'dark' ? 'light' : 'dark'
    await get().setMode(newMode)
  },

  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem('theme')
      if (stored === 'dark' || stored === 'light') {
        set({ mode: stored, colors: stored === 'dark' ? darkTheme : lightTheme })
      }
    } catch (e) {
      console.error('Failed to load theme:', e)
    }
  },
}))

// Initialize on import
;(async () => {
  await useThemeStore.getState().loadTheme()
})()

