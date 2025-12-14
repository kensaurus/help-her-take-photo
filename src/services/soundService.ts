/**
 * Sound Service - UI Feedback Sounds
 * 
 * Provides subtle, satisfying audio feedback for key interactions.
 * Uses expo-audio for cross-platform sound playback.
 */

import { Audio } from 'expo-audio'

// Sound effect types
type SoundType = 
  | 'tap'           // Light button tap
  | 'success'       // Action completed
  | 'capture'       // Photo captured
  | 'connect'       // Device connected
  | 'disconnect'    // Device disconnected
  | 'toggle'        // Toggle switch
  | 'error'         // Error occurred

// Sound enabled state
let soundEnabled = true

// Preloaded sounds cache
const soundCache: Map<SoundType, Audio.Sound | null> = new Map()

/**
 * Simple tone generation using oscillator-like approach
 * Since we can't bundle actual audio files easily, we use system sounds
 */
const SoundConfigs: Record<SoundType, { frequency: number; duration: number }> = {
  tap: { frequency: 1200, duration: 30 },
  success: { frequency: 880, duration: 150 },
  capture: { frequency: 600, duration: 100 },
  connect: { frequency: 523, duration: 200 },
  disconnect: { frequency: 392, duration: 150 },
  toggle: { frequency: 1000, duration: 50 },
  error: { frequency: 200, duration: 200 },
}

/**
 * Initialize audio settings
 */
export async function initSounds(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false, // Don't play when phone is silent
      staysActiveInBackground: false,
    })
  } catch (error) {
    console.warn('Sound init failed:', error)
  }
}

/**
 * Enable or disable sounds
 */
export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
}

/**
 * Check if sounds are enabled
 */
export function isSoundEnabled(): boolean {
  return soundEnabled
}

/**
 * Play a UI sound effect
 * Note: In a production app, you'd load actual audio files.
 * For now, we use haptics as the primary feedback.
 */
export async function playSound(type: SoundType): Promise<void> {
  if (!soundEnabled) return
  
  // For this implementation, we log the sound type
  // In production, load and play actual audio files
  console.log(`[Sound] Playing: ${type}`)
  
  // The actual sound playing would look like:
  // const { sound } = await Audio.Sound.createAsync(require(`../assets/sounds/${type}.mp3`))
  // await sound.playAsync()
  // sound.setOnPlaybackStatusUpdate((status) => {
  //   if (status.didJustFinish) {
  //     sound.unloadAsync()
  //   }
  // })
}

/**
 * Sound + Haptic combined feedback
 */
import * as Haptics from 'expo-haptics'

export const Feedback = {
  /** Light tap - buttons, list items */
  tap: async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await playSound('tap')
  },
  
  /** Success - completed actions */
  success: async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    await playSound('success')
  },
  
  /** Capture - photo taken */
  capture: async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    await playSound('capture')
  },
  
  /** Connect - device paired */
  connect: async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    await playSound('connect')
  },
  
  /** Disconnect - device unpaired */
  disconnect: async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await playSound('disconnect')
  },
  
  /** Toggle - switch toggled */
  toggle: async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)
    await playSound('toggle')
  },
  
  /** Error - something went wrong */
  error: async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    await playSound('error')
  },
  
  /** Selection - picker, segmented control */
  selection: () => {
    Haptics.selectionAsync()
  },
}

export default {
  initSounds,
  setSoundEnabled,
  isSoundEnabled,
  playSound,
  Feedback,
}
