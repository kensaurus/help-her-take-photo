/**
 * Root Layout - App navigation with theme support
 * Handles onboarding flow and initializes services
 */

import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as SplashScreen from 'expo-splash-screen'
import { useLanguageStore } from '../src/stores/languageStore'
import { useThemeStore } from '../src/stores/themeStore'
import { useOnboardingStore } from '../src/stores/onboardingStore'
import { useSettingsStore } from '../src/stores/settingsStore'
import { useStatsStore } from '../src/stores/statsStore'
import { usePairingStore } from '../src/stores/pairingStore'
import { logger } from '../src/services/logging'
import { notificationService } from '../src/services/notifications'
import { sessionLogger } from '../src/services/sessionLogger'
import { AppUpdatePrompt } from '../src/components/ui/AppUpdatePrompt'

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const { t, loadLanguage } = useLanguageStore()
  const { colors, mode, loadTheme } = useThemeStore()
  const { hasSeenOnboarding, loadOnboardingState } = useOnboardingStore()
  const { loadSettings } = useSettingsStore()
  const { loadStats, setDeviceId: setStatsDeviceId } = useStatsStore()
  const { loadFromStorage: loadPairing, myDeviceId } = usePairingStore()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const init = async () => {
      logger.info('App starting...')

      // Global JS error handler (captures red-screen crashes into Supabase logs)
      try {
        const ErrorUtilsAny = (globalThis as any)?.ErrorUtils
        const originalHandler = ErrorUtilsAny?.getGlobalHandler?.()
        ErrorUtilsAny?.setGlobalHandler?.((error: unknown, isFatal?: boolean) => {
          try {
            const e = error as any
            sessionLogger.error('global_js_error', e instanceof Error ? e : new Error(String(e)), {
              isFatal: !!isFatal,
              message: e?.message,
              name: e?.name,
              stack: e?.stack,
            })
          } catch {
            // ignore
          }

          if (typeof originalHandler === 'function') {
            originalHandler(error, isFatal)
          }
        })
      } catch {
        // ignore
      }
      
      // Load all stores in parallel - these use AsyncStorage
      // which requires native modules to be ready
      await Promise.all([
        loadLanguage(), 
        loadTheme(),
        loadOnboardingState(),
        loadSettings(),
        loadStats(),
        loadPairing(),
      ])
      
      // Set device ID in stats store for Supabase sync
      const pairingState = usePairingStore.getState()
      if (pairingState.myDeviceId) {
        setStatsDeviceId(pairingState.myDeviceId)
        // Initialize session logger for Supabase logging
        sessionLogger.init(pairingState.myDeviceId)
        sessionLogger.info('app_started', { 
          hasSeenOnboarding: useOnboardingStore.getState().hasSeenOnboarding 
        })
      }
      
      // Register for push notifications (non-blocking)
      notificationService.registerForPushNotifications()
        .then((token) => {
          if (token) {
            logger.info('Push notifications registered')
          }
        })
        .catch((error) => {
          logger.warn('Push notification registration failed', { error })
        })

      setIsReady(true)

      // Hide splash screen after a brief delay for smooth transition
      setTimeout(() => {
        SplashScreen.hideAsync()
        logger.info('App ready')
      }, 400)
    }
    init()
  }, [loadLanguage, loadTheme, loadOnboardingState, loadSettings, loadStats, loadPairing])

  // Handle onboarding navigation
  useEffect(() => {
    if (!isReady) return

    const inOnboarding = segments[0] === 'onboarding'
    
    if (!hasSeenOnboarding && !inOnboarding) {
      // User hasn't seen onboarding, redirect them
      router.replace('/onboarding')
    } else if (hasSeenOnboarding && inOnboarding) {
      // User has seen onboarding but somehow on that page, go home
      router.replace('/')
    }
  }, [isReady, hasSeenOnboarding, segments, router])

  // Track navigation
  useEffect(() => {
    logger.trackNavigation('RootLayout mounted')
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppUpdatePrompt />
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: true,
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
            headerTitleStyle: {
              fontWeight: '600',
              fontSize: 18,
            },
            headerShadowVisible: false,
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
          <Stack.Screen 
            name="onboarding" 
            options={{ 
              headerShown: false,
              animation: 'fade',
              gestureEnabled: false,
            }} 
          />
          <Stack.Screen 
            name="index" 
            options={{ 
              headerShown: false,
            }} 
          />
          <Stack.Screen 
            name="pairing" 
            options={{ 
              title: t.pairing.title,
              presentation: 'card',
            }} 
          />
          <Stack.Screen 
            name="camera" 
            options={{ 
              title: t.camera.title,
              headerShown: false,
              gestureEnabled: false,
            }} 
          />
          <Stack.Screen 
            name="viewer" 
            options={{ 
              title: t.viewer.title,
              headerStyle: {
                backgroundColor: colors.background,
              },
            }} 
          />
          <Stack.Screen 
            name="gallery" 
            options={{ 
              title: t.gallery.title,
            }} 
          />
          <Stack.Screen 
            name="profile" 
            options={{ 
              title: t.profile.title,
            }} 
          />
          <Stack.Screen 
            name="settings" 
            options={{ 
              title: t.settings.title,
            }} 
          />
          <Stack.Screen 
            name="feedback" 
            options={{ 
              title: 'Feedback',
            }} 
          />
          <Stack.Screen 
            name="changelog" 
            options={{ 
              title: "What's New",
            }} 
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
