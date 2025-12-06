/**
 * Core types for the app
 */

export type DeviceRole = 'camera' | 'viewer'

export type ConnectionStatus = 
  | 'disconnected'
  | 'discovering'
  | 'connecting'
  | 'connected'
  | 'streaming'
  | 'error'

export interface PeerDevice {
  id: string
  name: string
  ip: string
  port: number
  role: DeviceRole
}

export interface DiscoveredService {
  name: string
  host: string
  port: number
  addresses: string[]
  txt: Record<string, string>
}

export interface StreamFrame {
  timestamp: number
  data: string // Base64 encoded JPEG
  width: number
  height: number
  sequence: number
}

export interface PairingCode {
  code: string
  expiresAt: string
}

export interface PairingResult {
  paired: boolean
  partnerDevice: string
}

export interface PartnerInfo {
  partnerDevice: string
}

export interface ApiError {
  error: string | { fieldErrors?: Record<string, string[]>; formErrors?: string[] }
}

export interface CameraSettings {
  quality: 'low' | 'medium' | 'high'
  fps: 10 | 15 | 30
  flashMode: 'off' | 'on' | 'auto'
  cameraPosition: 'front' | 'back'
}

export interface StreamSettings {
  compressionQuality: number // 0.1 - 1.0
  maxWidth: number
  maxHeight: number
}

// Message types for P2P communication
export type P2PMessageType = 
  | 'ping'
  | 'pong'
  | 'frame'
  | 'capture_request'
  | 'capture_response'
  | 'settings_update'
  | 'disconnect'

export interface P2PMessage<T = unknown> {
  type: P2PMessageType
  payload: T
  timestamp: number
  sequence: number
}

export interface CaptureRequest {
  requestId: string
}

export interface CaptureResponse {
  requestId: string
  success: boolean
  savedPath?: string
  error?: string
}

