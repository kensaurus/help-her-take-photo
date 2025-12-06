/**
 * Root Layout - App navigation with theme support
 * Initializes Sentry, notifications, and other services
 */

import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as SplashScreen from 'expo-splash-screen'
import { useLanguageStore } from '../src/stores/languageStore'
import { useThemeStore } from '../src/stores/themeStore'
import { initSentry, logger } from '../src/services/logging'
import { notificationService } from '../src/services/notifications'

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync()

// Initialize Sentry (add your DSN in production)
// initSentry('YOUR_SENTRY_DSN')

export default function RootLayout() {
  const { t, loadLanguage } = useLanguageStore()
  const { colors, mode, loadTheme } = useThemeStore()

  useEffect(() => {
    const init = async () => {
      logger.info('App starting...')
      
      // Load user preferences
      await Promise.all([loadLanguage(), loadTheme()])
      
      // Register for push notifications
      notificationService.registerForPushNotifications()
        .then((token) => {
          if (token) {
            logger.info('Push notifications registered')
          }
        })
        .catch((error) => {
          logger.warn('Push notification registration failed', { error })
        })

      // Hide splash screen after a brief delay for smooth transition
      setTimeout(() => {
        SplashScreen.hideAsync()
        logger.info('App ready')
      }, 400)
    }
    init()
  }, [loadLanguage, loadTheme])

  // Track navigation
  useEffect(() => {
    logger.trackNavigation('RootLayout mounted')
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
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
            headerBackTitleVisible: false,
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
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
