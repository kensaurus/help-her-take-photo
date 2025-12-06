/**
 * Hook for frame streaming (sending/receiving camera preview)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { streamingService } from '../services/streaming'
import { useConnection } from './useConnection'
import type { StreamFrame, P2PMessage } from '../types'

interface UseFrameStreamOptions {
  onFrameReceived?: (frame: StreamFrame) => void
}

export function useFrameStream(options: UseFrameStreamOptions = {}) {
  const [currentFrame, setCurrentFrame] = useState<StreamFrame | null>(null)
  const [frameRate, setFrameRate] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)
  
  const frameCountRef = useRef(0)
  const lastFrameTimeRef = useRef(Date.now())
  const fpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleFrame = useCallback((message: P2PMessage) => {
    if (message.type !== 'frame') return
    
    const frame = message.payload as StreamFrame
    setCurrentFrame(frame)
    frameCountRef.current++
    
    options.onFrameReceived?.(frame)
  }, [options])

  const { sendFrame, isConnected, latency } = useConnection({
    onFrame: handleFrame,
  })

  // Calculate FPS
  useEffect(() => {
    fpsIntervalRef.current = setInterval(() => {
      const now = Date.now()
      const elapsed = (now - lastFrameTimeRef.current) / 1000
      setFrameRate(Math.round(frameCountRef.current / elapsed))
      frameCountRef.current = 0
      lastFrameTimeRef.current = now
    }, 1000)

    return () => {
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current)
      }
    }
  }, [])

  const startStreaming = useCallback(() => {
    streamingService.reset()
    setIsStreaming(true)
  }, [])

  const stopStreaming = useCallback(() => {
    setIsStreaming(false)
  }, [])

  const sendCameraFrame = useCallback((
    base64Data: string,
    width: number,
    height: number
  ) => {
    if (!isStreaming || !isConnected) return
    
    if (!streamingService.shouldCaptureFrame()) return

    const frame = streamingService.createFrame(base64Data, width, height)
    sendFrame(frame)
  }, [isStreaming, isConnected, sendFrame])

  const getDecodedFrame = useCallback(() => {
    if (!currentFrame) return null
    return streamingService.decodeFrame(currentFrame)
  }, [currentFrame])

  const setTargetFps = useCallback((fps: number) => {
    streamingService.setTargetFps(fps)
  }, [])

  const getStats = useCallback(() => {
    return {
      ...streamingService.getStats(),
      currentFps: frameRate,
      latency,
      frameSize: currentFrame ? streamingService.getFrameSize(currentFrame) : 0,
    }
  }, [frameRate, latency, currentFrame])

  return {
    currentFrame,
    decodedFrame: getDecodedFrame(),
    frameRate,
    isStreaming,
    latency,
    startStreaming,
    stopStreaming,
    sendCameraFrame,
    setTargetFps,
    getStats,
  }
}

