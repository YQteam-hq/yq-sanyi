/**
 * WebSocket Utilities for yq-sanyi
 * 
 * Provides advanced WebSocket functionality with connection management,
 * automatic reconnection, message handling, and event management for
 * real-time applications.
 * 
 * @packageDocumentation
 */

/**
 * WebSocket connection states
 */
export enum WebSocketState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3
}

/**
 * WebSocket event types
 */
export type WebSocketEventType = 'open' | 'message' | 'error' | 'close' | 'reconnecting' | 'reconnected'

/**
 * Message interface
 */
export interface WebSocketMessage {
  type: string
  data: any
  timestamp: number
  id?: string
  replyTo?: string
}

/**
 * Connection configuration interface
 */
export interface WebSocketConfig {
  url: string
  protocols?: string | string[]
  reconnect?: boolean
  maxReconnectAttempts?: number
  reconnectInterval?: number
  maxReconnectInterval?: number
  reconnectDecay?: number
  timeout?: number
  heartbeat?: {
    interval: number
    message?: any
    timeout?: number
  }
  binaryType?: 'blob' | 'arraybuffer'
  subprotocols?: string[]
}

/**
 * Event handler interface
 */
export type EventHandler = (event: any) => void | Promise<void>

/**
 * WebSocket manager class
 */
export class WebSocketManager {
  private ws: WebSocket | null = null
  private config: Required<WebSocketConfig>
  private eventHandlers: Map<WebSocketEventType, EventHandler[]> = new Map()
  private reconnectAttempts = 0
  private reconnectTimeout: number | null = null
  private heartbeatInterval: number | null = null
  private heartbeatTimeout: number | null = null
  private pendingMessages: any[] = []
  private messageIdCounter = 0
  private connectionState = WebSocketState.CLOSED
  private isOpen = false

  /**
   * Create a new WebSocket manager
   */
  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      protocols: config.protocols || [],
      reconnect: config.reconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      reconnectInterval: config.reconnectInterval ?? 1000,
      maxReconnectInterval: config.maxReconnectInterval ?? 30000,
      reconnectDecay: config.reconnectDecay ?? 1.5,
      timeout: config.timeout ?? 5000,
      heartbeat: config.heartbeat || { interval: 30000 },
      binaryType: config.binaryType || 'blob',
      subprotocols: config.subprotocols || []
    }
  }

  /**
   * Get current connection state
   */
  public getState(): WebSocketState {
    return this.connectionState
  }

  /**
   * Check if connection is open
   */
  public isConnected(): boolean {
    return this.isOpen
  }

  /**
   * Get current URL
   */
  public getUrl(): string {
    return this.config.url
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connectionState === WebSocketState.OPEN) {
        resolve()
        return
      }

      this.connectionState = WebSocketState.CONNECTING
      this.isOpen = false

      try {
        // Create WebSocket connection
        const wsUrl = this.config.url
        const protocols = this.config.subprotocols.length > 0 ? this.config.subprotocols : this.config.protocols
        
        this.ws = new WebSocket(wsUrl, protocols)
        this.ws.binaryType = this.config.binaryType

        // Set up event handlers
        this.ws.onopen = (event) => this.handleOpen(event)
        this.ws.onmessage = (event) => this.handleMessage(event)
        this.ws.onerror = (event) => this.handleError(event)
        this.ws.onclose = (event) => this.handleClose(event)

        // Set connection timeout
        const timeout = setTimeout(() => {
          if (this.connectionState === WebSocketState.CONNECTING) {
            this.ws?.close()
            reject(new Error('Connection timeout'))
          }
        }, this.config.timeout)

        // Store timeout for cleanup
        ;(this.ws as any).connectTimeout = timeout

      } catch (error) {
        this.connectionState = WebSocketState.CLOSED
        reject(error)
      }
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.reconnectAttempts = 0
    this.clearReconnectTimeout()
    this.clearHeartbeat()
    
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      
      if (this.connectionState === WebSocketState.OPEN || this.connectionState === WebSocketState.CONNECTING) {
        this.ws.close(1000, 'Manual disconnect')
      }
      
      this.ws = null
    }
    
    this.connectionState = WebSocketState.CLOSED
    this.isOpen = false
    
    this.emit('close', { code: 1000, reason: 'Manual disconnect' })
  }

  /**
   * Send message to WebSocket server
   */
  public send(message: any, options?: { expectReply?: boolean; timeout?: number }): Promise<any> | void {
    if (!this.ws || this.connectionState !== WebSocketState.OPEN) {
      throw new Error('WebSocket is not connected')
    }

    const messageId = options?.expectReply ? this.generateMessageId() : undefined
    const timestamp = Date.now()

    // Create message object
    const messageObj: WebSocketMessage = {
      type: typeof message === 'string' ? 'message' : 'data',
      data: message,
      timestamp,
      id: messageId,
      replyTo: undefined
    }

    // Send message
    this.ws.send(JSON.stringify(messageObj))

    // If expecting reply, set up timeout
    if (options?.expectReply) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (messageId) this.removePendingMessage(messageId)
          reject(new Error(`Message ${messageId} timed out`))
        }, options?.timeout || 10000)

        this.pendingMessages.push({
          id: messageId,
          resolve,
          reject,
          timeout
        })
      })
    }

    return undefined
  }

  /**
   * Send request and expect reply
   */
  public async request(message: any, options?: { timeout?: number }): Promise<any> {
    return this.send(message, { expectReply: true, timeout: options?.timeout })
  }

  /**
   * Add event handler
   */
  public on(event: WebSocketEventType, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }

  /**
   * Remove event handler
   */
  public off(event: WebSocketEventType, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * Remove all event handlers
   */
  public removeAllHandlers(event?: WebSocketEventType): void {
    if (event) {
      this.eventHandlers.delete(event)
    } else {
      this.eventHandlers.clear()
    }
  }

  /**
   * Emit event
   */
  private emit(event: WebSocketEventType, data?: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`WebSocket event handler error for ${event}:`, error)
        }
      })
    }
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(event: Event): void {
    this.connectionState = WebSocketState.OPEN
    this.isOpen = true
    this.reconnectAttempts = 0
    
    // Clear pending messages timeout
    if ((this.ws as any).connectTimeout) {
      clearTimeout((this.ws as any).connectTimeout)
      delete (this.ws as any).connectTimeout
    }

    // Start heartbeat
    this.startHeartbeat()

    // Send pending messages
    this.sendPendingMessages()

    this.emit('open', event)
    this.emit('reconnected')
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data)
      
      // Handle reply to pending message
      if (message.replyTo) {
        this.handleReply(message)
        return
      }

      // Emit message event
      this.emit('message', message)
    } catch (error) {
      this.emit('error', { error, originalEvent: event })
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    this.emit('error', event)
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    this.connectionState = WebSocketState.CLOSED
    this.isOpen = false
    this.clearHeartbeat()

    // Clear pending messages
    this.clearPendingMessages()

    this.emit('close', event)

    // Attempt to reconnect if enabled
    if (this.config.reconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect()
    }
  }

  /**
   * Handle reply to pending message
   */
  private handleReply(message: WebSocketMessage): void {
    const pending = this.pendingMessages.find(p => p.id === message.replyTo)
    if (pending) {
      clearTimeout(pending.timeout)
      if (message.id) this.removePendingMessage(message.id)
      pending.resolve(message.data)
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    if (!this.config.heartbeat) return

    const { interval, message, timeout } = this.config.heartbeat
    
    this.heartbeatInterval = window.setInterval(() => {
      if (this.connectionState === WebSocketState.OPEN) {
        const heartbeatMessage = message || { type: 'heartbeat', timestamp: Date.now() }
        
        if (timeout) {
          this.heartbeatTimeout = setTimeout(() => {
            this.disconnect()
            this.connect()
          }, timeout!)
        }

        this.send(heartbeatMessage)
      }
    }, interval) as unknown as number
  }

  /**
   * Clear heartbeat
   */
  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    this.clearReconnectTimeout()

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(this.config.reconnectDecay, this.reconnectAttempts),
      this.config.maxReconnectInterval
    )

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++
      this.emit('reconnecting', { attempt: this.reconnectAttempts, maxAttempts: this.config.maxReconnectAttempts })
      
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error)
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.scheduleReconnect()
        }
      })
    }, delay) as unknown as number
  }

  /**
   * Clear reconnect timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageIdCounter}`
  }

  /**
   * Send pending messages
   */
  private sendPendingMessages(): void {
    this.pendingMessages.forEach(pending => {
      // Note: We can't resend the original message as we don't have it stored
      // In a real implementation, you might want to store the original message
    })
  }

  /**
   * Remove pending message
   */
  private removePendingMessage(messageId: string): void {
    const index = this.pendingMessages.findIndex(p => p.id === messageId)
    if (index > -1) {
      const pending = this.pendingMessages[index]
      clearTimeout(pending.timeout)
      this.pendingMessages.splice(index, 1)
    }
  }

  /**
   * Clear all pending messages
   */
  private clearPendingMessages(): void {
    this.pendingMessages.forEach(pending => {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Connection closed'))
    })
    this.pendingMessages = []
  }
}

/**
 * Create WebSocket manager instance
 */
export function createWebSocketManager(config: WebSocketConfig): WebSocketManager {
  return new WebSocketManager(config)
}

/**
 * Create WebSocket connection with automatic reconnection
 */
export function createWebSocket(config: WebSocketConfig): WebSocketManager {
  const manager = new WebSocketManager(config)
  manager.connect().catch(console.error)
  return manager
}

/**
 * WebSocket utilities
 */
export const WebSocketUtils = {
  /**
   * Check if WebSocket is supported
   */
  isSupported(): boolean {
    return typeof WebSocket !== 'undefined'
  },

  /**
   * Create WebSocket URL
   */
  createURL(protocol: string, host: string, port: number, path: string = ''): string {
    return `${protocol}://${host}:${port}${path}`
  },

  /**
   * Parse WebSocket message
   */
  parseMessage(data: string): WebSocketMessage {
    try {
      return JSON.parse(data)
    } catch {
      return {
        type: 'message',
        data,
        timestamp: Date.now()
      }
    }
  },

  /**
   * Stringify WebSocket message
   */
  stringifyMessage(message: WebSocketMessage): string {
    return JSON.stringify(message)
  },

  /**
   * Generate UUID for message correlation
   */
  generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  },

  /**
   * Create message with correlation ID
   */
  createMessage(type: string, data: any, correlationId?: string): WebSocketMessage {
    return {
      type,
      data,
      timestamp: Date.now(),
      id: correlationId || WebSocketUtils.generateUUID()
    }
  },

  /**
   * Validate WebSocket URL
   */
  isValidURL(url: string): boolean {
    try {
      const ws = new URL(url)
      return ws.protocol === 'ws:' || ws.protocol === 'wss:'
    } catch {
      return false
    }
  },

  /**
   * Get WebSocket error message from event
   */
  getErrorMessage(event: Event | CloseEvent): string {
    if (event instanceof CloseEvent) {
      return `WebSocket closed with code ${event.code} and reason: ${event.reason}`
    }
    return 'WebSocket error occurred'
  }
}

/**
 * Common WebSocket configurations
 */
export const WebSocketConfigs = {
  /**
   * Default configuration
   */
  default: {
    reconnect: true,
    maxReconnectAttempts: 10,
    reconnectInterval: 1000,
    maxReconnectInterval: 30000,
    reconnectDecay: 1.5,
    timeout: 5000,
    heartbeat: {
      interval: 30000,
      message: { type: 'heartbeat' }
    }
  },

  /**
   * Long-polling configuration
   */
  longPolling: {
    reconnect: true,
    maxReconnectAttempts: 5,
    reconnectInterval: 2000,
    maxReconnectInterval: 10000,
    reconnectDecay: 1.2,
    timeout: 10000
  },

  /**
   * Real-time configuration
   */
  realtime: {
    reconnect: true,
    maxReconnectAttempts: 20,
    reconnectInterval: 500,
    maxReconnectInterval: 30000,
    reconnectDecay: 1.1,
    timeout: 3000,
    heartbeat: {
      interval: 15000,
      message: { type: 'ping' }
    }
  }
}

export default WebSocketManager