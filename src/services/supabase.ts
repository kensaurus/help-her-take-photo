/**
 * Supabase client configuration
 * 
 * SECURITY:
 * - Uses Supabase Auth with anonymous sign-in
 * - Device ID stored in SecureStore (encrypted)
 * - Auth tokens auto-refresh with AppState listener
 * - RLS policies enforce data isolation via auth.uid()
 */

import { createClient } from '@supabase/supabase-js'
import { AppState, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { logger } from './logging'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  logger.warn('Supabase credentials not configured')
}

// Device ID storage key (SecureStore)
const DEVICE_ID_KEY = 'secure_device_id'
const DEVICE_ID_LEGACY_KEY = 'device_id' // For migration from AsyncStorage

// Global device ID cache
let _deviceId: string | null = null

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Get or create device ID from SecureStore
 * This is the unique identifier for privacy/data isolation
 * Migrates from AsyncStorage if needed
 */
export async function getDeviceId(): Promise<string> {
  if (_deviceId) return _deviceId
  
  try {
    // Try SecureStore first
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY)
    
    if (!deviceId) {
      // Check for legacy AsyncStorage key and migrate
      const legacyDeviceId = await AsyncStorage.getItem(DEVICE_ID_LEGACY_KEY)
      
      if (legacyDeviceId) {
        // Migrate to SecureStore
        await SecureStore.setItemAsync(DEVICE_ID_KEY, legacyDeviceId, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        })
        // Clean up legacy storage
        await AsyncStorage.removeItem(DEVICE_ID_LEGACY_KEY)
        deviceId = legacyDeviceId
        logger.info('Device ID migrated to SecureStore')
      } else {
        // Generate new UUID
        deviceId = generateUUID()
        await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        })
        logger.info('New device ID generated')
      }
    }
    
    _deviceId = deviceId
    return deviceId
  } catch (error) {
    // Fallback to AsyncStorage if SecureStore fails (e.g., web platform)
    logger.warn('SecureStore unavailable, falling back to AsyncStorage', { error })
    
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_LEGACY_KEY)
    if (!deviceId) {
      deviceId = generateUUID()
      await AsyncStorage.setItem(DEVICE_ID_LEGACY_KEY, deviceId)
    }
    
    _deviceId = deviceId
    return deviceId
  }
}

/**
 * Set device ID (for testing or migration)
 */
export async function setDeviceId(id: string): Promise<void> {
  _deviceId = id
  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    })
  } catch {
    await AsyncStorage.setItem(DEVICE_ID_LEGACY_KEY, id)
  }
}

/**
 * Get cached device ID (sync, may be null)
 */
export function getCachedDeviceId(): string | null {
  return _deviceId
}

/**
 * Clear device ID (for logout/reset)
 */
export async function clearDeviceId(): Promise<void> {
  _deviceId = null
  try {
    await SecureStore.deleteItemAsync(DEVICE_ID_KEY)
  } catch {
    // Ignore
  }
  await AsyncStorage.removeItem(DEVICE_ID_LEGACY_KEY)
}

// ─────────────────────────────────────────────────────────────────────────────────
// Supabase Client with Auth Configuration
// ─────────────────────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Use AsyncStorage for auth token persistence (required for React Native)
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    // Auto-refresh tokens before expiry
    autoRefreshToken: true,
    // Persist session across app restarts
    persistSession: true,
    // Don't detect session from URL (not applicable in React Native)
    detectSessionInUrl: false,
  },
})

// ─────────────────────────────────────────────────────────────────────────────────
// AppState Listener for Token Refresh
// Tells Supabase Auth to continuously refresh the session automatically
// if the app is in the foreground.
// ─────────────────────────────────────────────────────────────────────────────────

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────────
// Anonymous Auth Helper
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Ensure user is authenticated (anonymous if no account)
 * This provides JWT-based security for RLS policies
 */
export async function ensureAuthenticated(): Promise<{ userId: string | null; error?: string }> {
  try {
    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      return { userId: session.user.id }
    }
    
    // Sign in anonymously
    const { data, error } = await supabase.auth.signInAnonymously()
    
    if (error) {
      logger.error('Anonymous auth failed', error)
      return { userId: null, error: error.message }
    }
    
    if (data.user) {
      logger.info('Anonymous auth successful', { userId: data.user.id.substring(0, 8) })
      return { userId: data.user.id }
    }
    
    return { userId: null, error: 'No user returned' }
  } catch (error) {
    logger.error('Auth error', error)
    return { userId: null, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Get current auth user ID (for RLS policies)
 */
export async function getAuthUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * Sign out and clear session
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
  logger.info('User signed out')
}

// ─────────────────────────────────────────────────────────────────────────────────
// Database Types
// ─────────────────────────────────────────────────────────────────────────────────

export interface Device {
  id: string
  device_id: string
  device_name?: string
  platform?: string
  push_token?: string
  app_version?: string
  locale?: string
  timezone?: string
  last_active_at?: string
  created_at?: string
  updated_at?: string
}

export interface PairingSession {
  id: string
  code: string
  device_id: string
  partner_device_id?: string
  creator_role?: 'camera' | 'viewer'
  status: 'pending' | 'paired' | 'expired' | 'ended'
  ended_at?: string
  created_at?: string
  expires_at: string
}

export interface ActiveConnection {
  id: string
  session_id: string
  camera_device_id: string
  viewer_device_id: string
  signaling_channel?: string
  is_streaming?: boolean
  quality?: 'low' | 'medium' | 'high'
  started_at?: string
  last_heartbeat_at?: string
}

export interface Capture {
  id: string
  session_id?: string
  camera_device_id: string
  viewer_device_id?: string
  storage_path?: string
  thumbnail_path?: string
  width?: number
  height?: number
  file_size_bytes?: number
  mime_type?: string
  captured_by?: 'camera' | 'viewer'
  is_favorite?: boolean
  deleted_at?: string
  created_at?: string
}

export interface UserStats {
  id: string
  device_id: string
  photos_taken: number
  photos_helped: number
  photos_received: number
  total_sessions: number
  camera_sessions: number
  viewer_sessions: number
  total_session_minutes: number
  current_streak_days: number
  longest_streak_days: number
  last_session_date?: string
  achievements: unknown[]
  experience_points: number
  level: number
  created_at?: string
  updated_at?: string
}

export interface UserSettings {
  id: string
  device_id: string
  theme: 'light' | 'dark' | 'system'
  language: string
  default_role: 'camera' | 'viewer'
  camera_quality: 'low' | 'medium' | 'high'
  save_to_gallery: boolean
  show_grid: boolean
  enable_flash: boolean
  notifications_enabled: boolean
  sound_enabled: boolean
  haptics_enabled: boolean
  analytics_enabled: boolean
  crash_reports_enabled: boolean
  created_at?: string
  updated_at?: string
}

export interface Feedback {
  id: string
  device_token?: string
  type: 'feature' | 'bug' | 'other' | 'rating'
  message: string
  email?: string
  rating?: number
  app_version?: string
  platform?: string
  status?: 'new' | 'reviewing' | 'resolved' | 'closed'
  admin_notes?: string
  created_at?: string
}

export interface SessionEvent {
  id: string
  session_id?: string
  device_id: string
  event_type: string
  event_data?: Record<string, unknown>
  created_at?: string
}

export interface AppVersion {
  id: string
  version: string
  build_number?: string
  download_url: string
  force_update: boolean
  changelog?: string
  created_at?: string
}
