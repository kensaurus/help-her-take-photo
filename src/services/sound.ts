/**
 * Sound Service - Subtle audio feedback for micro-interactions
 * Uses expo-audio for native sound playback
 */

import { useAudioPlayer } from 'expo-audio'
import { useCallback, useRef, useEffect } from 'react'
import { useSettingsStore } from '../stores/settingsStore'

// Sound effect types
export type SoundType = 'tap' | 'success' | 'error' | 'capture' | 'connect' | 'disconnect'

// Pre-generated short tone frequencies (we'll use web audio API fallback)
const SOUND_CONFIGS: Record<SoundType, { frequency: number; duration: number; type: OscillatorType }> = {
  tap: { frequency: 1200, duration: 30, type: 'sine' },
  success: { frequency: 880, duration: 100, type: 'sine' },
  error: { frequency: 300, duration: 150, type: 'sawtooth' },
  capture: { frequency: 1000, duration: 80, type: 'sine' },
  connect: { frequency: 660, duration: 120, type: 'sine' },
  disconnect: { frequency: 440, duration: 100, type: 'sine' },
}

/**
 * Simple in-memory sound generation using AudioContext
 * Creates short tonal sounds without requiring audio files
 */
class SoundService {
  private audioContext: AudioContext | null = null
  private enabled: boolean = true

  constructor() {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.audioContext = new AudioContext()
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  async play(type: SoundType) {
    if (!this.enabled || !this.audioContext) return

    try {
      const config = SOUND_CONFIGS[type]
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.type = config.type
      oscillator.frequency.setValueAtTime(config.frequency, this.audioContext.currentTime)

      // Create envelope for smooth sound
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.15, this.audioContext.currentTime + 0.005)
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + config.duration / 1000)

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + config.duration / 1000)
    } catch {
      // Silently fail if audio isn't available
    }
  }

  // Convenience methods
  tap() { this.play('tap') }
  success() { this.play('success') }
  error() { this.play('error') }
  capture() { this.play('capture') }
  connect() { this.play('connect') }
  disconnect() { this.play('disconnect') }
}

// Singleton instance
export const soundService = new SoundService()

/**
 * Hook to use sound effects with settings integration
 */
export function useSound() {
  const { settings } = useSettingsStore()
  
  useEffect(() => {
    soundService.setEnabled(settings.sound)
  }, [settings.sound])

  const playTap = useCallback(() => {
    if (settings.sound) soundService.tap()
  }, [settings.sound])

  const playSuccess = useCallback(() => {
    if (settings.sound) soundService.success()
  }, [settings.sound])

  const playError = useCallback(() => {
    if (settings.sound) soundService.error()
  }, [settings.sound])

  const playCapture = useCallback(() => {
    if (settings.sound) soundService.capture()
  }, [settings.sound])

  const playConnect = useCallback(() => {
    if (settings.sound) soundService.connect()
  }, [settings.sound])

  const playDisconnect = useCallback(() => {
    if (settings.sound) soundService.disconnect()
  }, [settings.sound])

  return {
    playTap,
    playSuccess,
    playError,
    playCapture,
    playConnect,
    playDisconnect,
  }
}

