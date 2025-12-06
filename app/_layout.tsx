/**
 * Root Layout - App navigation with theme support
 */

import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as SplashScreen from 'expo-splash-screen'
import { useLanguageStore } from '../src/stores/languageStore'
import { useThemeStore } from '../src/stores/themeStore'

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { t, loadLanguage } = useLanguageStore()
  const { colors, mode, loadTheme } = useThemeStore()

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadLanguage(), loadTheme()])
      // Hide splash screen after a brief delay for smooth transition
      setTimeout(() => {
        SplashScreen.hideAsync()
      }, 400)
    }
    init()
  }, [loadLanguage, loadTheme])

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
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
