/**
 * Language store with AsyncStorage persistence
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Language, getTranslation, translations } from '../i18n/translations'

// Re-export Language type for use in other files
export type { Language } from '../i18n/translations'

interface LanguageState {
  language: Language
  t: typeof translations.en
  setLanguage: (lang: Language) => Promise<void>
  loadLanguage: () => Promise<void>
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'en',
  t: translations.en,

  setLanguage: async (lang) => {
    await AsyncStorage.setItem('language', lang)
    set({ language: lang, t: getTranslation(lang) })
  },

  loadLanguage: async () => {
    try {
      const stored = await AsyncStorage.getItem('language')
      const lang = (stored as Language) || 'en'
      set({ language: lang, t: getTranslation(lang) })
    } catch (e) {
      console.error('Failed to load language:', e)
    }
  },
}))

// Note: Do NOT auto-initialize here - it must happen after native modules are ready
// Initialize in app/_layout.tsx instead
