import { State, Derived, ComponentDefinition } from './index.js'

export interface PerformanceMetrics {
  renderTime: number
  updateTime: number
  memoryUsage: number
  domOperations: number
  cacheHits: number
  cacheMisses: number
  virtualizationEnabled: boolean
  lazyLoadingEnabled: boolean
}

export interface OptimizationOptions {
  enableVirtualization?: boolean
  enableLazyLoading?: boolean
  enableCaching?: boolean
  enableBatching?: boolean
  enableDebouncing?: boolean
  enableThrottling?: boolean
  cacheSize?: number
  virtualizationThreshold?: number
  lazyLoadingThreshold?: number
}

export interface VirtualizationConfig {
  itemHeight: number
  containerHeight: number
  overscan?: number
  enableDynamicSizing?: boolean
  enableSmoothScrolling?: boolean
}

export interface LazyLoadingConfig {
  threshold?: number
  rootMargin?: string
  enableIntersectionObserver?: boolean
  enablePreloading?: boolean
  preloadCount?: number
}

export interface CacheEntry {
  key: string
  value: any
  timestamp: number
  ttl?: number
  hits: number
}

export interface RenderBatch {
  id: string
  operations: Array<{
    type: 'update' | 'insert' | 'remove' | 'move'
    target: Element
    data?: any
  }>
  startTime: number
  endTime?: number
}

export class PerformanceOptimizer {
  private static metrics: PerformanceMetrics = {
    renderTime: 0,
    updateTime: 0,
    memoryUsage: 0,
    domOperations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    virtualizationEnabled: false,
    lazyLoadingEnabled: false
  }

  private static cache = new Map<string, CacheEntry>()
  private static renderBatches: RenderBatch[] = []
  private static virtualizationConfigs = new Map<string, VirtualizationConfig>()
  private static lazyLoadingConfigs = new Map<string, LazyLoadingConfig>()
  private static observers: Map<string, IntersectionObserver> = new Map()

  // Performance monitoring
  static startRenderTimer(): () => number {
    const startTime = performance.now()
    return () => {
      const endTime = performance.now()
      const duration = endTime - startTime
      this.metrics.renderTime += duration
      return duration
    }
  }

  static startUpdateTimer(): () => number {
    const startTime = performance.now()
    return () => {
      const endTime = performance.now()
      const duration = endTime - startTime
      this.metrics.updateTime += duration
      return duration
    }
  }

  static recordDOMOperation(operation: 'update' | 'insert' | 'remove' | 'move'): void {
    this.metrics.domOperations++
  }

  static getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  static resetMetrics(): void {
    this.metrics = {
      renderTime: 0,
      updateTime: 0,
      memoryUsage: 0,
      domOperations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      virtualizationEnabled: false,
      lazyLoadingEnabled: false
    }
  }

  // Caching system
  static configureCache(options: { size?: number; ttl?: number } = {}): void {
    const { size = 100, ttl } = options
    
    // Limit cache size
    if (this.cache.size > size) {
      const entries = Array.from(this.cache.entries())
      entries.sort((a, b) => a[1].hits - b[1].hits)
      const toRemove = entries.slice(0, this.cache.size - size)
      toRemove.forEach(([key]) => this.cache.delete(key))
    }

    // Set TTL for all entries
    if (ttl) {
      for (const entry of this.cache.values()) {
        entry.ttl = ttl
      }
    }
  }

  static getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.metrics.cacheMisses++
      return null
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.metrics.cacheMisses++
      return null
    }

    entry.hits++
    this.metrics.cacheHits++
    return entry.value
  }

  static setToCache<T>(key: string, value: T, ttl?: number): void {
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      ttl,
      hits: 0
    }

    this.cache.set(key, entry)
    
    // Auto-clean expired entries
    if (this.cache.size > 1000) {
      this.cleanExpiredCache()
    }
  }

  static cleanExpiredCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }

  // Virtualization
  static enableVirtualization(
    componentId: string,
    config: VirtualizationConfig
  ): void {
    this.virtualizationConfigs.set(componentId, config)
    this.metrics.virtualizationEnabled = true
  }

  static getVirtualizationConfig(componentId: string): VirtualizationConfig | undefined {
    return this.virtualizationConfigs.get(componentId)
  }

  static calculateVisibleItems(
    scrollTop: number,
    containerHeight: number,
    itemHeight: number,
    totalItems: number,
    overscan: number = 5
  ): { startIndex: number; endIndex: number; visibleCount: number } {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      totalItems - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    
    return {
      startIndex,
      endIndex,
      visibleCount: endIndex - startIndex + 1
    }
  }

  static createVirtualizedContainer(
    componentId: string,
    items: any[],
    renderItem: (item: any, index: number) => HTMLElement,
    config: VirtualizationConfig
  ): HTMLElement {
    const container = document.createElement('div')
    container.style.height = `${config.containerHeight}px`
    container.style.overflow = 'auto'
    container.style.position = 'relative'

    let scrollTop = 0
    let visibleItems: HTMLElement[] = []

    const updateVisibleItems = () => {
      const visible = this.calculateVisibleItems(
        scrollTop,
        config.containerHeight,
        config.itemHeight,
        items.length
      )

      // Remove items that are no longer visible
      visibleItems.forEach((item, index) => {
        if (index < visible.startIndex || index > visible.endIndex) {
          item.remove()
        }
      })

      // Add new visible items
      for (let i = visible.startIndex; i <= visible.endIndex; i++) {
        if (!visibleItems[i]) {
          const itemElement = renderItem(items[i], i)
          itemElement.style.position = 'absolute'
          itemElement.style.top = `${i * config.itemHeight}px`
          itemElement.style.width = '100%'
          itemElement.style.height = `${config.itemHeight}px`
          container.appendChild(itemElement)
          visibleItems[i] = itemElement
        }
      }

      // Update positions
      visibleItems.forEach((item, index) => {
        if (item && index >= visible.startIndex && index <= visible.endIndex) {
          item.style.top = `${index * config.itemHeight}px`
        }
      })
    }

    container.addEventListener('scroll', () => {
      scrollTop = container.scrollTop
      updateVisibleItems()
    })

    // Initial render
    updateVisibleItems()

    return container
  }

  // Lazy loading
  static enableLazyLoading(
    componentId: string,
    config: LazyLoadingConfig = {}
  ): void {
    const finalConfig: LazyLoadingConfig = {
      threshold: 0.1,
      rootMargin: '50px',
      enableIntersectionObserver: true,
      enablePreloading: false,
      preloadCount: 3,
      ...config
    }

    this.lazyLoadingConfigs.set(componentId, finalConfig)
    this.metrics.lazyLoadingEnabled = true
  }

  static getLazyLoadingConfig(componentId: string): LazyLoadingConfig | undefined {
    return this.lazyLoadingConfigs.get(componentId)
  }

  static createLazyLoader<T>(
    componentId: string,
    loadFn: () => Promise<T>,
    config: LazyLoadingConfig = {}
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              loadFn()
                .then((data) => {
                  resolve(data)
                  observer.disconnect()
                })
                .catch(reject)
            }
          })
        },
        {
          threshold: config.threshold || 0.1,
          rootMargin: config.rootMargin || '50px'
        }
      )

      // Create a placeholder element
      const placeholder = document.createElement('div')
      placeholder.style.height = '100px'
      placeholder.style.backgroundColor = '#f0f0f0'
      placeholder.style.display = 'flex'
      placeholder.style.alignItems = 'center'
      placeholder.style.justifyContent = 'center'
      placeholder.textContent = 'Loading...'

      // Observe the placeholder
      observer.observe(placeholder)

      return placeholder
    })
  }

  // Render batching
  static startBatch(): string {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const batch: RenderBatch = {
      id: batchId,
      operations: [],
      startTime: performance.now()
    }
    this.renderBatches.push(batch)
    return batchId
  }

  static addToBatch(batchId: string, operation: RenderBatch['operations'][0]): void {
    const batch = this.renderBatches.find(b => b.id === batchId)
    if (batch) {
      batch.operations.push(operation)
    }
  }

  static endBatch(batchId: string): void {
    const batch = this.renderBatches.find(b => b.id === batchId)
    if (batch) {
      batch.endTime = performance.now()
      this.executeBatch(batch)
    }
  }

  private static executeBatch(batch: RenderBatch): void {
    requestAnimationFrame(() => {
      batch.operations.forEach((operation) => {
        switch (operation.type) {
          case 'update':
            if (operation.target) {
              // Update element
              this.recordDOMOperation('update')
            }
            break
          case 'insert':
            if (operation.target && operation.data) {
              // Insert element
              this.recordDOMOperation('insert')
            }
            break
          case 'remove':
            if (operation.target) {
              // Remove element
              this.recordDOMOperation('remove')
            }
            break
          case 'move':
            if (operation.target && operation.data) {
              // Move element
              this.recordDOMOperation('move')
            }
            break
        }
      })
    })
  }

  // Performance optimization utilities
  static optimizeComponentRendering(
    component: ComponentDefinition,
    options: OptimizationOptions = {}
  ): ComponentDefinition {
    const optimizedComponent = { ...component }

    if (options.enableCaching) {
      // Add caching to component
      optimizedComponent.script = {
        ...optimizedComponent.script,
        methods: {
          ...optimizedComponent.script?.methods,
          getCachedData: (key: string) => this.getFromCache(key),
          setCachedData: (key: string, value: any) => this.setToCache(key, value)
        }
      }
    }

    if (options.enableDebouncing) {
      // Add debouncing to component methods
      optimizedComponent.script = {
        ...optimizedComponent.script,
        methods: {
          ...optimizedComponent.script?.methods,
          debouncedMethod: DebounceUtils.debounce(
            optimizedComponent.script?.methods?.method || (() => {}),
            300
          )
        }
      }
    }

    if (options.enableThrottling) {
      // Add throttling to component methods
      optimizedComponent.script = {
        ...optimizedComponent.script,
        methods: {
          ...optimizedComponent.script?.methods,
          throttledMethod: DebounceUtils.throttle(
            optimizedComponent.script?.methods?.method || (() => {}),
            100
          )
        }
      }
    }

    return optimizedComponent
  }

  static optimizeListRendering(
    items: any[],
    renderItem: (item: any, index: number) => HTMLElement,
    options: OptimizationOptions & { virtualization?: VirtualizationConfig } = {}
  ): HTMLElement {
    const container = document.createElement('div')

    if (options.virtualization) {
      this.enableVirtualization('virtual-list', options.virtualization)
      return this.createVirtualizedContainer(
        'virtual-list',
        items,
        renderItem,
        options.virtualization
      )
    }

    // Regular list optimization
    const fragment = document.createDocumentFragment()
    const batchId = this.startBatch()

    items.forEach((item, index) => {
      const element = renderItem(item, index)
      this.addToBatch(batchId, {
        type: 'insert',
        target: element,
        data: { item, index }
      })
      fragment.appendChild(element)
    })

    this.endBatch(batchId)
    container.appendChild(fragment)

    return container
  }

  // Memory optimization
  static optimizeMemoryUsage(): void {
    // Clean up cache
    this.cleanExpiredCache()

    // Clean up observers
    for (const [key, observer] of this.observers) {
      observer.disconnect()
      this.observers.delete(key)
    }

    // Clean up render batches
    this.renderBatches = this.renderBatches.filter(
      batch => batch.endTime && Date.now() - batch.endTime < 60000
    )

    // Force garbage collection (if available)
    if ((window as any).gc) {
      (window as any).gc()
    }
  }

  // Performance analysis
  static analyzePerformance(): {
    score: number
    recommendations: string[]
    bottlenecks: string[]
  } {
    const metrics = this.getMetrics()
    let score = 100
    const recommendations: string[] = []
    const bottlenecks: string[] = []

    // Analyze render time
    if (metrics.renderTime > 100) {
      score -= 20
      bottlenecks.push('High render time')
      recommendations.push('Consider enabling virtualization for large lists')
    }

    // Analyze update time
    if (metrics.updateTime > 50) {
      score -= 15
      bottlenecks.push('High update time')
      recommendations.push('Consider enabling batching for updates')
    }

    // Analyze DOM operations
    if (metrics.domOperations > 100) {
      score -= 10
      bottlenecks.push('High DOM operations count')
      recommendations.push('Consider reducing DOM manipulations')
    }

    // Analyze cache efficiency
    const totalCacheRequests = metrics.cacheHits + metrics.cacheMisses
    if (totalCacheRequests > 0) {
      const cacheHitRate = metrics.cacheHits / totalCacheRequests
      if (cacheHitRate < 0.5) {
        score -= 10
        bottlenecks.push('Low cache hit rate')
        recommendations.push('Consider optimizing cache keys and TTL')
      }
    }

    // Analyze virtualization
    if (metrics.virtualizationEnabled && metrics.domOperations > 50) {
      recommendations.push('Virtualization is enabled - consider optimizing item height')
    }

    // Analyze lazy loading
    if (metrics.lazyLoadingEnabled && metrics.domOperations > 30) {
      recommendations.push('Lazy loading is enabled - consider adjusting threshold')
    }

    return {
      score: Math.max(0, score),
      recommendations,
      bottlenecks
    }
  }

  // Cleanup
  static cleanup(): void {
    this.resetMetrics()
    this.cache.clear()
    this.renderBatches = []
    this.virtualizationConfigs.clear()
    this.lazyLoadingConfigs.clear()
    
    // Disconnect all observers
    for (const observer of this.observers.values()) {
      observer.disconnect()
    }
    this.observers.clear()
  }
}

// Performance optimization utilities
export const PerformanceUtils = {
  // Performance monitoring
  startRenderTimer: () => PerformanceOptimizer.startRenderTimer(),
  startUpdateTimer: () => PerformanceOptimizer.startUpdateTimer(),
  recordDOMOperation: (operation: 'update' | 'insert' | 'remove' | 'move') => 
    PerformanceOptimizer.recordDOMOperation(operation),
  
  // Caching
  getFromCache: <T>(key: string) => PerformanceOptimizer.getFromCache<T>(key),
  setToCache: <T>(key: string, value: T, ttl?: number) => 
    PerformanceOptimizer.setToCache<T>(key, value, ttl),
  
  // Virtualization
  enableVirtualization: (componentId: string, config: VirtualizationConfig) => 
    PerformanceOptimizer.enableVirtualization(componentId, config),
  calculateVisibleItems: (scrollTop: number, containerHeight: number, itemHeight: number, totalItems: number, overscan?: number) =>
    PerformanceOptimizer.calculateVisibleItems(scrollTop, containerHeight, itemHeight, totalItems, overscan),
  
  // Lazy loading
  enableLazyLoading: (componentId: string, config: LazyLoadingConfig) =>
    PerformanceOptimizer.enableLazyLoading(componentId, config),
  createLazyLoader: <T>(componentId: string, loadFn: () => Promise<T>, config: LazyLoadingConfig = {}) =>
    PerformanceOptimizer.createLazyLoader<T>(componentId, loadFn, config),
  
  // Optimization
  optimizeComponentRendering: (component: ComponentDefinition, options: OptimizationOptions = {}) =>
    PerformanceOptimizer.optimizeComponentRendering(component, options),
  optimizeListRendering: (items: any[], renderItem: (item: any, index: number) => HTMLElement, options: OptimizationOptions & { virtualization?: VirtualizationConfig } = {}) =>
    PerformanceOptimizer.optimizeListRendering(items, renderItem, options),
  
  // Analysis
  analyzePerformance: () => PerformanceOptimizer.analyzePerformance(),
  optimizeMemoryUsage: () => PerformanceOptimizer.optimizeMemoryUsage(),
  
  // Cleanup
  cleanup: () => PerformanceOptimizer.cleanup()
}