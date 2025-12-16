/**
 * WebRTC Service for peer-to-peer video streaming
 * 
 * Uses Supabase Realtime for signaling (ICE candidates, SDP offers/answers)
 * 
 * Flow:
 * 1. Camera device creates offer → stores in Supabase
 * 2. Director device fetches offer → creates answer → stores in Supabase
 * 3. Both exchange ICE candidates via Supabase Realtime
 * 4. Connection established → video streams P2P
 * 
 * NOTE: WebRTC requires a development build - it does NOT work in Expo Go!
 */

import { supabase } from './supabase'
import { sessionLogger, CAMERA_ERROR_MESSAGES } from './sessionLogger'
import type { RealtimeChannel } from '@supabase/supabase-js'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, name = 'TimeoutError'): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(`Timed out after ${timeoutMs}ms`)
      ;(err as Error).name = name
      reject(err)
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}

// Helper to parse media errors
function parseMediaError(error: Error | unknown): string {
  if (!(error instanceof Error)) return 'UnknownError'
  
  const errorName = error.name
  
  switch (errorName) {
    case 'TimeoutError':
      return 'TimeoutError'
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'NotAllowedError'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'NotFoundError'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'NotReadableError'
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'OverconstrainedError'
    case 'AbortError':
      return 'AbortError'
    case 'SecurityError':
      return 'SecurityError'
    case 'TypeError':
      return 'TypeError'
    default:
      return 'UnknownError'
  }
}

// Dynamically import WebRTC to handle Expo Go gracefully
let RTCPeerConnection: any
let RTCSessionDescription: any
let RTCIceCandidate: any
let mediaDevices: any
let MediaStream: any
let isWebRTCAvailable = false

try {
  const webrtc = require('react-native-webrtc')
  RTCPeerConnection = webrtc.RTCPeerConnection
  RTCSessionDescription = webrtc.RTCSessionDescription
  RTCIceCandidate = webrtc.RTCIceCandidate
  mediaDevices = webrtc.mediaDevices
  MediaStream = webrtc.MediaStream
  isWebRTCAvailable = true
} catch (error) {
  console.warn('[WebRTC] Native module not available - requires development build')
  isWebRTCAvailable = false
}

// Export availability check
export const webrtcAvailable = isWebRTCAvailable

// Metered TURN server API configuration
// Get your API key from https://www.metered.ca/stun-turn
// NOTE: EXPO_PUBLIC_ vars require native rebuild - OTA won't update them
// Using fallback for testing until native rebuild
const METERED_API_KEY = process.env.EXPO_PUBLIC_METERED_API_KEY || ''
const METERED_API_URL = process.env.EXPO_PUBLIC_METERED_API_URL || 'https://kenji.metered.live/api/v1/turn/credentials'

// STUN servers (for NAT traversal discovery - always included)
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

// Free public TURN servers (always included as fallback even if Metered works)
// These are free relay servers for when direct P2P fails
const FREE_TURN_SERVERS = [
  // OpenRelay by Metered (free public TURN)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  // Twilio free STUN (no TURN without account)
  { urls: 'stun:global.stun.twilio.com:3478' },
]

// Full fallback config (used if Metered API fails)
const FALLBACK_ICE_SERVERS = {
  iceServers: [...STUN_SERVERS, ...FREE_TURN_SERVERS],
  iceCandidatePoolSize: 10,
}

// Cache for TURN credentials (they expire, so we refresh periodically)
let cachedIceServers: RTCConfiguration | null = null
let cacheTimestamp = 0
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes (credentials typically expire in 1 hour)

/**
 * Fetch TURN server credentials from Metered API
 * Returns cached credentials if still valid
 */
async function getIceServers(): Promise<RTCConfiguration> {
  // Return cached if still valid
  const now = Date.now()
  if (cachedIceServers && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    sessionLogger.logWebRTC('using_cached_ice_servers', { 
      age: Math.round((now - cacheTimestamp) / 1000) + 's' 
    })
    return cachedIceServers
  }

  // If no API key configured, use fallback STUN-only
  if (!METERED_API_KEY) {
    sessionLogger.warn('no_metered_api_key', {
      message: 'EXPO_PUBLIC_METERED_API_KEY not set, using STUN-only (may fail on mobile networks)',
    })
    return FALLBACK_ICE_SERVERS
  }

  try {
    sessionLogger.logWebRTC('fetching_turn_credentials', { 
      url: METERED_API_URL.replace(METERED_API_KEY, '***') 
    })

    // Avoid hanging init on slow/captive networks (common on Android).
    const controller = new AbortController()
    const abortId = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(`${METERED_API_URL}?apiKey=${METERED_API_KEY}`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(abortId))
    
    if (!response.ok) {
      throw new Error(`Metered API error: ${response.status} ${response.statusText}`)
    }

    const meteredServers = await response.json()
    
    // Merge Metered servers with STUN and free TURN as backup
    // This ensures we always have fallback relay servers
    const mergedServers = [
      ...STUN_SERVERS,           // Google/Cloudflare STUN
      ...meteredServers,         // Metered TURN (primary)
      ...FREE_TURN_SERVERS,      // Free TURN (backup)
    ]
    
    sessionLogger.logWebRTC('turn_credentials_fetched', {
      meteredCount: meteredServers?.length ?? 0,
      totalCount: mergedServers.length,
      hasSTUN: mergedServers.some((s: { urls: string | string[] }) => 
        (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u: string) => u.startsWith('stun:'))
      ),
      hasTURN: mergedServers.some((s: { urls: string | string[] }) => 
        (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u: string) => u.startsWith('turn:'))
      ),
    })

    // Cache the merged result
    cachedIceServers = {
      iceServers: mergedServers,
      iceCandidatePoolSize: 10,
    }
    cacheTimestamp = now

    return cachedIceServers
  } catch (error) {
    sessionLogger.error('turn_credentials_fetch_failed', error, {
      fallback: 'using STUN-only servers',
    })
    
    // Return fallback STUN servers
    return FALLBACK_ICE_SERVERS
  }
}

export type WebRTCRole = 'camera' | 'director'

interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate'
  data: RTCSessionDescriptionInit | RTCIceCandidateInit
}

interface WebRTCCallbacks {
  onRemoteStream?: (stream: MediaStream) => void
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void
  onError?: (error: Error) => void
}

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private channel: RealtimeChannel | null = null
  
  private deviceId: string | null = null
  private peerDeviceId: string | null = null
  private sessionId: string | null = null
  private role: WebRTCRole | null = null
  private callbacks: WebRTCCallbacks = {}
  
  // Lock to prevent race conditions between init and destroy
  private isInitializing = false
  private initializationId = 0
  
  // Mutex for cleanup operations - prevents concurrent init/destroy race conditions
  private cleanupPromise: Promise<void> | null = null
  
  // Guard against handling duplicate offers (race condition fix)
  private isHandlingOffer = false
  private lastOfferTime = 0
  
  // ICE timeout monitoring - detects stuck "checking" state
  private iceCheckingStartTime: number | null = null
  private iceTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  private readonly ICE_CHECKING_TIMEOUT_MS = 20000 // 20 seconds max in "checking" state
  
  // Connection health monitoring
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null
  private lastStatsTime: number = 0
  private consecutiveFailedStatsChecks = 0

  /**
   * Check if WebRTC is available
   */
  isAvailable(): boolean {
    return isWebRTCAvailable
  }

  /**
   * Initialize WebRTC service
   * Returns a promise that resolves when initialization is complete
   * 
   * ANDROID FIX: Added delays and defensive try/catch around RTCPeerConnection
   * to prevent native crashes when switching roles quickly.
   */
  async init(
    deviceId: string,
    peerDeviceId: string,
    sessionId: string,
    role: WebRTCRole,
    callbacks: WebRTCCallbacks
  ): Promise<void> {
    const initStartTime = Date.now()
    
    // Log at the very start to track if init is called
    sessionLogger.logCamera('init_start', { 
      role,
      deviceId: deviceId?.substring(0, 8),
      peerDeviceId: peerDeviceId?.substring(0, 8),
      sessionId: sessionId?.substring(0, 8),
      isWebRTCAvailable,
      hasPendingCleanup: !!this.cleanupPromise,
      initStartTime,
    })

    // Check if WebRTC is available (requires development build)
    if (!isWebRTCAvailable) {
      const error = new Error('WebRTC requires a development build. Video streaming is not available in Expo Go.')
      sessionLogger.warn('webrtc_not_available', { reason: 'expo_go' })
      callbacks.onError?.(error)
      return
    }

    try {
      // CRITICAL: Wait for any pending destroy() to complete before starting init
      // This prevents race conditions when switching between camera/viewer screens
      if (this.cleanupPromise) {
        sessionLogger.logWebRTC('init_waiting_for_cleanup', { role })
        try {
          await this.cleanupPromise
        } catch {
          // Ignore cleanup errors, proceed with init
        }
        sessionLogger.logWebRTC('init_cleanup_wait_complete', { role })
      }

      // Clean up any existing connection first
      if (this.peerConnection || this.channel) {
        sessionLogger.logWebRTC('init_cleanup_existing', { 
          hadPeerConnection: !!this.peerConnection,
          hadChannel: !!this.channel,
          previousRole: this.role,
        })
        await this.cleanupInternal()
        
        // ANDROID FIX: After cleanup, wait for native resources to fully release.
        // On Android, RTCPeerConnection.close() is async at native level and
        // creating a new connection immediately can cause a native crash.
        sessionLogger.logWebRTC('init_post_cleanup_delay', { role, delayMs: 500 })
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Set initialization lock and ID
      this.isInitializing = true
      this.initializationId++
      const currentInitId = this.initializationId

      this.deviceId = deviceId
      this.peerDeviceId = peerDeviceId
      this.sessionId = sessionId
      this.role = role
      this.callbacks = callbacks

      sessionLogger.logWebRTC('init', { 
        role,
        deviceId,
        sessionId,
        peerDeviceId,
        initId: currentInitId,
      })

      // Fetch TURN credentials from Metered API
      sessionLogger.logWebRTC('fetching_ice_servers', { role, initId: currentInitId })
      const iceServersConfig = await getIceServers()
      
      sessionLogger.logWebRTC('ice_servers_received', { 
        role, 
        initId: currentInitId,
        serverCount: iceServersConfig.iceServers?.length ?? 0,
      })
      
      // Check if init was cancelled during credential fetch
      if (this.initializationId !== currentInitId) {
        sessionLogger.logWebRTC('init_cancelled_during_ice_fetch', { initId: currentInitId })
        return
      }

      // ANDROID FIX: Wrap RTCPeerConnection creation in explicit try/catch.
      // On some Android devices/builds, the constructor can throw or cause native crash.
      sessionLogger.logWebRTC('creating_peer_connection', { 
        role, 
        initId: currentInitId,
        iceServerCount: iceServersConfig.iceServers?.length ?? 0,
      })
      
      let peerConnection: RTCPeerConnection | null = null
      try {
        peerConnection = new RTCPeerConnection(iceServersConfig)
      } catch (pcError) {
        sessionLogger.error('rtc_peer_connection_constructor_failed', pcError, {
          role,
          initId: currentInitId,
          iceServerCount: iceServersConfig.iceServers?.length ?? 0,
          errorName: (pcError as Error)?.name,
          errorMessage: (pcError as Error)?.message,
        })
        this.isInitializing = false
        const userError = new Error('Failed to initialize video connection. Please try again.')
        userError.name = 'RTCPeerConnectionError'
        callbacks.onError?.(userError)
        return
      }
      
      if (!peerConnection) {
        sessionLogger.error('rtc_peer_connection_null', new Error('RTCPeerConnection constructor returned null'), {
          role,
          initId: currentInitId,
        })
        this.isInitializing = false
        const userError = new Error('Failed to initialize video connection. Please try again.')
        userError.name = 'RTCPeerConnectionError'
        callbacks.onError?.(userError)
        return
      }
      
      this.peerConnection = peerConnection
      sessionLogger.logWebRTC('peer_connection_created_successfully', { role, initId: currentInitId })
      
      this.setupPeerConnectionHandlers()
      sessionLogger.logWebRTC('peer_connection_handlers_attached', { role, initId: currentInitId })

      // Subscribe to signaling channel
      sessionLogger.logWebRTC('subscribing_to_signaling', { role, initId: currentInitId })
      await this.subscribeToSignaling()

      // Check if init was cancelled during async operations
      if (this.initializationId !== currentInitId) {
        sessionLogger.logWebRTC('init_cancelled', { reason: 'new_init_started', initId: currentInitId })
        return
      }

      // Camera starts the connection - get local stream and create offer
      if (role === 'camera') {
        sessionLogger.logWebRTC('camera_role_starting_stream', { initId: currentInitId })
        
        const stream = await this.startLocalStream()
        
        if (!stream) {
          sessionLogger.error('init_failed_no_stream', new Error('Failed to get local stream'), { role })
          callbacks.onError?.(new Error('Failed to access camera. Please check permissions.'))
          return
        }
        
        // Check again after async operation
        if (this.initializationId !== currentInitId || !this.peerConnection) {
          sessionLogger.logWebRTC('init_cancelled_before_offer', { initId: currentInitId })
          return
        }
        
        sessionLogger.logWebRTC('camera_creating_offer', { initId: currentInitId })
        await this.createOffer()
        sessionLogger.logWebRTC('camera_init_complete', { initId: currentInitId })
      } else {
        sessionLogger.logWebRTC('director_init_complete', { initId: currentInitId })
        
        // FIX: Director signals camera to re-negotiate when switching roles
        // This solves the problem where camera doesn't know director has a new peer connection
        await this.sendDirectorReadySignal()
      }
      
      this.isInitializing = false
      sessionLogger.logWebRTC('init_success', { role, initId: currentInitId })
      
    } catch (error) {
      sessionLogger.error('init_error', error, { 
        role,
        deviceId: deviceId?.substring(0, 8),
        errorMessage: (error as Error)?.message,
        errorStack: (error as Error)?.stack?.substring(0, 500),
      })
      this.isInitializing = false
      callbacks.onError?.(error as Error)
      throw error // Re-throw so caller knows init failed
    }
  }

  /**
   * Start local camera stream
   * Best practices for mobile:
   * - Use lower resolution for better performance and battery
   * - Avoid mandatory constraints that can fail
   * - Use 'ideal' constraints to let the device choose optimal settings
   * 
   * ANDROID FIX: Added retry logic and better error handling for camera acquisition
   */
  async startLocalStream(): Promise<MediaStream | null> {
    const MAX_RETRIES = 2
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          sessionLogger.logWebRTC('stream_retry', { attempt, maxRetries: MAX_RETRIES })
          // Small delay before retry to allow camera resource release
          await new Promise(resolve => setTimeout(resolve, 500))
        }

        // First enumerate devices to find the back camera
        const devices = await mediaDevices.enumerateDevices()
        const videoDevices = devices.filter((d: { kind: string }) => d.kind === 'videoinput')
        const backCamera = videoDevices.find((d: { facing?: string }) => d.facing === 'environment')
        
        sessionLogger.logWebRTC('available_video_devices', {
          count: videoDevices.length,
          devices: videoDevices.map((d: { deviceId: string; label: string; facing?: string }) => ({
            id: d.deviceId?.substring(0, 8),
            label: d.label,
            facing: d.facing,
          })),
          attempt,
        })

        // Video constraints optimized for mobile
        // Using 'ideal' allows fallback if exact values aren't supported
        // ANDROID FIX: Lowered resolution for better compatibility on more devices
        const constraints = {
          video: {
            facingMode: { ideal: 'environment' }, // 'environment' = back camera
            width: { ideal: 1280, min: 320 }, // Lowered min for better device support
            height: { ideal: 720, min: 240 },  // Lowered min for better device support
            frameRate: { ideal: 30, min: 10 }, // Lowered min framerate
            // Optional: specify device if found
            ...(backCamera?.deviceId && { deviceId: { ideal: backCamera.deviceId } }),
          },
          audio: false, // No audio needed
        }

        sessionLogger.logWebRTC('requesting_user_media', { constraints, attempt })

        // getUserMedia can hang indefinitely on some Android devices/builds.
        // Force a timeout so the UI can fall back to expo-camera instead of blank screen.
        const stream = (await withTimeout(
          mediaDevices.getUserMedia(constraints),
          12000,
          'TimeoutError'
        )) as unknown as MediaStream

        if (!stream) {
          throw new Error('getUserMedia returned null stream')
        }

        // Verify we got video tracks
        const videoTracks = (stream as any).getVideoTracks?.() as unknown[] | undefined
        if (!videoTracks || videoTracks.length === 0) {
          throw new Error('No video tracks in stream')
        }

        // Log track settings for debugging
        const trackSettings = (videoTracks[0] as any)?.getSettings?.() || {}
        sessionLogger.logWebRTC('local_stream_track_settings', {
          width: trackSettings.width,
          height: trackSettings.height,
          frameRate: trackSettings.frameRate,
          facingMode: trackSettings.facingMode,
          deviceId: trackSettings.deviceId?.substring(0, 8),
        })

        this.localStream = stream

        // Add tracks to peer connection
        // IMPORTANT: Must add tracks BEFORE creating offer
        ;(stream as any).getTracks?.().forEach((track: any) => {
          if (this.peerConnection) {
            this.peerConnection.addTrack(track, stream as any)
            sessionLogger.logWebRTC('track_added_to_peer_connection', {
              kind: track.kind,
              enabled: track.enabled,
              readyState: track.readyState,
            })
          }
        })

        sessionLogger.logWebRTC('local_stream_started', {
          tracks: ((stream as any).getTracks?.() ?? []).length,
          videoTracks: videoTracks.length,
          streamId: (stream as any).id?.substring(0, 8),
          attempt,
        })

        return stream
      } catch (error) {
        lastError = error as Error
        const errorType = parseMediaError(lastError)
        
        sessionLogger.logCameraError(errorType as any, lastError, {
          attempt,
          maxRetries: MAX_RETRIES,
          role: this.role,
        })
        
        // Don't retry for permission errors or device not found
        if (errorType === 'NotAllowedError' || errorType === 'NotFoundError' || errorType === 'SecurityError') {
          sessionLogger.logCamera('init_failed', {
            reason: 'non_retryable_error',
            errorType,
            attempt,
          })
          break
        }
        
        // For NotReadableError (camera occupied), wait longer before retry
        if (errorType === 'NotReadableError') {
          sessionLogger.warn('camera_occupied_detected', {
            message: 'Camera may be used by another app',
            attempt,
            waitBeforeRetry: '1000ms',
          })
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    // All retries exhausted
    const finalErrorType = parseMediaError(lastError) as keyof typeof CAMERA_ERROR_MESSAGES
    const userMessage = CAMERA_ERROR_MESSAGES[finalErrorType] || CAMERA_ERROR_MESSAGES.UnknownError
    
    sessionLogger.logCamera('init_failed', {
      errorType: finalErrorType,
      userMessage,
      retriesExhausted: true,
      totalAttempts: MAX_RETRIES + 1,
    })
    
    // Create error with user-friendly message
    const finalError = new Error(userMessage)
    finalError.name = finalErrorType
    
    this.callbacks.onError?.(finalError)
    return null
  }

  /**
   * Create and send offer (camera side)
   * IMPORTANT: On Android, H.264 can cause black screens if hardware encoder unavailable
   * We prefer VP8 which has software fallback
   */
  private async createOffer() {
    if (!this.peerConnection) {
      sessionLogger.error('webrtc_create_offer_no_peer_connection', new Error('No peer connection'))
      return
    }

    sessionLogger.logWebRTC('creating_offer', { 
      role: this.role,
      hasLocalStream: !!this.localStream,
      localTrackCount: this.localStream?.getTracks().length ?? 0,
    })

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
      })

      // Prefer VP8 codec over H.264 - H.264 causes black screen on many Android devices
      // because not all have hardware H.264 encoder and there's no software fallback
      const modifiedSdp = this.preferVP8Codec(offer.sdp)
      const modifiedOffer = {
        type: offer.type,
        sdp: modifiedSdp,
      }

      await this.peerConnection.setLocalDescription(modifiedOffer as RTCSessionDescriptionInit)

      // Send offer via Supabase
      await this.sendSignal({
        type: 'offer',
        data: modifiedOffer,
      })

      sessionLogger.logWebRTC('offer_created', { 
        role: this.role,
        offerType: offer.type,
        hasSdp: !!offer.sdp,
        codecPreference: 'VP8',
      })
    } catch (error) {
      sessionLogger.error('webrtc_offer_failed', error, { role: this.role })
      this.callbacks.onError?.(error as Error)
    }
  }

  /**
   * Modify SDP to prefer VP8 codec over H.264
   * H.264 hardware encoders are unreliable on Android devices
   */
  private preferVP8Codec(sdp: string | undefined): string {
    if (!sdp) return sdp || ''
    
    try {
      // Find video m-line and reorder codecs to prefer VP8
      const lines = sdp.split('\r\n')
      const mLineIndex = lines.findIndex(line => line.startsWith('m=video'))
      
      if (mLineIndex === -1) return sdp

      const mLine = lines[mLineIndex]
      const parts = mLine.split(' ')
      
      // parts[3...] are codec payload types
      // Find VP8 payload type from a=rtpmap lines
      let vp8Payload: string | null = null
      for (const line of lines) {
        if (line.includes('a=rtpmap:') && line.toLowerCase().includes('vp8')) {
          const match = line.match(/a=rtpmap:(\d+)/)
          if (match) {
            vp8Payload = match[1]
            break
          }
        }
      }

      if (vp8Payload && parts.length > 3) {
        // Remove VP8 from its current position
        const payloadIndex = parts.indexOf(vp8Payload, 3)
        if (payloadIndex > 3) {
          parts.splice(payloadIndex, 1)
          // Insert VP8 as first codec preference
          parts.splice(3, 0, vp8Payload)
          lines[mLineIndex] = parts.join(' ')
          
          sessionLogger.logWebRTC('codec_preference_modified', {
            vp8Payload,
            message: 'VP8 set as preferred video codec',
          })
        }
      }

      return lines.join('\r\n')
    } catch (error) {
      sessionLogger.warn('codec_preference_failed', { error: (error as Error)?.message })
      return sdp
    }
  }

  /**
   * Handle received offer (director side)
   * 
   * RACE CONDITION FIX: Guards against duplicate offers that can arrive
   * when the camera sends multiple offers in quick succession
   */
  private async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) {
      sessionLogger.error('webrtc_handle_offer_no_peer_connection', new Error('No peer connection'))
      return
    }

    const signalingState = this.peerConnection.signalingState
    const now = Date.now()
    
    // RACE CONDITION FIX: Ignore duplicate offers
    // - If we're already handling an offer, skip this one
    // - If signaling state is 'stable' and we received an offer < 2s ago, skip (duplicate)
    // - If signaling state is 'have-remote-offer', we're mid-negotiation
    if (this.isHandlingOffer) {
      sessionLogger.warn('ignoring_duplicate_offer', {
        reason: 'already_handling_offer',
        signalingState,
        timeSinceLastOffer: now - this.lastOfferTime,
      })
      return
    }
    
    if (signalingState === 'stable' && this.lastOfferTime > 0 && (now - this.lastOfferTime) < 2000) {
      sessionLogger.warn('ignoring_duplicate_offer', {
        reason: 'recent_offer_already_processed',
        signalingState,
        timeSinceLastOffer: now - this.lastOfferTime,
      })
      return
    }

    this.isHandlingOffer = true
    this.lastOfferTime = now

    sessionLogger.logWebRTC('handling_offer', { 
      role: this.role,
      offerType: offer.type,
      hasSdp: !!offer.sdp,
      signalingState,
    })

    try {
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      )
      sessionLogger.logWebRTC('remote_description_set', { role: this.role })

      const answer = await this.peerConnection.createAnswer()
      
      // Also prefer VP8 in answer for consistency
      const modifiedSdp = this.preferVP8Codec(answer.sdp)
      const modifiedAnswer = {
        type: answer.type,
        sdp: modifiedSdp,
      }
      
      await this.peerConnection.setLocalDescription(modifiedAnswer as RTCSessionDescriptionInit)

      await this.sendSignal({
        type: 'answer',
        data: modifiedAnswer,
      })

      sessionLogger.logWebRTC('answer_created', { 
        role: this.role,
        answerType: answer.type,
        codecPreference: 'VP8',
      })
    } catch (error) {
      sessionLogger.error('webrtc_answer_failed', error, { 
        role: this.role,
        signalingState: this.peerConnection?.signalingState,
      })
      // Don't propagate duplicate offer errors to UI - they're harmless
      if (!(error as Error)?.message?.includes('wrong state')) {
        this.callbacks.onError?.(error as Error)
      }
    } finally {
      this.isHandlingOffer = false
    }
  }

  /**
   * Handle received answer (camera side)
   */
  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return

    try {
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      )
      sessionLogger.logWebRTC('answer_received')
    } catch (error) {
      sessionLogger.error('webrtc_set_answer_failed', error)
    }
  }

  /**
   * Handle ICE candidate
   */
  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) return

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      sessionLogger.logWebRTC('ice_candidate_added')
    } catch (error) {
      sessionLogger.error('webrtc_ice_candidate_failed', error)
    }
  }

  /**
   * Setup peer connection event handlers
   * Key handlers for debugging blank screen issues:
   * - onicecandidate: Sends ICE candidates to peer
   * - oniceconnectionstatechange: Monitor ICE state (stuck at 'checking' = STUN/TURN issue)
   * - ontrack: Receive remote media stream
   */
  private setupPeerConnectionHandlers() {
    if (!this.peerConnection) return

    // ICE candidate generated - send to peer
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Candidate types: 'host' (local), 'srflx' (STUN), 'relay' (TURN)
        // If all candidates are host/srflx and no 'relay', TURN is not working
        const candidateType = event.candidate.type || 'unknown'
        const isRelay = candidateType === 'relay'
        
        sessionLogger.logWebRTC('ice_candidate_generated', {
          candidateType,           // 'host', 'srflx', 'relay'
          isRelay,                 // true = TURN is working
          protocol: event.candidate.protocol || 'unknown',
          address: event.candidate.address?.substring(0, 10) + '...',
        })
        
        // Log specifically when we get a TURN relay candidate (good sign!)
        if (isRelay) {
          sessionLogger.info('turn_relay_candidate_found', {
            message: 'TURN server is working - relay candidate available',
            protocol: event.candidate.protocol,
          })
        }
        
        this.sendSignal({
          type: 'ice-candidate',
          data: event.candidate.toJSON(),
        })
      } else {
        // Null candidate means ICE gathering is complete
        sessionLogger.logWebRTC('ice_gathering_complete', { role: this.role })
      }
    }

    // Connection state change (overall connection health)
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState
      const signalingState = this.peerConnection?.signalingState
      sessionLogger.logWebRTC('connection_state_change', { 
        connectionState: state ?? 'unknown',
        signalingState: signalingState ?? 'unknown',
        role: this.role,
        peerDeviceId: this.peerDeviceId,
      })
      
      if (state) {
        this.callbacks.onConnectionStateChange?.(state)
        
        if (state === 'connected') {
          sessionLogger.logConnectionState('connected', this.peerDeviceId ?? undefined)
          
          // ANDROID FIX: ontrack may not fire on some devices
          // Force check for remote streams after connection is established
          if (this.role === 'director' && !this.remoteStream) {
            this.pollForRemoteStream()
          }
        } else if (state === 'failed') {
          // Connection failed - try ICE restart
          sessionLogger.logConnectionState('failed', this.peerDeviceId ?? undefined, { 
            connectionState: state,
            signalingState,
            action: 'attempting_ice_restart',
          })
          this.attemptIceRestart()
        } else if (state === 'disconnected') {
          sessionLogger.logConnectionState('disconnected', this.peerDeviceId ?? undefined, { 
            connectionState: state,
            signalingState,
          })
        }
      }
    }

    // ICE connection state change - CRITICAL for debugging blank screens
    // States: new -> checking -> connected/completed OR failed
    // Stuck at 'checking' = STUN/TURN servers not working
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState
      const iceGatheringState = this.peerConnection?.iceGatheringState
      
      sessionLogger.logWebRTC('ice_state_change', {
        iceConnectionState: iceState ?? 'unknown',
        iceGatheringState: iceGatheringState ?? 'unknown',
        role: this.role,
      })

      // ICE timeout monitoring
      if (iceState === 'checking') {
        // Start timeout if not already started
        if (!this.iceCheckingStartTime) {
          this.iceCheckingStartTime = Date.now()
          this.startIceTimeout()
        }
        
        sessionLogger.warn('ice_checking', {
          message: 'ICE is checking - if stuck here, STUN/TURN servers may not be working',
          role: this.role,
          timeoutMs: this.ICE_CHECKING_TIMEOUT_MS,
        })
      } else {
        // Clear timeout when state changes from "checking"
        this.clearIceTimeout()
        this.iceCheckingStartTime = null
      }
      
      // Start health monitoring on connected
      if (iceState === 'connected' || iceState === 'completed') {
        this.startHealthMonitoring()
      } else if (iceState === 'disconnected' || iceState === 'failed' || iceState === 'closed') {
        this.stopHealthMonitoring()
        
        // When camera sees disconnected, attempt reconnection
        if (this.role === 'camera' && (iceState === 'disconnected' || iceState === 'failed')) {
          sessionLogger.warn('camera_ice_disconnected', {
            message: 'Camera ICE disconnected - attempting ICE restart',
            iceState,
            role: this.role,
          })
          this.attemptIceRestart()
        }
      }

      // Attempt ICE restart on failure
      if (iceState === 'failed') {
        sessionLogger.error('ice_failed', new Error('ICE connection failed'), {
          message: 'ICE failed - likely need TURN servers for this network',
          role: this.role,
          checkingDuration: this.iceCheckingStartTime 
            ? Date.now() - this.iceCheckingStartTime 
            : null,
        })
        this.attemptIceRestart()
      }
    }

    // ICE gathering state change
    this.peerConnection.onicegatheringstatechange = () => {
      sessionLogger.logWebRTC('ice_gathering_state_change', {
        iceGatheringState: this.peerConnection?.iceGatheringState ?? 'unknown',
        role: this.role,
      })
    }

    // Remote stream received - CRITICAL for displaying remote video
    // This event fires when remote peer adds tracks
    this.peerConnection.ontrack = (event) => {
      sessionLogger.logWebRTC('remote_track_received', {
        kind: event.track.kind,
        trackId: event.track.id?.substring(0, 8),
        enabled: event.track.enabled,
        muted: event.track.muted,
        readyState: event.track.readyState,
        streamsCount: event.streams?.length ?? 0,
      })

      // IMPORTANT: Use event.streams[0] directly, don't create new MediaStream
      // Creating new MediaStream can cause blank video issues
      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0]
        
        sessionLogger.logWebRTC('setting_remote_stream', {
          streamId: stream.id?.substring(0, 8),
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
        })

        // Verify video tracks are present and enabled
        const videoTracks = stream.getVideoTracks()
        if (videoTracks.length === 0) {
          sessionLogger.warn('remote_stream_no_video', {
            message: 'Remote stream has no video tracks - camera may not be started on sender',
          })
        } else {
          videoTracks.forEach((track, idx) => {
            sessionLogger.logWebRTC('remote_video_track_details', {
              index: idx,
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState,
            })
          })
        }

        this.remoteStream = stream
        this.callbacks.onRemoteStream?.(stream)
      } else {
        // Fallback: create MediaStream from track (less reliable)
        sessionLogger.warn('no_streams_in_track_event', {
          message: 'ontrack event has no streams, creating from track (may cause issues)',
        })
        
        if (!this.remoteStream) {
          if (!MediaStream) {
            sessionLogger.warn('no_mediastream_constructor', {
              message: 'MediaStream constructor not available; cannot build fallback stream',
            })
            return
          }
          this.remoteStream = new MediaStream()
        }
        ;(this.remoteStream as any).addTrack?.(event.track)
        this.callbacks.onRemoteStream?.(this.remoteStream as any)
      }
    }

    // Negotiation needed (for renegotiation scenarios)
    this.peerConnection.onnegotiationneeded = () => {
      sessionLogger.logWebRTC('negotiation_needed', {
        role: this.role,
        signalingState: this.peerConnection?.signalingState,
      })
    }
  }

  /**
   * Start ICE checking timeout - fails if stuck in "checking" too long
   */
  private startIceTimeout() {
    this.clearIceTimeout()
    
    this.iceTimeoutTimer = setTimeout(() => {
      const iceState = this.peerConnection?.iceConnectionState
      
      if (iceState === 'checking') {
        const duration = this.iceCheckingStartTime 
          ? Date.now() - this.iceCheckingStartTime 
          : this.ICE_CHECKING_TIMEOUT_MS
        
        sessionLogger.error('ice_checking_timeout', new Error('ICE checking timeout'), {
          duration,
          role: this.role,
          message: 'ICE stuck in checking state - STUN/TURN servers may not be reachable',
        })
        
        // Notify callback about the failure
        const error = new Error('Connection timed out. Please check your network and try again.')
        error.name = 'ICETimeoutError'
        this.callbacks.onError?.(error)
        
        // Try ICE restart as last resort
        this.attemptIceRestart()
      }
    }, this.ICE_CHECKING_TIMEOUT_MS)
  }

  /**
   * Clear ICE timeout timer
   */
  private clearIceTimeout() {
    if (this.iceTimeoutTimer) {
      clearTimeout(this.iceTimeoutTimer)
      this.iceTimeoutTimer = null
    }
  }

  /**
   * Start connection health monitoring
   */
  private startHealthMonitoring() {
    this.stopHealthMonitoring()
    
    // Check connection stats every 10 seconds
    this.healthCheckTimer = setInterval(() => {
      this.checkConnectionHealth()
    }, 10000)
    
    sessionLogger.logWebRTC('health_monitoring_started', { role: this.role })
  }

  /**
   * Stop connection health monitoring
   */
  private stopHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
  }

  /**
   * Check connection health using WebRTC stats
   */
  private async checkConnectionHealth() {
    if (!this.peerConnection) return
    
    try {
      const stats = await this.peerConnection.getStats()
      const now = Date.now()
      
      let hasActiveConnection = false
      let bytesReceived = 0
      let bytesSent = 0
      
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          hasActiveConnection = true
          bytesReceived = report.bytesReceived || 0
          bytesSent = report.bytesSent || 0
        }
      })
      
      if (hasActiveConnection) {
        this.consecutiveFailedStatsChecks = 0
        
        // Log stats periodically (every 30 seconds)
        if (now - this.lastStatsTime > 30000) {
          this.lastStatsTime = now
          sessionLogger.logWebRTC('connection_stats', {
            role: this.role,
            bytesReceived,
            bytesSent,
            connectionState: this.peerConnection.connectionState,
            iceConnectionState: this.peerConnection.iceConnectionState,
          })
        }
      } else {
        this.consecutiveFailedStatsChecks++
        
        if (this.consecutiveFailedStatsChecks >= 3) {
          sessionLogger.warn('connection_health_degraded', {
            role: this.role,
            consecutiveFailures: this.consecutiveFailedStatsChecks,
            message: 'Connection may be unhealthy',
          })
        }
      }
    } catch (error) {
      // Stats API may not be available on all platforms
      sessionLogger.warn('connection_stats_error', { error: (error as Error)?.message })
    }
  }

  /**
   * ANDROID FIX: Poll for remote stream when ontrack doesn't fire
   * Some Android devices/builds have a bug where ontrack never fires
   * even though the remote track is received
   */
  private pollForRemoteStream() {
    if (!this.peerConnection) return
    
    let pollCount = 0
    const maxPolls = 10
    const pollInterval = 500 // 500ms between polls
    
    const poll = () => {
      pollCount++
      
      if (!this.peerConnection || this.remoteStream) {
        sessionLogger.logWebRTC('poll_remote_stream_stopped', {
          reason: this.remoteStream ? 'stream_found' : 'no_peer_connection',
          pollCount,
        })
        return
      }
      
      // Try to get receivers and extract stream
      try {
        const receivers = this.peerConnection.getReceivers?.()
        
        if (receivers && receivers.length > 0) {
          sessionLogger.logWebRTC('poll_found_receivers', {
            receiverCount: receivers.length,
            pollCount,
          })
          
          // Find video receiver
          for (const receiver of receivers) {
            const track = receiver.track
            if (track && track.kind === 'video') {
              sessionLogger.logWebRTC('poll_found_video_track', {
                trackId: track.id?.substring(0, 8),
                enabled: track.enabled,
                readyState: track.readyState,
                muted: track.muted,
              })
              
              // Create MediaStream from track
              if (MediaStream) {
                const stream = new MediaStream([track])
                this.remoteStream = stream
                
                sessionLogger.logWebRTC('poll_created_remote_stream', {
                  streamId: stream.id?.substring(0, 8),
                  videoTracks: stream.getVideoTracks().length,
                })
                
                this.callbacks.onRemoteStream?.(stream)
                return
              }
            }
          }
        }
      } catch (error) {
        sessionLogger.warn('poll_remote_stream_error', {
          error: (error as Error)?.message,
          pollCount,
        })
      }
      
      // Continue polling if not found
      if (pollCount < maxPolls) {
        setTimeout(poll, pollInterval)
      } else {
        sessionLogger.warn('poll_remote_stream_exhausted', {
          message: 'Could not find remote video stream after polling',
          maxPolls,
        })
      }
    }
    
    // Start polling after a short delay
    sessionLogger.logWebRTC('poll_remote_stream_start', { maxPolls, pollInterval })
    setTimeout(poll, pollInterval)
  }

  /**
   * Attempt ICE restart when connection fails
   */
  private async attemptIceRestart() {
    if (!this.peerConnection || this.role !== 'camera') return

    sessionLogger.logWebRTC('attempting_ice_restart', { role: this.role })

    try {
      // Only camera (offerer) should initiate ICE restart
      const offer = await this.peerConnection.createOffer({ iceRestart: true })
      await this.peerConnection.setLocalDescription(offer)
      
      await this.sendSignal({
        type: 'offer',
        data: offer,
      })

      sessionLogger.logWebRTC('ice_restart_offer_sent', { role: this.role })
    } catch (error) {
      sessionLogger.error('ice_restart_failed', error)
    }
  }

  /**
   * Subscribe to Supabase Realtime for signaling
   */
  private async subscribeToSignaling() {
    const channelName = `webrtc:${this.sessionId}`

    this.channel = supabase.channel(channelName)

    this.channel
      .on('broadcast', { event: 'signal' }, (payload) => {
        const { from, to, signal } = payload.payload as {
          from: string
          to: string
          signal: SignalMessage
        }

        // Only process messages for us
        if (to !== this.deviceId) return

        sessionLogger.logWebRTC('signal_received', { 
          type: signal.type, 
          from,
          myRole: this.role,
          myDeviceId: this.deviceId,
        })

        switch (signal.type) {
          case 'offer':
            this.handleOffer(signal.data as RTCSessionDescriptionInit)
            break
          case 'answer':
            this.handleAnswer(signal.data as RTCSessionDescriptionInit)
            break
          case 'ice-candidate':
            this.handleIceCandidate(signal.data as RTCIceCandidateInit)
            break
        }
      })
      // Listen for director_ready signal to re-negotiate when director switches roles
      .on('broadcast', { event: 'director_ready' }, (payload) => {
        const { from, to } = payload.payload as { from: string; to: string }
        
        // Only process if we're the camera and message is for us
        if (to !== this.deviceId || this.role !== 'camera') {
          return
        }
        
        sessionLogger.logWebRTC('director_ready_received', { 
          from,
          myRole: this.role,
          hasLocalStream: !!this.localStream,
        })
        
        // Re-send offer to the new director peer connection
        this.handleDirectorReady()
      })
      .subscribe()

    sessionLogger.logWebRTC('signaling_subscribed', { channelName })
  }

  /**
   * Handle director_ready signal by re-creating offer
   * Called when camera receives director_ready from director who switched roles
   */
  private async handleDirectorReady() {
    if (!this.peerConnection || this.role !== 'camera') {
      return
    }

    sessionLogger.logWebRTC('handling_director_ready', { role: this.role })

    try {
      // Create a new offer to send to the director's new peer connection
      const offer = await this.peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
        iceRestart: true, // Force ICE restart for new connection
      })

      const modifiedSdp = this.preferVP8Codec(offer.sdp)
      const modifiedOffer = { type: offer.type, sdp: modifiedSdp }

      await this.peerConnection.setLocalDescription(modifiedOffer as RTCSessionDescriptionInit)

      await this.sendSignal({
        type: 'offer',
        data: modifiedOffer,
      })

      sessionLogger.logWebRTC('director_ready_offer_sent', { 
        role: this.role,
        offerType: offer.type,
      })
    } catch (error) {
      sessionLogger.error('director_ready_offer_failed', error, { role: this.role })
    }
  }

  /**
   * Send signal via Supabase broadcast
   */
  private async sendSignal(signal: SignalMessage) {
    if (!this.channel || !this.deviceId || !this.peerDeviceId) return

    await this.channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        from: this.deviceId,
        to: this.peerDeviceId,
        signal,
      },
    })

    sessionLogger.logWebRTC('signal_sent', { type: signal.type })
  }

  /**
   * Send director_ready signal to tell camera to re-negotiate
   * This solves the problem where camera doesn't know director has a new peer connection
   */
  private async sendDirectorReadySignal() {
    if (!this.channel || !this.deviceId || !this.peerDeviceId) {
      return
    }

    await this.channel.send({
      type: 'broadcast',
      event: 'director_ready',
      payload: {
        from: this.deviceId,
        to: this.peerDeviceId,
      },
    })

    sessionLogger.logWebRTC('director_ready_sent', { to: this.peerDeviceId })
  }

  /**
   * Send command to peer (direction, capture, etc.)
   */
  async sendCommand(command: string, data?: Record<string, unknown>) {
    if (!this.channel || !this.deviceId || !this.peerDeviceId) return

    await this.channel.send({
      type: 'broadcast',
      event: 'command',
      payload: {
        from: this.deviceId,
        to: this.peerDeviceId,
        command,
        data,
      },
    })

    sessionLogger.logCommand('sent', command, data)

    // Also persist to database for history
    await supabase.from('commands').insert({
      session_id: this.sessionId,
      from_device_id: this.deviceId,
      to_device_id: this.peerDeviceId,
      command_type: command,
      command_data: data,
    })
  }

  /**
   * Subscribe to commands from peer
   */
  onCommand(callback: (command: string, data?: Record<string, unknown>) => void) {
    if (!this.channel) return

    this.channel.on('broadcast', { event: 'command' }, (payload) => {
      const { from, to, command, data } = payload.payload as {
        from: string
        to: string
        command: string
        data?: Record<string, unknown>
      }

      if (to !== this.deviceId) return

      sessionLogger.logCommand('received', command, data)
      callback(command, data)
    })
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  /**
   * Get remote stream
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream
  }

  /**
   * Internal cleanup (doesn't reset initialization state)
   * Made defensive to handle concurrent calls safely
   * 
   * ANDROID FIX: Added more granular logging and explicit nulling of event handlers
   * to prevent stale callbacks from firing on the next peer connection.
   */
  private async cleanupInternal() {
    sessionLogger.logWebRTC('cleanup_internal_start', {
      hasLocalStream: !!this.localStream,
      hasPeerConnection: !!this.peerConnection,
      hasChannel: !!this.channel,
      hasRemoteStream: !!this.remoteStream,
      role: this.role,
    })
    
    // Reset offer handling state
    this.isHandlingOffer = false
    this.lastOfferTime = 0
    
    // Clear ICE timeout and health monitoring
    this.clearIceTimeout()
    this.stopHealthMonitoring()
    this.iceCheckingStartTime = null
    this.consecutiveFailedStatsChecks = 0
    
    // Stop local tracks
    try {
      if (this.localStream) {
        const tracks = this.localStream.getTracks?.() ?? []
        sessionLogger.logWebRTC('cleanup_stopping_tracks', { trackCount: tracks.length })
        tracks.forEach((track: { stop: () => void; kind?: string; id?: string }) => {
          try {
            track.stop()
          } catch {
            // Track may already be stopped
          }
        })
      }
    } catch (e) {
      sessionLogger.warn('cleanup_stop_tracks_error', { error: (e as Error)?.message })
    }
    this.localStream = null

    // ANDROID FIX: Clear event handlers BEFORE closing to prevent stale callbacks
    // from the old connection interfering with the new one
    if (this.peerConnection) {
      try {
        // Explicitly null out handlers to prevent them from firing during/after close
        this.peerConnection.onicecandidate = null
        this.peerConnection.onconnectionstatechange = null
        this.peerConnection.oniceconnectionstatechange = null
        this.peerConnection.onicegatheringstatechange = null
        this.peerConnection.ontrack = null
        this.peerConnection.onnegotiationneeded = null
        sessionLogger.logWebRTC('cleanup_handlers_cleared', { role: this.role })
      } catch {
        // Handlers may not be settable
      }
      
      try {
        this.peerConnection.close()
        sessionLogger.logWebRTC('cleanup_peer_connection_closed', { role: this.role })
      } catch (e) {
        sessionLogger.warn('cleanup_close_error', { error: (e as Error)?.message })
      }
      this.peerConnection = null
    }

    // Unsubscribe from channel - wrap in try-catch to handle race conditions
    const channelToRemove = this.channel
    this.channel = null // Clear immediately to prevent double-removal
    
    if (channelToRemove) {
      try {
        await supabase.removeChannel(channelToRemove)
        sessionLogger.logWebRTC('cleanup_channel_removed', { role: this.role })
      } catch (error) {
        // Channel may already be removed or invalid
        sessionLogger.warn('cleanup_channel_error', { 
          error: (error as Error)?.message 
        })
      }
    }

    this.remoteStream = null
    sessionLogger.logWebRTC('cleanup_internal_complete', { role: this.role })
    
    // Flush logs immediately so we can see cleanup state even if app crashes next
    sessionLogger.flush()
  }

  /**
   * Cleanup and disconnect
   * 
   * ANDROID FIX: Enhanced logging and explicit state clearing to prevent
   * race conditions when switching between camera/director roles.
   */
  async destroy() {
    const destroyStartTime = Date.now()
    const previousRole = this.role
    
    sessionLogger.logWebRTC('destroying', { 
      isInitializing: this.isInitializing,
      role: this.role,
      destroyStartTime,
    })

    // If init is in progress, just increment the ID to cancel it
    if (this.isInitializing) {
      sessionLogger.logWebRTC('destroy_during_init', { 
        message: 'Cancelling initialization',
        initializationId: this.initializationId,
      })
      this.initializationId++
      this.isInitializing = false
    }

    // Clear role and IDs early to prevent stale event handlers from using them
    // This ensures any events that fire during cleanup see null values
    const oldDeviceId = this.deviceId
    const oldPeerDeviceId = this.peerDeviceId
    const oldSessionId = this.sessionId
    
    this.deviceId = null
    this.peerDeviceId = null
    this.sessionId = null
    this.role = null

    // Track cleanup as a promise so init() can wait for it
    this.cleanupPromise = this.cleanupInternal().finally(() => {
      this.cleanupPromise = null
    })
    
    try {
      await this.cleanupPromise
    } catch (error) {
      sessionLogger.error('destroy_cleanup_error', error)
    }

    sessionLogger.logWebRTC('destroy_complete', { 
      previousRole,
      durationMs: Date.now() - destroyStartTime,
      oldDeviceId: oldDeviceId?.substring(0, 8),
      oldPeerDeviceId: oldPeerDeviceId?.substring(0, 8),
      oldSessionId: oldSessionId?.substring(0, 8),
    })
    
    // Flush logs so destroy state is visible even if next operation crashes
    sessionLogger.flush()
  }
}

export const webrtcService = new WebRTCService()

