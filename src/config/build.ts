/**
 * Build information - Dynamic version management
 * 
 * Uses expo-constants for build timestamp (from app.config.ts extra)
 * Uses expo-application for native version info (from native build)
 * 
 * @see https://docs.expo.dev/versions/latest/sdk/application/
 * @see https://docs.expo.dev/versions/latest/sdk/constants/
 */

import Constants from 'expo-constants'
import * as Application from 'expo-application'

/**
 * Get build timestamp from app config (generated at bundle time)
 * Falls back to current timestamp if not available
 */
export function getBuildTimestamp(): string {
  const extra = Constants.expoConfig?.extra
  if (extra?.buildTimestamp) {
    return extra.buildTimestamp as string
  }
  // Fallback: generate at runtime (for development)
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  return `${year}${month}${day}.${hour}${minute}`
}

/**
 * Get build date from app config
 * Falls back to current date if not available
 */
export function getBuildDate(): string {
  const extra = Constants.expoConfig?.extra
  if (extra?.buildDate) {
    return extra.buildDate as string
  }
  return new Date().toISOString().split('T')[0]
}

/**
 * Get native app version (from native build)
 * This is the version shown in app stores
 */
export function getNativeVersion(): string {
  return Application.nativeApplicationVersion || '1.0.0'
}

/**
 * Get native build version (from native build)
 * This is the build number/version code
 */
export function getNativeBuildVersion(): string {
  return Application.nativeBuildVersion || '1'
}

/**
 * Get formatted build info for display
 */
export function getBuildInfo() {
  const nativeVersion = getNativeVersion()
  const buildTimestamp = getBuildTimestamp()
  
  return {
    // Native version from app binary
    version: nativeVersion,
    // Build timestamp from bundle time
    build: buildTimestamp,
    // Combined display format
    fullVersion: `v${nativeVersion} (${buildTimestamp})`,
    // Native build number/version code
    nativeBuild: getNativeBuildVersion(),
    // Build date
    date: getBuildDate(),
  }
}

/**
 * Changelog entries - most recent first
 * This is the only thing that needs manual updates for major releases
 */
export const CHANGELOG = [
  {
    version: '1.0.1',
    date: '2025-12-08',
    changes: [
      '🎨 Improved icon rendering (no more truncation)',
      '📱 4-slide onboarding flow for new users',
      '♿ Enhanced accessibility labels',
      '🔄 Pull-to-refresh on home screen',
      '✨ Tap animations with haptic feedback',
      '💀 Skeleton loaders for loading states',
      '🔧 Fixed AsyncStorage initialization issue',
      '🔢 Dynamic build versioning (no more hardcoded dates!)',
      '📝 Updated README with CI/CD documentation',
    ],
  },
  {
    version: '1.0.0',
    date: '2025-12-06',
    changes: [
      '🎉 Initial release',
      '📱 4-digit pairing for easy connection',
      '📸 Real-time camera streaming',
      '👀 Director mode for photo guidance',
      '🖼️ Shared photo gallery',
      '🌍 Multi-language support (EN, TH, ZH, JA)',
      '🌙 Dark/Light theme',
      '🎮 Gamification with "scoldings saved" stats',
      '💬 In-app feedback system',
    ],
  },
]

// Legacy exports for backwards compatibility
export const BUILD_NUMBER = getBuildTimestamp()
export const APP_VERSION = getNativeVersion()
