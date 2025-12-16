/**
 * Cloud API Service - Connects to Supabase Edge Functions
 * 
 * Provides typed API calls to:
 * - Photo upload & cloud backup
 * - AI photo analysis
 * - Push notifications
 * - Album management
 * - Friends & social features
 * - Analytics dashboard
 */

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase'
import { logger } from './logging'

// ─────────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────────

export interface CloudUploadResult {
  success: boolean
  publicUrl?: string
  storagePath?: string
  error?: string
}

export interface AIAnalysisResult {
  success: boolean
  analysisId?: string
  composition?: {
    score: number
    rule_of_thirds: boolean
    leading_lines: boolean
    symmetry: boolean
    suggestions: string[]
  }
  lighting?: {
    quality: string
    brightness: number
    contrast: number
    suggestions: string[]
  }
  subjects?: Array<{
    label: string
    confidence: number
    position: string
  }>
  overall_suggestions?: string[]
  error?: string
}

export interface Album {
  id: string
  device_id: string
  name: string
  share_code: string | null
  is_public: boolean
  created_at: string
  updated_at: string
  photo_count?: number
}

export interface Friend {
  id: string
  device_id: string
  friend_device_id: string
  status: 'pending' | 'accepted' | 'blocked'
  display_name?: string
  avatar_emoji?: string
  created_at: string
  accepted_at?: string
}

export interface RecentPartner {
  id: string
  device_id: string
  partner_device_id: string
  partner_name?: string
  partner_avatar?: string
  session_count: number
  last_session_at: string
  total_photos: number
}

export interface AnalyticsSummary {
  totalSessions: number
  totalPhotos: number
  averageSessionDuration: number
  topDirections: Array<{ direction: string; count: number }>
  activeDevices: number
  dailyTrend: Array<{ date: string; sessions: number; photos: number }>
}

// ─────────────────────────────────────────────────────────────────────────────────
// Edge Function Endpoints
// ─────────────────────────────────────────────────────────────────────────────────

const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  options?: { timeout?: number }
): Promise<T> {
  const controller = new AbortController()
  const timeout = options?.timeout || 30000
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(`${FUNCTIONS_URL}/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`)
    }

    return data as T
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// Photo Cloud Upload API
// ─────────────────────────────────────────────────────────────────────────────────

export const cloudPhotoApi = {
  /**
   * Upload a photo to cloud storage
   */
  async upload(params: {
    captureId: string
    deviceId: string
    imageBase64: string
    mimeType?: string
    albumId?: string
  }): Promise<CloudUploadResult> {
    try {
      logger.info('cloud_upload_starting', { captureId: params.captureId })

      const result = await callEdgeFunction<{
        success: boolean
        publicUrl?: string
        storagePath?: string
        error?: string
      }>('upload-photo', {
        captureId: params.captureId,
        deviceId: params.deviceId,
        imageData: params.imageBase64,
        mimeType: params.mimeType || 'image/jpeg',
        albumId: params.albumId,
      }, { timeout: 60000 }) // 60s for upload

      if (result.success) {
        logger.info('cloud_upload_success', { 
          captureId: params.captureId,
          storagePath: result.storagePath 
        })
      }

      return result
    } catch (error) {
      logger.error('cloud_upload_error', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      }
    }
  },

  /**
   * Convert local URI to base64 for upload
   */
  async uriToBase64(uri: string): Promise<string | null> {
    try {
      const response = await fetch(uri)
      const blob = await response.blob()
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Remove data URL prefix
          const base64 = result.split(',')[1]
          resolve(base64)
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      logger.error('uri_to_base64_error', error)
      return null
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────────
// AI Photo Analysis API
// ─────────────────────────────────────────────────────────────────────────────────

export const aiAnalysisApi = {
  /**
   * Analyze a photo using AI
   */
  async analyze(params: {
    captureId: string
    imageUrl: string
    deviceId: string
  }): Promise<AIAnalysisResult> {
    try {
      logger.info('ai_analysis_starting', { captureId: params.captureId })

      const result = await callEdgeFunction<{
        success: boolean
        analysisId?: string
        analysis?: {
          composition: AIAnalysisResult['composition']
          lighting: AIAnalysisResult['lighting']
          subjects: AIAnalysisResult['subjects']
          overall_suggestions: string[]
        }
        error?: string
      }>('analyze-photo', {
        captureId: params.captureId,
        imageUrl: params.imageUrl,
        deviceId: params.deviceId,
      }, { timeout: 45000 }) // 45s for AI

      if (result.success && result.analysis) {
        logger.info('ai_analysis_complete', { captureId: params.captureId })
        return {
          success: true,
          analysisId: result.analysisId,
          ...result.analysis,
        }
      }

      return { success: false, error: result.error || 'Analysis failed' }
    } catch (error) {
      logger.error('ai_analysis_error', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Analysis failed' 
      }
    }
  },

  /**
   * Get existing analysis for a capture
   */
  async getAnalysis(captureId: string): Promise<AIAnalysisResult | null> {
    try {
      const { data, error } = await supabase
        .from('ai_analyses')
        .select('*')
        .eq('capture_id', captureId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) return null

      return {
        success: true,
        analysisId: data.id,
        composition: data.composition_analysis,
        lighting: data.lighting_analysis,
        subjects: data.detected_subjects,
        overall_suggestions: data.suggestions,
      }
    } catch {
      return null
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────────
// Push Notifications API
// ─────────────────────────────────────────────────────────────────────────────────

export const notificationsApi = {
  /**
   * Send a push notification to a device
   */
  async send(params: {
    deviceId: string
    title: string
    body: string
    data?: Record<string, unknown>
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await callEdgeFunction<{
        success: boolean
        ticketId?: string
        error?: string
      }>('send-notification', {
        deviceId: params.deviceId,
        title: params.title,
        body: params.body,
        data: params.data,
      })

      return { success: result.success, error: result.error }
    } catch (error) {
      logger.error('notification_send_error', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send notification' 
      }
    }
  },

  /**
   * Notify partner about photo capture
   */
  async notifyPhotoCaptured(partnerDeviceId: string, photoCount: number = 1): Promise<void> {
    await this.send({
      deviceId: partnerDeviceId,
      title: '📸 New Photo!',
      body: photoCount > 1 
        ? `${photoCount} new photos captured!` 
        : 'A new photo was captured!',
      data: { type: 'photo_captured', count: photoCount },
    })
  },

  /**
   * Notify partner about session invite
   */
  async notifySessionInvite(partnerDeviceId: string, inviterName?: string): Promise<void> {
    await this.send({
      deviceId: partnerDeviceId,
      title: '🔗 Session Invite',
      body: inviterName 
        ? `${inviterName} wants to start a photo session!` 
        : 'Someone wants to start a photo session with you!',
      data: { type: 'session_invite' },
    })
  },
}

// ─────────────────────────────────────────────────────────────────────────────────
// Album Management API
// ─────────────────────────────────────────────────────────────────────────────────

export const albumsApi = {
  /**
   * Create a new album
   */
  async create(params: {
    deviceId: string
    name: string
    isPublic?: boolean
  }): Promise<{ album?: Album; error?: string }> {
    try {
      const result = await callEdgeFunction<{
        success: boolean
        album?: Album
        error?: string
      }>('manage-album', {
        action: 'create',
        deviceId: params.deviceId,
        name: params.name,
        isPublic: params.isPublic ?? false,
      })

      if (result.success && result.album) {
        return { album: result.album }
      }
      return { error: result.error || 'Failed to create album' }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to create album' }
    }
  },

  /**
   * List all albums for a device
   */
  async list(deviceId: string): Promise<{ albums: Album[]; error?: string }> {
    try {
      const result = await callEdgeFunction<{
        success: boolean
        albums?: Album[]
        error?: string
      }>('manage-album', {
        action: 'list',
        deviceId,
      })

      return { albums: result.albums || [], error: result.error }
    } catch (error) {
      return { albums: [], error: error instanceof Error ? error.message : 'Failed to list albums' }
    }
  },

  /**
   * Update an album
   */
  async update(params: {
    albumId: string
    deviceId: string
    name?: string
    isPublic?: boolean
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await callEdgeFunction<{
        success: boolean
        error?: string
      }>('manage-album', {
        action: 'update',
        ...params,
      })

      return { success: result.success, error: result.error }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update album' }
    }
  },

  /**
   * Delete an album
   */
  async delete(albumId: string, deviceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await callEdgeFunction<{
        success: boolean
        error?: string
      }>('manage-album', {
        action: 'delete',
        albumId,
        deviceId,
      })

      return { success: result.success, error: result.error }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete album' }
    }
  },

  /**
   * Generate a share code for an album
   */
  async generateShareCode(albumId: string, deviceId: string): Promise<{ shareCode?: string; error?: string }> {
    try {
      const result = await callEdgeFunction<{
        success: boolean
        shareCode?: string
        error?: string
      }>('manage-album', {
        action: 'generate_share_code',
        albumId,
        deviceId,
      })

      return { shareCode: result.shareCode, error: result.error }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to generate share code' }
    }
  },

  /**
   * Add a photo to an album
   */
  async addPhoto(albumId: string, captureId: string, deviceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await callEdgeFunction<{
        success: boolean
        error?: string
      }>('manage-album', {
        action: 'add_photo',
        albumId,
        captureId,
        deviceId,
      })

      return { success: result.success, error: result.error }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add photo to album' }
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────────
// Friends & Social API
// ─────────────────────────────────────────────────────────────────────────────────

export const friendsApi = {
  /**
   * Send a friend request
   */
  async sendRequest(deviceId: string, friendDeviceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await callEdgeFunction<{
        success: boolean
        error?: string
      }>('manage-friends', {
        action: 'send_request',
        deviceId,
        friendDeviceId,
      })

      return { success: result.success, error: result.error }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to send friend request' }
    }
  },

  /**
   * Accept a friend request
   */
  async acceptRequest(deviceId: string, friendDeviceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await callEdgeFunction<{
        success: boolean
        error?: string
      }>('manage-friends', {
        action: 'accept_request',
        deviceId,
        friendDeviceId,
      })

      return { success: result.success, error: result.error }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to accept request' }
    }
  },

  /**
   * List all friends
   */
  async list(deviceId: string): Promise<{ friends: Friend[]; error?: string }> {
    try {
      const result = await callEdgeFunction<{
        success: boolean
        friends?: Friend[]
        error?: string
      }>('manage-friends', {
        action: 'list_friends',
        deviceId,
      })

      return { friends: result.friends || [], error: result.error }
    } catch (error) {
      return { friends: [], error: error instanceof Error ? error.message : 'Failed to list friends' }
    }
  },

  /**
   * Get recent partners for quick reconnect
   */
  async getRecentPartners(deviceId: string, limit: number = 5): Promise<{ partners: RecentPartner[]; error?: string }> {
    try {
      const result = await callEdgeFunction<{
        success: boolean
        partners?: RecentPartner[]
        error?: string
      }>('manage-friends', {
        action: 'recent_partners',
        deviceId,
        limit,
      })

      return { partners: result.partners || [], error: result.error }
    } catch (error) {
      return { partners: [], error: error instanceof Error ? error.message : 'Failed to get recent partners' }
    }
  },

  /**
   * Block a user
   */
  async block(deviceId: string, friendDeviceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await callEdgeFunction<{
        success: boolean
        error?: string
      }>('manage-friends', {
        action: 'block',
        deviceId,
        friendDeviceId,
      })

      return { success: result.success, error: result.error }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to block user' }
    }
  },

  /**
   * Remove a friend
   */
  async remove(deviceId: string, friendDeviceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await callEdgeFunction<{
        success: boolean
        error?: string
      }>('manage-friends', {
        action: 'remove_friend',
        deviceId,
        friendDeviceId,
      })

      return { success: result.success, error: result.error }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to remove friend' }
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────────
// Analytics API
// ─────────────────────────────────────────────────────────────────────────────────

export const analyticsApi = {
  /**
   * Get analytics summary
   */
  async getSummary(params: {
    period: 'today' | 'week' | 'month' | 'all'
    deviceId?: string
  }): Promise<{ analytics?: AnalyticsSummary; error?: string }> {
    try {
      const result = await callEdgeFunction<{
        success: boolean
        analytics?: AnalyticsSummary
        error?: string
      }>('get-analytics', {
        period: params.period,
        deviceId: params.deviceId,
      })

      return { analytics: result.analytics, error: result.error }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get analytics' }
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────────
// Export all APIs
// ─────────────────────────────────────────────────────────────────────────────────

export const cloudApi = {
  photo: cloudPhotoApi,
  ai: aiAnalysisApi,
  notifications: notificationsApi,
  albums: albumsApi,
  friends: friendsApi,
  analytics: analyticsApi,
}

