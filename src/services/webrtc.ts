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
import { sessionLogger } from './sessionLogger'
import type { RealtimeChannel } from '@supabase/supabase-js'

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
const METERED_API_KEY = process.env.EXPO_PUBLIC_METERED_API_KEY || '692e88ad36749006f9f653eb3d40989da0d8'
const METERED_API_URL = process.env.EXPO_PUBLIC_METERED_API_URL || 'https://kenji.metered.live/api/v1/turn/credentials'

// Fallback STUN servers (used if TURN fetch fails)
const FALLBACK_ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
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

    const response = await fetch(`${METERED_API_URL}?apiKey=${METERED_API_KEY}`)
    
    if (!response.ok) {
      throw new Error(`Metered API error: ${response.status} ${response.statusText}`)
    }

    const iceServers = await response.json()
    
    sessionLogger.logWebRTC('turn_credentials_fetched', {
      serverCount: iceServers?.length ?? 0,
      hasSTUN: iceServers?.some((s: { urls: string | string[] }) => 
        (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u: string) => u.startsWith('stun:'))
      ),
      hasTURN: iceServers?.some((s: { urls: string | string[] }) => 
        (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u: string) => u.startsWith('turn:'))
      ),
    })

    // Cache the result
    cachedIceServers = {
      iceServers,
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

  /**
   * Check if WebRTC is available
   */
  isAvailable(): boolean {
    return isWebRTCAvailable
  }

  /**
   * Initialize WebRTC service
   * Returns a promise that resolves when initialization is complete
   */
  async init(
    deviceId: string,
    peerDeviceId: string,
    sessionId: string,
    role: WebRTCRole,
    callbacks: WebRTCCallbacks
  ): Promise<void> {
    // Log at the very start to track if init is called
    sessionLogger.logWebRTC('init_called', { 
      role,
      deviceId: deviceId?.substring(0, 8),
      isWebRTCAvailable,
    })

    // Check if WebRTC is available (requires development build)
    if (!isWebRTCAvailable) {
      const error = new Error('WebRTC requires a development build. Video streaming is not available in Expo Go.')
      sessionLogger.warn('webrtc_not_available', { reason: 'expo_go' })
      callbacks.onError?.(error)
      return
    }

    try {
      // Clean up any existing connection first
      if (this.peerConnection || this.channel) {
        sessionLogger.logWebRTC('init_cleanup_existing', { 
          hadPeerConnection: !!this.peerConnection,
          hadChannel: !!this.channel,
          previousRole: this.role,
        })
        await this.cleanupInternal()
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
      
      // Check if init was cancelled during credential fetch
      if (this.initializationId !== currentInitId) {
        sessionLogger.logWebRTC('init_cancelled_during_ice_fetch', { initId: currentInitId })
        return
      }

      // Create peer connection with fetched ICE servers
      sessionLogger.logWebRTC('creating_peer_connection', { 
        role, 
        initId: currentInitId,
        iceServerCount: iceServersConfig.iceServers?.length ?? 0,
      })
      this.peerConnection = new RTCPeerConnection(iceServersConfig)
      this.setupPeerConnectionHandlers()
      sessionLogger.logWebRTC('peer_connection_created', { role, initId: currentInitId })

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
      }
      
      this.isInitializing = false
      sessionLogger.logWebRTC('init_success', { role, initId: currentInitId })
      
    } catch (error) {
      sessionLogger.error('init_error', error, { 
        role,
        deviceId: deviceId?.substring(0, 8),
        errorMessage: (error as Error)?.message,
        errorStack: (error as Error)?.stack?.substring(0, 200),
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
   */
  async startLocalStream(): Promise<MediaStream | null> {
    try {
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
      })

      // Video constraints optimized for mobile
      // Using 'ideal' allows fallback if exact values aren't supported
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // 'environment' = back camera
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 },
          // Optional: specify device if found
          ...(backCamera?.deviceId && { deviceId: { ideal: backCamera.deviceId } }),
        },
        audio: false, // No audio needed
      }

      sessionLogger.logWebRTC('requesting_user_media', { constraints })

      const stream = await mediaDevices.getUserMedia(constraints)

      if (!stream) {
        throw new Error('getUserMedia returned null stream')
      }

      // Verify we got video tracks
      const videoTracks = stream.getVideoTracks()
      if (videoTracks.length === 0) {
        throw new Error('No video tracks in stream')
      }

      // Log track settings for debugging
      const trackSettings = videoTracks[0].getSettings?.() || {}
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
      stream.getTracks().forEach((track) => {
        if (this.peerConnection) {
          this.peerConnection.addTrack(track, stream)
          sessionLogger.logWebRTC('track_added_to_peer_connection', {
            kind: track.kind,
            enabled: track.enabled,
            readyState: track.readyState,
          })
        }
      })

      sessionLogger.logWebRTC('local_stream_started', {
        tracks: stream.getTracks().length,
        videoTracks: videoTracks.length,
        streamId: stream.id?.substring(0, 8),
      })

      return stream
    } catch (error) {
      sessionLogger.error('webrtc_local_stream_failed', error, {
        errorName: (error as Error)?.name,
        errorMessage: (error as Error)?.message,
      })
      this.callbacks.onError?.(error as Error)
      return null
    }
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
   */
  private async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) {
      sessionLogger.error('webrtc_handle_offer_no_peer_connection', new Error('No peer connection'))
      return
    }

    sessionLogger.logWebRTC('handling_offer', { 
      role: this.role,
      offerType: offer.type,
      hasSdp: !!offer.sdp,
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
      sessionLogger.error('webrtc_answer_failed', error, { role: this.role })
      this.callbacks.onError?.(error as Error)
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
        sessionLogger.logWebRTC('ice_candidate_generated', {
          type: event.candidate.type, // 'host', 'srflx' (STUN), 'relay' (TURN)
          protocol: event.candidate.protocol,
          address: event.candidate.address?.substring(0, 10) + '...',
        })
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

      // Log warning if stuck at checking (common cause of blank screen)
      if (iceState === 'checking') {
        sessionLogger.warn('ice_checking', {
          message: 'ICE is checking - if stuck here, STUN/TURN servers may not be working',
          role: this.role,
        })
      }

      // Attempt ICE restart on failure
      if (iceState === 'failed') {
        sessionLogger.error('ice_failed', new Error('ICE connection failed'), {
          message: 'ICE failed - likely need TURN servers for this network',
          role: this.role,
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
          this.remoteStream = new MediaStream()
        }
        this.remoteStream.addTrack(event.track)
        this.callbacks.onRemoteStream?.(this.remoteStream)
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
      .subscribe()

    sessionLogger.logWebRTC('signaling_subscribed', { channelName })
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
   */
  private async cleanupInternal() {
    // Stop local tracks
    this.localStream?.getTracks().forEach((track) => track.stop())
    this.localStream = null

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    // Unsubscribe from channel
    if (this.channel) {
      await supabase.removeChannel(this.channel)
      this.channel = null
    }

    this.remoteStream = null
  }

  /**
   * Cleanup and disconnect
   */
  async destroy() {
    sessionLogger.logWebRTC('destroying', { 
      isInitializing: this.isInitializing,
      role: this.role,
    })

    // If init is in progress, just increment the ID to cancel it
    if (this.isInitializing) {
      sessionLogger.logWebRTC('destroy_during_init', { 
        message: 'Cancelling initialization',
      })
      this.initializationId++
      this.isInitializing = false
    }

    await this.cleanupInternal()

    this.deviceId = null
    this.peerDeviceId = null
    this.sessionId = null
    this.role = null
  }
}

export const webrtcService = new WebRTCService()

