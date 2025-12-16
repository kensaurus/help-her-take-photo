/**
 * Theme store with dark mode support
 * 
 * Cutesy Pastel Design Philosophy:
 * - Soft, dreamy pastel colors
 * - Playful yet sophisticated aesthetic
 * - Distinct button vs badge differentiation
 * - Artistic, asymmetric shapes inspiration
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
  // Cutesy additions
  pastelPink: string      // Soft coral pink for highlights
  pastelMint: string      // Soft mint for success states
  pastelLavender: string  // Soft purple for accents
  pastelPeach: string     // Warm peach for warmth
  pastelBlue: string      // Soft periwinkle for info
  // Button vs Badge distinction
  buttonGlow: string      // Subtle glow for clickable elements
  badgeBg: string         // Muted background for badges
}

// Light theme: Cutesy pastel, dreamy and playful
const lightTheme: ThemeColors = {
  background: '#FFF9FB',     // Soft blush white
  surface: '#FFFFFF',
  surfaceAlt: '#FFF5F8',     // Whisper pink
  text: '#4A3B47',           // Soft plum (not harsh black)
  textSecondary: '#7B6B77',  // Muted mauve
  textMuted: '#B5A8B1',      // Soft lavender gray
  border: '#F5E6EB',         // Pastel pink border
  borderLight: '#FAF0F3',    // Very subtle pink
  primary: '#F5A0B8',        // Soft coral pink
  primaryText: '#FFFFFF',
  accent: '#B8D4F5',         // Soft periwinkle blue
  accentText: '#4A3B47',
  success: '#A8E6CF',        // Pastel mint green
  error: '#FFB7B7',          // Soft rose
  overlay: 'rgba(255, 249, 251, 0.97)',
  switchTrackOff: '#E8D8DE',
  switchTrackOn: '#F5A0B8',
  switchThumb: '#FFFFFF',
  // Cutesy palette
  pastelPink: '#FFD4E0',     // Soft baby pink
  pastelMint: '#C8F7DC',     // Soft mint
  pastelLavender: '#E8D5F5', // Soft lavender
  pastelPeach: '#FFDDC8',    // Soft peach
  pastelBlue: '#D4E8FF',     // Soft sky blue
  // Button/Badge differentiation
  buttonGlow: 'rgba(245, 160, 184, 0.3)',  // Pink glow for buttons
  badgeBg: 'rgba(184, 212, 245, 0.2)',     // Soft blue for badges
}

// Dark theme: Dreamy night pastels, like sunset to twilight
const darkTheme: ThemeColors = {
  background: '#1E1A1C',     // Soft dark plum
  surface: '#2A2528',        // Muted mauve dark
  surfaceAlt: '#352F32',     // Warm dark surface
  text: '#F5E8EC',           // Soft pink white
  textSecondary: '#C8B8C0',  // Muted pink gray
  textMuted: '#8A7A82',      // Soft mauve
  border: '#3D3538',         // Subtle dark border
  borderLight: '#332D30',    // Very subtle
  primary: '#E88BA5',        // Soft coral (darker mode)
  primaryText: '#1E1A1C',
  accent: '#9BB8D8',         // Muted periwinkle
  accentText: '#1E1A1C',
  success: '#8BC4A8',        // Muted mint
  error: '#D89898',          // Muted rose
  overlay: 'rgba(30, 26, 28, 0.97)',
  switchTrackOff: '#4A4245',
  switchTrackOn: '#E88BA5',
  switchThumb: '#F5E8EC',
  // Cutesy dark palette
  pastelPink: '#D88BA0',     // Muted coral
  pastelMint: '#8BC4A8',     // Muted mint
  pastelLavender: '#B8A0C8', // Muted lavender
  pastelPeach: '#D8B8A0',    // Muted peach
  pastelBlue: '#A0B8D8',     // Muted sky
  // Button/Badge differentiation
  buttonGlow: 'rgba(232, 139, 165, 0.25)', // Pink glow for buttons
  badgeBg: 'rgba(155, 184, 216, 0.15)',    // Soft blue for badges
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

