/**
 * Enhanced debugging utilities for yq-sanyi components with performance profiling
 * @packageDocumentation
 */

import type { ComponentInstance, UpdateLog, LifecycleState } from '../../core/src/index.js'

export interface PerformanceMetrics {
  renderTime: number
  updateTime: number
  memoryUsage: number
  componentCount: number
  updateFrequency: number
}

export interface DebugInfo {
  componentName: string
  lifecycleState: LifecycleState
  state: Record<string, any>
  derivedStates: Record<string, any>
  updateLogs: UpdateLog[]
  errorInfo: { hasError: boolean; error?: Error; timestamp?: number } | null
  mountTime: number
  lastUpdateTime: number
  updateCount: number
}

export interface ProfilerOptions {
  sampleInterval?: number
  maxSamples?: number
  enableMemoryTracking?: boolean
  enableRenderProfiling?: boolean
}

export class ComponentProfiler {
  private samples: PerformanceMetrics[] = []
  private instanceMetrics: Map<string, DebugInfo> = new Map()
  private options: Required<ProfilerOptions>
  
  constructor(options: ProfilerOptions = {}) {
    this.options = {
      sampleInterval: 1000,
      maxSamples: 100,
      enableMemoryTracking: true,
      enableRenderProfiling: true,
      ...options
    }
  }

  /**
   * Start profiling a component instance
   */
  startProfiling(instance: ComponentInstance): void {
    const debugInfo: DebugInfo = {
      componentName: instance.name,
      lifecycleState: instance.lifecycleState,
      state: { ...instance.state },
      derivedStates: { ...instance.derivedStates },
      updateLogs: [...instance.updateLogs],
      errorInfo: instance.errorInfo,
      mountTime: Date.now(),
      lastUpdateTime: Date.now(),
      updateCount: instance.updateLogs.length
    }
    
    this.instanceMetrics.set(`${instance.name}-${instance.container.id}`, debugInfo)
    
    if (this.options.enableRenderProfiling) {
      this.startRenderProfiling(instance)
    }
  }

  /**
   * Stop profiling a component instance
   */
  stopProfiling(instance: ComponentInstance): DebugInfo | null {
    const key = `${instance.name}-${instance.container.id}`
    const info = this.instanceMetrics.get(key)
    if (info) {
      this.instanceMetrics.delete(key)
      return info
    }
    return null
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    const now = Date.now()
    const samples = Array.from(this.instanceMetrics.values())
    
    return {
      renderTime: this.calculateAverageRenderTime(samples),
      updateTime: this.calculateAverageUpdateTime(samples),
      memoryUsage: this.options.enableMemoryTracking ? this.getMemoryUsage() : 0,
      componentCount: samples.length,
      updateFrequency: this.calculateUpdateFrequency(samples)
    }
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): {
    summary: PerformanceMetrics
    details: Array<{ component: string; metrics: DebugInfo }>
    recommendations: string[]
  } {
    const summary = this.getCurrentMetrics()
    const details = Array.from(this.instanceMetrics.entries()).map(([key, metrics]) => ({
      component: key,
      metrics
    }))
    
    const recommendations = this.generateRecommendations(summary, details)
    
    return { summary, details, recommendations }
  }

  /**
   * Export profiling data
   */
  exportProfileData(): string {
    const report = this.getPerformanceReport()
    return JSON.stringify(report, null, 2)
  }

  private startRenderProfiling(instance: ComponentInstance): void {
    const originalUpdate = instance.requestUpdate
    let renderStartTime = 0
    
    instance.requestUpdate = () => {
      renderStartTime = performance.now()
      const result = originalUpdate?.call(instance)
      
      if (renderStartTime > 0) {
        const renderTime = performance.now() - renderStartTime
        this.recordRenderTime(instance.name, renderTime)
      }
      
      return result
    }
  }

  private recordRenderTime(componentName: string, renderTime: number): void {
    const sample: PerformanceMetrics = {
      renderTime,
      updateTime: 0,
      memoryUsage: 0,
      componentCount: 0,
      updateFrequency: 0
    }
    
    this.samples.push(sample)
    if (this.samples.length > this.options.maxSamples) {
      this.samples.shift()
    }
  }

  private calculateAverageRenderTime(samples: DebugInfo[]): number {
    if (samples.length === 0) return 0
    // This would be enhanced with actual render time tracking
    return 0
  }

  private calculateAverageUpdateTime(samples: DebugInfo[]): number {
    if (samples.length === 0) return 0
    const totalUpdates = samples.reduce((sum, s) => sum + s.updateCount, 0)
    return totalUpdates / samples.length
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return memory.usedJSHeapSize
    }
    return 0
  }

  private calculateUpdateFrequency(samples: DebugInfo[]): number {
    if (samples.length === 0) return 0
    const now = Date.now()
    const recentUpdates = samples.filter(s => now - s.lastUpdateTime < 60000)
    return recentUpdates.length / 60 // updates per second
  }

  private generateRecommendations(
    summary: PerformanceMetrics, 
    details: Array<{ component: string; metrics: DebugInfo }>
  ): string[] {
    const recommendations: string[] = []
    
    if (summary.renderTime > 16) {
      recommendations.push('Consider optimizing component rendering - some components are taking too long to render')
    }
    
    if (summary.updateFrequency > 10) {
      recommendations.push('High update frequency detected - consider implementing batch updates or memoization')
    }
    
    const errorComponents = details.filter(d => d.metrics.errorInfo?.hasError)
    if (errorComponents.length > 0) {
      recommendations.push(`${errorComponents.length} components have errors - check error boundaries`)
    }
    
    return recommendations
  }
}

/**
 * Global profiler instance
 */
export const globalProfiler = new ComponentProfiler()

/**
 * Decorator for profiling component methods
 */
export function profileMethod(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value
  
  descriptor.value = function(...args: any[]) {
    const startTime = performance.now()
    const result = method.apply(this, args)
    const endTime = performance.now()
    
    console.log(`Method ${propertyName} executed in ${endTime - startTime}ms`)
    
    return result
  }
  
  return descriptor
}

/**
 * Performance monitoring utility
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()
  private thresholds: Map<string, number> = new Map()
  
  setThreshold(metric: string, threshold: number): void {
    this.thresholds.set(metric, threshold)
  }
  
  recordMetric(metric: string, value: number): void {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, [])
    }
    
    const values = this.metrics.get(metric)!
    values.push(value)
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift()
    }
    
    const threshold = this.thresholds.get(metric)
    if (threshold && value > threshold) {
      console.warn(`Performance threshold exceeded for ${metric}: ${value} > ${threshold}`)
    }
  }
  
  getMetricAverage(metric: string): number {
    const values = this.metrics.get(metric)
    if (!values || values.length === 0) return 0
    
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }
  
  getMetricPercentile(metric: string, percentile: number): number {
    const values = this.metrics.get(metric)
    if (!values || values.length === 0) return 0
    
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    
    return sorted[index] || 0
  }
}

export const performanceMonitor = new PerformanceMonitor()

/**
 * Debug utilities for component development
 */
export class DebugUtils {
  /**
   * Log component state changes
   */
  static logStateChange(instance: ComponentInstance, property: string, oldValue: any, newValue: any): void {
    console.group(`🔄 State Change: ${instance.name}.${property}`)
    console.log('Old value:', oldValue)
    console.log('New value:', newValue)
    console.log('Timestamp:', new Date().toISOString())
    console.groupEnd()
  }
  
  /**
   * Log component lifecycle events
   */
  static logLifecycleEvent(instance: ComponentInstance, event: string): void {
    console.group(`📋 Lifecycle: ${instance.name} - ${event}`)
    console.log('State:', instance.state)
    console.log('Timestamp:', new Date().toISOString())
    console.groupEnd()
  }
  
  /**
   * Log component errors
   */
  static logComponentError(instance: ComponentInstance, error: Error): void {
    console.group(`❌ Component Error: ${instance.name}`)
    console.error('Error:', error)
    console.error('Stack:', error.stack)
    console.error('Component state:', instance.state)
    console.error('Timestamp:', new Date().toISOString())
    console.groupEnd()
  }
  
  /**
   * Generate component snapshot
   */
  static generateSnapshot(instance: ComponentInstance): DebugInfo {
    return {
      componentName: instance.name,
      lifecycleState: instance.lifecycleState,
      state: { ...instance.state },
      derivedStates: { ...instance.derivedStates },
      updateLogs: [...instance.updateLogs],
      errorInfo: instance.errorInfo,
      mountTime: Date.now(),
      lastUpdateTime: Date.now(),
      updateCount: instance.updateLogs.length
    }
  }
  
  /**
   * Compare two component snapshots
   */
  static compareSnapshots(oldSnapshot: DebugInfo, newSnapshot: DebugInfo): {
    changedProperties: string[]
    addedProperties: string[]
    removedProperties: string[]
    updateCount: number
  } {
    const changedProperties: string[] = []
    const addedProperties: string[] = []
    const removedProperties: string[] = []
    
    const oldKeys = Object.keys(oldSnapshot.state)
    const newKeys = Object.keys(newSnapshot.state)
    
    // Find changed properties
    for (const key of oldKeys) {
      if (key in newSnapshot.state && oldSnapshot.state[key] !== newSnapshot.state[key]) {
        changedProperties.push(key)
      }
    }
    
    // Find added properties
    for (const key of newKeys) {
      if (!(key in oldSnapshot.state)) {
        addedProperties.push(key)
      }
    }
    
    // Find removed properties
    for (const key of oldKeys) {
      if (!(key in newSnapshot.state)) {
        removedProperties.push(key)
      }
    }
    
    return {
      changedProperties,
      addedProperties,
      removedProperties,
      updateCount: newSnapshot.updateCount - oldSnapshot.updateCount
    }
  }
}