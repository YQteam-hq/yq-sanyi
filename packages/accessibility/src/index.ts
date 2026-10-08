/**
 * Accessibility utilities and ARIA enhancements for yq-sanyi components
 * @packageDocumentation
 */

// import type { ComponentDefinition, ComponentScript, ComponentInstance } from '../../core/src/index.js' - Not available in package context

export type ComponentScript = (this: any) => any
export type ComponentInstance = any

export interface ComponentDefinition {
  name: string
  template: string
  style?: string
  script?: ComponentScript
}

export interface ARIAAttributes {
  role?: string
  ariaLabel?: string
  ariaLabelledby?: string
  ariaDescribedby?: string
  ariaHidden?: boolean
  ariaExpanded?: boolean
  ariaPressed?: boolean
  ariaDisabled?: boolean
  ariaSelected?: boolean
  ariaChecked?: boolean
  ariaRequired?: boolean
  ariaInvalid?: boolean
  ariaBusy?: boolean
  ariaCurrent?: string
  ariaLevel?: number
  ariaModal?: boolean
  ariaMultiselectable?: boolean
  ariaOrientation?: 'horizontal' | 'vertical' | 'undefined'
  ariaPosinset?: number
  ariaSetsize?: number
  ariaSort?: 'ascending' | 'descending' | 'none' | 'other'
  ariaValuenow?: number
  ariaValuemin?: number
  ariaValuemax?: number
  ariaValuetext?: string
}

export interface AccessibilityConfig {
  skipToContentLink?: boolean
  keyboardNavigation?: boolean
  focusManagement?: boolean
  screenReaderAnnouncements?: boolean
  highContrastMode?: boolean
  reducedMotion?: boolean
}

export interface KeyboardNavigationConfig {
  enabled: boolean
  wrapAround?: boolean
  loopFocus?: boolean
  focusTrap?: boolean
  arrowKeys?: boolean
  tabKey?: boolean
  escapeKey?: boolean
  enterKey?: boolean
  spaceKey?: boolean
}

export interface FocusManager {
  trap: (element: HTMLElement) => void
  release: () => void
  focusFirst: (element: HTMLElement) => void
  focusLast: (element: HTMLElement) => void
  focusNext: (element: HTMLElement) => HTMLElement | null
  focusPrevious: (element: HTMLElement) => HTMLElement | null
}

/**
 * Accessibility utilities
 */
export class AccessibilityUtils {
  private config: AccessibilityConfig = {
    skipToContentLink: true,
    keyboardNavigation: true,
    focusManagement: true,
    screenReaderAnnouncements: true,
    highContrastMode: false,
    reducedMotion: false
  }

  /**
   * Configure accessibility settings
   */
  configure(config: Partial<AccessibilityConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Check if reduced motion is preferred
   */
  isReducedMotion(): boolean {
    return this.config.reducedMotion || 
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  /**
   * Check if high contrast mode is enabled
   */
  isHighContrast(): boolean {
    return this.config.highContrastMode ||
      window.matchMedia('(prefers-contrast: high)').matches
  }

  /**
   * Create skip to content link
   */
  createSkipToContentLink(targetId: string): string {
    if (!this.config.skipToContentLink) return ''
    
    return `
      <a href="#${targetId}" 
         class="skip-link" 
         aria-label="Skip to main content"
         style="
           position: absolute;
           top: -40px;
           left: 0;
           background: #000;
           color: white;
           padding: 8px;
           text-decoration: none;
           z-index: 100;
         "
         onfocus="this.style.top='0';"
         onblur="this.style.top='-40px';">
        Skip to main content
      </a>
    `
  }

  /**
   * Apply ARIA attributes to an element
   */
  applyARIA(element: HTMLElement, attributes: ARIAAttributes): void {
    if (attributes.role) element.setAttribute('role', attributes.role)
    if (attributes.ariaLabel) element.setAttribute('aria-label', attributes.ariaLabel)
    if (attributes.ariaLabelledby) element.setAttribute('aria-labelledby', attributes.ariaLabelledby)
    if (attributes.ariaDescribedby) element.setAttribute('aria-describedby', attributes.ariaDescribedby)
    if (attributes.ariaHidden !== undefined) element.setAttribute('aria-hidden', attributes.ariaHidden.toString())
    if (attributes.ariaExpanded !== undefined) element.setAttribute('aria-expanded', attributes.ariaExpanded.toString())
    if (attributes.ariaPressed !== undefined) element.setAttribute('aria-pressed', attributes.ariaPressed.toString())
    if (attributes.ariaDisabled !== undefined) element.setAttribute('aria-disabled', attributes.ariaDisabled.toString())
    if (attributes.ariaSelected !== undefined) element.setAttribute('aria-selected', attributes.ariaSelected.toString())
    if (attributes.ariaChecked !== undefined) element.setAttribute('aria-checked', attributes.ariaChecked.toString())
    if (attributes.ariaRequired !== undefined) element.setAttribute('aria-required', attributes.ariaRequired.toString())
    if (attributes.ariaInvalid !== undefined) element.setAttribute('aria-invalid', attributes.ariaInvalid.toString())
    if (attributes.ariaBusy !== undefined) element.setAttribute('aria-busy', attributes.ariaBusy.toString())
    if (attributes.ariaCurrent) element.setAttribute('aria-current', attributes.ariaCurrent)
    if (attributes.ariaLevel !== undefined) element.setAttribute('aria-level', attributes.ariaLevel.toString())
    if (attributes.ariaModal !== undefined) element.setAttribute('aria-modal', attributes.ariaModal.toString())
    if (attributes.ariaMultiselectable !== undefined) element.setAttribute('aria-multiselectable', attributes.ariaMultiselectable.toString())
    if (attributes.ariaOrientation) element.setAttribute('aria-orientation', attributes.ariaOrientation)
    if (attributes.ariaPosinset !== undefined) element.setAttribute('aria-posinset', attributes.ariaPosinset.toString())
    if (attributes.ariaSetsize !== undefined) element.setAttribute('aria-setsize', attributes.ariaSetsize.toString())
    if (attributes.ariaSort) element.setAttribute('aria-sort', attributes.ariaSort)
    if (attributes.ariaValuenow !== undefined) element.setAttribute('aria-valuenow', attributes.ariaValuenow.toString())
    if (attributes.ariaValuemin !== undefined) element.setAttribute('aria-valuemin', attributes.ariaValuemin.toString())
    if (attributes.ariaValuemax !== undefined) element.setAttribute('aria-valuemax', attributes.ariaValuemax.toString())
    if (attributes.ariaValuetext) element.setAttribute('aria-valuetext', attributes.ariaValuetext)
  }

  /**
   * Create screen reader announcement
   */
  announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.config.screenReaderAnnouncements) return
    
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', priority)
    announcement.setAttribute('aria-atomic', 'true')
    announcement.setAttribute('class', 'sr-only')
    announcement.textContent = message
    
    document.body.appendChild(announcement)
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement)
    }, 1000)
  }

  /**
   * Check if an element is keyboard focusable
   */
  isFocusable(element: HTMLElement): boolean {
    const tabIndex = element.getAttribute('tabindex')
    const disabled = element.getAttribute('disabled') !== null
    const hidden = element.getAttribute('aria-hidden') === 'true'
    
    return (
      !disabled &&
      !hidden &&
      (tabIndex === null || parseInt(tabIndex) >= 0) &&
      element.getAttribute('visibility') !== 'hidden'
    )
  }

  /**
   * Get all focusable elements within a container
   */
  getFocusableElements(container: HTMLElement): HTMLElement[] {
    const elements = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    return Array.from(elements).filter(el => el instanceof HTMLElement && this.isFocusable(el)) as HTMLElement[]
  }
}

/**
 * Keyboard navigation utilities
 */
export class KeyboardNavigation {
  private config: KeyboardNavigationConfig = {
    enabled: true,
    wrapAround: false,
    loopFocus: false,
    focusTrap: false,
    arrowKeys: true,
    tabKey: true,
    escapeKey: true,
    enterKey: true,
    spaceKey: true
  }

  /**
   * Configure keyboard navigation
   */
  configure(config: Partial<KeyboardNavigationConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Create keyboard navigation handler
   */
  createNavigationHandler(
    onNavigate?: (direction: 'next' | 'previous' | 'first' | 'last') => void,
    onAction?: (element: HTMLElement) => void
  ): (event: KeyboardEvent) => void {
    return (event: KeyboardEvent) => {
      if (!this.config.enabled) return

      const target = event.target as HTMLElement
      const focusableElements = this.getFocusableElements(target.closest('body') || document.body)
      
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          if (this.config.arrowKeys) {
            event.preventDefault()
            this.navigateFocus(focusableElements, 'next', target)
          }
          break
          
        case 'ArrowUp':
        case 'ArrowLeft':
          if (this.config.arrowKeys) {
            event.preventDefault()
            this.navigateFocus(focusableElements, 'previous', target)
          }
          break
          
        case 'Tab':
          if (this.config.tabKey) {
            // Default tab behavior is fine, but we can add custom handling here
          }
          break
          
        case 'Enter':
        case ' ':
          if (this.config.enterKey || this.config.spaceKey) {
            event.preventDefault()
            onAction?.(target)
          }
          break
          
        case 'Escape':
          if (this.config.escapeKey) {
            event.preventDefault()
            onNavigate?.('last') // Escape usually closes dialogs
          }
          break
      }
    }
  }

  /**
   * Navigate focus between elements
   */
  private navigateFocus(
    elements: HTMLElement[], 
    direction: 'next' | 'previous' | 'first' | 'last', 
    current: HTMLElement
  ): void {
    const currentIndex = elements.indexOf(current)
    let newIndex = currentIndex

    switch (direction) {
      case 'next':
        newIndex = currentIndex + 1
        if (newIndex >= elements.length) {
          newIndex = this.config.wrapAround ? 0 : elements.length - 1
        }
        break
        
      case 'previous':
        newIndex = currentIndex - 1
        if (newIndex < 0) {
          newIndex = this.config.wrapAround ? elements.length - 1 : 0
        }
        break
        
      case 'first':
        newIndex = 0
        break
        
      case 'last':
        newIndex = elements.length - 1
        break
    }

    if (newIndex >= 0 && newIndex < elements.length) {
      elements[newIndex].focus()
    }
  }

  /**
   * Get focusable elements
   */
  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]'
    )) as HTMLElement[]
  }
}

/**
 * Focus trap utility
 */
export class FocusTrap implements FocusManager {
  private originalActiveElement: HTMLElement | null = null
  private focusableElements: HTMLElement[] = []
  private container: HTMLElement | null = null

  /**
   * Trap focus within an element
   */
  trap(container: HTMLElement): void {
    this.container = container
    this.originalActiveElement = document.activeElement as HTMLElement
    this.focusableElements = this.getFocusableElements(container)
    
    if (this.focusableElements.length > 0) {
      this.focusableElements[0].focus()
    }
    
    // Add event listeners
    document.addEventListener('focus', this.handleFocus.bind(this), true)
    document.addEventListener('keydown', this.handleKeydown.bind(this))
  }

  /**
   * Release focus trap
   */
  release(): void {
    document.removeEventListener('focus', this.handleFocus.bind(this), true)
    document.removeEventListener('keydown', this.handleKeydown.bind(this))
    
    if (this.originalActiveElement) {
      this.originalActiveElement.focus()
    }
    
    this.container = null
    this.focusableElements = []
    this.originalActiveElement = null
  }

  /**
   * Focus first element
   */
  focusFirst(element: HTMLElement): void {
    const focusable = this.getFocusableElements(element)
    if (focusable.length > 0) {
      focusable[0].focus()
    }
  }

  /**
   * Focus last element
   */
  focusLast(element: HTMLElement): void {
    const focusable = this.getFocusableElements(element)
    if (focusable.length > 0) {
      focusable[focusable.length - 1].focus()
    }
  }

  /**
   * Focus next element
   */
  focusNext(element: HTMLElement): HTMLElement | null {
    const focusable = this.getFocusableElements(element)
    const index = focusable.indexOf(element)
    
    if (index >= 0 && index < focusable.length - 1) {
      return focusable[index + 1]
    }
    
    return null
  }

  /**
   * Focus previous element
   */
  focusPrevious(element: HTMLElement): HTMLElement | null {
    const focusable = this.getFocusableElements(element)
    const index = focusable.indexOf(element)
    
    if (index > 0) {
      return focusable[index - 1]
    }
    
    return null
  }

  /**
   * Handle focus events
   */
  private handleFocus(event: FocusEvent): void {
    if (!this.container || event.target === this.container) return
    
    if (!this.container.contains(event.target as Node)) {
      event.preventDefault()
      event.stopPropagation()
      
      const focusable = this.getFocusableElements(this.container)
      if (focusable.length > 0) {
        focusable[0].focus()
      }
    }
  }

  /**
   * Handle key events
   */
  private handleKeydown(event: KeyboardEvent): void {
    if (!this.container) return
    
    if (event.key === 'Tab') {
      const focusable = this.getFocusableElements(this.container)
      const firstElement = focusable[0]
      const lastElement = focusable[focusable.length - 1]
      
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement?.focus()
        }
      }
    }
  }

  /**
   * Get focusable elements
   */
  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]'
    )) as HTMLElement[]
  }
}

/**
 * Pre-built accessible components
 */
export const AccessibleComponents = {
  /**
   * Create accessible button
   */
  button: (name: string, label: string, onClick?: () => void): ComponentDefinition => ({
    name,
    template: `<button yq-on:click="click" aria-label="${label}">${label}</button>`,
    style: `button { padding: 0.5rem 1rem; border: none; border-radius: 4px; background: #007bff; color: white; cursor: pointer; }`,
    script: function () {
      return {
        click: function () {
          onClick?.()
          ;(this as any).$emit('click')
        }
      }
    }
  }),

  /**
   * Create accessible modal
   */
  modal: (name: string, title: string, content: string): ComponentDefinition => ({
    name,
    template: `
      <div class="modal-overlay" yq-show="isOpen" yq-on:click="close" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-content" yq-on:click.stop>
          <h2 id="modal-title">${title}</h2>
          <div class="modal-body">${content}</div>
          <button yq-on:click="close" aria-label="Close modal">Close</button>
        </div>
      </div>
    `,
    style: `
      .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
      .modal-content { background: white; padding: 2rem; border-radius: 8px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; }
      .modal-body { margin: 1rem 0; }
      .modal-content button { margin-top: 1rem; padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    `,
    script: function () {
      return {
        state: { isOpen: false },
        open: function () {
          ;(this as any).state.isOpen = true
          document.body.style.overflow = 'hidden'
        },
        close: function () {
          ;(this as any).state.isOpen = false
          document.body.style.overflow = ''
        }
      }
    }
  }),

  /**
   * Create accessible tabs
   */
  tabs: (name: string, tabs: Array<{ id: string; label: string; content: string }>): ComponentDefinition => ({
    name,
    template: `
      <div class="tabs" role="tablist">
        <div class="tab-headers">
          ${tabs.map((tab, index) => `
            <button 
              class="tab-header" 
              role="tab" 
              aria-selected="${index === 0}" 
              aria-controls="panel-${tab.id}"
              yq-class:active="activeTab === '${tab.id}'"
              yq-on:click="setTab('${tab.id}')"
              id="tab-${tab.id}"
            >
              ${tab.label}
            </button>
          `).join('')}
        </div>
        <div class="tab-content">
          ${tabs.map((tab, index) => `
            <div 
              class="tab-panel" 
              role="tabpanel" 
              aria-labelledby="tab-${tab.id}"
              yq-show="activeTab === '${tab.id}'"
              id="panel-${tab.id}"
              hidden="${index !== 0}"
            >
              ${tab.content}
            </div>
          `).join('')}
        </div>
      </div>
    `,
    style: `
      .tabs { border: 1px solid #ccc; border-radius: 4px; overflow: hidden; }
      .tab-headers { display: flex; background: #f5f5f5; border-bottom: 1px solid #ccc; }
      .tab-header { padding: 0.75rem 1.5rem; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; }
      .tab-header[aria-selected="true"] { border-bottom-color: #007bff; background: white; }
      .tab-content { padding: 1rem; }
      .tab-panel[hidden] { display: none; }
    `,
    script: function () {
      return {
        state: { activeTab: tabs[0]?.id || '' },
        setTab: function (tabId: string) {
          ;(this as any).state.activeTab = tabId
        }
      }
    }
  })
}

// Export singleton instances
export const accessibilityUtils = new AccessibilityUtils()
export const keyboardNavigation = new KeyboardNavigation()
export const focusTrap = new FocusTrap()