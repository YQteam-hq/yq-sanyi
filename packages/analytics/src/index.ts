/**
 * Performance monitoring and analytics utilities for yq-sanyi components
 * @packageDocumentation
 */

import type { ComponentDefinition, ComponentScript } from '../../core/src/index.js'

declare global {
  interface Window {
    yq?: any
  }
}

export interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  tags?: Record<string, string>
}

export interface AnalyticsEvent {
  type: string
  payload?: any
  timestamp: number
  userId?: string
  sessionId?: string
  tags?: Record<string, string>
}

export interface PerformanceThreshold {
  name: string
  warning: number
  critical: number
  unit: string
}

export interface AnalyticsConfig {
  enablePerformanceTracking: boolean
  enableEventTracking: boolean
  enableErrorTracking: boolean
  enableUserTracking: boolean
  sampleRate?: number
  endpoint?: string
  thresholds?: PerformanceThreshold[]
}

export interface ComponentMetrics {
  renderTime: number
  updateTime: number
  memoryUsage: number
  errorCount: number
  interactionCount: number
  mountTime: number
  unmountTime?: number
}

export interface UserSession {
  id: string
  startTime: number
  lastActivity: number
  events: AnalyticsEvent[]
  metrics: PerformanceMetric[]
  errors: Error[]
}

/**
 * Performance monitoring and analytics manager
 */
export class AnalyticsManager {
  private config: AnalyticsConfig
  private metrics: PerformanceMetric[] = []
  private events: AnalyticsEvent[] = []
  private errors: Error[] = []
  private sessions: Map<string, UserSession> = new Map()
  private thresholds: PerformanceThreshold[] = []
  private isInitialized = false

  constructor(config: AnalyticsConfig) {
    this.config = config
  }

  /**
   * Initialize analytics
   */
  initialize(): void {
    if (this.isInitialized) return
    
    this.isInitialized = true
    
    // Set up performance monitoring
    if (this.config.enablePerformanceTracking) {
      this.setupPerformanceMonitoring()
    }
    
    // Set up error tracking
    if (this.config.enableErrorTracking) {
      this.setupErrorTracking()
    }
    
    // Set up user tracking
    if (this.config.enableUserTracking) {
      this.setupUserTracking()
    }
    
    // Set up default thresholds
    this.setupDefaultThresholds()
  }

  /**
   * Track a performance metric
   */
  trackMetric(metric: PerformanceMetric): void {
    if (!this.config.enablePerformanceTracking) return
    
    this.metrics.push(metric)
    
    // Check thresholds
    this.checkThresholds(metric)
    
    // Send to endpoint if configured
    if (this.config.endpoint) {
      this.sendToEndpoint('metric', metric)
    }
  }

  /**
   * Track an event
   */
  trackEvent(event: AnalyticsEvent): void {
    if (!this.config.enableEventTracking) return
    
    // Apply sampling rate
    if (this.config.sampleRate && Math.random() > this.config.sampleRate) {
      return
    }
    
    event.timestamp = Date.now()
    
    // Add to current session
    const sessionId = this.getCurrentSessionId()
    if (sessionId) {
      const session = this.sessions.get(sessionId)
      if (session) {
        session.events.push(event)
        session.lastActivity = Date.now()
      }
    }
    
    this.events.push(event)
    
    // Send to endpoint if configured
    if (this.config.endpoint) {
      this.sendToEndpoint('event', event)
    }
  }

  /**
   * Track an error
   */
  trackError(error: Error, context?: Record<string, any>): void {
    if (!this.config.enableErrorTracking) return
    
    const errorEvent: AnalyticsEvent = {
      type: 'error',
      payload: {
        message: error.message,
        stack: error.stack,
        context
      },
      timestamp: Date.now()
    }
    
    this.errors.push(error)
    
    // Add to current session
    const sessionId = this.getCurrentSessionId()
    if (sessionId) {
      const session = this.sessions.get(sessionId)
      if (session) {
        session.errors.push(error)
        session.lastActivity = Date.now()
      }
    }
    
    this.trackEvent(errorEvent)
  }

  /**
   * Track component performance
   */
  trackComponentPerformance(componentName: string, metrics: ComponentMetrics): void {
    this.trackMetric({
      name: 'component_performance',
      value: metrics.renderTime,
      timestamp: Date.now(),
      tags: {
        component: componentName,
        type: 'render_time'
      }
    })
    
    this.trackMetric({
      name: 'component_performance',
      value: metrics.updateTime,
      timestamp: Date.now(),
      tags: {
        component: componentName,
        type: 'update_time'
      }
    })
    
    this.trackMetric({
      name: 'component_performance',
      value: metrics.memoryUsage,
      timestamp: Date.now(),
      tags: {
        component: componentName,
        type: 'memory_usage'
      }
    })
    
    if (metrics.errorCount > 0) {
      this.trackMetric({
        name: 'component_errors',
        value: metrics.errorCount,
        timestamp: Date.now(),
        tags: {
          component: componentName
        }
      })
    }
  }

  /**
   * Get analytics report
   */
  getReport(): {
    summary: {
      totalEvents: number
      totalMetrics: number
      totalErrors: number
      activeSessions: number
      averageRenderTime: number
      averageUpdateTime: number
    }
    events: AnalyticsEvent[]
    metrics: PerformanceMetric[]
    errors: Error[]
    sessions: UserSession[]
  } {
    const renderTimes = this.metrics
      .filter(m => m.tags?.type === 'render_time')
      .map(m => m.value)
    
    const updateTimes = this.metrics
      .filter(m => m.tags?.type === 'update_time')
      .map(m => m.value)
    
    return {
      summary: {
        totalEvents: this.events.length,
        totalMetrics: this.metrics.length,
        totalErrors: this.errors.length,
        activeSessions: this.sessions.size,
        averageRenderTime: renderTimes.length > 0 ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length : 0,
        averageUpdateTime: updateTimes.length > 0 ? updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length : 0
      },
      events: [...this.events],
      metrics: [...this.metrics],
      errors: [...this.errors],
      sessions: Array.from(this.sessions.values())
    }
  }

  /**
   * Export analytics data
   */
  exportData(): string {
    return JSON.stringify(this.getReport(), null, 2)
  }

  /**
   * Clear analytics data
   */
  clearData(): void {
    this.metrics = []
    this.events = []
    this.errors = []
    this.sessions.clear()
  }

  /**
   * Add performance threshold
   */
  addThreshold(threshold: PerformanceThreshold): void {
    this.thresholds.push(threshold)
  }

  /**
   * Remove performance threshold
   */
  removeThreshold(name: string): void {
    this.thresholds = this.thresholds.filter(t => t.name !== name)
  }

  private setupPerformanceMonitoring(): void {
    // Monitor component performance
    const originalDefine = (window as any).yq?.define
    if (originalDefine) {
      (window as any).yq.define = (name: string, definition: any) => {
        const start = performance.now()
        const result = originalDefine.call(window.yq, name, definition)
        const end = performance.now()
        
        this.trackMetric({
          name: 'component_definition_time',
          value: end - start,
          timestamp: Date.now(),
          tags: { component: name }
        })
        
        return result
      }
    }
  }

  private setupErrorTracking(): void {
    window.addEventListener('error', (event) => {
      this.trackError(event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        errorId: event.error?.id
      })
    })
    
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(new Error(event.reason), {
        type: 'unhandledrejection'
      })
    })
  }

  private setupUserTracking(): void {
    // Generate session ID
    const sessionId = this.generateSessionId()
    this.startSession(sessionId)
    
    // Track user interactions
    document.addEventListener('click', (event) => {
      this.trackEvent({
        type: 'user_interaction',
        payload: {
          type: 'click',
          target: (event.target as HTMLElement)?.tagName,
          x: event.clientX,
          y: event.clientY
        },
        timestamp: Date.now()
      })
    })
    
    document.addEventListener('keydown', (event) => {
      this.trackEvent({
        type: 'user_interaction',
        payload: {
          type: 'keydown',
          key: event.key,
          code: event.code
        },
        timestamp: Date.now()
      })
    })
  }

  private setupDefaultThresholds(): void {
    this.thresholds = [
      {
        name: 'render_time',
        warning: 100,
        critical: 200,
        unit: 'ms'
      },
      {
        name: 'update_time',
        warning: 50,
        critical: 100,
        unit: 'ms'
      },
      {
        name: 'memory_usage',
        warning: 50,
        critical: 100,
        unit: 'MB'
      }
    ]
  }

  private checkThresholds(metric: PerformanceMetric): void {
    for (const threshold of this.thresholds) {
      if (metric.name.includes(threshold.name)) {
        const value = metric.value
        
        if (value > threshold.critical) {
          console.warn(`Critical threshold exceeded: ${threshold.name} = ${value}${threshold.unit}`)
          this.trackEvent({
            type: 'threshold_exceeded',
            payload: {
              threshold: threshold.name,
              value,
              level: 'critical'
            },
            timestamp: Date.now()
          })
        } else if (value > threshold.warning) {
          console.warn(`Warning threshold exceeded: ${threshold.name} = ${value}${threshold.unit}`)
          this.trackEvent({
            type: 'threshold_exceeded',
            payload: {
              threshold: threshold.name,
              value,
              level: 'warning'
            },
            timestamp: Date.now()
          })
        }
      }
    }
  }

  private sendToEndpoint(type: string, data: any): void {
    if (!this.config.endpoint) return
    
    // In a real implementation, this would send data to the endpoint
    // For now, we'll just log it
    console.log(`Sending ${type} to endpoint:`, data)
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getCurrentSessionId(): string | null {
    // In a real implementation, this would get the current session ID from cookies or local storage
    return null
  }

  private startSession(sessionId: string): void {
    const session: UserSession = {
      id: sessionId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      events: [],
      metrics: [],
      errors: []
    }
    
    this.sessions.set(sessionId, session)
  }
}

/**
 * Analytics utilities
 */
export const AnalyticsUtils = {
  /**
   * Create performance tracker
   */
  createPerformanceTracker(componentName: string): {
    start: () => number
    end: (start: number) => void
    track: (name: string, value: number) => void
  } {
    return {
      start: () => performance.now(),
      end: (start: number) => {
        const end = performance.now()
        const duration = end - start
        console.log(`${componentName} took ${duration}ms`)
      },
      track: (name: string, value: number) => {
        console.log(`Performance metric - ${name}: ${value}`)
      }
    }
  },

  /**
   * Create event tracker
   */
  createEventTracker(analytics: AnalyticsManager): {
    track: (type: string, payload?: any) => void
    trackInteraction: (element: string, action: string) => void
    trackNavigation: (from: string, to: string) => void
  } {
    return {
      track: (type: string, payload?: any) => {
        analytics.trackEvent({ type, payload, timestamp: Date.now() })
      },
      trackInteraction: (element: string, action: string) => {
        analytics.trackEvent({
          type: 'interaction',
          payload: { element, action },
          timestamp: Date.now()
        })
      },
      trackNavigation: (from: string, to: string) => {
        analytics.trackEvent({
          type: 'navigation',
          payload: { from, to },
          timestamp: Date.now()
        })
      }
    }
  },

  /**
   * Create error tracker
   */
  createErrorTracker(analytics: AnalyticsManager): {
    track: (error: Error, context?: Record<string, any>) => void
    trackAsyncError: (error: any, context?: Record<string, any>) => void
    trackValidationError: (field: string, message: string) => void
  } {
    return {
      track: (error: Error, context?: Record<string, any>) => {
        analytics.trackError(error, context)
      },
      trackAsyncError: (error: any, context?: Record<string, any>) => {
        analytics.trackError(new Error(String(error)), context)
      },
      trackValidationError: (field: string, message: string) => {
        analytics.trackEvent({
          type: 'validation_error',
          payload: { field, message },
          timestamp: Date.now()
        })
      }
    }
  }
}

/**
 * Pre-built analytics components
 */
export const AnalyticsComponents = {
  /**
   * Create performance monitor component
   */
  performanceMonitor: (analytics: AnalyticsManager): ComponentDefinition => ({
    name: 'yq-performance-monitor',
    template: `
      <div class="performance-monitor">
        <div class="metric">Avg Render: {{ avgRenderTime }}ms</div>
        <div class="metric">Avg Update: {{ avgUpdateTime }}ms</div>
        <div class="metric">Memory: {{ memoryUsage }}MB</div>
        <div class="metric">Errors: {{ errorCount }}</div>
      </div>
    `,
    style: `
      .performance-monitor { 
        position: fixed; 
        top: 10px; 
        right: 10px; 
        background: rgba(0,0,0,0.8); 
        color: white; 
        padding: 10px; 
        border-radius: 4px; 
        font-family: monospace; 
        font-size: 12px; 
        z-index: 9999; 
      }
      .metric { margin: 2px 0; }
    `,
    script: function () {
      return {
        state: { 
          avgRenderTime: 0, 
          avgUpdateTime: 0, 
          memoryUsage: 0, 
          errorCount: 0 
        },
        onMount: function () {
          ;(this as any).state.updateMetrics()
          setInterval(() => (this as any).state.updateMetrics(), 1000)
        },
        updateMetrics: function () {
          const report = analytics.getReport()
          ;(this as any).state.avgRenderTime = report.summary.averageRenderTime
          ;(this as any).state.avgUpdateTime = report.summary.averageUpdateTime
          
          // Estimate memory usage
          if ('memory' in performance) {
            ;(this as any).state.memoryUsage = Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
          }
          
          ;(this as any).state.errorCount = report.summary.totalErrors
        }
      }
    }
  }),

  /**
   * Create analytics dashboard component
   */
  analyticsDashboard: (analytics: AnalyticsManager): ComponentDefinition => ({
    name: 'yq-analytics-dashboard',
    template: `
      <div class="analytics-dashboard">
        <h2>Analytics Dashboard</h2>
        <div class="stats">
          <div class="stat">
            <h3>Events</h3>
            <div>{{ totalEvents }}</div>
          </div>
          <div class="stat">
            <h3>Metrics</h3>
            <div>{{ totalMetrics }}</div>
          </div>
          <div class="stat">
            <h3>Errors</h3>
            <div>{{ totalErrors }}</div>
          </div>
          <div class="stat">
            <h3>Sessions</h3>
            <div>{{ activeSessions }}</div>
          </div>
        </div>
        <div class="export">
          <button yq-on:click="exportData">Export Data</button>
          <button yq-on:click="clearData">Clear Data</button>
        </div>
      </div>
    `,
    style: `
      .analytics-dashboard { 
        padding: 20px; 
        background: white; 
        border-radius: 8px; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
      }
      .stats { 
        display: grid; 
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
        gap: 20px; 
        margin: 20px 0; 
      }
      .stat { 
        text-align: center; 
        padding: 15px; 
        background: #f8f9fa; 
        border-radius: 4px; 
      }
      .stat h3 { 
        margin: 0 0 10px 0; 
        color: #666; 
        font-size: 14px; 
      }
      .stat div { 
        font-size: 24px; 
        font-weight: bold; 
        color: #007bff; 
      }
      .export { 
        display: flex; 
        gap: 10px; 
      }
      button { 
        padding: 8px 16px; 
        background: #007bff; 
        color: white; 
        border: none; 
        border-radius: 4px; 
        cursor: pointer; 
      }
      button:hover { 
        background: #0056b3; 
      }
    `,
    script: function () {
      return {
        state: { 
          totalEvents: 0, 
          totalMetrics: 0, 
          totalErrors: 0, 
          activeSessions: 0 
        },
        onMount: function () {
          ;(this as any).state.updateStats()
          setInterval(() => (this as any).state.updateStats(), 1000)
        },
        updateStats: function () {
          const report = analytics.getReport()
          ;(this as any).state.totalEvents = report.summary.totalEvents
          ;(this as any).state.totalMetrics = report.summary.totalMetrics
          ;(this as any).state.totalErrors = report.summary.totalErrors
          ;(this as any).state.activeSessions = report.summary.activeSessions
        },
        exportData: function () {
          const data = analytics.exportData()
          const blob = new Blob([data], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'analytics-data.json'
          a.click()
          URL.revokeObjectURL(url)
        },
        clearData: function () {
          if (confirm('Are you sure you want to clear all analytics data?')) {
            analytics.clearData()
          }
        }
      }
    }
  }),

  /**
   * Create heat map component for user interactions
   */
  interactionHeatmap: (analytics: AnalyticsManager): ComponentDefinition => ({
    name: 'yq-interaction-heatmap',
    template: `
      <div class="interaction-heatmap">
        <h2>Interaction Heatmap</h2>
        <div class="heatmap-container">
          <div class="heatmap-overlay"></div>
          <div class="heatmap-legend">
            <div class="legend-item">
              <div class="legend-low"></div>
              <span>Low</span>
            </div>
            <div class="legend-item">
              <div class="legend-medium"></div>
              <span>Medium</span>
            </div>
            <div class="legend-item">
              <div class="legend-high"></div>
              <span>High</span>
            </div>
          </div>
        </div>
      </div>
    `,
    style: `
      .interaction-heatmap { 
        padding: 20px; 
        background: white; 
        border-radius: 8px; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
      }
      .heatmap-container { 
        position: relative; 
        height: 400px; 
        background: #f8f9fa; 
        border-radius: 4px; 
        overflow: hidden; 
      }
      .heatmap-overlay { 
        position: absolute; 
        top: 0; 
        left: 0; 
        right: 0; 
        bottom: 0; 
        pointer-events: none; 
        opacity: 0.6; 
      }
      .heatmap-legend { 
        display: flex; 
        justify-content: center; 
        gap: 20px; 
        margin-top: 10px; 
      }
      .legend-item { 
        display: flex; 
        align-items: center; 
        gap: 5px; 
      }
      .legend-low { 
        width: 20px; 
        height: 20px; 
        background: rgba(0, 255, 0, 0.3); 
        border-radius: 2px; 
      }
      .legend-medium { 
        width: 20px; 
        height: 20px; 
        background: rgba(255, 255, 0, 0.6); 
        border-radius: 2px; 
      }
      .legend-high { 
        width: 20px; 
        height: 20px; 
        background: rgba(255, 0, 0, 0.8); 
        border-radius: 2px; 
      }
    `,
    script: function () {
      return {
        state: { interactions: [] },
        onMount: function () {
          ;(this as any).state.setupHeatmap()
        },
        setupHeatmap: function () {
          // In a real implementation, this would create a heatmap overlay
          // based on interaction data
          console.log('Setting up interaction heatmap')
        }
      }
    }
  })
}

// Export default analytics manager
export const defaultAnalyticsConfig: AnalyticsConfig = {
  enablePerformanceTracking: true,
  enableEventTracking: true,
  enableErrorTracking: true,
  enableUserTracking: true,
  sampleRate: 1.0
}

export const analyticsManager = new AnalyticsManager(defaultAnalyticsConfig)