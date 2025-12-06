/**
 * Build information
 * This file is updated at build time
 */

// Build timestamp (YYYYMMDD.HHMM format)
export const BUILD_NUMBER = '20241206.1200'

// App version from app.json
export const APP_VERSION = '1.0.0'

// Changelog entries (most recent first)
export const CHANGELOG = [
  {
    version: '1.0.0',
    build: '20241206.1200',
    date: '2024-12-06',
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

// Get formatted build info
export function getBuildInfo() {
  return {
    version: APP_VERSION,
    build: BUILD_NUMBER,
    fullVersion: `v${APP_VERSION} (${BUILD_NUMBER})`,
  }
}

