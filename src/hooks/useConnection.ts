/**
 * Hook for managing P2P connection
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { p2pService, type P2PCallbacks } from '../services/p2p'
import { useConnectionStore } from '../stores/connectionStore'
import type { P2PMessage, DeviceRole } from '../types'

interface UseConnectionOptions {
  onFrame?: (frame: P2PMessage) => void
  onCaptureRequest?: (requestId: string) => void
}

export function useConnection(options: UseConnectionOptions = {}) {
  const { onFrame, onCaptureRequest } = options
  const [latency, setLatency] = useState<number | null>(null)
  
  const {
    status,
    myRole,
    peerDevice,
    setStatus,
    setRole,
    setError,
    reset,
  } = useConnectionStore()

  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    const callbacks: P2PCallbacks = {
      onMessage: (message) => {
        switch (message.type) {
          case 'frame':
            optionsRef.current.onFrame?.(message)
            break
          case 'capture_request':
            optionsRef.current.onCaptureRequest?.((message.payload as { requestId: string }).requestId)
            break
          case 'pong':
            const pongPayload = message.payload as { originalTimestamp: number }
            setLatency(Date.now() - pongPayload.originalTimestamp)
            break
          case 'disconnect':
            setStatus('disconnected')
            break
        }
      },
      onError: (error) => {
        setError(error.message)
      },
      onConnected: () => {
        setStatus('connected')
      },
      onDisconnected: () => {
        setStatus('disconnected')
      },
    }

    p2pService.init(callbacks)

    return () => {
      p2pService.stop()
    }
  }, [setStatus, setError])

  const startAsServer = useCallback(async (role: DeviceRole, port?: number) => {
    try {
      setRole(role)
      setStatus('connecting')
      const actualPort = await p2pService.startServer(port)
      setStatus('connected')
      return actualPort
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start server')
      throw error
    }
  }, [setRole, setStatus, setError])

  const connectToPeer = useCallback((address: string, port: number, role: DeviceRole) => {
    setRole(role)
    setStatus('connecting')
    p2pService.connectToPeer(address, port)
  }, [setRole, setStatus])

  const sendFrame = useCallback((frameData: unknown) => {
    if (status !== 'connected' && status !== 'streaming') return
    
    setStatus('streaming')
    p2pService.sendMessage('frame', frameData)
  }, [status, setStatus])

  const requestCapture = useCallback((requestId: string) => {
    p2pService.sendMessage('capture_request', { requestId })
  }, [])

  const respondCapture = useCallback((requestId: string, success: boolean, savedPath?: string) => {
    p2pService.sendMessage('capture_response', { requestId, success, savedPath })
  }, [])

  const disconnect = useCallback(() => {
    p2pService.stop()
    reset()
  }, [reset])

  return {
    status,
    myRole,
    peerDevice,
    latency,
    isConnected: status === 'connected' || status === 'streaming',
    isStreaming: status === 'streaming',
    startAsServer,
    connectToPeer,
    sendFrame,
    requestCapture,
    respondCapture,
    disconnect,
  }
}

