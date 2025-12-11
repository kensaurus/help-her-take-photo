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
  // Switch-specific colors
  switchTrackOff: string
  switchTrackOn: string
  switchThumb: string
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
  switchTrackOff: '#D1D5DB',
  switchTrackOn: '#0A0A0A',
  switchThumb: '#FFFFFF',
}

const darkTheme: ThemeColors = {
  background: '#0A0A0A',
  surface: '#141414',
  surfaceAlt: '#1A1A1A',
  text: '#FAFAFA',
  textSecondary: '#A3A3A3',
  textMuted: '#6B6B6B',
  border: '#333333',
  borderLight: '#252525',
  primary: '#FAFAFA',
  primaryText: '#0A0A0A',
  accent: '#818CF8',
  accentText: '#0A0A0A',
  success: '#34D399',
  error: '#F87171',
  overlay: 'rgba(10, 10, 10, 0.95)',
  switchTrackOff: '#404040',
  switchTrackOn: '#818CF8',
  switchThumb: '#FAFAFA',
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

// Note: Do NOT auto-initialize here - it must happen after native modules are ready
// Initialize in app/_layout.tsx instead

