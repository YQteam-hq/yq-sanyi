/**
 * Advanced state management patterns for yq-sanyi components
 * @packageDocumentation
 */

// import type { ComponentDefinition, ComponentScript } from '../../core/src/index.js' - Not available in package context

export type ComponentScript = (this: any) => any

export interface ComponentDefinition {
  name: string
  template: string
  style?: string
  script?: ComponentScript
}

export interface StateSelector<T = any> {
  (state: any): T
}

export interface StateAction<T = any> {
  (state: any): T
}

export interface StateMiddleware<T = any> {
  (next: (action: { type: string; payload?: any }) => { type: string; payload?: any }): (action: { type: string; payload?: any }) => { type: string; payload?: any }
}

export interface StateEffect<T = any> {
  (state: T): void | (() => void)
}

export interface StateReducer<T = any> {
  (state: T, action: { type: string; payload?: any }): T
}

export interface StateOptions<T = any> {
  initialState: T
  reducer?: StateReducer<T>
  middleware?: StateMiddleware<T>[]
  effects?: StateEffect<T>[]
  persist?: {
    key: string
    storage?: 'localStorage' | 'sessionStorage'
  }
}

export interface Store<T = any> {
  getState(): T
  dispatch(action: { type: string; payload?: any }): void
  subscribe(callback: (state: T) => void): () => void
  unsubscribe(callback: (state: T) => void): void
  destroy(): void
}

export interface Context<T = any> {
  Provider: ComponentDefinition
  Consumer: ComponentDefinition
  useContext(): T | null
}

/**
 * Advanced state management utilities
 */
export class StateManager {
  private stores: Map<string, Store> = new Map()
  private contexts: Map<string, Context> = new Map()
  private globalState: Record<string, any> = {}

  /**
   * Create a new store
   */
  createStore<T>(name: string, options: StateOptions<T>): Store {
    const store = new StoreImpl<T>(options)
    this.stores.set(name, store)
    return store
  }

  /**
   * Get a store by name
   */
  getStore<T>(name: string): Store<T> | null {
    return this.stores.get(name) || null
  }

  /**
   * Create a context
   */
  createContext<T>(name: string, defaultValue: T): Context<T> {
    const context = new ContextImpl<T>(name, defaultValue)
    this.contexts.set(name, context)
    return context
  }

  /**
   * Get a context by name
   */
  getContext<T>(name: string): Context<T> | null {
    return this.contexts.get(name) || null
  }

  /**
   * Set global state
   */
  setGlobalState(key: string, value: any): void {
    this.globalState[key] = value
  }

  /**
   * Get global state
   */
  getGlobalState(key: string): any {
    return this.globalState[key]
  }

  /**
   * Clear all stores and contexts
   */
  clearAll(): void {
    this.stores.forEach(store => store.destroy())
    this.stores.clear()
    this.contexts.clear()
    this.globalState = {}
  }
}

/**
 * Store implementation
 */
class StoreImpl<T> implements Store<T> {
  private state: T
  private listeners: Set<(state: T) => void> = new Set()
  private middleware: StateMiddleware<T>[]
  private reducer?: StateReducer<T>
  private effects: StateEffect<T>[]
  private persist?: { key: string; storage: Storage }

  constructor(options: StateOptions<T>) {
    this.state = options.initialState
    this.middleware = options.middleware || []
    this.reducer = options.reducer
    this.effects = options.effects || []
    this.persist = options.persist ? {
      key: options.persist.key,
      storage: options.persist.storage === 'sessionStorage' ? sessionStorage : localStorage
    } : undefined

    // Load persisted state
    if (this.persist) {
      try {
        const persisted = this.persist.storage.getItem(this.persist.key)
        if (persisted) {
          this.state = JSON.parse(persisted)
        }
      } catch (e) {
        console.warn('Failed to load persisted state:', e)
      }
    }

    // Initialize effects
    this.effects.forEach(effect => {
      const cleanup = effect(this.state)
      if (cleanup && typeof cleanup === 'function') {
        // Store cleanup function for later use
      }
    })
  }

  getState(): T {
    return this.state
  }

  dispatch(action: { type: string; payload?: any }): void {
    let dispatchAction = (action: { type: string; payload?: any }) => action

    // Apply middleware
    for (const middleware of this.middleware) {
      dispatchAction = middleware(dispatchAction)
    }

    const processedAction = dispatchAction(action)

    // Apply reducer if available
    if (this.reducer) {
      this.state = this.reducer(this.state, processedAction)
    } else {
      // Default action handling
      this.state = { ...this.state, ...processedAction.payload }
    }

    // Persist state if enabled
    if (this.persist) {
      try {
        this.persist.storage.setItem(this.persist.key, JSON.stringify(this.state))
      } catch (e) {
        console.warn('Failed to persist state:', e)
      }
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(this.state))
  }

  subscribe(callback: (state: T) => void): () => void {
    this.listeners.add(callback)
    return () => this.unsubscribe(callback)
  }

  unsubscribe(callback: (state: T) => void): void {
    this.listeners.delete(callback)
  }

  destroy(): void {
    this.listeners.clear()
    this.effects = []
  }
}

/**
 * Context implementation
 */
class ContextImpl<T> implements Context<T> {
  private name: string
  private defaultValue: T
  private currentValue: T | null = null
  private listeners: Set<(value: T | null) => void> = new Set()

  constructor(name: string, defaultValue: T) {
    this.name = name
    this.defaultValue = defaultValue
  }

  get Provider(): ComponentDefinition {
    return {
      name: `${this.name}-provider`,
      template: `<slot></slot>`,
      style: ``,
      script: function () {
        return {
          state: { value: (this as any).context?.value || null },
          onMount: function () {
            // Set context value
          }
        }
      }
    }
  }

  get Consumer(): ComponentDefinition {
    return {
      name: `${this.name}-consumer`,
      template: `<div>{{ contextValue }}</div>`,
      style: ``,
      script: function () {
        return {
          state: { contextValue: null },
          onMount: function (this: any) {
            this.state.contextValue = this.context?.value || null
          }
        }
      }
    }
  }

  useContext(): T | null {
    return this.currentValue
  }
}

/**
 * State management utilities
 */
export const StateUtils = {
  /**
   * Create a useStore hook
   */
  useStore: <T>(storeName: string): Store<T> | null => {
    // This would be integrated with yq-sanyi's component system
    return null
  },

  /**
   * Create a useContext hook
   */
  useContext: <T>(contextName: string): T | null => {
    // This would be integrated with yq-sanyi's component system
    return null
  },

  /**
   * Create a selector for derived state
   */
  createSelector: <T, R>(selector: StateSelector<T>, deps: any[] = []): StateSelector<R> => {
    return selector as unknown as StateSelector<R>
  },

  /**
   * Create an action creator
   */
  createAction: <T>(type: string, payload?: T): { type: string; payload?: T } => {
    return { type, payload }
  },

  /**
   * Create a reducer
   */
  createReducer: <T>(initialState: T, handlers: Record<string, StateReducer<T>>): StateReducer<T> => {
    return (state: T, action: { type: string; payload?: any }) => {
      const handler = handlers[action.type]
      return handler ? handler(state, action) : state
    }
  },

  /**
 * Create middleware
 */
  createMiddleware: <T>(middlewareFn: (action: { type: string; payload?: any }) => { type: string; payload?: any }): StateMiddleware<T> => {
    return (next) => (action: { type: string; payload?: any }) => middlewareFn(action)
  },

  /**
   * Create async middleware
   */
  createAsyncMiddleware: <T>(): StateMiddleware<T> => {
    return (next) => (action) => {
      if (action.type.endsWith('/pending')) {
        // Handle pending state
      } else if (action.type.endsWith('/fulfilled')) {
        // Handle fulfilled state
      } else if (action.type.endsWith('/rejected')) {
        // Handle rejected state
      }
      return next(action)
    }
  },

  /**
   * Create persistence middleware
   */
  createPersistenceMiddleware: <T>(key: string, storage: Storage = localStorage): StateMiddleware<T> => {
    return (next) => (action) => {
      const result = next(action)
      
      try {
        storage.setItem(key, JSON.stringify(result))
      } catch (e) {
        console.warn('Failed to persist state:', e)
      }
      
      return result
    }
  },

  /**
   * Create logging middleware
   */
  createLoggingMiddleware: <T>(): StateMiddleware<T> => {
    return (next) => (action) => {
      console.log('Dispatching action:', action)
      const result = next(action)
      console.log('New state:', result)
      return result
    }
  },

  /**
   * Create throttle middleware
   */
  createThrottleMiddleware: <T>(delay: number): StateMiddleware<T> => {
    let lastCall = 0
    return (next) => (action) => {
      const now = Date.now()
      if (now - lastCall >= delay) {
        lastCall = now
        return next(action)
      }
      return action
    }
  },

  /**
   * Create debounce middleware
   */
  createDebounceMiddleware: <T>(delay: number): StateMiddleware<T> => {
    let timeout: number | null = null
    return (next) => (action) => {
      if (timeout) {
        clearTimeout(timeout)
      }
      
      timeout = setTimeout(() => {
        next(action)
      }, delay)
      
      return action
    }
  }
}

/**
 * Pre-built state management components
 */
export const StateComponents = {
  /**
   * Create a counter store component
   */
  counterStore: (initialValue: number = 0): ComponentDefinition => ({
    name: 'yq-counter-store',
    template: `<div>Count: {{ count }}</div>`,
    style: ``,
    script: function () {
      const store = stateManager.createStore('counter', {
        initialState: { count: initialValue },
        reducer: (state: any, action: any) => {
          switch (action.type) {
            case 'increment':
              return { count: state.count + 1 }
            case 'decrement':
              return { count: state.count - 1 }
            case 'reset':
              return { count: initialValue }
            default:
              return state
          }
        }
      })

      return {
        state: { count: initialValue },
        onMount: function () {
          const unsubscribe = store.subscribe((newState: any) => {
            ;(this as any).state.count = newState.count
          })
        },
        increment: function () {
          store.dispatch({ type: 'increment' })
        },
        decrement: function () {
          store.dispatch({ type: 'decrement' })
        },
        reset: function () {
          store.dispatch({ type: 'reset' })
        }
      }
    }
  }),

  /**
   * Create a todo list store component
   */
  todoStore: (initialTodos: Array<{ id: string; text: string; completed: boolean }> = []): ComponentDefinition => ({
    name: 'yq-todo-store',
    template: `
      <div>
        <input yq-model="newTodo" placeholder="Add a todo" />
        <button yq-on:click="addTodo">Add</button>
        <ul>
          <li yq-for="todo in todos">
            <input type="checkbox" yq-model="todo.completed" yq-on:change="toggleTodo(todo.id)" />
            <span yq-class:completed="todo.completed">{{ todo.text }}</span>
            <button yq-on:click="removeTodo(todo.id)">Remove</button>
          </li>
        </ul>
      </div>
    `,
    style: `
      .completed { text-decoration: line-through; color: #666; }
      input[type="checkbox"] { margin-right: 0.5rem; }
    `,
    script: function () {
      const store = stateManager.createStore('todos', {
        initialState: { todos: initialTodos, newTodo: '' },
        reducer: (state: any, action: any) => {
          switch (action.type) {
            case 'addTodo':
              return {
                todos: [...state.todos, { id: Date.now().toString(), text: state.newTodo, completed: false }],
                newTodo: ''
              }
            case 'toggleTodo':
              return {
                todos: state.todos.map((todo: any) =>
                  todo.id === action.payload ? { ...todo, completed: !todo.completed } : todo
                ),
                newTodo: state.newTodo
              }
            case 'removeTodo':
              return {
                todos: state.todos.filter((todo: any) => todo.id !== action.payload),
                newTodo: state.newTodo
              }
            default:
              return state
          }
        }
      })

      return {
        state: { todos: initialTodos, newTodo: '' },
        onMount: function () {
          const unsubscribe = store.subscribe((newState: any) => {
            ;(this as any).state.todos = newState.todos
            ;(this as any).state.newTodo = newState.newTodo
          })
        },
        addTodo: function () {
          if ((this as any).state.newTodo.trim()) {
            store.dispatch({ type: 'addTodo' })
          }
        },
        toggleTodo: function (id: string) {
          store.dispatch({ type: 'toggleTodo', payload: id })
        },
        removeTodo: function (id: string) {
          store.dispatch({ type: 'removeTodo', payload: id })
        }
      }
    }
  }),

  /**
   * Create a global state provider
   */
  globalStateProvider: (initialState: Record<string, any>): ComponentDefinition => ({
    name: 'yq-global-state-provider',
    template: `<slot></slot>`,
    style: ``,
    script: function () {
      return {
        state: { ...initialState },
        setState: function (updates: Record<string, any>) {
          Object.assign((this as any).state, updates)
        },
        getState: function () {
          return { ...(this as any).state }
        }
      }
    }
  }),

  /**
   * Create a state consumer component
   */
  stateConsumer: (stateProvider: string, selector?: StateSelector): ComponentDefinition => ({
    name: 'yq-state-consumer',
    template: `<div>{{ selectedState }}</div>`,
    style: ``,
    script: function () {
      return {
        state: { selectedState: null },
        onMount: function (this: any) {
          // Subscribe to global state
          this.state.selectedState = selector ? selector(this.globalState) : this.globalState
        }
      }
    }
  })
}

/**
 * State management patterns
 */
export const StatePatterns = {
  /**
   * Create a simple state hook
   */
  useState: <T>(initialValue: T): [() => T, (value: T) => void] => {
    let state = initialValue
    const getState = () => state
    const setState = (newValue: T) => {
      state = newValue
      // Trigger re-render
    }
    return [getState, setState]
  },

  /**
   * Create a useReducer hook
   */
  useReducer: <T>(reducer: StateReducer<T>, initialState: T): [() => T, (action: { type: string; payload?: any }) => void] => {
    let state = initialState
    const getState = () => state
    const dispatch = (action: { type: string; payload?: any }) => {
      state = reducer(state, action)
      // Trigger re-render
    }
    return [getState, dispatch]
  },

  /**
   * Create a useContext hook
   */
  useContext: <T>(context: Context<T>): T | null => {
    return context.useContext()
  },

  /**
   * Create a useStore hook
   */
  useStore: <T>(store: Store<T>): [() => T, (action: { type: string; payload?: any }) => void] => {
    const getState = () => store.getState()
    const dispatch = (action: { type: string; payload?: any }) => {
      store.dispatch(action)
    }
    return [getState, dispatch]
  }
}

// Export singleton instance
export const stateManager = new StateManager()

// Export utilities - note: StateManager, Store, Context are already exported above