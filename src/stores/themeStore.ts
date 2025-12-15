/**
 * Theme store with dark mode support
 * 
 * Zen-inspired design: calm, spacious, mindful
 * - Softer contrasts for reduced eye strain
 * - Muted accent colors for calm atmosphere
 * - Warmer tones for comfort
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
  // Zen additions
  zen: string       // Calming accent for zen moments
  zenMuted: string  // Subtle zen background
}

// Light theme: Warm, paper-like, gentle on the eyes
const lightTheme: ThemeColors = {
  background: '#FAF9F6',     // Warm off-white (paper)
  surface: '#FFFFFF',
  surfaceAlt: '#F7F6F3',     // Warm gray
  text: '#2C2C2C',           // Softer than pure black
  textSecondary: '#5C5C5C',  // Warm gray
  textMuted: '#9A9A9A',      // Muted
  border: '#E8E6E1',         // Warm border
  borderLight: '#F2F0EB',    // Very subtle
  primary: '#3D3D3D',        // Soft black
  primaryText: '#FFFFFF',
  accent: '#7C8B9A',         // Muted blue-gray (calming)
  accentText: '#FFFFFF',
  success: '#6B9080',        // Muted sage green
  error: '#C17B7B',          // Muted rose
  overlay: 'rgba(250, 249, 246, 0.97)',
  switchTrackOff: '#D4D2CD',
  switchTrackOn: '#7C8B9A',
  switchThumb: '#FFFFFF',
  zen: '#A8B5A0',            // Sage green - zen accent
  zenMuted: 'rgba(168, 181, 160, 0.1)',
}

// Dark theme: Deep, warm darkness, like night sky
const darkTheme: ThemeColors = {
  background: '#121210',     // Warm black
  surface: '#1A1918',        // Warm surface
  surfaceAlt: '#222120',     // Warm alt
  text: '#E8E6E1',           // Warm white
  textSecondary: '#A8A6A1',  // Warm gray
  textMuted: '#6B6965',      // Muted
  border: '#2E2D2B',         // Warm border
  borderLight: '#252422',    // Subtle
  primary: '#E8E6E1',        // Warm white
  primaryText: '#121210',
  accent: '#8B9AA8',         // Muted steel blue
  accentText: '#121210',
  success: '#7AA08B',        // Muted sage
  error: '#B08080',          // Muted rose
  overlay: 'rgba(18, 18, 16, 0.97)',
  switchTrackOff: '#3D3B39',
  switchTrackOn: '#8B9AA8',
  switchThumb: '#E8E6E1',
  zen: '#8B9F7C',            // Muted sage - zen accent
  zenMuted: 'rgba(139, 159, 124, 0.08)',
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

