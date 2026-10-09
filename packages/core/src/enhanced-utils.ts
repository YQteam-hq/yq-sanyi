import { Signal, State, Derived } from './index.js'

export interface PerformanceMetrics {
  updateCount: number
  lastUpdateTime: number
  averageUpdateTime: number
  slowestUpdateTime: number
  derivationCount: number
  effectCount: number
}

export interface EnhancedErrorInfo {
  message: string
  code: string
  component?: string
  templateLocation?: string
  suggestion?: string
  stack?: string
}

export class EnhancedErrorHandler {
  private static errorMessages = new Map<string, string>()
  private static errorSuggestions = new Map<string, string>()
  private static performanceMetrics: PerformanceMetrics = {
    updateCount: 0,
    lastUpdateTime: 0,
    averageUpdateTime: 0,
    slowestUpdateTime: 0,
    derivationCount: 0,
    effectCount: 0
  }

  static initialize(): void {
    this.registerErrorMessages()
  }

  private static registerErrorMessages(): void {
    this.errorMessages.set('UNEXPRESSED_CLOSING_BRACE', 'Unclosed {{ expression - missing closing "}}"')
    this.errorMessages.set('EMPTY_EXPRESSION', 'Empty expression in {{ }} - provide a valid path')
    this.errorMessages.set('INVALID_PATH', 'Invalid path format - use dot notation (e.g., user.name)')
    this.errorMessages.set('DUPLICATE_BINDING', 'Duplicate binding name in yq-for - item and index names must be different')
    this.errorMessages.set('MISSING_CLOSING_TAG', 'Unclosed HTML tag - check for missing closing tags')
    this.errorMessages.set('INVALID_TAG_NAME', 'Invalid custom element name - must contain hyphen and use lowercase')
    this.errorMessages.set('INVALID_DIRECTIVE', 'Invalid directive usage - check directive syntax')
    this.errorMessages.set('CIRCULAR_DEPENDENCY', 'Circular dependency detected in derived state')
    this.errorMessages.set('INVALID_COMPONENT_NAME', 'Invalid component name - must be a valid custom element name')
  }

  static createEnhancedError(error: Error, context?: {
    component?: string
    template?: string
    location?: string
  }): EnhancedErrorInfo {
    const code = this.getErrorCode(error.message)
    const suggestion = this.getErrorSuggestion(code)
    
    return {
      message: this.enhanceErrorMessage(error.message, context),
      code,
      component: context?.component,
      templateLocation: context?.location,
      suggestion,
      stack: error.stack
    }
  }

  private static getErrorCode(message: string): string {
    if (message.includes('unclosed')) return 'UNEXPRESSED_CLOSING_BRACE'
    if (message.includes('empty expression')) return 'EMPTY_EXPRESSION'
    if (message.includes('invalid path')) return 'INVALID_PATH'
    if (message.includes('duplicate binding')) return 'DUPLICATE_BINDING'
    if (message.includes('unclosed tag')) return 'MISSING_CLOSING_TAG'
    if (message.includes('invalid tag')) return 'INVALID_TAG_NAME'
    if (message.includes('circular dependency')) return 'CIRCULAR_DEPENDENCY'
    return 'UNKNOWN_ERROR'
  }

  private static getErrorSuggestion(code: string): string {
    return this.errorSuggestions.get(code) || 'Check your template syntax and try again'
  }

  private static enhanceErrorMessage(message: string, context?: {
    component?: string
    template?: string
    location?: string
  }): string {
    let enhanced = message
    if (context?.component) {
      enhanced = `[${context.component}] ${enhanced}`
    }
    if (context?.location) {
      enhanced += ` (at ${context.location})`
    }
    return enhanced
  }

  static updatePerformanceMetrics(type: 'update' | 'derivation' | 'effect', duration: number): void {
    const now = Date.now()
    
    switch (type) {
      case 'update':
        this.performanceMetrics.updateCount++
        this.performanceMetrics.lastUpdateTime = now
        this.performanceMetrics.averageUpdateTime = 
          (this.performanceMetrics.averageUpdateTime * (this.performanceMetrics.updateCount - 1) + duration) / 
          this.performanceMetrics.updateCount
        this.performanceMetrics.slowestUpdateTime = 
          Math.max(this.performanceMetrics.slowestUpdateTime, duration)
        break
      case 'derivation':
        this.performanceMetrics.derivationCount++
        break
      case 'effect':
        this.performanceMetrics.effectCount++
        break
    }
  }

  static getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  static resetMetrics(): void {
    this.performanceMetrics = {
      updateCount: 0,
      lastUpdateTime: 0,
      averageUpdateTime: 0,
      slowestUpdateTime: 0,
      derivationCount: 0,
      effectCount: 0
    }
  }
}

export class DebounceUtils {
  private static timeouts = new Map<string, number>()

  static debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number,
    key?: string
  ): (...args: Parameters<T>) => void {
    const timeoutKey = key || `debounce_${fn.name}_${Date.now()}`
    
    return (...args: Parameters<T>) => {
      if (this.timeouts.has(timeoutKey)) {
        clearTimeout(this.timeouts.get(timeoutKey) as number)
      }
      
      this.timeouts.set(timeoutKey, setTimeout(() => {
        fn(...args)
        this.timeouts.delete(timeoutKey)
      }, delay))
    }
  }

  static throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number,
    key?: string
  ): (...args: Parameters<T>) => void {
    const timeoutKey = key || `throttle_${fn.name}_${Date.now()}`
    let inThrottle = false
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        fn.apply(fn, args)
        inThrottle = true
        this.timeouts.set(timeoutKey, setTimeout(() => {
          inThrottle = false
          this.timeouts.delete(timeoutKey)
        }, limit))
      }
    }
  }

  static cancel(key: string): void {
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key)!)
      this.timeouts.delete(key)
    }
  }

  static cancelAll(): void {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout as number)
    }
    this.timeouts.clear()
  }
}

export class ValidationUtils {
  static validateTemplate(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    // Check for unclosed expressions
    const expressionRegex = /{{([^}]*)$/gm
    const unclosedExpressions = template.match(expressionRegex)
    if (unclosedExpressions) {
      errors.push(`Unclosed expression found: ${unclosedExpressions[0]}}}`)
    }
    
    // Check for empty expressions
    const emptyExpressionRegex = /{{\s*}}/g
    const emptyExpressions = template.match(emptyExpressionRegex)
    if (emptyExpressions) {
      errors.push('Empty expression found: {{ }}')
    }
    
    // Check for unbalanced tags
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g
    const tags: string[] = []
    const matches = template.match(tagRegex) || []
    
    for (const match of matches) {
      const isClosing = match.startsWith('</')
      const tagName = match.replace(/^<\/?|>$/g, '').split(/\s+/)[0]
      
      if (isClosing) {
        const openIndex = tags.lastIndexOf(tagName)
        if (openIndex === -1) {
          errors.push(`Closing tag without opening tag: ${match}`)
        } else {
          tags.splice(openIndex, 1)
        }
      } else {
        tags.push(tagName)
      }
    }
    
    // Check for unclosed tags
    for (const unclosedTag of tags) {
      errors.push(`Unclosed tag: ${unclosedTag}`)
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  static validateComponentName(name: string): boolean {
    return /^[a-z][a-z0-9-]*$/.test(name) && name.includes('-') && name.length > 1
  }

  static validateDirective(directive: string, value: string): { valid: boolean; error?: string } {
    switch (directive) {
      case 'yq-for':
        if (!value.includes(' in ') && !value.trim()) {
          return { valid: false, error: 'yq-for requires "item in items" syntax' }
        }
        break
      case 'yq-model':
        if (!value.trim()) {
          return { valid: false, error: 'yq-model requires a path' }
        }
        break
      case 'yq-if':
      case 'yq-show':
        if (!value.trim()) {
          return { valid: false, error: `${directive} requires a condition` }
        }
        break
    }
    return { valid: true }
  }
}

// Performance monitoring decorator
export function measurePerformance<T>(
  target: any,
  propertyKey: string,
  descriptor: TypedPropertyDescriptor<T>
): void {
  const originalMethod = descriptor.value!
  
  descriptor.value = function (this: any, ...args: any[]) {
    const start = performance.now()
    const result = (originalMethod as unknown as Function).apply(this, args)
    const end = performance.now()
    
    const duration = end - start
    EnhancedErrorHandler.updatePerformanceMetrics('update', duration)
    
    return result
  } as any
}