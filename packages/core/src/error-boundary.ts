import { emitError } from './error-bus.js'

export class ErrorBoundary {
  private props: {
    fallback: ((error: Error, errorInfo: any) => any) | null
    children: any
    onError: ((error: Error, errorInfo: any) => void) | null
    onRecover: ((state: any, err: Error) => void) | null
    resetKeys: string[]
    resetTimeout: number
    showStack: boolean
  }
  private state: {
    hasError: boolean
    error: Error | null
    errorInfo: any
    errorCount: number
    lastErrorTime: number | null
  }
  private unmounted: boolean = false
  private retryTimeout: any = null
  private retryCallbacks: Set<() => void> = new Set()

  constructor(props: {
    fallback?: (error: Error, errorInfo: any) => any
    children?: any
    onError?: (error: Error, errorInfo: any) => void
    onRecover?: (state: any, err: Error) => void
    resetKeys?: string[]
    resetTimeout?: number
    showStack?: boolean
  } = {}) {
    this.props = {
      fallback: null,
      children: null,
      onError: null,
      onRecover: null,
      resetKeys: [],
      resetTimeout: 5000,
      showStack: true,
      ...props
    }
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: null
    }
  }

  componentDidCatch(error: Error, errorInfo: any): void {
    this.state.hasError = true
    this.state.error = error
    this.state.errorInfo = errorInfo
    this.state.errorCount++
    this.state.lastErrorTime = Date.now()

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
    emitError(error, errorInfo)
  }

  reset(): void {
    const prevState = { ...this.state }
    const prevError = this.state.error
    this.state.hasError = false
    this.state.error = null
    this.state.errorInfo = null
    if (this.props.onRecover && prevError) {
      this.props.onRecover(prevState, prevError)
    }
  }

  destroy(): void {
    this.unmounted = true
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
    this.retryCallbacks.clear()
  }

  hasError(): boolean {
    return this.state.hasError
  }

  getErrorCount(): number {
    return this.state.errorCount
  }

  getLastErrorTime(): number | null {
    return this.state.lastErrorTime
  }

  render(): any {
    if (this.state.hasError && this.props.fallback) {
      return this.props.fallback(this.state.error!, this.state.errorInfo)
    }
    return null
  }
}