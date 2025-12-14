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
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
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
   */
  async startLocalStream(): Promise<MediaStream | null> {
    try {
      const stream = await mediaDevices.getUserMedia({
        video: {
          facingMode: 'back',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false, // No audio needed
      })

      this.localStream = stream

      // Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, stream)
      })

      sessionLogger.logWebRTC('local_stream_started', {
        tracks: stream.getTracks().length,
      })

      return stream
    } catch (error) {
      sessionLogger.error('webrtc_local_stream_failed', error)
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
   */
  private setupPeerConnectionHandlers() {
    if (!this.peerConnection) return

    // ICE candidate generated
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'ice-candidate',
          data: event.candidate.toJSON(),
        })
      }
    }

    // Connection state change
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
        } else if (state === 'failed' || state === 'disconnected') {
          sessionLogger.logConnectionState('failed', this.peerDeviceId ?? undefined, { 
            connectionState: state,
            signalingState,
          })
        }
      }
    }

    // ICE connection state change
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState
      const iceGatheringState = this.peerConnection?.iceGatheringState
      sessionLogger.logWebRTC('ice_state_change', {
        iceConnectionState: iceState ?? 'unknown',
        iceGatheringState: iceGatheringState ?? 'unknown',
        role: this.role,
      })
    }

    // Remote stream received
    this.peerConnection.ontrack = (event) => {
      sessionLogger.logWebRTC('remote_track_received', {
        kind: event.track.kind,
      })

      if (event.streams[0]) {
        this.remoteStream = event.streams[0]
        this.callbacks.onRemoteStream?.(event.streams[0])
      }
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

