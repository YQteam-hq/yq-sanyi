import { State, Derived, ComponentDefinition } from './index.js'

export interface PerformanceMetrics {
  timestamp: number
  renderTime: number
  updateTime: number
  memoryUsage: number
  domOperations: number
  cacheHits: number
  cacheMisses: number
  virtualizationEnabled: boolean
  lazyLoadingEnabled: boolean
  animationCount: number
  networkRequests: number
  componentCount: number
  activeComponents: string[]
  fps: number
  cpuUsage: number
  memoryPressure: boolean
  warnings: string[]
  errors: string[]
}

export interface PerformanceConfig {
  enabled: boolean
  sampleRate: number
  maxMetrics: number
  enableMemoryTracking: boolean
  enableFPSTracking: boolean
  enableCPUTracking: boolean
  enableNetworkTracking: boolean
  enableComponentTracking: boolean
  enableVirtualizationTracking: boolean
  enableAnimationTracking: boolean
  reportInterval: number
  alertThresholds: {
    renderTime: number
    updateTime: number
    memoryUsage: number
    domOperations: number
    fps: number
    cpuUsage: number
  }
}

export interface PerformanceReport {
  summary: {
    score: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    issues: number
    recommendations: string[]
  }
  metrics: PerformanceMetrics
  trends: {
    renderTime: number[]
    updateTime: number[]
    memoryUsage: number[]
    fps: number[]
  }
  bottlenecks: string[]
  optimizations: string[]
}

export interface PerformanceProfile {
  id: string
  name: string
  startTime: number
  endTime?: number
  metrics: PerformanceMetrics[]
  config: PerformanceConfig
  tags: string[]
}

export class PerformanceMonitor {
  private static config: PerformanceConfig = {
    enabled: true,
    sampleRate: 0.1,
    maxMetrics: 1000,
    enableMemoryTracking: true,
    enableFPSTracking: true,
    enableCPUTracking: true,
    enableNetworkTracking: true,
    enableComponentTracking: true,
    enableVirtualizationTracking: true,
    enableAnimationTracking: true,
    reportInterval: 5000,
    alertThresholds: {
      renderTime: 100,
      updateTime: 50,
      memoryUsage: 100,
      domOperations: 100,
      fps: 30,
      cpuUsage: 80
    }
  }

  private static metrics: PerformanceMetrics[] = []
  private static profiles: PerformanceProfile[] = []
  private static currentProfile: PerformanceProfile | null = null
  private static rafId: number | null = null
  private static reportIntervalId: number | null = null
  private static fpsHistory: number[] = []
  private static lastFrameTime = performance.now()
  private static frameCount = 0
  private static networkRequests: Map<string, { url: string; startTime: number; endTime?: number; size?: number }> = new Map()
  private static components: Map<string, { name: string; mountTime: number; unmountTime?: number; renderCount: number }> = new Map()
  private static animations: Map<string, { startTime: number; endTime?: number; element: HTMLElement; type: string }> = new Map()

  // Configuration
  static configure(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config }
    
    if (this.config.enabled) {
      this.startMonitoring()
    } else {
      this.stopMonitoring()
    }
  }

  static getConfig(): PerformanceConfig {
    return { ...this.config }
  }

  // Monitoring control
  static startMonitoring(): void {
    if (!this.config.enabled) return

    this.startFPSMonitoring()
    this.startMemoryMonitoring()
    this.startNetworkMonitoring()
    this.startComponentTracking()
    this.startAnimationTracking()
    
    if (this.config.reportInterval > 0) {
      this.startReporting()
    }
  }

  static stopMonitoring(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    
    if (this.reportIntervalId) {
      clearInterval(this.reportIntervalId)
      this.reportIntervalId = null
    }
    
    this.stopFPSMonitoring()
    this.stopMemoryMonitoring()
    this.stopNetworkMonitoring()
    this.stopComponentTracking()
    this.stopAnimationTracking()
  }

  // Performance profiling
  static startProfile(name: string, tags: string[] = []): string {
    const profileId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const profile: PerformanceProfile = {
      id: profileId,
      name,
      startTime: performance.now(),
      metrics: [],
      config: { ...this.config },
      tags
    }
    
    this.profiles.push(profile)
    this.currentProfile = profile
    
    return profileId
  }

  static endProfile(profileId: string): PerformanceProfile | null {
    const profile = this.profiles.find(p => p.id === profileId)
    if (profile) {
      profile.endTime = performance.now()
      this.currentProfile = null
      return profile
    }
    return null
  }

  static getCurrentProfile(): PerformanceProfile | null {
    return this.currentProfile
  }

  // Metrics collection
  static collectMetrics(): PerformanceMetrics {
    const metrics: PerformanceMetrics = {
      timestamp: performance.now(),
      renderTime: this.calculateAverageRenderTime(),
      updateTime: this.calculateAverageUpdateTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
      domOperations: this.getDOMOperationCount(),
      cacheHits: this.getCacheHitCount(),
      cacheMisses: this.getCacheMissCount(),
      virtualizationEnabled: this.isVirtualizationEnabled(),
      lazyLoadingEnabled: this.isLazyLoadingEnabled(),
      animationCount: this.getAnimationCount(),
      networkRequests: this.getNetworkRequestCount(),
      componentCount: this.getComponentCount(),
      activeComponents: this.getActiveComponents(),
      fps: this.getCurrentFPS(),
      cpuUsage: this.getCurrentCPUUsage(),
      memoryPressure: this.isMemoryPressure(),
      warnings: this.getWarnings(),
      errors: this.getErrors()
    }

    // Add to metrics history
    this.metrics.push(metrics)
    
    // Limit metrics history
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics.shift()
    }

    // Add to current profile
    if (this.currentProfile) {
      this.currentProfile.metrics.push(metrics)
    }

    return metrics
  }

  // FPS monitoring
  private static startFPSMonitoring(): void {
    if (!this.config.enableFPSTracking) return

    const updateFPS = () => {
      const now = performance.now()
      const delta = now - this.lastFrameTime
      
      if (delta >= 1000) {
        const fps = Math.round((this.frameCount * 1000) / delta)
        this.fpsHistory.push(fps)
        
        if (this.fpsHistory.length > 60) {
          this.fpsHistory.shift()
        }
        
        this.frameCount = 0
        this.lastFrameTime = now
      }
      
      this.frameCount++
      this.rafId = requestAnimationFrame(updateFPS)
    }
    
    this.rafId = requestAnimationFrame(updateFPS)
  }

  private static stopFPSMonitoring(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  static getCurrentFPS(): number {
    if (this.fpsHistory.length === 0) return 0
    return this.fpsHistory[this.fpsHistory.length - 1]
  }

  // Memory monitoring
  private static startMemoryMonitoring(): void {
    if (!this.config.enableMemoryTracking) return

    // Memory monitoring is handled by the periodic metrics collection
  }

  private static stopMemoryMonitoring(): void {
    // Memory monitoring is handled by the periodic metrics collection
  }

  static getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return Math.round(memory.usedJSHeapSize / 1024 / 1024) // MB
    }
    return 0
  }

  static isMemoryPressure(): boolean {
    const memoryUsage = this.getCurrentMemoryUsage()
    return memoryUsage > this.config.alertThresholds.memoryUsage
  }

  // Network monitoring
  private static startNetworkMonitoring(): void {
    if (!this.config.enableNetworkTracking) return

    // Monitor fetch requests
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const startTime = performance.now()
      const url = args[0] as string
      
      try {
        const response = await originalFetch(...args)
        const endTime = performance.now()
        
        this.networkRequests.set(`fetch_${startTime}`, {
          url,
          startTime,
          endTime,
          size: response.headers.get('content-length') ? parseInt(response.headers.get('content-length')!) : undefined
        })
        
        return response
      } catch (error) {
        const endTime = performance.now()
        this.networkRequests.set(`fetch_${startTime}`, {
          url,
          startTime,
          endTime,
          error: error as Error
        })
        throw error
      }
    }

    // Monitor XMLHttpRequest
    const originalXHR = window.XMLHttpRequest
    window.XMLHttpRequest = function() {
      const xhr = new originalXHR()
      const originalOpen = xhr.open
      const originalSend = xhr.send
      
      xhr.open = function(...args) {
        const url = args[1] as string
        xhr._startTime = performance.now()
        xhr._url = url
        return originalOpen.apply(this, args)
      }
      
      xhr.send = function(...args) {
        const originalOnLoad = xhr.onload
        const originalOnError = xhr.onerror
        
        xhr.onload = function() {
          xhr._endTime = performance.now()
          PerformanceMonitor.networkRequests.set(`xhr_${xhr._startTime}`, {
            url: xhr._url,
            startTime: xhr._startTime,
            endTime: xhr._endTime,
            size: xhr.response?.length
          })
          originalOnLoad?.apply(this, args)
        }
        
        xhr.onerror = function() {
          xhr._endTime = performance.now()
          PerformanceMonitor.networkRequests.set(`xhr_${xhr._startTime}`, {
            url: xhr._url,
            startTime: xhr._startTime,
            endTime: xhr._endTime,
            error: new Error('Network error')
          })
          originalOnError?.apply(this, args)
        }
        
        return originalSend.apply(this, args)
      }
      
      return xhr
    } as any
  }

  private static stopNetworkMonitoring(): void {
    // Restore original fetch and XMLHttpRequest
    window.fetch = window.fetch
    window.XMLHttpRequest = window.XMLHttpRequest
  }

  static getNetworkRequestCount(): number {
    return this.networkRequests.size
  }

  // Component tracking
  private static startComponentTracking(): void {
    if (!this.config.enableComponentTracking) return

    // Track component mount/unmount
    const originalDefine = window.customElements?.define
    if (originalDefine) {
      window.customElements.define = function(name, constructor, options) {
        const originalConnectedCallback = constructor.prototype.connectedCallback
        const originalDisconnectedCallback = constructor.prototype.disconnectedCallback
        
        constructor.prototype.connectedCallback = function() {
          const startTime = performance.now()
          PerformanceMonitor.components.set(name, {
            name,
            mountTime: startTime,
            renderCount: 0
          })
          originalConnectedCallback?.call(this)
        }
        
        constructor.prototype.disconnectedCallback = function() {
          const component = PerformanceMonitor.components.get(name)
          if (component) {
            component.unmountTime = performance.now()
            PerformanceMonitor.components.delete(name)
          }
          originalDisconnectedCallback?.call(this)
        }
        
        return originalDefine.call(this, name, constructor, options)
      }
    }
  }

  private static stopComponentTracking(): void {
    // Restore original customElements.define
    window.customElements.define = window.customElements.define
  }

  static getComponentCount(): number {
    return this.components.size
  }

  static getActiveComponents(): string[] {
    return Array.from(this.components.keys())
  }

  // Animation tracking
  private static startAnimationTracking(): void {
    if (!this.config.enableAnimationTracking) return

    // Track animations
    const originalAnimate = Element.prototype.animate
    Element.prototype.animate = function(...args) {
      const animation = originalAnimate.apply(this, args)
      const startTime = performance.now()
      
      PerformanceMonitor.animations.set(`animation_${startTime}`, {
        startTime,
        element: this,
        type: 'custom'
      })
      
      animation.onfinish = () => {
        const anim = PerformanceMonitor.animations.get(`animation_${startTime}`)
        if (anim) {
          anim.endTime = performance.now()
        }
      }
      
      return animation
    }
  }

  private static stopAnimationTracking(): void {
    // Restore original animate
    Element.prototype.animate = Element.prototype.animate
  }

  static getAnimationCount(): number {
    return this.animations.size
  }

  // Reporting
  private static startReporting(): void {
    if (this.reportIntervalId) {
      clearInterval(this.reportIntervalId)
    }

    this.reportIntervalId = setInterval(() => {
      this.generateReport()
    }, this.config.reportInterval)
  }

  static generateReport(): PerformanceReport {
    const metrics = this.metrics[this.metrics.length - 1] || this.collectMetrics()
    const trends = this.calculateTrends()
    const score = this.calculatePerformanceScore(metrics)
    const grade = this.getPerformanceGrade(score)
    const issues = this.identifyIssues(metrics)
    const recommendations = this.generateRecommendations(metrics, trends)

    return {
      summary: {
        score,
        grade,
        issues: issues.length,
        recommendations
      },
      metrics,
      trends,
      bottlenecks: issues,
      optimizations: recommendations
    }
  }

  // Analysis methods
  private static calculateAverageRenderTime(): number {
    const renderMetrics = this.metrics.filter(m => m.renderTime > 0)
    if (renderMetrics.length === 0) return 0
    
    const total = renderMetrics.reduce((sum, m) => sum + m.renderTime, 0)
    return total / renderMetrics.length
  }

  private static calculateAverageUpdateTime(): number {
    const updateMetrics = this.metrics.filter(m => m.updateTime > 0)
    if (updateMetrics.length === 0) return 0
    
    const total = updateMetrics.reduce((sum, m) => sum + m.updateTime, 0)
    return total / updateMetrics.length
  }

  private static getDOMOperationCount(): number {
    // This would be tracked during DOM operations
    return 0
  }

  private static getCacheHitCount(): number {
    // This would be tracked during cache operations
    return 0
  }

  private static getCacheMissCount(): number {
    // This would be tracked during cache operations
    return 0
  }

  private static isVirtualizationEnabled(): boolean {
    // Check if virtualization is enabled
    return false
  }

  private static isLazyLoadingEnabled(): boolean {
    // Check if lazy loading is enabled
    return false
  }

  private static calculateTrends() {
    const recentMetrics = this.metrics.slice(-50) // Last 50 metrics
    
    return {
      renderTime: recentMetrics.map(m => m.renderTime),
      updateTime: recentMetrics.map(m => m.updateTime),
      memoryUsage: recentMetrics.map(m => m.memoryUsage),
      fps: recentMetrics.map(m => m.fps)
    }
  }

  private static calculatePerformanceScore(metrics: PerformanceMetrics): number {
    let score = 100
    
    // Render time impact
    if (metrics.renderTime > this.config.alertThresholds.renderTime) {
      score -= 20
    }
    
    // Update time impact
    if (metrics.updateTime > this.config.alertThresholds.updateTime) {
      score -= 15
    }
    
    // Memory usage impact
    if (metrics.memoryUsage > this.config.alertThresholds.memoryUsage) {
      score -= 10
    }
    
    // FPS impact
    if (metrics.fps < this.config.alertThresholds.fps) {
      score -= 25
    }
    
    // DOM operations impact
    if (metrics.domOperations > this.config.alertThresholds.domOperations) {
      score -= 10
    }
    
    return Math.max(0, score)
  }

  private static getPerformanceGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
  }

  private static identifyIssues(metrics: PerformanceMetrics): string[] {
    const issues: string[] = []
    
    if (metrics.renderTime > this.config.alertThresholds.renderTime) {
      issues.push('High render time detected')
    }
    
    if (metrics.updateTime > this.config.alertThresholds.updateTime) {
      issues.push('High update time detected')
    }
    
    if (metrics.memoryUsage > this.config.alertThresholds.memoryUsage) {
      issues.push('High memory usage detected')
    }
    
    if (metrics.fps < this.config.alertThresholds.fps) {
      issues.push('Low FPS detected')
    }
    
    if (metrics.domOperations > this.config.alertThresholds.domOperations) {
      issues.push('High DOM operations count')
    }
    
    if (metrics.memoryPressure) {
      issues.push('Memory pressure detected')
    }
    
    return issues
  }

  private static generateRecommendations(metrics: PerformanceMetrics, trends: any): string[] {
    const recommendations: string[] = []
    
    if (metrics.renderTime > this.config.alertThresholds.renderTime) {
      recommendations.push('Consider enabling virtualization for large lists')
      recommendations.push('Optimize component rendering with memoization')
    }
    
    if (metrics.updateTime > this.config.alertThresholds.updateTime) {
      recommendations.push('Enable batching for DOM updates')
      recommendations.push('Use debouncing for frequent updates')
    }
    
    if (metrics.memoryUsage > this.config.alertThresholds.memoryUsage) {
      recommendations.push('Implement lazy loading for components')
      recommendations.push('Enable caching for expensive operations')
      recommendations.push('Clean up unused objects and references')
    }
    
    if (metrics.fps < this.config.alertThresholds.fps) {
      recommendations.push('Reduce animation complexity')
      recommendations.push('Enable hardware acceleration')
      recommendations.push('Optimize CSS transitions')
    }
    
    if (metrics.domOperations > this.config.alertThresholds.domOperations) {
      recommendations.push('Minimize DOM manipulations')
      recommendations.push('Use document fragments for batch operations')
      recommendations.push('Consider virtual DOM techniques')
    }
    
    return recommendations
  }

  private static getWarnings(): string[] {
    const warnings: string[] = []
    
    if (this.getCurrentFPS() < this.config.alertThresholds.fps) {
      warnings.push('Low FPS detected')
    }
    
    if (this.isMemoryPressure()) {
      warnings.push('Memory pressure detected')
    }
    
    return warnings
  }

  private static getErrors(): string[] {
    const errors: string[] = []
    
    if (this.getCurrentFPS() < 15) {
      errors.push('Critical FPS drop detected')
    }
    
    if (this.getCurrentMemoryUsage() > 500) {
      errors.push('Critical memory usage detected')
    }
    
    return errors
  }

  // Public API
  static getMetrics(): PerformanceMetrics[] {
    return [...this.metrics]
  }

  static getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null
  }

  static getProfiles(): PerformanceProfile[] {
    return [...this.profiles]
  }

  static exportData(): {
    metrics: PerformanceMetrics[]
    profiles: PerformanceProfile[]
    config: PerformanceConfig
  } {
    return {
      metrics: this.metrics,
      profiles: this.profiles,
      config: this.config
    }
  }

  static importData(data: {
    metrics: PerformanceMetrics[]
    profiles: PerformanceProfile[]
    config: PerformanceConfig
  }): void {
    this.metrics = data.metrics
    this.profiles = data.profiles
    this.config = data.config
  }

  // Cleanup
  static cleanup(): void {
    this.stopMonitoring()
    this.metrics = []
    this.profiles = []
    this.currentProfile = null
    this.fpsHistory = []
    this.networkRequests.clear()
    this.components.clear()
    this.animations.clear()
  }
}

// Performance monitoring utilities
export const PerformanceUtils = {
  // Configuration
  configure: (config: Partial<PerformanceConfig>) => PerformanceMonitor.configure(config),
  getConfig: () => PerformanceMonitor.getConfig(),
  
  // Monitoring control
  startMonitoring: () => PerformanceMonitor.startMonitoring(),
  stopMonitoring: () => PerformanceMonitor.stopMonitoring(),
  
  // Profiling
  startProfile: (name: string, tags: string[] = []) => PerformanceMonitor.startProfile(name, tags),
  endProfile: (profileId: string) => PerformanceMonitor.endProfile(profileId),
  getCurrentProfile: () => PerformanceMonitor.getCurrentProfile(),
  
  // Metrics collection
  collectMetrics: () => PerformanceMonitor.collectMetrics(),
  getMetrics: () => PerformanceMonitor.getMetrics(),
  getLatestMetrics: () => PerformanceMonitor.getLatestMetrics(),
  
  // Analysis
  generateReport: () => PerformanceMonitor.generateReport(),
  exportData: () => PerformanceMonitor.exportData(),
  importData: (data: any) => PerformanceMonitor.importData(data),
  
  // Cleanup
  cleanup: () => PerformanceMonitor.cleanup()
}