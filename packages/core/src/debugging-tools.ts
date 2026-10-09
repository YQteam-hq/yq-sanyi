import { State, Derived, Signal } from './index.js'

export interface DebugConfig {
  enabled: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  performance: boolean
  stateChanges: boolean
  renderTraces: boolean
  componentTree: boolean
  timeTravel: boolean
}

export interface ComponentDebugInfo {
  id: string
  name: string
  state: any
  props: any
  children: ComponentDebugInfo[]
  renderCount: number
  lastRenderTime: number
  errors: Error[]
  dependencies: string[]
}

export interface StateChange {
  timestamp: number
  path: string
  oldValue: any
  newValue: any
  componentId?: string
  trace?: string
}

export interface RenderTrace {
  timestamp: number
  componentId: string
  renderTime: number
  stateChanges: StateChange[]
  children: RenderTrace[]
}

export class DebugTools {
  private static config: DebugConfig = {
    enabled: false,
    logLevel: 'info',
    performance: true,
    stateChanges: true,
    renderTraces: true,
    componentTree: true,
    timeTravel: false
  }

  private static componentRegistry = new Map<string, ComponentDebugInfo>()
  private static stateHistory: StateChange[] = []
  private static renderTraces: RenderTrace[] = []
  private static timeTravelStack: StateChange[][] = []
  private static timeTravelIndex = -1

  // Configuration
  static configure(config: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...config }
    
    if (this.config.enabled) {
      this.enableDebugMode()
    } else {
      this.disableDebugMode()
    }
  }

  static getConfig(): DebugConfig {
    return { ...this.config }
  }

  // Debug mode management
  static enableDebugMode(): void {
    this.config.enabled = true
    console.log('[yq:debug] Debug mode enabled')
    
    // Enable performance monitoring
    if (this.config.performance) {
      this.enablePerformanceMonitoring()
    }
    
    // Enable state change tracking
    if (this.config.stateChanges) {
      this.enableStateChangeTracking()
    }
    
    // Enable render tracing
    if (this.config.renderTraces) {
      this.enableRenderTracing()
    }
  }

  static disableDebugMode(): void {
    this.config.enabled = false
    console.log('[yq:debug] Debug mode disabled')
    
    // Clean up debug listeners
    this.componentRegistry.clear()
    this.stateHistory = []
    this.renderTraces = []
  }

  // Component debugging
  static registerComponent(componentId: string, name: string, state: any, props: any): void {
    if (!this.config.enabled) return

    const debugInfo: ComponentDebugInfo = {
      id: componentId,
      name,
      state: { ...state },
      props: { ...props },
      children: [],
      renderCount: 0,
      lastRenderTime: 0,
      errors: [],
      dependencies: []
    }

    this.componentRegistry.set(componentId, debugInfo)
    this.log('debug', `Component registered: ${name} (${componentId})`)
  }

  static updateComponentState(componentId: string, state: any): void {
    if (!this.config.enabled) return

    const component = this.componentRegistry.get(componentId)
    if (component) {
      component.state = { ...state }
      this.log('debug', `Component state updated: ${component.name}`)
    }
  }

  static recordComponentRender(componentId: string, renderTime: number): void {
    if (!this.config.enabled) return

    const component = this.componentRegistry.get(componentId)
    if (component) {
      component.renderCount++
      component.lastRenderTime = renderTime
      
      if (this.config.renderTraces) {
        this.recordRenderTrace(componentId, renderTime)
      }
      
      this.log('debug', `Component rendered: ${component.name} (${renderTime}ms)`)
    }
  }

  static addComponentError(componentId: string, error: Error): void {
    if (!this.config.enabled) return

    const component = this.componentRegistry.get(componentId)
    if (component) {
      component.errors.push(error)
      this.log('error', `Component error: ${component.name} - ${error.message}`)
    }
  }

  // State change tracking
  static trackStateChange(path: string, oldValue: any, newValue: any, componentId?: string): void {
    if (!this.config.enabled || !this.config.stateChanges) return

    const change: StateChange = {
      timestamp: Date.now(),
      path,
      oldValue,
      newValue,
      componentId,
      trace: this.getStackTrace()
    }

    this.stateHistory.push(change)
    
    // Limit history size
    if (this.stateHistory.length > 1000) {
      this.stateHistory.shift()
    }

    this.log('debug', `State changed: ${path}`, { oldValue, newValue })
  }

  // Render tracing
  private static recordRenderTrace(componentId: string, renderTime: number): void {
    const trace: RenderTrace = {
      timestamp: Date.now(),
      componentId,
      renderTime,
      stateChanges: this.stateHistory.slice(-10), // Last 10 changes
      children: []
    }

    this.renderTraces.push(trace)
    
    // Limit traces size
    if (this.renderTraces.length > 100) {
      this.renderTraces.shift()
    }
  }

  // Performance monitoring
  private static enablePerformanceMonitoring(): void {
    // Monkey patch performance monitoring
    const originalConsoleTime = console.time
    const originalConsoleTimeEnd = console.timeEnd

    console.time = (label: string) => {
      if (this.config.enabled) {
        this.log('debug', `Performance timer started: ${label}`)
      }
      originalConsoleTime(label)
    }

    console.timeEnd = (label: string) => {
      const duration = performance.now()
      if (this.config.enabled) {
        this.log('debug', `Performance timer ended: ${label} (${duration}ms)`)
      }
      originalConsoleTimeEnd(label)
    }
  }

  // State change tracking
  private static enableStateChangeTracking(): void {
    // Track state changes for all signals
    const originalSignalSet = Signal.prototype.set
    Signal.prototype.set = function<T>(this: Signal<T>, next: T): void {
      const oldValue = this.peek()
      const result = originalSignalSet.call(this, next)
      
      if (this.config.enabled && this.config.stateChanges) {
        DebugTools.trackStateChange(
          this.constructor.name,
          oldValue,
          next
        )
      }
      
      return result
    }
  }

  // Render tracing
  private static enableRenderTracing(): void {
    // Track component renders
    const originalRender = this.renderComponent
    this.renderComponent = function(componentId: string, template: string, state: any) {
      const startTime = performance.now()
      
      try {
        const result = originalRender.call(this, componentId, template, state)
        const endTime = performance.now()
        
        if (this.config.enabled && this.config.renderTraces) {
          this.recordComponentRender(componentId, endTime - startTime)
        }
        
        return result
      } catch (error) {
        if (this.config.enabled) {
          this.addComponentError(componentId, error as Error)
        }
        throw error
      }
    }
  }

  // Time travel debugging
  static startTimeTravel(): void {
    if (!this.config.enabled || !this.config.timeTravel) return

    this.timeTravelStack = this.stateHistory.map(change => ({ ...change }))
    this.timeTravelIndex = this.timeTravelStack.length - 1
    this.log('info', 'Time travel started')
  }

  static undo(): void {
    if (!this.config.enabled || !this.config.timeTravel || this.timeTravelIndex <= 0) return

    this.timeTravelIndex--
    this.applyTimeTravelState(this.timeTravelStack[this.timeTravelIndex])
    this.log('info', 'Time travel undone')
  }

  static redo(): void {
    if (!this.config.enabled || !this.config.timeTravel || this.timeTravelIndex >= this.timeTravelStack.length - 1) return

    this.timeTravelIndex++
    this.applyTimeTravelState(this.timeTravelStack[this.timeTravelIndex])
    this.log('info', 'Time travel redone')
  }

  private static applyTimeTravelState(state: StateChange): void {
    // Apply state changes to revert to previous state
    // This is a simplified version - in practice, you'd need more sophisticated state management
    this.log('debug', 'Applying time travel state', state)
  }

  // Component tree visualization
  static getComponentTree(): ComponentDebugInfo[] {
    if (!this.config.enabled || !this.config.componentTree) return []

    const rootComponents: ComponentDebugInfo[] = []
    
    for (const component of this.componentRegistry.values()) {
      if (!component.dependencies.length) {
        rootComponents.push(component)
      }
    }

    return rootComponents
  }

  // Debug utilities
  static log(level: 'error' | 'warn' | 'info' | 'debug', message: string, data?: any): void {
    if (!this.config.enabled) return
    if (this.logLevels.indexOf(level) > this.logLevels.indexOf(this.config.logLevel)) return

    const timestamp = new Date().toISOString()
    const logMessage = `[yq:debug] [${timestamp}] [${level.toUpperCase()}] ${message}`

    switch (level) {
      case 'error':
        console.error(logMessage, data)
        break
      case 'warn':
        console.warn(logMessage, data)
        break
      case 'info':
        console.info(logMessage, data)
        break
      case 'debug':
        console.debug(logMessage, data)
        break
    }
  }

  private static logLevels = ['error', 'warn', 'info', 'debug']

  private static getStackTrace(): string {
    const stack = new Error().stack
    if (!stack) return 'No stack trace available'
    
    // Remove the first two lines (Error and getStackTrace)
    const lines = stack.split('\n')
    return lines.slice(2).join('\n')
  }

  // Debug UI
  static createDebugPanel(): HTMLElement {
    const panel = document.createElement('div')
    panel.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 400px;
      height: 100vh;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      font-family: monospace;
      font-size: 12px;
      overflow-y: auto;
      z-index: 999999;
      padding: 20px;
      box-sizing: border-box;
    `

    const title = document.createElement('h3')
    title.textContent = 'yq-sanyi Debug Panel'
    title.style.marginTop = '0'
    panel.appendChild(title)

    const toggleBtn = document.createElement('button')
    toggleBtn.textContent = 'Toggle Debug'
    toggleBtn.style.cssText = `
      background: #667eea;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 16px;
    `
    toggleBtn.onclick = () => {
      this.config.enabled = !this.config.enabled
      if (this.config.enabled) {
        this.enableDebugMode()
      } else {
        this.disableDebugMode()
      }
    }
    panel.appendChild(toggleBtn)

    // Component tree
    const componentTree = this.createComponentTreeElement()
    panel.appendChild(componentTree)

    // State history
    const stateHistory = this.createStateHistoryElement()
    panel.appendChild(stateHistory)

    // Performance metrics
    const performanceMetrics = this.createPerformanceMetricsElement()
    panel.appendChild(performanceMetrics)

    return panel
  }

  private static createComponentTreeElement(): HTMLElement {
    const container = document.createElement('div')
    container.style.marginBottom = '20px'

    const title = document.createElement('h4')
    title.textContent = 'Component Tree'
    title.style.marginBottom = '10px'
    container.appendChild(title)

    const tree = document.createElement('div')
    tree.style.whiteSpace = 'pre-wrap'
    tree.style.fontSize = '11px'
    tree.style.lineHeight = '1.4'
    tree.style.color = '#ccc'

    const components = this.getComponentTree()
    tree.textContent = JSON.stringify(components, null, 2)
    container.appendChild(tree)

    return container
  }

  private static createStateHistoryElement(): HTMLElement {
    const container = document.createElement('div')
    container.style.marginBottom = '20px'

    const title = document.createElement('h4')
    title.textContent = 'State History'
    title.style.marginBottom = '10px'
    container.appendChild(title)

    const history = document.createElement('div')
    history.style.whiteSpace = 'pre-wrap'
    history.style.fontSize = '11px'
    history.style.lineHeight = '1.4'
    history.style.color = '#ccc'
    history.style.maxHeight = '200px'
    history.style.overflowY = 'auto'

    const recentChanges = this.stateHistory.slice(-20)
    history.textContent = JSON.stringify(recentChanges, null, 2)
    container.appendChild(history)

    return container
  }

  private static createPerformanceMetricsElement(): HTMLElement {
    const container = document.createElement('div')
    container.style.marginBottom = '20px'

    const title = document.createElement('h4')
    title.textContent = 'Performance Metrics'
    title.style.marginBottom = '10px'
    container.appendChild(title)

    const metrics = document.createElement('div')
    metrics.style.fontSize = '11px'
    metrics.style.lineHeight = '1.4'
    metrics.style.color = '#ccc'

    let metricsText = ''
    for (const component of this.componentRegistry.values()) {
      metricsText += `${component.name}: ${component.renderCount} renders, avg: ${component.lastRenderTime}ms\n`
    }
    metrics.textContent = metricsText
    container.appendChild(metrics)

    return container
  }

  // Export debugging data
  static exportDebugData(): {
    components: ComponentDebugInfo[]
    stateHistory: StateChange[]
    renderTraces: RenderTrace[]
    config: DebugConfig
  } {
    return {
      components: Array.from(this.componentRegistry.values()),
      stateHistory: this.stateHistory,
      renderTraces: this.renderTraces,
      config: this.config
    }
  }

  // Cleanup
  static cleanup(): void {
    this.disableDebugMode()
    this.componentRegistry.clear()
    this.stateHistory = []
    this.renderTraces = []
    this.timeTravelStack = []
    this.timeTravelIndex = -1
  }
}

// Debug utilities
export const DebugUtils = {
  // Debug component rendering
  debugComponent: (componentId: string, name: string, state: any, props: any) => {
    DebugTools.registerComponent(componentId, name, state, props)
    return (newState: any) => {
      DebugTools.updateComponentState(componentId, newState)
    }
  },

  // Debug state changes
  debugState: (state: State<any>, name: string) => {
    const unsubscribe = state.subscribe((newValue, oldValue) => {
      DebugTools.trackStateChange(name, oldValue, newValue)
    })
    return unsubscribe
  },

  // Performance profiler
  profile: (name: string, fn: () => void) => {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    DebugTools.log('info', `Profile: ${name} took ${end - start}ms`)
    return result
  },

  // Memory profiler
  memoryProfile: () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      DebugTools.log('info', 'Memory usage:', {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      })
    }
  }
}