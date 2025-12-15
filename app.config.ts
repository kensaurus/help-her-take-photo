/**
 * Dynamic Expo configuration
 * Build timestamp is automatically generated at bundle time
 */

import { ExpoConfig, ConfigContext } from 'expo/config'

// Generate build timestamp (YYYYMMDD.HHMM format)
const generateBuildTimestamp = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  return `${year}${month}${day}.${hour}${minute}`
}

// Build timestamp generated at bundle time
const BUILD_TIMESTAMP = generateBuildTimestamp()

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Help Her Take Photo',
  slug: 'help-her-take-photo',
  description:
    "Stop the bad photos! Real-time camera guidance app for couples. Connect devices so your partner can see and direct your camera framing live. Features: live video streaming, direction controls, photo capture, multi-language support (EN/TH/ZH/JA), gamification stats, shared gallery. Save your relationship one photo at a time!",
  version: '1.0.0',
  keywords: [
    'camera',
    'photo',
    'couples',
    'relationship',
    'photography',
    'real-time',
    'streaming',
    'guidance',
    'partner',
    'help',
  ],
  primaryColor: '#000000',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FAFAFA',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.helpher.takephoto',
    buildNumber: '1',
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      NSCameraUsageDescription:
        'This app needs camera access so you can take photos for your partner',
      NSPhotoLibraryUsageDescription:
        'This app needs photo library access to save and share photos',
      NSPhotoLibraryAddUsageDescription:
        'This app needs permission to save photos to your library',
      NSLocalNetworkUsageDescription:
        "This app uses local network to connect with your partner's device",
      NSMicrophoneUsageDescription:
        'This app may use microphone for video recording',
      NSFaceIDUsageDescription: 'Use Face ID for secure authentication',
      NSBonjourServices: ['_helphertakephoto._tcp'],
      UIBackgroundModes: ['fetch', 'remote-notification'],
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType:
            'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FAFAFA',
    },
    package: 'com.helpher.takephoto',
    versionCode: 1,
    permissions: [
      'CAMERA',
      'RECORD_AUDIO',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'READ_MEDIA_IMAGES',
      'READ_MEDIA_VIDEO',
      'READ_MEDIA_AUDIO',
      'READ_MEDIA_VISUAL_USER_SELECTED',
      'ACCESS_NETWORK_STATE',
      'ACCESS_WIFI_STATE',
      'CHANGE_WIFI_MULTICAST_STATE',
      'VIBRATE',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
      'RECEIVE_BOOT_COMPLETED',
      'POST_NOTIFICATIONS',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    [
      'expo-camera',
      {
        cameraPermission: 'Allow HelpHer to access your camera',
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission: 'Allow HelpHer to access your photos',
        savePhotosPermission: 'Allow HelpHer to save photos',
      },
    ],
    [
      'react-native-vision-camera',
      {
        cameraPermissionText:
          '$(PRODUCT_NAME) needs access to your camera for taking photos',
        enableMicrophonePermission: false,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#FF6B6B',
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission:
          'Allow $(PRODUCT_NAME) to use Face ID for authentication',
      },
    ],
    ['expo-secure-store'],
    'expo-router',
    'expo-audio',
  ],
  extra: {
    // Dynamic build info - generated at bundle time
    buildTimestamp: BUILD_TIMESTAMP,
    buildDate: new Date().toISOString().split('T')[0],
    eas: {
      projectId: '8a43c382-0044-4ea0-a4f4-7eb45d70d42c',
    },
  },
  scheme: 'helphertakephoto',
  owner: 'kensaurus',
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: 'https://u.expo.dev/8a43c382-0044-4ea0-a4f4-7eb45d70d42c',
    fallbackToCacheTimeout: 30000,
    checkAutomatically: 'ON_LOAD',
  },
})

