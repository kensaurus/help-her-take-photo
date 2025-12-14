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

// STUN/TURN servers for NAT traversal
// IMPORTANT: STUN-only often fails on mobile networks (symmetric NAT)
// For production, add TURN servers (e.g., from Twilio, Metered, or self-hosted coturn)
const ICE_SERVERS = {
  iceServers: [
    // Free STUN servers (unreliable on mobile networks behind symmetric NAT)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Free TURN server from Metered (for testing - get your own for production)
    // Sign up at https://www.metered.ca/stun-turn for free tier
    {
      urls: 'stun:stun.relay.metered.ca:80',
    },
    {
      urls: 'turn:standard.relay.metered.ca:80',
      username: 'free', // Replace with your credentials
      credential: 'free', // Replace with your credentials
    },
    {
      urls: 'turn:standard.relay.metered.ca:80?transport=tcp',
      username: 'free',
      credential: 'free',
    },
    {
      urls: 'turn:standard.relay.metered.ca:443',
      username: 'free',
      credential: 'free',
    },
    {
      urls: 'turns:standard.relay.metered.ca:443?transport=tcp',
      username: 'free',
      credential: 'free',
    },
  ],
  iceCandidatePoolSize: 10,
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
    // Check if WebRTC is available (requires development build)
    if (!isWebRTCAvailable) {
      const error = new Error('WebRTC requires a development build. Video streaming is not available in Expo Go.')
      sessionLogger.warn('webrtc_not_available', { reason: 'expo_go' })
      callbacks.onError?.(error)
      return
    }

    // Clean up any existing connection first
    if (this.peerConnection || this.channel) {
      sessionLogger.logWebRTC('init_cleanup_existing', { 
        hadPeerConnection: !!this.peerConnection,
        hadChannel: !!this.channel,
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

    // Create peer connection
    this.peerConnection = new RTCPeerConnection(ICE_SERVERS)
    this.setupPeerConnectionHandlers()

    // Subscribe to signaling channel
    await this.subscribeToSignaling()

    // Check if init was cancelled during async operations
    if (this.initializationId !== currentInitId) {
      sessionLogger.logWebRTC('init_cancelled', { reason: 'new_init_started', initId: currentInitId })
      return
    }

    // Camera starts the connection
    if (role === 'camera') {
      await this.startLocalStream()
      
      // Check again after async operation
      if (this.initializationId !== currentInitId || !this.peerConnection) {
        sessionLogger.logWebRTC('init_cancelled_before_offer', { initId: currentInitId })
        return
      }
      
      await this.createOffer()
    }
    
    this.isInitializing = false
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

      await this.peerConnection.setLocalDescription(offer)

      // Send offer via Supabase
      await this.sendSignal({
        type: 'offer',
        data: offer,
      })

      sessionLogger.logWebRTC('offer_created', { 
        role: this.role,
        offerType: offer.type,
        hasSdp: !!offer.sdp,
      })
    } catch (error) {
      sessionLogger.error('webrtc_offer_failed', error, { role: this.role })
      this.callbacks.onError?.(error as Error)
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
      await this.peerConnection.setLocalDescription(answer)

      await this.sendSignal({
        type: 'answer',
        data: answer,
      })

      sessionLogger.logWebRTC('answer_created', { 
        role: this.role,
        answerType: answer.type,
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

