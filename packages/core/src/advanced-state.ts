import { State, Derived, Signal } from './index.js'

export interface PersistOptions {
  key: string
  storage?: 'localStorage' | 'sessionStorage'
  serialize?: (value: any) => string
  deserialize?: (value: string) => any
  ttl?: number // Time to live in milliseconds
}

export interface HistoryOptions {
  maxSize?: number
  debounceTime?: number
  persist?: boolean
}

export interface ValidationRule<T> {
  validate: (value: T) => boolean
  message: string
}

export interface FormField<T> {
  value: T
  error?: string
  touched: boolean
  dirty: boolean
  validating: boolean
}

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  lastUpdated: number | null
}

export interface StateSelector<T, R> {
  (state: T): R
  equality?: (a: R, b: R) => boolean
}

export interface Action<T> {
  type: string
  payload?: any
  meta?: any
}

export interface Reducer<T, A extends Action<any>> {
  (state: T, action: A): T
}

export interface Middleware<T, A extends Action<any>> {
  (action: A, next: (action: A) => void): void
}

export class AdvancedStateManagement {
  private static persistedStates = new Map<string, { value: any; timestamp: number }>()
  private static stateHistory = new Map<string, any[]>()
  private static subscriptions = new Map<string, Set<() => void>>()
  private static validators = new Map<string, ValidationRule<any>[]>()
  private static middleware: Middleware<any, any>[] = []

  // State persistence
  static persist<T>(state: State<T>, options: PersistOptions): State<T> {
    const { key, storage = 'localStorage', serialize = JSON.stringify, deserialize = JSON.parse, ttl } = options
    
    // Load initial value from storage
    try {
      const stored = storage.getItem(key)
      if (stored) {
        const parsed = deserialize(stored)
        const now = Date.now()
        
        // Check TTL
        if (ttl && parsed.timestamp && now - parsed.timestamp > ttl) {
          storage.removeItem(key)
        } else {
          state.value = parsed.value
        }
      }
    } catch (error) {
      console.warn(`[yq:state] Failed to load persisted state for key "${key}":`, error)
    }

    // Subscribe to changes
    const unsubscribe = state.subscribe(() => {
      try {
        const data = {
          value: state.value,
          timestamp: Date.now()
        }
        storage.setItem(key, serialize(data))
      } catch (error) {
        console.warn(`[yq:state] Failed to persist state for key "${key}":`, error)
      }
    })

    // Store unsubscribe function for cleanup
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set())
    }
    this.subscriptions.get(key)!.add(unsubscribe)

    return state
  }

  static clearPersistedState(key: string, storage: 'localStorage' | 'sessionStorage' = 'localStorage'): void {
    storage.removeItem(key)
    this.subscriptions.delete(key)
  }

  // State history
  static enableHistory<T>(state: State<T>, options: HistoryOptions = {}): State<T> {
    const { maxSize = 50, debounceTime = 1000, persist = false } = options
    const key = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    this.stateHistory.set(key, [])
    let lastUpdate = 0

    const unsubscribe = state.subscribe(() => {
      const now = Date.now()
      if (now - lastUpdate < debounceTime) return
      
      lastUpdate = now
      const history = this.stateHistory.get(key)
      
      if (history) {
        history.push({
          value: state.value,
          timestamp: now,
          state: 'snapshot'
        })
        
        // Limit history size
        if (history.length > maxSize) {
          history.shift()
        }
        
        // Persist if requested
        if (persist) {
          try {
            localStorage.setItem(key, JSON.stringify(history))
          } catch (error) {
            console.warn(`[yq:state] Failed to persist history:`, error)
          }
        }
      }
    })

    return state
  }

  static getStateHistory<T>(state: State<T>): Array<{ value: T; timestamp: number; state: string }> {
    // Find history for this state
    for (const [key, history] of this.stateHistory) {
      if (history.length > 0 && history[0].value === state.value) {
        return history
      }
    }
    return []
  }

  // State validation
  static addValidation<T>(state: State<T>, rule: ValidationRule<T>, key?: string): () => void {
    const validationKey = key || `validation_${Date.now()}`
    
    if (!this.validators.has(validationKey)) {
      this.validators.set(validationKey, [])
    }
    this.validators.get(validationKey)!.push(rule)

    // Validate on change
    const unsubscribe = state.subscribe(() => {
      this.validateState(state, validationKey)
    })

    return unsubscribe
  }

  static validateState<T>(state: State<T>, key: string): boolean {
    const rules = this.validators.get(key)
    if (!rules) return true

    for (const rule of rules) {
      if (!rule.validate(state.value)) {
        console.error(`[yq:validation] ${rule.message}`, state.value)
        return false
      }
    }
    return true
  }

  // Form state management
  static createFormField<T>(initialValue: T): FormField<T> {
    return {
      value: initialValue,
      touched: false,
      dirty: false,
      validating: false
    }
  }

  static updateFormField<T>(field: FormField<T>, value: T): FormField<T> {
    return {
      ...field,
      value,
      dirty: true,
      touched: true
    }
  }

  static validateFormField<T>(field: FormField<T>, rules: ValidationRule<T>[]): FormField<T> {
    const errors: string[] = []
    
    for (const rule of rules) {
      if (!rule.validate(field.value)) {
        errors.push(rule.message)
      }
    }

    return {
      ...field,
      error: errors.length > 0 ? errors[0] : undefined,
      validating: false
    }
  }

  // Async state management
  static createAsyncState<T>(initialData: T | null = null): AsyncState<T> {
    return {
      data: initialData,
      loading: false,
      error: null,
      lastUpdated: null
    }
  }

  static async executeAsync<T>(
    asyncState: AsyncState<T>,
    asyncFn: () => Promise<T>,
    options: { onSuccess?: (data: T) => void; onError?: (error: Error) => void } = {}
  ): Promise<void> {
    asyncState.loading = true
    asyncState.error = null

    try {
      const data = await asyncFn()
      asyncState.data = data
      asyncState.lastUpdated = Date.now()
      asyncState.loading = false
      
      if (options.onSuccess) {
        options.onSuccess(data)
      }
    } catch (error) {
      asyncState.error = error instanceof Error ? error.message : String(error)
      asyncState.loading = false
      
      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  // State selectors with memoization
  static createSelector<T, R>(
    state: State<T>,
    selector: StateSelector<T, R>
  ): Derived<R> {
    const cache = new WeakMap()
    let lastValue: R | undefined
    let lastState: T | undefined

    return derived(() => {
      const currentState = state.value
      
      // Check cache
      if (lastState === currentState) {
        return lastValue!
      }

      const selected = selector(currentState)
      
      // Check equality
      if (lastValue !== undefined && selector.equality) {
        if (selector.equality(lastValue, selected)) {
          return lastValue
        }
      }

      lastValue = selected
      lastState = currentState
      return selected
    })
  }

  // State middleware
  static addMiddleware<T, A extends Action<any>>(middleware: Middleware<T, A>): void {
    this.middleware.push(middleware)
  }

  static dispatch<T, A extends Action<any>>(action: A, reducer: Reducer<T, A>, state: T): T {
    let currentState = state

    // Apply middleware
    const dispatchWithMiddleware = (action: A) => {
      for (const middleware of this.middleware) {
        middleware(action, (nextAction) => {
          currentState = reducer(currentState, nextAction)
        })
      }
    }

    dispatchWithMiddleware(action)
    currentState = reducer(currentState, action)

    return currentState
  }

  // State debugging
  static debugState<T>(state: State<T>, name: string): () => void {
    console.log(`[yq:state] Debugging state "${name}":`, {
      currentValue: state.value,
      type: typeof state.value,
      timestamp: Date.now()
    })

    const unsubscribe = state.subscribe(() => {
      console.log(`[yq:state] State "${name}" changed:`, {
        newValue: state.value,
        oldValue: arguments[0], // This won't work properly in derived state
        timestamp: Date.now()
      })
    })

    return unsubscribe
  }

  // State cleanup
  static cleanup(): void {
    // Unsubscribe all subscriptions
    for (const subscriptions of this.subscriptions.values()) {
      for (const unsubscribe of subscriptions) {
        unsubscribe()
      }
    }
    
    this.subscriptions.clear()
    this.stateHistory.clear()
    this.validators.clear()
    this.middleware = []
  }
}

// Utility functions for common state patterns
export const StateUtils = {
  // Local storage state
  localStorageState<T>(key: string, initialValue: T): State<T> {
    const state = State(initialValue)
    return AdvancedStateManagement.persist(state, { key, storage: 'localStorage' })
  },

  // Session storage state
  sessionStorageState<T>(key: string, initialValue: T): State<T> {
    const state = State(initialValue)
    return AdvancedStateManagement.persist(state, { key, storage: 'sessionStorage' })
  },

  // Debounced state updates
  debouncedState<T>(state: State<T>, delay: number): State<T> {
    let timeout: number | null = null
    let pendingValue: T | null = null

    const debouncedState: State<T> = {
      get value(): T {
        return state.value
      },
      set value(newValue: T) {
        pendingValue = newValue
        if (timeout) {
          clearTimeout(timeout)
        }
        timeout = setTimeout(() => {
          state.value = pendingValue!
          pendingValue = null
          timeout = null
        }, delay)
      },
      peek(): T {
        return state.value
      },
      subscribe(fn: () => void): () => void {
        return state.subscribe(fn)
      }
    }

    return debouncedState
  },

  // Throttled state updates
  throttledState<T>(state: State<T>, limit: number): State<T> {
    let lastUpdate = 0
    let pendingValue: T | null = null

    const throttledState: State<T> = {
      get value(): T {
        return state.value
      },
      set value(newValue: T) {
        const now = Date.now()
        if (now - lastUpdate >= limit) {
          state.value = newValue
          lastUpdate = now
        } else {
          pendingValue = newValue
        }
      },
      peek(): T {
        return state.value
      },
      subscribe(fn: () => void): () => void {
        return state.subscribe(fn)
      }
    }

    return throttledState
  },

  // Computed state with dependencies
  computedState<T, R>(
    dependencies: State<T>[],
    computeFn: (values: T[]) => R
  ): Derived<R> {
    return derived(() => {
      return computeFn(dependencies.map(dep => dep.value))
    })
  },

  // Undo/redo functionality
  createUndoRedoState<T>(initialState: T): {
    state: State<T>
    undo: () => void
    redo: () => void
    canUndo: boolean
    canRedo: boolean
    clearHistory: () => void
  } {
    const state = State(initialState)
    const history: T[] = [initialState]
    let currentIndex = 0

    const updateState = (newValue: T) => {
      // Remove anything after current index
      history.splice(currentIndex + 1)
      history.push(newValue)
      currentIndex = history.length - 1
      state.value = newValue
    }

    return {
      state,
      undo: () => {
        if (currentIndex > 0) {
          currentIndex--
          state.value = history[currentIndex]
        }
      },
      redo: () => {
        if (currentIndex < history.length - 1) {
          currentIndex++
          state.value = history[currentIndex]
        }
      },
      canUndo: currentIndex > 0,
      canRedo: currentIndex < history.length - 1,
      clearHistory: () => {
        history.length = 1
        currentIndex = 0
        state.value = history[0]
      }
    }
  }
}