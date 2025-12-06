/**
 * Frame streaming service for encoding/decoding camera frames
 */

import type { StreamFrame, StreamSettings } from '../types'

const DEFAULT_SETTINGS: StreamSettings = {
  compressionQuality: 0.6,
  maxWidth: 720,
  maxHeight: 1280,
}

class StreamingService {
  private settings: StreamSettings = DEFAULT_SETTINGS
  private frameSequence = 0
  private lastFrameTime = 0
  private targetFps = 15
  private frameInterval: number

  constructor() {
    this.frameInterval = 1000 / this.targetFps
  }

  /**
   * Update streaming settings
   */
  updateSettings(settings: Partial<StreamSettings>): void {
    this.settings = { ...this.settings, ...settings }
  }

  /**
   * Set target FPS
   */
  setTargetFps(fps: number): void {
    this.targetFps = fps
    this.frameInterval = 1000 / fps
  }

  /**
   * Check if enough time has passed for next frame
   */
  shouldCaptureFrame(): boolean {
    const now = Date.now()
    if (now - this.lastFrameTime >= this.frameInterval) {
      this.lastFrameTime = now
      return true
    }
    return false
  }

  /**
   * Create a StreamFrame from base64 image data
   */
  createFrame(
    base64Data: string,
    width: number,
    height: number
  ): StreamFrame {
    return {
      timestamp: Date.now(),
      data: base64Data,
      width,
      height,
      sequence: this.frameSequence++,
    }
  }

  /**
   * Decode a received frame
   */
  decodeFrame(frame: StreamFrame): {
    uri: string
    width: number
    height: number
    latency: number
  } {
    return {
      uri: `data:image/jpeg;base64,${frame.data}`,
      width: frame.width,
      height: frame.height,
      latency: Date.now() - frame.timestamp,
    }
  }

  /**
   * Calculate frame size in bytes
   */
  getFrameSize(frame: StreamFrame): number {
    return frame.data.length * 0.75 // Base64 overhead
  }

  /**
   * Get current settings
   */
  getSettings(): StreamSettings {
    return { ...this.settings }
  }

  /**
   * Reset sequence counter
   */
  reset(): void {
    this.frameSequence = 0
    this.lastFrameTime = 0
  }

  /**
   * Get stats
   */
  getStats(): {
    frameSequence: number
    targetFps: number
    settings: StreamSettings
  } {
    return {
      frameSequence: this.frameSequence,
      targetFps: this.targetFps,
      settings: this.settings,
    }
  }
}

export const streamingService = new StreamingService()

