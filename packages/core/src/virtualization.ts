import { State, Derived, ComponentDefinition } from './index.js'

export interface VirtualizationItem {
  id: string | number
  data: any
  height?: number
  width?: number
  className?: string
  style?: string
}

export interface VirtualizationOptions {
  itemHeight: number
  itemWidth?: number
  containerHeight: number
  containerWidth?: number
  overscan?: number
  enableDynamicSizing?: boolean
  enableSmoothScrolling?: boolean
  enableHorizontalScrolling?: boolean
  enableIntersectionObserver?: boolean
  enableResizeObserver?: boolean
  enableScrollEvents?: boolean
  enableTouchScrolling?: boolean
  enableKeyboardNavigation?: boolean
  renderItem: (item: VirtualizationItem, index: number) => HTMLElement
  keyExtractor?: (item: VirtualizationItem) => string
  onScroll?: (scrollTop: number, scrollLeft: number) => void
  onVisibleChange?: (visibleItems: VirtualizationItem[]) => void
  onItemSizeChange?: (item: VirtualizationItem, size: { width: number; height: number }) => void
}

export interface LazyLoadOptions {
  threshold?: number
  rootMargin?: string
  root?: Element
  enableIntersectionObserver?: boolean
  enablePreloading?: boolean
  preloadCount?: number
  loadMore?: (startIndex: number, endIndex: number) => Promise<void>
  onLoad?: (loadedItems: VirtualizationItem[]) => void
  onError?: (error: Error) => void
}

export interface InfiniteScrollOptions extends LazyLoadOptions {
  hasMore?: boolean
  loading?: boolean
  endMessage?: string
  errorMessage?: string
  distance?: number
}

export class VirtualizationManager {
  private static instances = new Map<string, VirtualizationManager>()
  private container: HTMLElement
  private options: VirtualizationOptions
  private items: VirtualizationItem[]
  private scrollTop = 0
  private scrollLeft = 0
  private visibleItems: VirtualizationItem[] = []
  private itemElements = new Map<string | number, HTMLElement>()
  private resizeObserver?: ResizeObserver
  private intersectionObserver?: IntersectionObserver
  private scrollTimeout?: number
  private isScrolling = false

  constructor(container: HTMLElement, options: VirtualizationOptions) {
    this.container = container
    this.options = options
    this.items = []
    
    this.initializeContainer()
    this.setupEventListeners()
    this.setupObservers()
  }

  static getInstance(id: string, container: HTMLElement, options: VirtualizationOptions): VirtualizationManager {
    if (!this.instances.has(id)) {
      this.instances.set(id, new VirtualizationManager(container, options))
    }
    return this.instances.get(id)!
  }

  static removeInstance(id: string): void {
    const instance = this.instances.get(id)
    if (instance) {
      instance.cleanup()
      this.instances.delete(id)
    }
  }

  private initializeContainer(): void {
    this.container.style.position = 'relative'
    this.container.style.overflow = 'auto'
    this.container.style.height = `${this.options.containerHeight}px`
    
    if (this.options.containerWidth) {
      this.container.style.width = `${this.options.containerWidth}px`
    }

    if (this.options.enableHorizontalScrolling) {
      this.container.style.overflowX = 'auto'
      this.container.style.overflowY = 'hidden'
    }

    // Create scroll content
    const scrollContent = document.createElement('div')
    scrollContent.style.position = 'absolute'
    scrollContent.style.top = '0'
    scrollContent.style.left = '0'
    scrollContent.style.width = '100%'
    scrollContent.style.height = '100%'
    
    this.container.appendChild(scrollContent)
    this.updateScrollContentSize()
  }

  private setupEventListeners(): void {
    if (this.options.enableScrollEvents) {
      this.container.addEventListener('scroll', this.handleScroll.bind(this))
    }

    if (this.options.enableTouchScrolling) {
      this.container.addEventListener('touchstart', this.handleTouchStart.bind(this))
      this.container.addEventListener('touchmove', this.handleTouchMove.bind(this))
      this.container.addEventListener('touchend', this.handleTouchEnd.bind(this))
    }

    if (this.options.enableKeyboardNavigation) {
      this.container.addEventListener('keydown', this.handleKeyDown.bind(this))
    }
  }

  private setupObservers(): void {
    if (this.options.enableResizeObserver) {
      this.resizeObserver = new ResizeObserver(this.handleResize.bind(this))
      this.resizeObserver.observe(this.container)
    }

    if (this.options.enableIntersectionObserver) {
      this.intersectionObserver = new IntersectionObserver(
        this.handleIntersection.bind(this),
        {
          root: this.container,
          rootMargin: '0px',
          threshold: [0, 0.25, 0.5, 0.75, 1]
        }
      )
    }
  }

  private handleScroll = (): void => {
    this.scrollTop = this.container.scrollTop
    this.scrollLeft = this.container.scrollLeft

    if (this.options.onScroll) {
      this.options.onScroll(this.scrollTop, this.scrollLeft)
    }

    this.updateVisibleItems()

    // Handle smooth scrolling
    if (this.options.enableSmoothScrolling) {
      this.isScrolling = true
      clearTimeout(this.scrollTimeout)
      this.scrollTimeout = window.setTimeout(() => {
        this.isScrolling = false
      }, 150)
    }
  }

  private handleResize = (entries: ResizeObserverEntry[]): void => {
    for (const entry of entries) {
      if (entry.target === this.container) {
        const { height, width } = entry.contentRect
        this.options.containerHeight = height
        if (this.options.containerWidth) {
          this.options.containerWidth = width
        }
        this.updateScrollContentSize()
        this.updateVisibleItems()
      }
    }
  }

  private handleIntersection = (entries: IntersectionObserverEntry[]): void => {
    entries.forEach((entry) => {
      const element = entry.target as HTMLElement
      const itemId = element.dataset.itemId
      if (itemId) {
        const item = this.items.find(i => i.id.toString() === itemId)
        if (item) {
          const isVisible = entry.isIntersecting
          if (isVisible && !this.visibleItems.includes(item)) {
            this.visibleItems.push(item)
          } else if (!isVisible && this.visibleItems.includes(item)) {
            this.visibleItems = this.visibleItems.filter(i => i !== item)
          }
        }
      }
    })

    if (this.options.onVisibleChange) {
      this.options.onVisibleChange(this.visibleItems)
    }
  }

  private handleTouchStart = (event: TouchEvent): void => {
    // Handle touch start
    this.isScrolling = true
  }

  private handleTouchMove = (event: TouchEvent): void => {
    // Handle touch move
    this.isScrolling = true
  }

  private handleTouchEnd = (event: TouchEvent): void => {
    // Handle touch end
    this.isScrolling = false
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    const step = 20
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        this.container.scrollTop += step
        break
      case 'ArrowUp':
        event.preventDefault()
        this.container.scrollTop -= step
        break
      case 'ArrowRight':
        event.preventDefault()
        this.container.scrollLeft += step
        break
      case 'ArrowLeft':
        event.preventDefault()
        this.container.scrollLeft -= step
        break
    }
  }

  private updateScrollContentSize(): void {
    const scrollContent = this.container.querySelector('div[style*="position: absolute"]')
    if (scrollContent) {
      const totalHeight = this.items.length * this.options.itemHeight
      const totalWidth = this.options.enableHorizontalScrolling 
        ? (this.items.length * (this.options.itemWidth || this.options.itemHeight))
        : '100%'
      
      scrollContent.style.height = `${totalHeight}px`
      scrollContent.style.width = totalWidth
    }
  }

  private updateVisibleItems(): void {
    const { startIndex, endIndex } = this.calculateVisibleRange()
    const newVisibleItems: VirtualizationItem[] = []

    for (let i = startIndex; i <= endIndex; i++) {
      if (this.items[i]) {
        newVisibleItems.push(this.items[i])
      }
    }

    this.visibleItems = newVisibleItems

    if (this.options.onVisibleChange) {
      this.options.onVisibleChange(this.visibleItems)
    }

    this.renderVisibleItems(startIndex, endIndex)
  }

  private calculateVisibleRange(): { startIndex: number; endIndex: number } {
    const overscan = this.options.overscan || 5
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.options.itemHeight) - overscan)
    const endIndex = Math.min(
      this.items.length - 1,
      Math.ceil((this.scrollTop + this.options.containerHeight) / this.options.itemHeight) + overscan
    )

    return { startIndex, endIndex }
  }

  private renderVisibleItems(startIndex: number, endIndex: number): void {
    const scrollContent = this.container.querySelector('div[style*="position: absolute"]')
    if (!scrollContent) return

    // Remove items outside the visible range
    for (const [itemId, element] of this.itemElements) {
      const itemIndex = this.items.findIndex(item => item.id === itemId)
      if (itemIndex < startIndex || itemIndex > endIndex) {
        element.remove()
        this.itemElements.delete(itemId)
      }
    }

    // Add or update visible items
    for (let i = startIndex; i <= endIndex; i++) {
      const item = this.items[i]
      if (!item) continue

      const key = this.options.keyExtractor ? this.options.keyExtractor(item) : item.id.toString()
      
      if (!this.itemElements.has(key)) {
        const element = this.options.renderItem(item, i)
        element.style.position = 'absolute'
        element.style.top = `${i * this.options.itemHeight}px`
        element.style.left = '0'
        element.style.width = '100%'
        element.style.height = `${this.options.itemHeight}px`
        element.dataset.itemId = key
        
        if (this.options.enableIntersectionObserver) {
          this.intersectionObserver!.observe(element)
        }

        scrollContent.appendChild(element)
        this.itemElements.set(key, element)
      } else {
        const element = this.itemElements.get(key)!
        element.style.top = `${i * this.options.itemHeight}px`
        
        // Update item data if needed
        if (item.height && this.options.enableDynamicSizing) {
          element.style.height = `${item.height}px`
        }
      }
    }
  }

  // Public API
  setItems(items: VirtualizationItem[]): void {
    this.items = items
    this.updateScrollContentSize()
    this.updateVisibleItems()
  }

  updateItem(id: string | number, updates: Partial<VirtualizationItem>): void {
    const itemIndex = this.items.findIndex(item => item.id === id)
    if (itemIndex !== -1) {
      this.items[itemIndex] = { ...this.items[itemIndex], ...updates }
      
      if (updates.height || updates.width) {
        const key = this.options.keyExtractor ? this.options.keyExtractor(this.items[itemIndex]) : id.toString()
        const element = this.itemElements.get(key)
        if (element) {
          if (updates.height) {
            element.style.height = `${updates.height}px`
          }
          if (updates.width) {
            element.style.width = `${updates.width}px`
          }
        }
      }
      
      this.updateVisibleItems()
    }
  }

  removeItem(id: string | number): void {
    const itemIndex = this.items.findIndex(item => item.id === id)
    if (itemIndex !== -1) {
      this.items.splice(itemIndex, 1)
      this.updateScrollContentSize()
      this.updateVisibleItems()
    }
  }

  scrollToItem(id: string | number): void {
    const itemIndex = this.items.findIndex(item => item.id === id)
    if (itemIndex !== -1) {
      const scrollTop = itemIndex * this.options.itemHeight
      this.container.scrollTop = scrollTop
    }
  }

  getVisibleItems(): VirtualizationItem[] {
    return [...this.visibleItems]
  }

  getScrollPosition(): { scrollTop: number; scrollLeft: number } {
    return { scrollTop: this.scrollTop, scrollLeft: this.scrollLeft }
  }

  refresh(): void {
    this.updateScrollContentSize()
    this.updateVisibleItems()
  }

  cleanup(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }
    
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
    }
    
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
    }
    
    // Remove all item elements
    for (const element of this.itemElements.values()) {
      element.remove()
    }
    this.itemElements.clear()
    
    // Remove scroll content
    const scrollContent = this.container.querySelector('div[style*="position: absolute"]')
    if (scrollContent) {
      scrollContent.remove()
    }
  }
}

// Virtualization utilities
export const VirtualizationUtils = {
  // Create virtualized list
  createVirtualizedList: (
    container: HTMLElement,
    items: VirtualizationItem[],
    options: VirtualizationOptions
  ): VirtualizationManager => {
    const manager = VirtualizationManager.getInstance(
      `virtual_${Date.now()}`,
      container,
      options
    )
    manager.setItems(items)
    return manager
  },

  // Create virtualized grid
  createVirtualizedGrid: (
    container: HTMLElement,
    items: VirtualizationItem[],
    options: {
      itemWidth: number
      itemHeight: number
      containerHeight: number
      containerWidth?: number
      overscan?: number
      renderItem: (item: VirtualizationItem, index: number) => HTMLElement
      keyExtractor?: (item: VirtualizationItem) => string
    }
  ): VirtualizationManager => {
    const gridOptions: VirtualizationOptions = {
      ...options,
      enableHorizontalScrolling: true,
      enableSmoothScrolling: true,
      enableIntersectionObserver: true,
      enableResizeObserver: true,
      enableScrollEvents: true,
      enableTouchScrolling: true,
      enableKeyboardNavigation: true
    }
    
    return VirtualizationUtils.createVirtualizedList(
      container,
      items,
      gridOptions
    )
  },

  // Create infinite scroll list
  createInfiniteScroll: (
    container: HTMLElement,
    loadItems: (limit: number, offset: number) => Promise<VirtualizationItem[]>,
    options: VirtualizationOptions & InfiniteScrollOptions
  ): {
    manager: VirtualizationManager
    loadMore: () => Promise<void>
    reset: () => void
  } => {
    let allItems: VirtualizationItem[] = []
    let isLoading = false
    let hasMore = true
    let currentOffset = 0

    const infiniteOptions: VirtualizationOptions = {
      ...options,
      enableIntersectionObserver: true,
      enableSmoothScrolling: true,
      enableScrollEvents: true
    }

    const manager = VirtualizationUtils.createVirtualizedList(
      container,
      allItems,
      infiniteOptions
    )

    const loadMore = async (): Promise<void> => {
      if (isLoading || !hasMore) return

      isLoading = true
      try {
        const newItems = await loadItems(20, currentOffset)
        if (newItems.length > 0) {
          allItems = [...allItems, ...newItems]
          currentOffset += newItems.length
          manager.setItems(allItems)
          
          if (options.onLoad) {
            options.onLoad(newItems)
          }
        } else {
          hasMore = false
        }
      } catch (error) {
        if (options.onError) {
          options.onError(error as Error)
        }
      } finally {
        isLoading = false
      }
    }

    const reset = (): void => {
      allItems = []
      currentOffset = 0
      hasMore = true
      isLoading = false
      manager.setItems(allItems)
    }

    // Auto-load more on scroll
    const handleScroll = (): void => {
      const { scrollTop, containerHeight } = manager.getScrollPosition()
      const scrollHeight = container.scrollHeight
      const threshold = options.distance || 100

      if (scrollHeight - scrollTop - containerHeight < threshold && hasMore && !isLoading) {
        loadMore()
      }
    }

    container.addEventListener('scroll', handleScroll)

    return {
      manager,
      loadMore,
      reset: () => {
        container.removeEventListener('scroll', handleScroll)
        reset()
      }
    }
  },

  // Calculate optimal item size
  calculateOptimalItemSize: (
    items: VirtualizationItem[],
    containerHeight: number,
    containerWidth: number,
    minItemHeight: number = 50,
    maxItemHeight: number = 200
  ): { itemHeight: number; itemWidth: number; columns: number } => {
    const totalItems = items.length
    const containerArea = containerHeight * containerWidth
    const averageItemArea = containerArea / Math.max(totalItems, 1)

    // Calculate optimal dimensions
    const aspectRatio = 16 / 9 // Default aspect ratio
    let itemHeight = Math.sqrt(averageItemArea / aspectRatio)
    let itemWidth = itemHeight * aspectRatio

    // Apply constraints
    itemHeight = Math.max(minItemHeight, Math.min(maxItemHeight, itemHeight))
    itemWidth = Math.max(50, itemWidth)

    // Calculate number of columns
    const columns = Math.floor(containerWidth / itemWidth)

    return {
      itemHeight: Math.round(itemHeight),
      itemWidth: Math.round(itemWidth),
      columns
    }
  },

  // Optimize virtualization performance
  optimizeVirtualization: (
    items: VirtualizationItem[],
    options: VirtualizationOptions
  ): VirtualizationOptions => {
    const optimizedOptions = { ...options }

    // Adjust overscan based on item count
    if (items.length > 1000) {
      optimizedOptions.overscan = 10
    } else if (items.length > 500) {
      optimizedOptions.overscan = 5
    } else {
      optimizedOptions.overscan = 3
    }

    // Enable dynamic sizing for large datasets
    if (items.length > 500) {
      optimizedOptions.enableDynamicSizing = true
    }

    // Enable smooth scrolling for better UX
    optimizedOptions.enableSmoothScrolling = true

    return optimizedOptions
  }
}