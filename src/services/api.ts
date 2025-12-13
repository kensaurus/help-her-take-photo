/**
 * API service using Supabase
 * Complete API for pairing, devices, captures, stats, settings
 */

import { supabase } from './supabase'
import type { 
  Device, 
  PairingSession, 
  Capture, 
  UserStats, 
  UserSettings,
  SessionEvent 
} from './supabase'
import { Platform } from 'react-native'
import Constants from 'expo-constants'

/**
 * Generate a random 4-digit code
 */
function generateCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

/**
 * Pairing API using Supabase
 */
export const pairingApi = {
  /**
   * Create a new pairing session with a 4-digit code
   */
  async createPairing(deviceId: string): Promise<{ code?: string; error?: string }> {
    try {
      // Delete any existing pending sessions for this device
      await supabase
        .from('pairing_sessions')
        .delete()
        .eq('device_id', deviceId)
        .eq('status', 'pending')

      // Generate unique code (retry if collision)
      let code = generateCode()
      let attempts = 0
      
      while (attempts < 5) {
        // Check if code already exists
        const { data: existing } = await supabase
          .from('pairing_sessions')
          .select('code')
          .eq('code', code)
          .eq('status', 'pending')
          .single()
        
        if (!existing) break
        code = generateCode()
        attempts++
      }

      // Create new session (expires in 5 minutes)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
      
      const { data, error } = await supabase
        .from('pairing_sessions')
        .insert({
          code,
          device_id: deviceId,
          status: 'pending',
          expires_at: expiresAt,
        })
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        return { error: error.message }
      }

      return { code: data.code }
    } catch (error) {
      console.error('Create pairing error:', error)
      return { error: error instanceof Error ? error.message : 'Failed to create code' }
    }
  },

  /**
   * Join a pairing session with a code
   */
  async joinPairing(deviceId: string, code: string): Promise<{ partnerId?: string; sessionId?: string; error?: string }> {
    try {
      // Find pending session with this code
      const { data: session, error: findError } = await supabase
        .from('pairing_sessions')
        .select('*')
        .eq('code', code)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single()

      if (findError || !session) {
        return { error: 'Invalid or expired code' }
      }

      // Can't join your own session
      if (session.device_id === deviceId) {
        return { error: 'Cannot join your own session' }
      }

      // Update session with partner
      const { error: updateError } = await supabase
        .from('pairing_sessions')
        .update({
          partner_device_id: deviceId,
          status: 'paired',
        })
        .eq('id', session.id)

      if (updateError) {
        return { error: updateError.message }
      }

      return { partnerId: session.device_id, sessionId: session.id }
    } catch (error) {
      console.error('Join pairing error:', error)
      return { error: error instanceof Error ? error.message : 'Failed to join' }
    }
  },

  /**
   * Check if a partner has joined
   */
  async getPartner(deviceId: string, code: string): Promise<{ partnerId?: string; sessionId?: string; error?: string }> {
    try {
      const { data: session } = await supabase
        .from('pairing_sessions')
        .select('*')
        .eq('code', code)
        .eq('device_id', deviceId)
        .single()

      if (!session) {
        return { error: 'Session not found' }
      }

      if (session.status === 'paired' && session.partner_device_id) {
        return { partnerId: session.partner_device_id, sessionId: session.id }
      }

      // Not paired yet
      return {}
    } catch (error) {
      return {}
    }
  },

  /**
   * Get current pairing for a device
   */
  async getCurrentPairing(deviceId: string): Promise<{ partnerId?: string; error?: string }> {
    try {
      // Check if device is the creator
      const { data: asCreator } = await supabase
        .from('pairing_sessions')
        .select('*')
        .eq('device_id', deviceId)
        .eq('status', 'paired')
        .single()

      if (asCreator?.partner_device_id) {
        return { partnerId: asCreator.partner_device_id }
      }

      // Check if device is the partner
      const { data: asPartner } = await supabase
        .from('pairing_sessions')
        .select('*')
        .eq('partner_device_id', deviceId)
        .eq('status', 'paired')
        .single()

      if (asPartner?.device_id) {
        return { partnerId: asPartner.device_id }
      }

      return {}
    } catch (error) {
      return {}
    }
  },

  /**
   * Unpair devices
   */
  async unpair(deviceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete sessions where device is creator or partner
      await supabase
        .from('pairing_sessions')
        .delete()
        .or(`device_id.eq.${deviceId},partner_device_id.eq.${deviceId}`)

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to unpair' 
      }
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEVICE API
// Register and manage device information
// ─────────────────────────────────────────────────────────────────────────────────

export const deviceApi = {
  /**
   * Register or update device
   */
  async register(deviceId: string, options?: {
    deviceName?: string
    pushToken?: string
    locale?: string
    timezone?: string
  }): Promise<{ device?: Device; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('devices')
        .upsert({
          device_id: deviceId,
          device_name: options?.deviceName,
          platform: Platform.OS,
          push_token: options?.pushToken,
          app_version: Constants.expoConfig?.version || '1.0.0',
          locale: options?.locale,
          timezone: options?.timezone,
          last_active_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'device_id',
        })
        .select()
        .single()

      if (error) return { error: error.message }
      return { device: data }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to register device' }
    }
  },

  /**
   * Update device push token
   */
  async updatePushToken(deviceId: string, pushToken: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('devices')
        .update({ push_token: pushToken, updated_at: new Date().toISOString() })
        .eq('device_id', deviceId)

      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update token' }
    }
  },

  /**
   * Update last active timestamp
   */
  async heartbeat(deviceId: string): Promise<void> {
    await supabase
      .from('devices')
      .update({ last_active_at: new Date().toISOString() })
      .eq('device_id', deviceId)
  },
}

// ─────────────────────────────────────────────────────────────────────────────────
// CAPTURES API
// Save and manage photos
// ─────────────────────────────────────────────────────────────────────────────────

export const capturesApi = {
  /**
   * Save a capture record
   */
  async save(capture: {
    cameraDeviceId: string
    viewerDeviceId?: string
    sessionId?: string
    storagePath?: string
    thumbnailPath?: string
    width?: number
    height?: number
    fileSizeBytes?: number
    capturedBy?: 'camera' | 'viewer'
  }): Promise<{ capture?: Capture; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('captures')
        .insert({
          camera_device_id: capture.cameraDeviceId,
          viewer_device_id: capture.viewerDeviceId,
          session_id: capture.sessionId,
          storage_path: capture.storagePath,
          thumbnail_path: capture.thumbnailPath,
          width: capture.width,
          height: capture.height,
          file_size_bytes: capture.fileSizeBytes,
          captured_by: capture.capturedBy || 'camera',
        })
        .select()
        .single()

      if (error) return { error: error.message }
      return { capture: data }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to save capture' }
    }
  },

  /**
   * Get captures for a device
   */
  async getByDevice(deviceId: string, options?: {
    limit?: number
    offset?: number
    favoritesOnly?: boolean
  }): Promise<{ captures: Capture[]; error?: string }> {
    try {
      let query = supabase
        .from('captures')
        .select('*')
        .eq('camera_device_id', deviceId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (options?.favoritesOnly) {
        query = query.eq('is_favorite', true)
      }
      if (options?.limit) {
        query = query.limit(options.limit)
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
      }

      const { data, error } = await query

      if (error) return { captures: [], error: error.message }
      return { captures: data || [] }
    } catch (error) {
      return { captures: [], error: error instanceof Error ? error.message : 'Failed to fetch captures' }
    }
  },

  /**
   * Toggle favorite status
   */
  async toggleFavorite(captureId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current status
      const { data: capture } = await supabase
        .from('captures')
        .select('is_favorite')
        .eq('id', captureId)
        .single()

      // Toggle
      const { error } = await supabase
        .from('captures')
        .update({ is_favorite: !capture?.is_favorite })
        .eq('id', captureId)

      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to toggle favorite' }
    }
  },

  /**
   * Soft delete a capture
   */
  async delete(captureId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('captures')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', captureId)

      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete capture' }
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────────
// USER STATS API
// Track and update user statistics
// ─────────────────────────────────────────────────────────────────────────────────

export const statsApi = {
  /**
   * Get user stats
   */
  async get(deviceId: string): Promise<{ stats?: UserStats; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('device_id', deviceId)
        .single()

      if (error && error.code !== 'PGRST116') { // Not found is ok
        return { error: error.message }
      }

      // Return default stats if not found
      if (!data) {
        return {
          stats: {
            id: '',
            device_id: deviceId,
            photos_taken: 0,
            photos_helped: 0,
            photos_received: 0,
            total_sessions: 0,
            camera_sessions: 0,
            viewer_sessions: 0,
            total_session_minutes: 0,
            current_streak_days: 0,
            longest_streak_days: 0,
            achievements: [],
            experience_points: 0,
            level: 1,
          }
        }
      }

      return { stats: data }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to fetch stats' }
    }
  },

  /**
   * Increment photo count
   */
  async incrementPhotos(deviceId: string, type: 'taken' | 'helped' | 'received'): Promise<void> {
    const column = type === 'taken' ? 'photos_taken' 
      : type === 'helped' ? 'photos_helped' 
      : 'photos_received'

    try {
      // Get current stats
      const { data: current } = await supabase
        .from('user_stats')
        .select('photos_taken, photos_helped, photos_received')
        .eq('device_id', deviceId)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentValue = (current as any)?.[column] || 0

      // Upsert with incremented value
      await supabase
        .from('user_stats')
        .upsert({
          device_id: deviceId,
          [column]: currentValue + 1,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'device_id' })
    } catch {
      // Silent fail
    }
  },

  /**
   * Add experience points
   */
  async addXP(deviceId: string, points: number): Promise<{ newLevel?: number; error?: string }> {
    try {
      // Get current stats
      const { data: current } = await supabase
        .from('user_stats')
        .select('experience_points, level')
        .eq('device_id', deviceId)
        .single()

      const newXP = (current?.experience_points || 0) + points
      const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1

      const { error } = await supabase
        .from('user_stats')
        .upsert({
          device_id: deviceId,
          experience_points: newXP,
          level: newLevel,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'device_id' })

      if (error) return { error: error.message }
      
      // Return new level if leveled up
      if (newLevel > (current?.level || 1)) {
        return { newLevel }
      }
      return {}
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to add XP' }
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────────
// USER SETTINGS API
// Sync user preferences
// ─────────────────────────────────────────────────────────────────────────────────

export const settingsApi = {
  /**
   * Get user settings
   */
  async get(deviceId: string): Promise<{ settings?: UserSettings; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('device_id', deviceId)
        .single()

      if (error && error.code !== 'PGRST116') {
        return { error: error.message }
      }

      return { settings: data || undefined }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to fetch settings' }
    }
  },

  /**
   * Save user settings
   */
  async save(deviceId: string, settings: Partial<UserSettings>): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          device_id: deviceId,
          ...settings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'device_id' })

      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to save settings' }
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION EVENTS API
// Track analytics events
// ─────────────────────────────────────────────────────────────────────────────────

export const eventsApi = {
  /**
   * Log an event
   */
  async log(event: {
    deviceId: string
    sessionId?: string
    eventType: string
    eventData?: Record<string, unknown>
  }): Promise<void> {
    try {
      await supabase.from('session_events').insert({
        device_id: event.deviceId,
        session_id: event.sessionId,
        event_type: event.eventType,
        event_data: event.eventData,
      })
    } catch {
      // Silent fail for analytics
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────────
// FEEDBACK API
// ─────────────────────────────────────────────────────────────────────────────────

export interface FeedbackInput {
  deviceId?: string
  type: 'feature' | 'bug' | 'other' | 'rating'
  message: string
  email?: string
  rating?: number
}

export const feedbackApi = {
  async submit(input: FeedbackInput): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('feedback')
        .insert({
          device_token: input.deviceId, // Original table uses device_token
          type: input.type,
          message: input.message,
          email: input.email,
          rating: input.rating,
        })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      }
    }
  },
}
