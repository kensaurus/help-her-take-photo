/**
 * P2P UDP communication service for low-latency frame streaming
 */

import dgram, { type UdpSocket } from 'react-native-udp'
import type { P2PMessage, P2PMessageType } from '../types'

const DEFAULT_PORT = 54321
const MAX_PACKET_SIZE = 65507 // Max UDP packet size
const CHUNK_SIZE = 60000 // Safe chunk size for fragmented frames

export interface P2PCallbacks {
  onMessage: (message: P2PMessage) => void
  onError: (error: Error) => void
  onConnected: () => void
  onDisconnected: () => void
}

interface PendingChunks {
  [key: string]: {
    chunks: Map<number, string>
    total: number
    timestamp: number
  }
}

class P2PService {
  private socket: UdpSocket | null = null
  private callbacks: P2PCallbacks | null = null
  private peerAddress: string | null = null
  private peerPort: number = DEFAULT_PORT
  private localPort: number = DEFAULT_PORT
  private sequenceNumber = 0
  private pendingChunks: PendingChunks = {}
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private lastPongTime = 0

  /**
   * Initialize P2P service
   */
  init(callbacks: P2PCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * Start listening for incoming connections
   */
  async startServer(port: number = DEFAULT_PORT): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = dgram.createSocket({ type: 'udp4' })
        this.localPort = port

        this.socket.on('message', (data, rinfo) => {
          this.handleIncomingData(data, rinfo)
        })

        this.socket.on('error', (error) => {
          this.callbacks?.onError(new Error(String(error)))
        })

        this.socket.on('close', () => {
          this.callbacks?.onDisconnected()
        })

        this.socket.bind(port, () => {
          resolve(port)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Connect to a peer
   */
  connectToPeer(address: string, port: number = DEFAULT_PORT): void {
    this.peerAddress = address
    this.peerPort = port
    
    // Send initial ping
    this.sendMessage('ping', { timestamp: Date.now() })
    
    // Start keep-alive pings
    this.startPingInterval()
    
    this.callbacks?.onConnected()
  }

  /**
   * Send a message to connected peer
   */
  sendMessage<T>(type: P2PMessageType, payload: T): void {
    if (!this.socket || !this.peerAddress) return

    const message: P2PMessage<T> = {
      type,
      payload,
      timestamp: Date.now(),
      sequence: this.sequenceNumber++,
    }

    const data = JSON.stringify(message)
    const buffer = Buffer.from(data, 'utf8')

    // Check if we need to chunk the message
    if (buffer.length > CHUNK_SIZE && type === 'frame') {
      this.sendChunkedMessage(message)
    } else {
      this.socket.send(
        buffer,
        0,
        buffer.length,
        this.peerPort,
        this.peerAddress,
        (error) => {
          if (error) {
            this.callbacks?.onError(new Error(`Send failed: ${error}`))
          }
        }
      )
    }
  }

  /**
   * Send large message in chunks
   */
  private sendChunkedMessage(message: P2PMessage): void {
    const data = JSON.stringify(message.payload)
    const chunks: string[] = []
    
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      chunks.push(data.slice(i, i + CHUNK_SIZE))
    }

    const messageId = `${message.sequence}-${message.timestamp}`

    chunks.forEach((chunk, index) => {
      const chunkMessage = {
        type: 'frame_chunk' as const,
        messageId,
        chunkIndex: index,
        totalChunks: chunks.length,
        data: chunk,
      }

      const buffer = Buffer.from(JSON.stringify(chunkMessage), 'utf8')
      
      this.socket?.send(
        buffer,
        0,
        buffer.length,
        this.peerPort,
        this.peerAddress!,
        () => {}
      )
    })
  }

  /**
   * Handle incoming data
   */
  private handleIncomingData(data: Buffer, rinfo: { address: string; port: number }): void {
    try {
      const str = data.toString('utf8')
      const parsed = JSON.parse(str)

      // Handle chunked messages
      if (parsed.type === 'frame_chunk') {
        this.handleChunk(parsed)
        return
      }

      // Handle regular messages
      const message = parsed as P2PMessage
      
      // Auto-respond to pings
      if (message.type === 'ping') {
        this.sendMessage('pong', { originalTimestamp: message.timestamp })
        
        // Set peer address if not set
        if (!this.peerAddress) {
          this.peerAddress = rinfo.address
          this.peerPort = rinfo.port
          this.callbacks?.onConnected()
        }
      }

      // Track pong for latency
      if (message.type === 'pong') {
        this.lastPongTime = Date.now()
      }

      this.callbacks?.onMessage(message)
    } catch {
      // Ignore malformed packets
    }
  }

  /**
   * Handle incoming chunk
   */
  private handleChunk(chunk: {
    messageId: string
    chunkIndex: number
    totalChunks: number
    data: string
  }): void {
    const { messageId, chunkIndex, totalChunks, data } = chunk

    if (!this.pendingChunks[messageId]) {
      this.pendingChunks[messageId] = {
        chunks: new Map(),
        total: totalChunks,
        timestamp: Date.now(),
      }
    }

    this.pendingChunks[messageId].chunks.set(chunkIndex, data)

    // Check if all chunks received
    if (this.pendingChunks[messageId].chunks.size === totalChunks) {
      const sortedChunks: string[] = []
      for (let i = 0; i < totalChunks; i++) {
        sortedChunks.push(this.pendingChunks[messageId].chunks.get(i)!)
      }

      const fullData = sortedChunks.join('')
      const payload = JSON.parse(fullData)

      const message: P2PMessage = {
        type: 'frame',
        payload,
        timestamp: this.pendingChunks[messageId].timestamp,
        sequence: parseInt(messageId.split('-')[0]),
      }

      delete this.pendingChunks[messageId]
      this.callbacks?.onMessage(message)
    }

    // Clean up old pending chunks
    this.cleanupPendingChunks()
  }

  /**
   * Clean up stale pending chunks
   */
  private cleanupPendingChunks(): void {
    const now = Date.now()
    const maxAge = 5000 // 5 seconds

    for (const messageId of Object.keys(this.pendingChunks)) {
      if (now - this.pendingChunks[messageId].timestamp > maxAge) {
        delete this.pendingChunks[messageId]
      }
    }
  }

  /**
   * Start ping interval for keep-alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.sendMessage('ping', { timestamp: Date.now() })
    }, 2000)
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    if (this.peerAddress) {
      this.sendMessage('disconnect', {})
    }

    this.socket?.close()
    this.socket = null
    this.peerAddress = null
    this.pendingChunks = {}
  }

  /**
   * Get last known latency
   */
  getLatency(): number {
    if (this.lastPongTime === 0) return -1
    return Date.now() - this.lastPongTime
  }

  get isConnected(): boolean {
    return this.socket !== null && this.peerAddress !== null
  }

  get port(): number {
    return this.localPort
  }
}

export const p2pService = new P2PService()

