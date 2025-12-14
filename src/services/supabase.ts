/**
 * Supabase client configuration
 * 
 * PRIVACY: All queries MUST filter by device_id
 * The API service enforces this at the application level
 */

import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase credentials not configured')
}

// Device ID storage key
const DEVICE_ID_KEY = 'device_id'

// Global device ID cache
let _deviceId: string | null = null

/**
 * Get or create device ID
 * This is the unique identifier for privacy/data isolation
 */
export async function getDeviceId(): Promise<string> {
  if (_deviceId) return _deviceId
  
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY)
  
  if (!deviceId) {
    // Generate UUID v4
    deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  
  _deviceId = deviceId
  return deviceId
}

/**
 * Set device ID (for testing or migration)
 */
export function setDeviceId(id: string) {
  _deviceId = id
  AsyncStorage.setItem(DEVICE_ID_KEY, id)
}

/**
 * Get cached device ID (sync, may be null)
 */
export function getCachedDeviceId(): string | null {
  return _deviceId
}

// Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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
