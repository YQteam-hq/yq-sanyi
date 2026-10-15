/**
 * DOM Utilities for yq-sanyi
 * 
 * Provides advanced DOM manipulation utilities with query selectors,
 * event handling, animations, and DOM traversal helpers for yq-sanyi applications.
 * 
 * @packageDocumentation
 */

/**
 * Query selector types
 */
export type QuerySelector = string | Element | HTMLElement | NodeListOf<Element> | Element[]

/**
 * Event types
 */
export type EventType = keyof HTMLElementEventMap | string

/**
 * Animation configuration interface
 */
export interface AnimationConfig {
  duration?: number
  easing?: string
  delay?: number
  fill?: 'none' | 'forwards' | 'backwards' | 'both'
  iterations?: number
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
}

/**
 * Position and size interface
 */
export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

/**
 * Event handler interface
 */
export type EventHandler = (event: Event) => void | Promise<void>

/**
 * DOM utilities class
 */
export class DOMUtils {
  /**
   * Query element(s) from DOM
   */
  static query<T extends Element = Element>(selector: QuerySelector): T | null {
    if (typeof selector === 'string') {
      return document.querySelector<T>(selector)
    }
    
    if (selector instanceof Node) {
      return selector as T
    }
    
    if (selector instanceof NodeList) {
      return selector[0] as T
    }
    
    if (Array.isArray(selector)) {
      return selector[0] as T
    }
    
    return null
  }

  /**
   * Query all elements from DOM
   */
  static queryAll<T extends Element = Element>(selector: QuerySelector): T[] {
    if (typeof selector === 'string') {
      return Array.from(document.querySelectorAll<T>(selector))
    }
    
    if (selector instanceof Node) {
      return [selector as T]
    }
    
    if (selector instanceof NodeList) {
      return Array.from(selector) as T[]
    }
    
    if (Array.isArray(selector)) {
      return selector as T[]
    }
    
    return []
  }

  /**
   * Wait for element to appear in DOM
   */
  static async waitFor(selector: string | ((element: HTMLElement) => boolean), timeout: number = 10000): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      
      // Check if element already exists
      const checkElement = () => {
        let element: HTMLElement | null = null
        
        if (typeof selector === 'string') {
          element = document.querySelector<HTMLElement>(selector)
        } else {
          // Check all elements for the condition
          const allElements = document.querySelectorAll('*')
          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i] as HTMLElement
            if (selector(el)) {
              element = el
              break
            }
          }
        }
        
        if (element) {
          resolve(element)
          return true
        }
        
        return false
      }
      
      // Initial check
      if (checkElement()) {
        return
      }
      
      // Set up observer
      const observer = new MutationObserver(() => {
        if (checkElement()) {
          observer.disconnect()
        }
      })
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      })
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        observer.disconnect()
        reject(new Error(`Element not found within ${timeout}ms`))
      }, timeout)
      
      // Clean up on unmount
      return () => {
        observer.disconnect()
        clearTimeout(timeoutId)
      }
    })
  }

  /**
   * Create element with attributes and children
   */
  static createElement<T extends HTMLElement = HTMLElement>(
    tagName: string,
    attributes?: Record<string, any>,
    children?: (Node | string)[]
  ): T {
    const element = document.createElement(tagName) as T
    
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'style' && typeof value === 'object') {
          Object.assign(element.style, value)
        } else if (key.startsWith('on') && typeof value === 'function') {
          const event = key.substring(2).toLowerCase()
          element.addEventListener(event, value)
        } else {
          element.setAttribute(key, String(value))
        }
      })
    }
    
    if (children) {
      children.forEach(child => {
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child))
        } else {
          element.appendChild(child)
        }
      })
    }
    
    return element
  }

  /**
   * Add event listener with automatic cleanup
   */
  static addEventListener(
    target: Element | Window | Document,
    event: EventType,
    handler: EventHandler,
    options?: AddEventListenerOptions
  ): () => void {
    target.addEventListener(event, handler as EventListener, options)
    
    return () => {
      target.removeEventListener(event, handler as EventListener, options)
    }
  }

  /**
   * Add event listener with delegation
   */
  static addDelegatedListener(
    parent: Element,
    selector: string,
    event: EventType,
    handler: EventHandler,
    options?: AddEventListenerOptions
  ): () => void {
    const delegatedHandler: EventListener = (event) => {
      const target = event.target as Element
      const element = target.closest(selector)
      
      if (element && parent.contains(element)) {
        handler.call(element, event)
      }
    }
    
    return this.addEventListener(parent, event, delegatedHandler, options)
  }

  /**
   * Trigger event on element
   */
  static trigger(element: Element, event: Event | EventType, data?: any): void {
    let eventObj: Event
    
    if (typeof event === 'string') {
      eventObj = new CustomEvent(event, { detail: data })
    } else {
      eventObj = event
    }
    
    element.dispatchEvent(eventObj)
  }

  /**
   * Get element position relative to viewport
   */
  static getViewportPosition(element: Element): Position {
    const rect = element.getBoundingClientRect()
    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY
    }
  }

  /**
   * Get element position relative to document
   */
  static getDocumentPosition(element: Element): Position {
    const rect = element.getBoundingClientRect()
    return {
      x: rect.left,
      y: rect.top
    }
  }

  /**
   * Get element size
   */
  static getSize(element: Element): Size {
    const rect = element.getBoundingClientRect()
    return {
      width: rect.width,
      height: rect.height
    }
  }

  /**
   * Get element bounding rect
   */
  static getRect(element: Element): Rect {
    const rect = element.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    }
  }

  /**
   * Check if element is in viewport
   */
  static isInViewport(element: Element, partially: boolean = true): boolean {
    const rect = element.getBoundingClientRect()
    
    if (partially) {
      return (
        rect.top <= window.innerHeight &&
        rect.bottom >= 0 &&
        rect.left <= window.innerWidth &&
        rect.right >= 0
      )
    } else {
      return (
        rect.top >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.left >= 0 &&
        rect.right <= window.innerWidth
      )
    }
  }

  /**
   * Check if element is visible
   */
  static isVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element)
    return (element as any).offsetParent !== null && 
           element.getClientRects().length > 0 &&
           style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0'
  }

  /**
   * Scroll element into view
   */
  static scrollIntoView(
    element: Element,
    options?: ScrollIntoViewOptions
  ): void {
    element.scrollIntoView(options)
  }

  /**
   * Smooth scroll to position
   */
  static scrollTo(
    x: number,
    y: number,
    options?: ScrollToOptions
  ): void {
    window.scrollTo({ behavior: 'smooth', ...options, left: x, top: y })
  }

  /**
   * Animate element
   */
  static async animate(
    element: Element,
    keyframes: Keyframe[] | PropertyIndexedKeyframes,
    options: AnimationConfig & KeyframeAnimationOptions
  ): Promise<Animation> {
    const animation = element.animate(keyframes, options)
    return animation.finished
  }

  /**
   * Add CSS class
   */
  static addClass(element: Element, ...classNames: string[]): void {
    element.classList.add(...classNames)
  }

  /**
   * Remove CSS class
   */
  static removeClass(element: Element, ...classNames: string[]): void {
    element.classList.remove(...classNames)
  }

  /**
   * Toggle CSS class
   */
  static toggleClass(element: Element, className: string, force?: boolean): boolean {
    return element.classList.toggle(className, force)
  }

  /**
   * Check if element has CSS class
   */
  static hasClass(element: Element, className: string): boolean {
    return element.classList.contains(className)
  }

  /**
   * Set CSS style
   */
  static setStyle(element: HTMLElement, styles: Record<string, any>): void {
    Object.assign(element.style, styles)
  }

  /**
   * Get CSS style
   */
  static getStyle(element: Element, property: string): string {
    return window.getComputedStyle(element).getPropertyValue(property)
  }

  /**
   * Set attribute
   */
  static setAttribute(element: Element, name: string, value: any): void {
    element.setAttribute(name, String(value))
  }

  /**
   * Get attribute
   */
  static getAttribute(element: Element, name: string): string | null {
    return element.getAttribute(name)
  }

  /**
   * Remove attribute
   */
  static removeAttribute(element: Element, name: string): void {
    element.removeAttribute(name)
  }

  /**
   * Get data attribute
   */
  static getData(element: Element, name: string): string | null {
    return element.getAttribute(`data-${name}`)
  }

  /**
   * Set data attribute
   */
  static setData(element: Element, name: string, value: any): void {
    element.setAttribute(`data-${name}`, String(value))
  }

  /**
   * Get element dimensions including padding and border
   */
  static getDimensions(element: HTMLElement): {
    width: number
    height: number
    padding: { top: number; right: number; bottom: number; left: number }
    border: { top: number; right: number; bottom: number; left: number }
    margin: { top: number; right: number; bottom: number; left: number }
  } {
    const style = window.getComputedStyle(element)
    
    return {
      width: element.offsetWidth,
      height: element.offsetHeight,
      padding: {
        top: parseFloat(style.paddingTop),
        right: parseFloat(style.paddingRight),
        bottom: parseFloat(style.paddingBottom),
        left: parseFloat(style.paddingLeft)
      },
      border: {
        top: parseFloat(style.borderTopWidth),
        right: parseFloat(style.borderRightWidth),
        bottom: parseFloat(style.borderBottomWidth),
        left: parseFloat(style.borderLeftWidth)
      },
      margin: {
        top: parseFloat(style.marginTop),
        right: parseFloat(style.marginRight),
        bottom: parseFloat(style.marginBottom),
        left: parseFloat(style.marginLeft)
      }
    }
  }

  /**
   * Get element computed style
   */
  static getComputedStyle(element: Element): CSSStyleDeclaration {
    return window.getComputedStyle(element)
  }

  /**
   * Clone element with deep copy
   */
  static clone<T extends Element>(element: T, deep: boolean = true): T {
    return element.cloneNode(deep) as T
  }

  /**
   * Empty element content
   */
  static empty(element: Element): void {
    while (element.firstChild) {
      element.removeChild(element.firstChild)
    }
  }

  /**
   * Check if element matches selector
   */
  static matches(element: Element, selector: string): boolean {
    return element.matches(selector)
  }

  /**
   * Find closest parent matching selector
   */
  static closest(element: Element, selector: string): Element | null {
    return element.closest(selector)
  }

  /**
   * Get element siblings
   */
  static getSiblings(element: Element): Element[] {
    const siblings = Array.from(element.parentNode?.children || [])
    return siblings.filter(sibling => sibling !== element)
  }

  /**
   * Get element index among siblings
   */
  static getIndex(element: Element): number {
    return Array.from(element.parentNode?.children || []).indexOf(element)
  }

  /**
   * Insert element before reference
   */
  static insertBefore(element: Element, reference: Element): void {
    reference.parentNode?.insertBefore(element, reference)
  }

  /**
   * Insert element after reference
   */
  static insertAfter(element: Element, reference: Element): void {
    reference.parentNode?.insertBefore(element, reference.nextSibling)
  }

  /**
   * Replace element with new element
   */
  static replace(element: Element, newElement: Element): void {
    element.parentNode?.replaceChild(newElement, element)
  }

  /**
   * Remove element from DOM
   */
  static remove(element: Element): void {
    element.remove()
  }

  /**
   * Get element text content
   */
  static getText(element: Element): string {
    return element.textContent || ''
  }

  /**
   * Set element text content
   */
  static setText(element: Element, text: string): void {
    element.textContent = text
  }

  /**
   * Get element HTML content
   */
  static getHTML(element: Element): string {
    return element.innerHTML
  }

  /**
   * Set element HTML content
   */
  static setHTML(element: Element, html: string): void {
    element.innerHTML = html
  }
}

/**
 * DOM event utilities
 */
export const DOMEvents = {
  /**
   * Create custom event
   */
  create(type: string, detail?: any): CustomEvent {
    return new CustomEvent(type, { detail })
  },

  /**
   * Prevent default behavior
   */
  prevent(event: Event): void {
    event.preventDefault()
  },

  /**
   * Stop event propagation
   */
  stop(event: Event): void {
    event.stopPropagation()
  },

  /**
   * Stop immediate event propagation
   */
  stopImmediate(event: Event): void {
    event.stopImmediatePropagation()
  },

  /**
   * Get event target
   */
  getTarget<T extends Element>(event: Event): T {
    return event.target as T
  },

  /**
   * Get event current target
   */
  getCurrentTarget<T extends Element>(event: Event): T {
    return event.currentTarget as T
  },

  /**
   * Get event coordinates
   */
  getCoordinates(event: MouseEvent): Position {
    return {
      x: event.clientX,
      y: event.clientY
    }
  },

  /**
   * Get event relative coordinates
   */
  getRelativeCoordinates(event: MouseEvent, element: Element): Position {
    const rect = element.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }
}

/**
 * DOM traversal utilities
 */
export const DOMTraversal = {
  /**
   * Get parent element
   */
  getParent(element: Element): Element | null {
    return element.parentElement
  },

  /**
   * Get parent element matching selector
   */
  getParentMatching(element: Element, selector: string): Element | null {
    return element.closest(selector)
  },

  /**
   * Get child elements
   */
  getChildren(element: Element): Element[] {
    return Array.from(element.children)
  },

  /**
   * Get first child element
   */
  getFirstChild(element: Element): Element | null {
    return element.firstElementChild
  },

  /**
   * Get last child element
   */
  getLastChild(element: Element): Element | null {
    return element.lastElementChild
  },

  /**
   * Get next sibling element
   */
  getNextSibling(element: Element): Element | null {
    return element.nextElementSibling
  },

  /**
   * Get previous sibling element
   */
  getPreviousSibling(element: Element): Element | null {
    return element.previousElementSibling
  },

  /**
   * Find descendants by selector
   */
  findDescendants(element: Element, selector: string): Element[] {
    return Array.from(element.querySelectorAll(selector))
  },

  /**
   * Find ancestor by selector
   */
  findAncestor(element: Element, selector: string): Element | null {
    return element.closest(selector)
  },

  /**
   * Get element path to root
   */
  getPath(element: Element): Element[] {
    const path: Element[] = []
    let current: Element | null = element
    
    while (current) {
      path.unshift(current)
      current = current.parentElement
    }
    
    return path
  }
}

/**
 * DOM animation utilities
 */
export const DOMAnimations = {
  /**
   * Fade in element
   */
  fadeIn(element: HTMLElement, duration: number = 300): Promise<void> {
    return new Promise((resolve) => {
      element.style.opacity = '0'
      element.style.transition = `opacity ${duration}ms`
      
      requestAnimationFrame(() => {
        element.style.opacity = '1'
        setTimeout(resolve, duration)
      })
    })
  },

  /**
   * Fade out element
   */
  fadeOut(element: HTMLElement, duration: number = 300): Promise<void> {
    return new Promise((resolve) => {
      element.style.opacity = '1'
      element.style.transition = `opacity ${duration}ms`
      
      requestAnimationFrame(() => {
        element.style.opacity = '0'
        setTimeout(() => {
          element.style.transition = ''
          resolve()
        }, duration)
      })
    })
  },

  /**
   * Slide in element
   */
  slideIn(element: HTMLElement, direction: 'left' | 'right' | 'up' | 'down' = 'up', duration: number = 300): Promise<void> {
    return new Promise((resolve) => {
      const rect = element.getBoundingClientRect()
      const start = {
        left: direction === 'left' ? -rect.width : 0,
        top: direction === 'up' ? -rect.height : 0
      }
      
      element.style.transform = `translate(${start.left}px, ${start.top}px)`
      element.style.transition = `transform ${duration}ms`
      
      requestAnimationFrame(() => {
        element.style.transform = 'translate(0, 0)'
        setTimeout(resolve, duration)
      })
    })
  },

  /**
   * Slide out element
   */
  slideOut(element: HTMLElement, direction: 'left' | 'right' | 'up' | 'down' = 'down', duration: number = 300): Promise<void> {
    return new Promise((resolve) => {
      const rect = element.getBoundingClientRect()
      const end = {
        left: direction === 'left' ? -rect.width : rect.width,
        top: direction === 'up' ? -rect.height : rect.height
      }
      
      element.style.transform = `translate(0, 0)`
      element.style.transition = `transform ${duration}ms`
      
      requestAnimationFrame(() => {
        element.style.transform = `translate(${end.left}px, ${end.top}px)`
        setTimeout(() => {
          element.style.transform = ''
          element.style.transition = ''
          resolve()
        }, duration)
      })
    })
  },

  /**
   * Shake element
   */
  shake(element: HTMLElement, intensity: number = 5, duration: number = 300): Promise<void> {
    return new Promise((resolve) => {
      const start = Date.now()
      const animate = () => {
        const elapsed = Date.now() - start
        const progress = elapsed / duration
        
        if (progress < 1) {
          const offset = Math.sin(progress * Math.PI * 8) * intensity * (1 - progress)
          element.style.transform = `translateX(${offset}px)`
          requestAnimationFrame(animate)
        } else {
          element.style.transform = ''
          resolve()
        }
      }
      
      animate()
    })
  }
}

/**
 * DOM validation utilities
 */
export const DOMValidation = {
  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  /**
   * Validate phone number format
   */
  isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))
  },

  /**
   * Validate URL format
   */
  isValidURL(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  },

  /**
   * Validate password strength
   */
  isPasswordStrong(password: string, minLength: number = 8): boolean {
    return password.length >= minLength &&
           /[A-Z]/.test(password) &&
           /[a-z]/.test(password) &&
           /[0-9]/.test(password) &&
           /[^A-Za-z0-9]/.test(password)
  },

  /**
   * Validate form field
   */
  validateField(element: HTMLInputElement | HTMLTextAreaElement, rules: {
    required?: boolean
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    custom?: (value: string) => boolean
  }): { valid: boolean; message?: string } {
    const value = element.value.trim()
    
    if (rules.required && !value) {
      return { valid: false, message: 'This field is required' }
    }
    
    if (rules.minLength && value.length < rules.minLength) {
      return { valid: false, message: `Minimum length is ${rules.minLength}` }
    }
    
    if (rules.maxLength && value.length > rules.maxLength) {
      return { valid: false, message: `Maximum length is ${rules.maxLength}` }
    }
    
    if (rules.pattern && !rules.pattern.test(value)) {
      return { valid: false, message: 'Invalid format' }
    }
    
    if (rules.custom && !rules.custom(value)) {
      return { valid: false, message: 'Invalid value' }
    }
    
    return { valid: true }
  }
}

export default DOMUtils