/**
 * Root Layout - App navigation with theme support
 * Handles onboarding flow and initializes services
 */

import { useEffect, useState, useCallback } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Alert } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'

// Initialize Sentry early (required for Sentry.wrap to work)
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  debug: true, // Show Sentry logs in console
  enabled: true, // Temporarily enabled for testing (change back to !__DEV__ for production)
  environment: __DEV__ ? 'development' : 'production',
  release: Constants.expoConfig?.version ?? '1.0.0',
  tracesSampleRate: 0.2,
  beforeSend(event) {
    // Scrub sensitive data
    if (event.request?.headers) {
      delete event.request.headers['Authorization']
      delete event.request.headers['authorization']
    }
    return event
  },
})

import { useLanguageStore } from '../src/stores/languageStore'
import { useThemeStore } from '../src/stores/themeStore'
import { useOnboardingStore } from '../src/stores/onboardingStore'
import { useSettingsStore } from '../src/stores/settingsStore'
import { useStatsStore } from '../src/stores/statsStore'
import { usePairingStore } from '../src/stores/pairingStore'
import { logger } from '../src/services/logging'
import { notificationService } from '../src/services/notifications'
import { sessionLogger } from '../src/services/sessionLogger'
import { connectionManager, type ConnectionEvent } from '../src/services/connectionManager'
import { initErrorTracking, setUser as setErrorUser } from '../src/services/errorTracking'
import { ensureAuthenticated } from '../src/services/supabase'
import { AuthProvider } from '../src/contexts/AuthContext'
import { AppUpdatePrompt } from '../src/components/ui/AppUpdatePrompt'
import { DebugMenu } from '../src/components/ui/DebugMenu'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import { ZenDock } from '../src/components/ui/ZenDock'

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync()

export default Sentry.wrap(function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const { t, loadLanguage } = useLanguageStore()
  const { colors, mode, loadTheme } = useThemeStore()
  const { hasSeenOnboarding, loadOnboardingState } = useOnboardingStore()
  const { loadSettings } = useSettingsStore()
  const { loadStats, setDeviceId: setStatsDeviceId } = useStatsStore()
  const { loadFromStorage: loadPairing, myDeviceId } = usePairingStore()
  const [isReady, setIsReady] = useState(false)

  // Handle connection manager events
  const handleConnectionEvent = useCallback((event: ConnectionEvent) => {
    switch (event.type) {
      case 'session_expired':
        // Session is no longer valid, show alert and redirect
        Alert.alert(
          'Session Expired',
          'Your pairing session has expired. Please pair again.',
          [{ text: 'OK', onPress: () => router.replace('/') }]
        )
        break
      
      case 'fatal_error':
        if (!event.recoverable) {
          Alert.alert(
            'Connection Error',
            event.error,
            [{ text: 'OK' }]
          )
        }
        break
      
      case 'reconnect_failed':
        sessionLogger.warn('reconnect_failed_alert', { reason: event.reason })
        break
    }
  }, [router])

  useEffect(() => {
    const init = async () => {
      logger.info('App starting...')

      // Initialize error tracking (Sentry) first
      await initErrorTracking()

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
      
      // Ensure anonymous authentication for RLS
      const { userId } = await ensureAuthenticated()
      if (userId) {
        setErrorUser({ id: userId })
        logger.info('Anonymous auth successful', { userId: userId.substring(0, 8) })
      }
      
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
      
      // Initialize connection manager for network/lifecycle monitoring
      connectionManager.initialize()
      
      // Subscribe to connection events
      const unsubscribe = connectionManager.subscribe(handleConnectionEvent)
      
      // Validate session if we have one (clears stale sessions)
      if (pairingState.isPaired && pairingState.sessionId) {
        sessionLogger.info('validating_existing_session', {
          sessionId: pairingState.sessionId.substring(0, 8),
        })
        // Don't await - let it run in background
        connectionManager.validateSession().then((isValid) => {
          if (!isValid) {
            sessionLogger.warn('existing_session_invalid_on_startup')
          }
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
      
      // Cleanup function
      return () => {
        unsubscribe()
      }
    }
    init()
  }, [loadLanguage, loadTheme, loadOnboardingState, loadSettings, loadStats, loadPairing, handleConnectionEvent])

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

  // Handle error boundary reset
  const handleErrorReset = useCallback(() => {
    // Navigate to home after reset
    router.replace('/')
  }, [router])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ErrorBoundary onReset={handleErrorReset}>
            <AppUpdatePrompt />
            <DebugMenu />
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
              headerShown: false,
              gestureEnabled: false,
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
            <ZenDock />
          </ErrorBoundary>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
});