/**
 * Realtime Commands Service
 * 
 * Uses Supabase Realtime Broadcast for instant direction commands.
 * Replaces polling-based command delivery for better latency and battery life.
 */

import { supabase } from './supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import { logger } from './logging'

// ─────────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────────

export type Direction = 'up' | 'down' | 'left' | 'right' | 'closer' | 'back'

export interface DirectionCommand {
  direction: Direction
  senderDeviceId: string
  timestamp: string
  sessionId?: string
}

export interface RealtimeCommandsConfig {
  sessionId: string
  role: 'camera' | 'viewer'
  onCommand?: (command: DirectionCommand) => void
  onConnectionStatus?: (status: 'connected' | 'disconnected' | 'error') => void
}

// ─────────────────────────────────────────────────────────────────────────────────
// Realtime Commands Manager
// ─────────────────────────────────────────────────────────────────────────────────

class RealtimeCommandsManager {
  private channel: RealtimeChannel | null = null
  private sessionId: string | null = null
  private config: RealtimeCommandsConfig | null = null
  private isSubscribed = false
  
  /**
   * Subscribe to realtime commands for a session
   */
  async subscribe(config: RealtimeCommandsConfig): Promise<void> {
    if (this.channel) {
      await this.unsubscribe()
    }
    
    this.config = config
    this.sessionId = config.sessionId
    
    const channelName = `session:${config.sessionId}`
    
    logger.info('realtime_commands_subscribing', { 
      sessionId: config.sessionId, 
      role: config.role,
      channelName 
    })
    
    // Create channel with broadcast configuration
    this.channel = supabase.channel(channelName, {
      config: {
        broadcast: {
          // Don't receive own messages
          self: false,
          // Wait for server acknowledgment
          ack: true,
        },
      },
    })
    
    // Listen for direction commands
    this.channel.on(
      'broadcast',
      { event: 'direction_command' },
      (payload) => {
        const command: DirectionCommand = {
          direction: payload.payload.direction,
          senderDeviceId: payload.payload.senderDeviceId,
          timestamp: payload.payload.timestamp || new Date().toISOString(),
          sessionId: config.sessionId,
        }
        
        logger.debug('realtime_command_received', { 
          direction: command.direction,
          from: command.senderDeviceId 
        })
        
        config.onCommand?.(command)
      }
    )
    
    // Listen for photo capture commands
    this.channel.on(
      'broadcast',
      { event: 'capture_photo' },
      (payload) => {
        logger.debug('realtime_capture_received', { payload: payload.payload })
        // Handle capture command - can be extended
      }
    )
    
    // Subscribe to channel
    this.channel.subscribe((status) => {
      logger.info('realtime_channel_status', { status, sessionId: config.sessionId })
      
      if (status === 'SUBSCRIBED') {
        this.isSubscribed = true
        config.onConnectionStatus?.('connected')
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        this.isSubscribed = false
        config.onConnectionStatus?.(status === 'CLOSED' ? 'disconnected' : 'error')
      }
    })
  }
  
  /**
   * Send a direction command to the session
   */
  async sendCommand(direction: Direction, senderDeviceId: string): Promise<boolean> {
    if (!this.channel || !this.isSubscribed) {
      logger.warn('realtime_send_failed', { reason: 'not_subscribed' })
      return false
    }
    
    try {
      const result = await this.channel.send({
        type: 'broadcast',
        event: 'direction_command',
        payload: {
          direction,
          senderDeviceId,
          timestamp: new Date().toISOString(),
        },
      })
      
      logger.debug('realtime_command_sent', { direction, result })
      return result === 'ok'
    } catch (error) {
      logger.error('realtime_send_error', { error, direction })
      return false
    }
  }
  
  /**
   * Send a capture photo command
   */
  async sendCaptureCommand(senderDeviceId: string): Promise<boolean> {
    if (!this.channel || !this.isSubscribed) {
      return false
    }
    
    try {
      const result = await this.channel.send({
        type: 'broadcast',
        event: 'capture_photo',
        payload: {
          senderDeviceId,
          timestamp: new Date().toISOString(),
        },
      })
      
      return result === 'ok'
    } catch (error) {
      logger.error('realtime_capture_send_error', { error })
      return false
    }
  }
  
  /**
   * Unsubscribe from realtime commands
   */
  async unsubscribe(): Promise<void> {
    if (this.channel) {
      logger.info('realtime_commands_unsubscribing', { sessionId: this.sessionId })
      
      try {
        await supabase.removeChannel(this.channel)
      } catch (error) {
        logger.warn('realtime_unsubscribe_error', { error })
      }
      
      this.channel = null
      this.isSubscribed = false
      this.sessionId = null
      this.config = null
    }
  }
  
  /**
   * Check if currently subscribed
   */
  isConnected(): boolean {
    return this.isSubscribed && this.channel !== null
  }
  
  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// Singleton Export
// ─────────────────────────────────────────────────────────────────────────────────

export const realtimeCommands = new RealtimeCommandsManager()

// ─────────────────────────────────────────────────────────────────────────────────
// React Hook Helper
// ─────────────────────────────────────────────────────────────────────────────────

import { useEffect, useCallback, useState } from 'react'

export function useRealtimeCommands(
  sessionId: string | undefined,
  role: 'camera' | 'viewer',
  onCommand?: (command: DirectionCommand) => void
) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastCommand, setLastCommand] = useState<DirectionCommand | null>(null)
  
  useEffect(() => {
    if (!sessionId) return
    
    realtimeCommands.subscribe({
      sessionId,
      role,
      onCommand: (cmd) => {
        setLastCommand(cmd)
        onCommand?.(cmd)
      },
      onConnectionStatus: (status) => {
        setIsConnected(status === 'connected')
      },
    })
    
    return () => {
      realtimeCommands.unsubscribe()
    }
  }, [sessionId, role, onCommand])
  
  const sendDirection = useCallback(async (direction: Direction, deviceId: string) => {
    return realtimeCommands.sendCommand(direction, deviceId)
  }, [])
  
  const sendCapture = useCallback(async (deviceId: string) => {
    return realtimeCommands.sendCaptureCommand(deviceId)
  }, [])
  
  return {
    isConnected,
    lastCommand,
    sendDirection,
    sendCapture,
  }
}

