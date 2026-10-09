import { State, Derived, ComponentDefinition } from './index.js'

export interface AccessibilityConfig {
  screenReader: boolean
  keyboardNavigation: boolean
  focusManagement: boolean
  ariaAttributes: boolean
  colorContrast: boolean
  reducedMotion: boolean
  highContrast: boolean
}

export interface AccessibilityViolation {
  type: string
  message: string
  element: HTMLElement
  severity: 'error' | 'warning' | 'info'
  suggestion?: string
}

export interface AccessibilityReport {
  violations: AccessibilityViolation[]
  score: number
  recommendations: string[]
}

export interface A11yDirective {
  name: string
  handler: (element: HTMLElement, value: string, context: any) => void
}

export class AccessibilityManager {
  private static config: AccessibilityConfig = {
    screenReader: true,
    keyboardNavigation: true,
    focusManagement: true,
    ariaAttributes: true,
    colorContrast: true,
    reducedMotion: true,
    highContrast: true
  }

  private static violations: AccessibilityViolation[] = []
  private static observers: MutationObserver[] = []
  private static keyboardHandlers: Map<string, (event: KeyboardEvent) => void> = new Map()
  private static focusHandlers: Map<string, (event: FocusEvent) => void> = new Map()

  // Configuration
  static configure(config: Partial<AccessibilityConfig>): void {
    this.config = { ...this.config, ...config }
    
    if (this.config.keyboardNavigation) {
      this.enableKeyboardNavigation()
    }
    
    if (this.config.focusManagement) {
      this.enableFocusManagement()
    }
    
    if (this.config.screenReader) {
      this.enableScreenReaderSupport()
    }
  }

  static getConfig(): AccessibilityConfig {
    return { ...this.config }
  }

  // Accessibility directives
  static addDirective(name: string, directive: A11yDirective): void {
    this.registerDirective(name, directive)
  }

  static getDirective(name: string): A11yDirective | undefined {
    return this.getRegisteredDirective(name)
  }

  // Keyboard navigation
  private static enableKeyboardNavigation(): void {
    // Handle tab navigation
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        this.handleTabNavigation(event)
      }
    })

    // Handle escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.handleEscapeKey(event)
      }
    })

    // Handle enter and space for interactive elements
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        this.handleInteractiveKey(event)
      }
    })
  }

  private static handleTabNavigation(event: KeyboardEvent): void {
    const activeElement = document.activeElement as HTMLElement
    
    // Check if focus should be trapped
    if (activeElement?.hasAttribute('data-focus-trap')) {
      const trapContainer = activeElement.closest('[data-focus-trap]') as HTMLElement
      const focusableElements = trapContainer?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      
      if (focusableElements) {
        const firstElement = focusableElements[0] as HTMLElement
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
        
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }
  }

  private static handleEscapeKey(event: KeyboardEvent): void {
    const activeElement = document.activeElement as HTMLElement
    
    if (activeElement?.hasAttribute('data-modal')) {
      const modal = activeElement.closest('[data-modal]') as HTMLElement
      if (modal) {
        const closeButton = modal.querySelector('[data-close-modal]') as HTMLElement
        if (closeButton) {
          closeButton.click()
        }
      }
    }
  }

  private static handleInteractiveKey(event: KeyboardEvent): void {
    const activeElement = document.activeElement as HTMLElement
    
    if (activeElement?.hasAttribute('data-interactive')) {
      event.preventDefault()
      activeElement.click()
    }
  }

  // Focus management
  private static enableFocusManagement(): void {
    // Focus trap for modals and dialogs
    this.setupFocusTrap()
    
    // Restore focus after closing modals
    this.setupFocusRestore()
  }

  private static setupFocusTrap(): void {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-modal') {
          const modal = mutation.target as HTMLElement
          if (modal.hasAttribute('data-modal') && modal.getAttribute('data-modal') === 'open') {
            this.trapFocus(modal)
          }
        }
      }
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-modal'],
      subtree: true
    })

    this.observers.push(observer)
  }

  private static setupFocusRestore(): void {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-modal') {
          const modal = mutation.target as HTMLElement
          if (modal.hasAttribute('data-modal') && modal.getAttribute('data-modal') === 'closed') {
            this.restoreFocus()
          }
        }
      }
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-modal'],
      subtree: true
    })

    this.observers.push(observer)
  }

  private static trapFocus(container: HTMLElement): void {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    
    if (focusableElements.length > 0) {
      const firstElement = focusableElements[0] as HTMLElement
      firstElement.focus()
    }
  }

  private static restoreFocus(): void {
    const lastFocusedElement = document.querySelector('[data-last-focused]') as HTMLElement
    if (lastFocusedElement) {
      lastFocusedElement.focus()
    }
  }

  // Screen reader support
  private static enableScreenReaderSupport(): void {
    // Announce dynamic content changes
    this.setupLiveRegion()
    
    // Handle ARIA attributes
    this.setupARIAAttributes()
  }

  private static setupLiveRegion(): void {
    const liveRegion = document.createElement('div')
    liveRegion.setAttribute('aria-live', 'polite')
    liveRegion.setAttribute('aria-atomic', 'true')
    liveRegion.style.position = 'absolute'
    liveRegion.style.left = '-10000px'
    liveRegion.style.width = '1px'
    liveRegion.style.height = '1px'
    liveRegion.style.overflow = 'hidden'
    
    document.body.appendChild(liveRegion)
    
    // Store reference for dynamic content updates
    (window as any).yqLiveRegion = liveRegion
  }

  private static setupARIAAttributes(): void {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) {
              this.enhanceARIAAttributes(node)
            }
          }
        }
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    this.observers.push(observer)
  }

  private static enhanceARIAAttributes(element: HTMLElement): void {
    // Add ARIA labels for interactive elements
    if (element.tagName === 'BUTTON' && !element.hasAttribute('aria-label')) {
      element.setAttribute('aria-label', element.textContent || 'Button')
    }
    
    // Add ARIA roles for semantic elements
    if (element.tagName === 'ARTICLE' && !element.hasAttribute('role')) {
      element.setAttribute('role', 'article')
    }
    
    if (element.tagName === 'SECTION' && !element.hasAttribute('role')) {
      element.setAttribute('role', 'region')
    }
  }

  // Accessibility validation
  static validateElement(element: HTMLElement): AccessibilityViolation[] {
    const violations: AccessibilityViolation[] = []
    
    // Check for missing alt text
    if (element.tagName === 'IMG' && !element.hasAttribute('alt')) {
      violations.push({
        type: 'missing-alt',
        message: 'Image missing alt attribute',
        element,
        severity: 'error',
        suggestion: 'Add alt attribute to describe the image'
      })
    }
    
    // Check for missing labels
    if (element.tagName === 'INPUT' && element.hasAttribute('required') && !element.hasAttribute('aria-label')) {
      violations.push({
        type: 'missing-label',
        message: 'Input missing label',
        element,
        severity: 'error',
        suggestion: 'Add aria-label or associate with a label element'
      })
    }
    
    // Check for color contrast
    if (this.config.colorContrast) {
      const contrast = this.calculateColorContrast(element)
      if (contrast < 4.5) {
        violations.push({
          type: 'low-contrast',
          message: `Low color contrast: ${contrast.toFixed(2)}`,
          element,
          severity: 'warning',
          suggestion: 'Increase color contrast to meet WCAG standards'
        })
      }
    }
    
    // Check for keyboard accessibility
    if (this.config.keyboardNavigation && element.hasAttribute('tabindex') && element.getAttribute('tabindex') === '-1') {
      violations.push({
        type: 'keyboard-inaccessible',
        message: 'Element is keyboard inaccessible',
        element,
        severity: 'warning',
        suggestion: 'Remove tabindex="-1" or make element keyboard accessible'
      })
    }
    
    return violations
  }

  private static calculateColorContrast(element: HTMLElement): number {
    // Simplified color contrast calculation
    // In a real implementation, you would calculate actual color values
    return 4.5 // Placeholder
  }

  // Accessibility report
  static generateReport(): AccessibilityReport {
    const violations: AccessibilityViolation[] = []
    const allElements = document.querySelectorAll('*')
    
    for (const element of allElements) {
      if (element instanceof HTMLElement) {
        const elementViolations = this.validateElement(element)
        violations.push(...elementViolations)
      }
    }
    
    const score = this.calculateAccessibilityScore(violations)
    const recommendations = this.generateRecommendations(violations)
    
    return {
      violations,
      score,
      recommendations
    }
  }

  private static calculateAccessibilityScore(violations: AccessibilityViolation[]): number {
    const errorCount = violations.filter(v => v.severity === 'error').length
    const warningCount = violations.filter(v => v.severity === 'warning').length
    
    const maxScore = 100
    const penalty = (errorCount * 10) + (warningCount * 5)
    
    return Math.max(0, maxScore - penalty)
  }

  private static generateRecommendations(violations: AccessibilityViolation[]): string[] {
    const recommendations: string[] = []
    
    const errorCount = violations.filter(v => v.severity === 'error').length
    const warningCount = violations.filter(v => v.severity === 'warning').length
    
    if (errorCount > 0) {
      recommendations.push(`Fix ${errorCount} critical accessibility errors`)
    }
    
    if (warningCount > 0) {
      recommendations.push(`Address ${warningCount} accessibility warnings`)
    }
    
    if (errorCount === 0 && warningCount === 0) {
      recommendations.push('No accessibility violations found')
    }
    
    return recommendations
  }

  // Accessibility utilities
  static announceToScreenReader(message: string): void {
    const liveRegion = (window as any).yqLiveRegion
    if (liveRegion) {
      liveRegion.textContent = message
    }
  }

  static manageFocus(element: HTMLElement, options: { trap?: boolean; restore?: boolean } = {}): void {
    if (options.trap) {
      this.trapFocus(element)
    }
    
    if (options.restore) {
      this.restoreFocus()
    }
  }

  static createAccessibleButton(
    label: string,
    onClick: () => void,
    options: { ariaDescribedBy?: string; disabled?: boolean } = {}
  ): HTMLButtonElement {
    const button = document.createElement('button')
    button.textContent = label
    button.addEventListener('click', onClick)
    
    if (options.ariaDescribedBy) {
      button.setAttribute('aria-describedby', options.ariaDescribedBy)
    }
    
    if (options.disabled) {
      button.disabled = true
      button.setAttribute('aria-disabled', 'true')
    }
    
    return button
  }

  static createAccessibleInput(
    type: string,
    label: string,
    options: { required?: boolean; placeholder?: string; value?: string } = {}
  ): HTMLInputElement {
    const input = document.createElement('input')
    input.type = type
    input.placeholder = options.placeholder || label
    
    if (options.required) {
      input.required = true
    }
    
    if (options.value) {
      input.value = options.value
    }
    
    return input
  }

  // Cleanup
  static cleanup(): void {
    // Remove observers
    for (const observer of this.observers) {
      observer.disconnect()
    }
    this.observers = []
    
    // Remove event listeners
    this.keyboardHandlers.clear()
    this.focusHandlers.clear()
    
    // Clear violations
    this.violations = []
  }
}

// Accessibility utilities
export const AccessibilityUtils = {
  // Create accessible form
  createAccessibleForm: (
    fields: Array<{
      name: string
      label: string
      type: string
      required?: boolean
      placeholder?: string
    }>,
    onSubmit: (data: { [key: string]: string }) => void
  ): HTMLFormElement => {
    const form = document.createElement('form')
    
    fields.forEach(field => {
      const fieldContainer = document.createElement('div')
      fieldContainer.style.marginBottom = '16px'
      
      const label = document.createElement('label')
      label.textContent = field.label
      label.style.display = 'block'
      label.style.marginBottom = '4px'
      label.style.fontWeight = 'bold'
      
      const input = document.createElement('input')
      input.type = field.type
      input.name = field.name
      input.placeholder = field.placeholder || field.label
      input.style.width = '100%'
      input.style.padding = '8px'
      input.style.border = '1px solid #ccc'
      input.style.borderRadius = '4px'
      
      if (field.required) {
        input.required = true
        input.setAttribute('aria-required', 'true')
      }
      
      fieldContainer.appendChild(label)
      fieldContainer.appendChild(input)
      form.appendChild(fieldContainer)
    })
    
    const submitButton = document.createElement('button')
    submitButton.type = 'submit'
    submitButton.textContent = 'Submit'
    submitButton.style.backgroundColor = '#667eea'
    submitButton.style.color = 'white'
    submitButton.style.border = 'none'
    submitButton.style.padding = '10px 20px'
    submitButton.style.borderRadius = '4px'
    submitButton.style.cursor = 'pointer'
    
    form.appendChild(submitButton)
    
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const formData = new FormData(form)
      const data: { [key: string]: string } = {}
      
      for (const [key, value] of formData.entries()) {
        data[key] = value as string
      }
      
      onSubmit(data)
    })
    
    return form
  },

  // Create accessible modal
  createAccessibleModal: (
    title: string,
    content: HTMLElement,
    options: { closeButtonText?: string; trapFocus?: boolean } = {}
  ): HTMLElement => {
    const modal = document.createElement('div')
    modal.style.position = 'fixed'
    modal.style.top = '0'
    modal.style.left = '0'
    modal.style.width = '100%'
    modal.style.height = '100%'
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
    modal.style.display = 'flex'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'
    modal.style.zIndex = '1000'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-labelledby', 'modal-title')
    
    const modalContent = document.createElement('div')
    modalContent.style.backgroundColor = 'white'
    modalContent.style.padding = '20px'
    modalContent.style.borderRadius = '8px'
    modalContent.style.maxWidth = '500px'
    modalContent.style.width = '90%'
    modalContent.style.maxHeight = '80vh'
    modalContent.style.overflowY = 'auto'
    
    const modalTitle = document.createElement('h2')
    modalTitle.id = 'modal-title'
    modalTitle.textContent = title
    modalTitle.style.marginTop = '0'
    
    const closeButton = AccessibilityManager.createAccessibleButton(
      options.closeButtonText || 'Close',
      () => {
        modal.setAttribute('data-modal', 'closed')
        modal.style.display = 'none'
      },
      { ariaDescribedBy: 'modal-title' }
    )
    closeButton.style.float = 'right'
    closeButton.style.marginBottom = '10px'
    
    modalContent.appendChild(modalTitle)
    modalContent.appendChild(closeButton)
    modalContent.appendChild(content)
    modal.appendChild(modalContent)
    
    modal.setAttribute('data-modal', 'open')
    
    if (options.trapFocus) {
      AccessibilityManager.trapFocus(modalContent)
    }
    
    return modal
  },

  // Create accessible navigation
  createAccessibleNavigation: (
    items: Array<{ label: string; href: string }>,
    options: { ariaLabel?: string } = {}
  ): HTMLElement => {
    const nav = document.createElement('nav')
    nav.setAttribute('role', 'navigation')
    
    if (options.ariaLabel) {
      nav.setAttribute('aria-label', options.ariaLabel)
    }
    
    const ul = document.createElement('ul')
    ul.style.listStyle = 'none'
    ul.style.padding = '0'
    ul.style.margin = '0'
    
    items.forEach(item => {
      const li = document.createElement('li')
      li.style.marginBottom = '4px'
      
      const a = document.createElement('a')
      a.href = item.href
      a.textContent = item.label
      a.style.display = 'block'
      a.style.padding = '8px 12px'
      a.style.textDecoration = 'none'
      a.style.color = '#667eea'
      
      if (a.getAttribute('href') === window.location.pathname) {
        a.style.fontWeight = 'bold'
        a.style.backgroundColor = '#f0f0f0'
      }
      
      li.appendChild(a)
      ul.appendChild(li)
    })
    
    nav.appendChild(ul)
    return nav
  }
}