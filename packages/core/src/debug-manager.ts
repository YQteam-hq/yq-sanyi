import { ComponentInstance } from './index'
import { DebugPanel, DebugInfo, DebugPanelOptions, PerformanceMetrics } from './debug-panel'

export interface DebugManagerOptions {
  enabled?: boolean
  autoShow?: boolean
  captureUpdates?: boolean
  captureErrors?: boolean
  captureWarnings?: boolean
  performanceTracking?: boolean
  maxLogs?: number
  panel?: DebugPanelOptions
}

export interface DebugEvent {
  timestamp: number
  type: 'mount' | 'update' | 'unmount' | 'error' | 'warning' | 'effect'
  componentName: string
  data?: any
  error?: Error
}

export class DebugManager {
  private panel: DebugPanel | null = null
  private options: Required<DebugManagerOptions>
  private events: DebugEvent[] = []
  private componentInstances: Map<string, ComponentInstance> = new Map()
  private registeredInstances: WeakSet<ComponentInstance> = new WeakSet()
  private startTime: number = Date.now()
  private updateCount: number = 0
  private effectCount: number = 0
  private capturedConsole:
    | { error: typeof console.error; warn: typeof console.warn; log: typeof console.log }
    | null = null
  private capturingConsole = false
  private intervalSamples: number[] = []
  private lastIntervalSample: number | null = null
  private maxIntervalSample: number | null = null
  private lastUpdateAt: Map<string, number> = new Map()
  private frameCount = 0
  private frameSamplerId: number | null = null
  private frameSamplerStart = 0

  constructor(options: DebugManagerOptions = {}) {
    this.options = {
      enabled: true,
      autoShow: true,
      captureUpdates: true,
      captureErrors: true,
      captureWarnings: true,
      performanceTracking: true,
      maxLogs: 1000,
      panel: {},
      ...options
    }

    if (this.options.enabled) {
      this.initialize()
    }
  }

  private initialize(): void {
    const panelOptions: DebugPanelOptions = {
      position: this.options.panel.position || 'top-right',
      theme: this.options.panel.theme || 'dark',
      autoShow: this.options.autoShow,
      showOnMount: this.options.panel.showOnMount !== false,
      showOnError: this.options.panel.showOnError !== false
    }
    if (this.options.panel.shortcut !== undefined) {
      panelOptions.shortcut = this.options.panel.shortcut
    }
    if (this.options.panel.maxLogs !== undefined) {
      panelOptions.maxLogs = this.options.panel.maxLogs
    }
    if (this.options.panel.title !== undefined) {
      panelOptions.title = this.options.panel.title
    }

    this.panel = new DebugPanel(panelOptions)

    this.panel.startAutoUpdate(1000)

    this.setupConsoleCapture()
    this.startFrameSampler()

    this.logEvent({
      timestamp: Date.now(),
      type: 'effect',
      componentName: 'DebugManager',
      data: { message: 'Debug Manager initialized' }
    })
  }

  private setupConsoleCapture(): void {
    if (this.capturedConsole) {
      return
    }

    const original = {
      error: console.error,
      warn: console.warn,
      log: console.log
    }
    this.capturedConsole = original

    console.error = (...args) => {
      original.error.apply(console, args)
      if (!this.options.captureErrors || this.capturingConsole) {
        return
      }
      this.capturingConsole = true
      try {
        this.logEvent({
          timestamp: Date.now(),
          type: 'error',
          componentName: 'Console',
          error: args[0] instanceof Error ? args[0] : new Error(args.join(' '))
        })
      } finally {
        this.capturingConsole = false
      }
    }

    console.warn = (...args) => {
      original.warn.apply(console, args)
      if (!this.options.captureWarnings || this.capturingConsole) {
        return
      }
      this.capturingConsole = true
      try {
        this.logEvent({
          timestamp: Date.now(),
          type: 'warning',
          componentName: 'Console',
          data: { message: args.join(' ') }
        })
      } finally {
        this.capturingConsole = false
      }
    }

    console.log = (...args) => {
      original.log.apply(console, args)
    }
  }

  private restoreConsoleCapture(): void {
    if (!this.capturedConsole) {
      return
    }
    console.error = this.capturedConsole.error
    console.warn = this.capturedConsole.warn
    console.log = this.capturedConsole.log
    this.capturedConsole = null
  }

  public registerComponent(instance: ComponentInstance): void {
    if (!this.options.enabled) return
    if (this.registeredInstances.has(instance)) return

    this.registeredInstances.add(instance)
    this.componentInstances.set(instance.name, instance)

    this.addLifecycleListeners(instance)

    this.logEvent({
      timestamp: Date.now(),
      type: 'effect',
      componentName: 'DebugManager',
      data: { message: `Component registered: ${instance.name}` }
    })
  }

  private addLifecycleListeners(instance: ComponentInstance): void {
    const hooks = instance.lifecycleHooks

    const originalOnMount = hooks.onMount
    hooks.onMount = () => {
      if (originalOnMount) {
        originalOnMount()
      }
      this.lastUpdateAt.set(instance.name, this.now())
      this.logEvent({
        timestamp: Date.now(),
        type: 'mount',
        componentName: instance.name,
        data: { timestamp: Date.now() }
      })
    }

    const originalOnUpdate = hooks.onUpdate
    hooks.onUpdate = () => {
      const at = this.now()
      const previous = this.lastUpdateAt.get(instance.name)
      if (typeof previous === 'number') {
        this.recordUpdateInterval(at - previous)
      }
      this.lastUpdateAt.set(instance.name, at)
      if (originalOnUpdate) {
        originalOnUpdate()
      }
      this.updateCount++
      this.logEvent({
        timestamp: Date.now(),
        type: 'update',
        componentName: instance.name,
        data: { timestamp: Date.now(), updateCount: this.updateCount }
      })
    }

    const originalOnUnmount = hooks.onUnmount
    hooks.onUnmount = () => {
      if (originalOnUnmount) {
        originalOnUnmount()
      }
      this.lastUpdateAt.delete(instance.name)
      this.logEvent({
        timestamp: Date.now(),
        type: 'unmount',
        componentName: instance.name,
        data: { timestamp: Date.now() }
      })
    }
  }

  public logEvent(event: DebugEvent): void {
    if (!this.options.enabled) return

    if (!event.timestamp) {
      event.timestamp = Date.now()
    }

    this.events.push(event)

    if (this.events.length > this.options.maxLogs) {
      this.events = this.events.slice(-this.options.maxLogs)
    }

    this.updateDebugPanel()
  }

  public captureError(componentName: string, error: Error): void {
    if (!this.options.captureErrors) return

    this.logEvent({
      timestamp: Date.now(),
      type: 'error',
      componentName,
      error
    })
  }

  public captureWarning(componentName: string, message: string): void {
    if (!this.options.captureWarnings) return

    this.logEvent({
      timestamp: Date.now(),
      type: 'warning',
      componentName,
      data: { message }
    })
  }

  public trackEffect(componentName: string): void {
    this.effectCount++
    this.logEvent({
      timestamp: Date.now(),
      type: 'effect',
      componentName,
      data: { timestamp: Date.now(), effectCount: this.effectCount }
    })
  }

  public getDebugInfo(): DebugInfo {
    const componentTree = this.getComponentTree()
    const updateLogs = this.getUpdateLogs()
    const stateSnapshot = this.getStateSnapshot()
    const performanceMetrics = this.getPerformanceMetrics()
    const errors = this.getErrors()
    const warnings = this.getWarnings()

    return {
      componentTree,
      updateLogs,
      stateSnapshot,
      performanceMetrics,
      errors,
      warnings
    }
  }

  private getComponentTree(): any {
    const tree: any = {}

    for (const [name, instance] of this.componentInstances) {
      tree[name] = {
        name,
        lifecycleState: instance.lifecycleState,
        children: instance.children.map(child => child.name),
        hasError: instance.errorInfo?.hasError || false,
        mountedAt: this.getMountTime(name),
        lastUpdate: this.getLastUpdateTime(name)
      }
    }

    return tree
  }

  private getUpdateLogs(): any[] {
    return this.events
      .filter(event => event.type === 'update' || event.type === 'mount' || event.type === 'unmount')
      .slice(-50)
  }

  private getStateSnapshot(): Record<string, any> {
    const snapshot: Record<string, any> = {}

    for (const [name, instance] of this.componentInstances) {
      snapshot[name] = {
        state: { ...instance.state },
        derivedStates: { ...instance.derivedStates },
        lifecycleState: instance.lifecycleState,
        errorInfo: instance.errorInfo
      }
    }

    return snapshot
  }

  private getPerformanceMetrics(): PerformanceMetrics {
    return {
      updateCount: this.updateCount,
      effectCount: this.effectCount,
      memoryUsage: this.getMemoryUsage(),
      uptime: Date.now() - this.startTime,
      fps: this.getEstimatedFPS(),
      lastUpdateInterval: this.lastIntervalSample,
      averageUpdateInterval: this.averageUpdateInterval(),
      maxUpdateInterval: this.maxIntervalSample
    }
  }

  private getErrors(): any[] {
    return this.events
      .filter(event => event.type === 'error')
      .slice(-10)
  }

  private getWarnings(): any[] {
    return this.events
      .filter(event => event.type === 'warning')
      .slice(-10)
  }

  private getMountTime(componentName: string): number | null {
    const mountEvent = this.events.find(event => 
      event.type === 'mount' && event.componentName === componentName
    )
    return mountEvent?.timestamp || null
  }

  private getLastUpdateTime(componentName: string): number | null {
    const updateEvent = this.events
      .filter(event => 
        (event.type === 'update' || event.type === 'mount') && 
        event.componentName === componentName
      )
      .sort((a, b) => b.timestamp - a.timestamp)[0]
    
    return updateEvent?.timestamp || null
  }

  private now(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()
  }

  private recordUpdateInterval(duration: number): void {
    if (!Number.isFinite(duration) || duration < 0) {
      return
    }
    this.lastIntervalSample = duration
    this.maxIntervalSample =
      this.maxIntervalSample === null ? duration : Math.max(this.maxIntervalSample, duration)
    this.intervalSamples.push(duration)
    if (this.intervalSamples.length > 100) {
      this.intervalSamples = this.intervalSamples.slice(-100)
    }
  }

  private averageUpdateInterval(): number | null {
    if (this.intervalSamples.length === 0) {
      return null
    }
    let total = 0
    for (const sample of this.intervalSamples) {
      total += sample
    }
    return total / this.intervalSamples.length
  }

  private startFrameSampler(): void {
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null
    if (!raf) {
      return
    }
    this.frameSamplerStart = this.now()
    this.frameCount = 0
    const tick = (): void => {
      if (this.frameSamplerId === null) {
        return
      }
      this.frameCount++
      this.frameSamplerId = raf(tick)
    }
    this.frameSamplerId = raf(tick)
  }

  private stopFrameSampler(): void {
    if (this.frameSamplerId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.frameSamplerId)
    }
    this.frameSamplerId = null
  }

  private getEstimatedFPS(): number | null {
    if (this.frameSamplerId === null) {
      return null
    }
    const elapsed = this.now() - this.frameSamplerStart
    if (elapsed <= 0) {
      return null
    }
    return Math.min(240, (this.frameCount / elapsed) * 1000)
  }

  private getMemoryUsage(): number {
    const metrics = typeof performance !== 'undefined' ? (performance as any).memory : undefined
    if (metrics && typeof metrics.usedJSHeapSize === 'number') {
      return Math.round(metrics.usedJSHeapSize / 1024 / 1024)
    }
    return 0
  }

  private updateDebugPanel(): void {
    if (this.panel) {
      const debugInfo = this.getDebugInfo()
      this.panel.updateDebugInfo(debugInfo)
    }
  }

  public showPanel(): void {
    if (this.panel) {
      this.panel.show()
    }
  }

  public hidePanel(): void {
    if (this.panel) {
      this.panel.hide()
    }
  }

  public togglePanel(): void {
    if (this.panel) {
      this.panel.toggle()
    }
  }

  public isPanelVisible(): boolean {
    return this.panel ? this.panel.isVisible : false
  }

  public getPanel(): DebugPanel | null {
    return this.panel
  }

  public clearLogs(): void {
    this.events = []
    this.updateCount = 0
    this.effectCount = 0
    this.updateDebugPanel()
  }

  public exportDebugData(): string {
    const debugInfo = this.getDebugInfo()
    return JSON.stringify({
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      debugInfo,
      events: this.events
    }, null, 2)
  }

  public destroy(): void {
    this.stopFrameSampler()

    if (this.panel) {
      this.panel.destroy()
      this.panel = null
    }

    this.restoreConsoleCapture()

    this.componentInstances.clear()
    this.registeredInstances = new WeakSet()
    this.lastUpdateAt.clear()
    this.intervalSamples = []
    this.lastIntervalSample = null
    this.maxIntervalSample = null
    this.updateCount = 0
    this.effectCount = 0

    this.events = []
  }

  private static instance: DebugManager | null = null

  public static getInstance(options?: DebugManagerOptions): DebugManager {
    if (!DebugManager.instance) {
      DebugManager.instance = new DebugManager(options)
    }
    return DebugManager.instance
  }

  public static destroyInstance(): void {
    if (DebugManager.instance) {
      DebugManager.instance.destroy()
      DebugManager.instance = null
    }
  }
}