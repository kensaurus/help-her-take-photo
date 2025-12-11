/**
 * Onboarding store with AsyncStorage persistence
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface OnboardingState {
  hasSeenOnboarding: boolean
  currentStep: number
  setHasSeenOnboarding: (value: boolean) => Promise<void>
  setCurrentStep: (step: number) => void
  completeOnboarding: () => Promise<void>
  loadOnboardingState: () => Promise<void>
  resetOnboarding: () => Promise<void>
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  hasSeenOnboarding: false,
  currentStep: 0,

  setHasSeenOnboarding: async (value) => {
    await AsyncStorage.setItem('hasSeenOnboarding', JSON.stringify(value))
    set({ hasSeenOnboarding: value })
  },

  setCurrentStep: (step) => {
    set({ currentStep: step })
  },

  completeOnboarding: async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', JSON.stringify(true))
    set({ hasSeenOnboarding: true, currentStep: 0 })
  },

  loadOnboardingState: async () => {
    try {
      const stored = await AsyncStorage.getItem('hasSeenOnboarding')
      if (stored) {
        set({ hasSeenOnboarding: JSON.parse(stored) })
      }
    } catch (e) {
      console.error('Failed to load onboarding state:', e)
    }
  },

  resetOnboarding: async () => {
    await AsyncStorage.removeItem('hasSeenOnboarding')
    set({ hasSeenOnboarding: false, currentStep: 0 })
  },
}))

// Note: Do NOT auto-initialize here - it must happen after native modules are ready
// Initialize in app/_layout.tsx instead

