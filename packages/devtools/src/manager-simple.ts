export const DebugManagerOptions: Record<string, any> = {}

export class DebugManager {
  private options: {
    enabled: boolean
    autoShow: boolean
    captureUpdates: boolean
    captureErrors: boolean
    captureWarnings: boolean
    performanceTracking: boolean
    maxLogs: number
  }
  private events: any[] = []
  private componentInstances: Map<string, any> = new Map()
  private startTime: number = Date.now()
  private updateCount: number = 0
  private effectCount: number = 0

  constructor(options: any = {}) {
    this.options = {
      enabled: true,
      autoShow: true,
      captureUpdates: true,
      captureErrors: true,
      captureWarnings: true,
      performanceTracking: true,
      maxLogs: 1000,
      ...options
    }

    if (this.options.enabled) {
      this.initialize()
    }
  }

  initialize(): void {
    this.logEvent({
      timestamp: Date.now(),
      type: 'effect',
      componentName: 'DebugManager',
      data: { message: 'Debug Manager initialized' }
    })
  }

  logEvent(event: any): void {
    if (!this.options.enabled) return
    
    event.id = this.events.length
    this.events.push(event)
    
    if (this.events.length > this.options.maxLogs) {
      this.events.shift()
    }
  }

  trackComponent(component: any): void {
    if (!this.options.enabled) return
    
    this.componentInstances.set(component.name, {
      instance: component,
      mountTime: Date.now(),
      updateCount: 0,
      errorCount: 0
    })
    
    this.logEvent({
      timestamp: Date.now(),
      type: 'component',
      componentName: component.name,
      data: { action: 'mount', state: component.state }
    })
  }

  trackUpdate(component: any, oldState: any, newState: any): void {
    if (!this.options.enabled || !this.options.captureUpdates) return
    
    this.updateCount++
    
    const componentInfo = this.componentInstances.get(component.name)
    if (componentInfo) {
      componentInfo.updateCount++
    }
    
    this.logEvent({
      timestamp: Date.now(),
      type: 'update',
      componentName: component.name,
      data: { 
        oldState, 
        newState, 
        updateCount: this.updateCount 
      }
    })
  }

  trackError(component: any, error: Error, stack?: string): void {
    if (!this.options.enabled || !this.options.captureErrors) return
    
    const componentInfo = this.componentInstances.get(component.name)
    if (componentInfo) {
      componentInfo.errorCount++
    }
    
    this.logEvent({
      timestamp: Date.now(),
      type: 'error',
      componentName: component.name,
      data: { 
        error: error.message, 
        stack,
        errorCount: componentInfo ? componentInfo.errorCount : 1
      }
    })
  }

  trackEffect(componentName: string, effect?: any): void {
    if (!this.options.enabled || !this.options.captureUpdates) return
    
    this.effectCount++
    
    this.logEvent({
      timestamp: Date.now(),
      type: 'effect',
      componentName,
      data: { 
        effectCount: this.effectCount,
        dependencies: effect?.dependencies?.length || 0
      }
    })
  }

  getComponentStats(componentName: string): any {
    return this.componentInstances.get(componentName)
  }

  getAllComponents(): any[] {
    return Array.from(this.componentInstances.entries())
  }

  getLogs(filter: any = {}): any[] {
    let logs = [...this.events]
    
    if (filter.type) {
      logs = logs.filter((log: any) => log.type === filter.type)
    }
    
    if (filter.componentName) {
      logs = logs.filter((log: any) => log.componentName === filter.componentName)
    }
    
    if (filter.since) {
      logs = logs.filter((log: any) => log.timestamp >= filter.since)
    }
    
    return logs
  }

  clearLogs(): void {
    this.events = []
  }

  reset(): void {
    this.events = []
    this.componentInstances.clear()
    this.startTime = Date.now()
    this.updateCount = 0
    this.effectCount = 0
  }

  startPerformance(componentName: string, operation: string): any {
    if (!this.options.enabled || !this.options.performanceTracking) return null
    
    return {
      startTime: Date.now(),
      componentName,
      operation,
      id: `${componentName}-${operation}-${Date.now()}`
    }
  }

  endPerformance(perf: any): number {
    if (!this.options.enabled || !this.options.performanceTracking) return 0
    
    const duration = Date.now() - perf.startTime
    
    this.logEvent({
      timestamp: Date.now(),
      type: 'performance',
      componentName: perf.componentName,
      data: {
        operation: perf.operation,
        duration,
        timestamp: perf.startTime
      }
    })
    
    return duration
  }

  exportLogs(): any {
    return {
      timestamp: Date.now(),
      startTime: this.startTime,
      events: this.events,
      componentInstances: Array.from(this.componentInstances.entries()),
      stats: {
        totalEvents: this.events.length,
        totalUpdates: this.updateCount,
        totalEffects: this.effectCount,
        componentCount: this.componentInstances.size
      }
    }
  }

  showPanel(): void {}
  hidePanel(): void {}
  togglePanel(): void {}
  exportDebugData(): string { return '' }
  destroy(): void {
    this.events = []
    this.componentInstances.clear()
  }

  static getInstance(options?: any): DebugManager {
    if (!globalDebugManager) {
      globalDebugManager = new DebugManager(options)
    }
    return globalDebugManager
  }

  static destroyInstance(): void {
    globalDebugManager = null
  }
}

let globalDebugManager: DebugManager | null = null

export function getDebugManager(options: any = {}): DebugManager {
  if (!globalDebugManager) {
    globalDebugManager = new DebugManager(options)
  }
  return globalDebugManager
}

export function resetDebugManager(): void {
  globalDebugManager = null
}