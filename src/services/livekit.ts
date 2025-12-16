/**
 * LiveKit Video Service (STUB)
 * 
 * LiveKit packages temporarily removed due to native build conflicts
 * with react-native-webrtc.
 * 
 * To enable LiveKit:
 * 1. npm uninstall react-native-webrtc
 * 2. npm install @livekit/react-native @livekit/react-native-webrtc livekit-server-sdk
 * 3. Update webrtc.ts to use @livekit/react-native-webrtc
 * 4. Set USE_LIVEKIT = true in viewer.tsx and camera.tsx
 * 5. Uncomment the implementation below
 */

// LiveKit is disabled - using WebRTC fallback
export const isLiveKitAvailable = false

interface LiveKitCallbacks {
  onRemoteTrack?: (track: any, participant: any) => void
  onConnectionStateChange?: (state: string) => void
  onDataReceived?: (data: any, participant: any) => void
  onError?: (error: Error) => void
}

/**
 * Stub LiveKit service - throws error if called
 * Real implementation available when packages are installed
 */
class LiveKitService {
  async init(
    _deviceId: string,
    _peerDeviceId: string,
    _sessionId: string,
    _role: 'camera' | 'director',
    _callbacks: LiveKitCallbacks
  ): Promise<void> {
    throw new Error('LiveKit is not available - using WebRTC fallback')
  }

  async sendCommand(_command: string, _data?: Record<string, unknown>): Promise<void> {
    throw new Error('LiveKit is not available')
  }

  onCommand(_handler: (command: string, data?: Record<string, unknown>) => void): void {
    // No-op
  }

  async flipCamera(): Promise<void> {
    throw new Error('LiveKit is not available')
  }

  getConnectionState(): string {
    return 'disconnected'
  }

  isConnected(): boolean {
    return false
  }

  getRemoteVideoTrack(): any {
    return null
  }

  async destroy(): Promise<void> {
    // No-op
  }
}

export const livekitService = new LiveKitService()
