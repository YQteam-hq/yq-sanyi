/**
 * Advanced State Management System for yq-sanyi
 * 
 * This module provides sophisticated state management capabilities including:
 * - Global state management with undo/redo functionality
 * - State persistence and synchronization
 * - State validation and middleware
 * - Time-travel debugging
 * - State analytics and monitoring
 * - Advanced derived state computations
 * - State composition and inheritance
 */

export interface StateConfig {
  persistence?: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB';
  persistenceKey?: string;
  maxHistory?: number;
  enableTimeTravel?: boolean;
  enableAnalytics?: boolean;
  middleware?: StateMiddleware[];
  validators?: StateValidator[];
  debounceTime?: number;
  throttleTime?: number;
}

export interface StateMiddleware {
  (action: StateAction, next: () => void): void;
}

export interface StateValidator {
  (state: any, action: StateAction): boolean | Promise<boolean>;
}

export interface StateAction {
  type: string;
  payload?: any;
  timestamp: number;
  meta?: any;
  source?: 'user' | 'system' | 'middleware';
}

export interface StateHistory {
  past: StateSnapshot[];
  present: StateSnapshot;
  future: StateSnapshot[];
}

export interface StateSnapshot {
  state: any;
  timestamp: number;
  action?: StateAction;
  checksum: string;
}

export interface StateAnalytics {
  actionsCount: number;
  lastUpdate: number;
  updateFrequency: number;
  stateSize: number;
  memoryUsage: number;
  popularPaths: Array<{ path: string; accessCount: number }>;
  errorCount: number;
  performanceMetrics: {
    averageUpdateTime: number;
    maxUpdateTime: number;
    minUpdateTime: number;
  };
}

export interface DerivedStateConfig {
  dependencies: string[];
  compute: (state: any) => any;
  cache?: boolean;
  cacheTimeout?: number;
  equalityCheck?: (a: any, b: any) => boolean;
}

export interface GlobalStateConfig {
  key: string;
  initialState: any;
  config?: StateConfig;
  scope?: 'global' | 'local' | 'session';
}

export class AdvancedStateManagement {
  private globalStates = new Map<string, any>();
  private stateHistories = new Map<string, StateHistory>();
  private stateAnalytics = new Map<string, StateAnalytics>();
  private derivedStates = new Map<string, DerivedStateConfig>();
  private stateSubscriptions = new Map<string, Set<(state: any) => void>>();
  private middleware: StateMiddleware[] = [];
  private validators: StateValidator[] = [];
  private isBatching = false;
  private batchQueue: Array<{ key: string; action: StateAction; state: any }> = [];

  constructor() {
    this.loadPersistedStates();
    this.startAnalyticsCollection();
  }

  private loadPersistedStates(): void {
    const states = localStorage.getItem('yq-sanyi-global-states');
    if (states) {
      try {
        const parsed = JSON.parse(states);
        this.globalStates = new Map(Object.entries(parsed));
      } catch (error) {
        console.warn('Failed to load persisted states:', error);
      }
    }
  }

  private persistState(key: string, state: any): void {
    if (this.getPersistenceConfig(key)?.persistence === 'localStorage') {
      const allStates = Object.fromEntries(this.globalStates);
      localStorage.setItem('yq-sanyi-global-states', JSON.stringify(allStates));
    }
  }

  private getPersistenceConfig(key: string): StateConfig | undefined {
    return this.globalStates.get(`${key}__config`) as StateConfig;
  }

  private generateChecksum(state: any): string {
    const stateString = JSON.stringify(state, (_, value) => {
      if (typeof value === 'function') return '[Function]';
      if (value instanceof Date) return value.toISOString();
      return value;
    });
    let hash = 0;
    for (let i = 0; i < stateString.length; i++) {
      const char = stateString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private startAnalyticsCollection(): void {
    setInterval(() => {
      this.stateAnalytics.forEach((analytics, key) => {
        const currentState = this.globalStates.get(key);
        analytics.stateSize = JSON.stringify(currentState).length;
        analytics.memoryUsage = this.estimateMemoryUsage(currentState);
      });
    }, 30000);
  }

  private estimateMemoryUsage(obj: any): number {
    if (typeof obj !== 'object' || obj === null) {
      return obj ? obj.toString().length * 2 : 0;
    }
    
    let size = 0;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        size += key.toString().length * 2;
        size += this.estimateMemoryUsage(obj[key]);
      }
    }
    return size;
  }

  public createGlobalState(config: GlobalStateConfig): AdvancedStateInstance {
    const { key, initialState, config: stateConfig = {} } = config;
    
    // Initialize state
    this.globalStates.set(key, initialState);
    this.globalStates.set(`${key}__config`, stateConfig);

    // Initialize history if enabled
    if (stateConfig.enableTimeTravel) {
      this.stateHistories.set(key, {
        past: [],
        present: {
          state: initialState,
          timestamp: Date.now(),
          checksum: this.generateChecksum(initialState)
        },
        future: []
      });
    }

    // Initialize analytics if enabled
    if (stateConfig.enableAnalytics) {
      this.stateAnalytics.set(key, {
        actionsCount: 0,
        lastUpdate: Date.now(),
        updateFrequency: 0,
        stateSize: JSON.stringify(initialState).length,
        memoryUsage: this.estimateMemoryUsage(initialState),
        popularPaths: [],
        errorCount: 0,
        performanceMetrics: {
          averageUpdateTime: 0,
          maxUpdateTime: 0,
          minUpdateTime: 0
        }
      });
    }

    return new AdvancedStateInstance(this, key, stateConfig);
  }

  public getGlobalState(key: string): any {
    return this.globalStates.get(key);
  }

  public setGlobalState(key: string, state: any, action?: StateAction): void {
    const config = this.getPersistenceConfig(key);
    const startTime = performance.now();

    // Apply middleware
    const processedAction = { ...action, timestamp: Date.now(), source: 'system' as const };
    
    if (this.middleware.length > 0) {
      this.processMiddleware(processedAction, () => {
        this.updateStateInternal(key, state, processedAction, startTime);
      });
    } else {
      this.updateStateInternal(key, state, processedAction, startTime);
    }
  }

  private processMiddleware(action: StateAction, next: () => void): void {
    const processIndex = (index: number): void => {
      if (index >= this.middleware.length) {
        next();
        return;
      }
      
      this.middleware[index](action, () => processIndex(index + 1));
    };
    
    processIndex(0);
  }

  private updateStateInternal(key: string, state: any, action: StateAction, startTime: number): void {
    // Validate state
    this.validateState(key, state, action).then(isValid => {
      if (!isValid) {
        console.error(`State validation failed for key: ${key}`);
        return;
      }

      const oldState = this.globalStates.get(key);
      this.globalStates.set(key, state);

      // Update history
      this.updateHistory(key, oldState, state, action);

      // Update analytics
      this.updateAnalytics(key, action, performance.now() - startTime);

      // Persist if needed
      this.persistState(key, state);

      // Notify subscribers
      this.notifySubscribers(key, state);

      // Update derived states
      this.updateDerivedStates(key, state);
    });
  }

  private async validateState(key: string, state: any, action: StateAction): Promise<boolean> {
    for (const validator of this.validators) {
      const result = await validator(state, action);
      if (!result) {
        return false;
      }
    }
    return true;
  }

  private updateHistory(key: string, oldState: any, newState: any, action: StateAction): void {
    const history = this.stateHistories.get(key);
    if (!history) return;

    const newSnapshot = {
      state: newState,
      timestamp: Date.now(),
      action,
      checksum: this.generateChecksum(newState)
    };

    // Add to past
    history.past.push({
      state: oldState,
      timestamp: history.present.timestamp,
      checksum: history.present.checksum
    });

    // Limit history size
    const maxHistory = this.getPersistenceConfig(key)?.maxHistory || 50;
    if (history.past.length > maxHistory) {
      history.past.shift();
    }

    // Update present
    history.present = newSnapshot;

    // Clear future on new action
    history.future = [];
  }

  private updateAnalytics(key: string, action: StateAction, updateTime: number): void {
    const analytics = this.stateAnalytics.get(key);
    if (!analytics) return;

    analytics.actionsCount++;
    analytics.lastUpdate = action.timestamp;
    
    // Update frequency
    const now = Date.now();
    const timeDiff = now - analytics.lastUpdate;
    analytics.updateFrequency = timeDiff > 0 ? 1000 / timeDiff : 0;

    // Update performance metrics
    const metrics = analytics.performanceMetrics;
    if (metrics.averageUpdateTime === 0) {
      metrics.averageUpdateTime = updateTime;
      metrics.maxUpdateTime = updateTime;
      metrics.minUpdateTime = updateTime;
    } else {
      metrics.averageUpdateTime = (metrics.averageUpdateTime + updateTime) / 2;
      metrics.maxUpdateTime = Math.max(metrics.maxUpdateTime, updateTime);
      metrics.minUpdateTime = Math.min(metrics.minUpdateTime, updateTime);
    }
  }

  private notifySubscribers(key: string, state: any): void {
    const subscribers = this.stateSubscriptions.get(key);
    if (subscribers) {
      subscribers.forEach(callback => callback(state));
    }
  }

  private updateDerivedStates(changedKey: string, newState: any): void {
    this.derivedStates.forEach((config, derivedKey) => {
      if (config.dependencies.includes(changedKey)) {
        const computedValue = config.compute(newState);
        this.globalStates.set(derivedKey, computedValue);
        this.notifySubscribers(derivedKey, computedValue);
      }
    });
  }

  public addMiddleware(middleware: StateMiddleware): void {
    this.middleware.push(middleware);
  }

  public addValidator(validator: StateValidator): void {
    this.validators.push(validator);
  }

  public subscribe(key: string, callback: (state: any) => void): () => void {
    if (!this.stateSubscriptions.has(key)) {
      this.stateSubscriptions.set(key, new Set());
    }
    this.stateSubscriptions.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subscribers = this.stateSubscriptions.get(key);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.stateSubscriptions.delete(key);
        }
      }
    };
  }

  public getAnalytics(key: string): StateAnalytics | undefined {
    return this.stateAnalytics.get(key);
  }

  public getHistory(key: string): StateHistory | undefined {
    return this.stateHistories.get(key);
  }

  public undo(key: string): boolean {
    const history = this.stateHistories.get(key);
    if (!history || history.past.length === 0) return false;

    const previous = history.past.pop()!;
    history.future.unshift(history.present);
    history.present = previous;

    this.globalStates.set(key, previous.state);
    this.notifySubscribers(key, previous.state);

    return true;
  }

  public redo(key: string): boolean {
    const history = this.stateHistories.get(key);
    if (!history || history.future.length === 0) return false;

    const next = history.future.shift()!;
    history.past.push(history.present);
    history.present = next;

    this.globalStates.set(key, next.state);
    this.notifySubscribers(key, next.state);

    return true;
  }

  public clearHistory(key: string): void {
    const history = this.stateHistories.get(key);
    if (history) {
      history.past = [];
      history.future = [];
      history.present.checksum = this.generateChecksum(history.present.state);
    }
  }

  public batchUpdate(updates: Array<{ key: string; state: any; action?: StateAction }>): void {
    this.isBatching = true;
    this.batchQueue = updates.map(update => ({
      key: update.key,
      action: { ...update.action, timestamp: Date.now(), source: 'system' as const },
      state: update.state
    }));
    
    // Process batch after a short delay
    setTimeout(() => {
      this.processBatch();
    }, 0);
  }

  private processBatch(): void {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    batch.forEach(({ key, action, state }) => {
      this.updateStateInternal(key, state, action, 0);
    });

    this.isBatching = false;
  }

  public createDerivedState(key: string, config: DerivedStateConfig): void {
    this.derivedStates.set(key, config);
    
    // Compute initial value
    const dependencies = config.dependencies.map(dep => this.globalStates.get(dep));
    const initialValue = config.compute(dependencies.reduce((acc, val, i) => {
      acc[config.dependencies[i]] = val;
      return acc;
    }, {}));
    
    this.globalStates.set(key, initialValue);
  }

  public getStatePath(key: string, path: string[]): any {
    const state = this.globalStates.get(key);
    if (!state) return undefined;

    let current = state;
    for (const segment of path) {
      if (current && typeof current === 'object' && segment in current) {
        current = current[segment];
      } else {
        return undefined;
      }
    }
    return current;
  }

  public setStatePath(key: string, path: string[], value: any): void {
    const state = this.globalStates.get(key);
    if (!state) return;

    const newState = { ...state };
    let current = newState;
    for (let i = 0; i < path.length - 1; i++) {
      const segment = path[i];
      if (!(segment in current) || typeof current[segment] !== 'object') {
        current[segment] = {};
      }
      current = current[segment];
    }
    current[path[path.length - 1]] = value;

    this.setGlobalState(key, newState, {
      type: 'setStatePath',
      payload: { path, value },
      timestamp: Date.now()
    });
  }

  public exportState(key: string): { state: any; history?: StateHistory; analytics?: StateAnalytics } {
    return {
      state: this.globalStates.get(key),
      history: this.stateHistories.get(key),
      analytics: this.stateAnalytics.get(key)
    };
  }

  public importState(key: string, data: { state: any; history?: StateHistory; analytics?: StateAnalytics }): void {
    this.globalStates.set(key, data.state);
    
    if (data.history) {
      this.stateHistories.set(key, data.history);
    }
    
    if (data.analytics) {
      this.stateAnalytics.set(key, data.analytics);
    }

    this.persistState(key, data.state);
  }

  public clearAllStates(): void {
    this.globalStates.clear();
    this.stateHistories.clear();
    this.stateAnalytics.clear();
    this.stateSubscriptions.clear();
    this.derivedStates.clear();
    
    localStorage.removeItem('yq-sanyi-global-states');
  }
}

export class AdvancedStateInstance {
  constructor(
    private manager: AdvancedStateManagement,
    private key: string,
    private config: StateConfig
  ) {}

  public get(): any {
    return this.manager.getGlobalState(this.key);
  }

  public set(state: any, action?: Partial<StateAction>): void {
    const fullAction: StateAction = {
      type: 'setState',
      payload: state,
      timestamp: Date.now(),
      source: 'user',
      ...action
    };
    
    this.manager.setGlobalState(this.key, state, fullAction);
  }

  public update(updater: (state: any) => any, action?: Partial<StateAction>): void {
    const currentState = this.get();
    const newState = updater(currentState);
    this.set(newState, action);
  }

  public subscribe(callback: (state: any) => void): () => void {
    return this.manager.subscribe(this.key, callback);
  }

  public getAnalytics(): StateAnalytics | undefined {
    return this.manager.getAnalytics(this.key);
  }

  public getHistory(): StateHistory | undefined {
    return this.manager.getHistory(this.key);
  }

  public undo(): boolean {
    return this.manager.undo(this.key);
  }

  public redo(): boolean {
    return this.manager.redo(this.key);
  }

  public clearHistory(): void {
    this.manager.clearHistory(this.key);
  }

  export(): { state: any; history?: StateHistory; analytics?: StateAnalytics } {
    return this.manager.exportState(this.key);
  }

  import(data: { state: any; history?: StateHistory; analytics?: StateAnalytics }): void {
    this.manager.importState(this.key, data);
  }
}

// Utility functions for state management
export const StateUtils = {
  deepMerge: (target: any, source: any): any => {
    const result = { ...target };
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = StateUtils.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    return result;
  },

  pick: (obj: any, paths: string[]): any => {
    const result: any = {};
    paths.forEach(path => {
      const value = StateUtils.get(obj, path);
      if (value !== undefined) {
        StateUtils.set(result, path, value);
      }
    });
    return result;
  },

  omit: (obj: any, paths: string[]): any => {
    const result = { ...obj };
    paths.forEach(path => {
      StateUtils.delete(result, path);
    });
    return result;
  },

  get: (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  },

  set: (obj: any, path: string, value: any): void => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  },

  delete: (obj: any, path: string): void => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => current?.[key], obj);
    if (target && lastKey in target) {
      delete target[lastKey];
    }
  },

  debounce: (func: (...args: any[]) => void, wait: number): (...args: any[]) => void => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  throttle: (func: (...args: any[]) => void, limit: number): (...args: any[]) => void => {
    let inThrottle: boolean;
    return (...args: any[]) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

// Create global instance
export const GlobalStateManager = new AdvancedStateManagement();

// Helper function to create state instances
export function createAdvancedState(config: GlobalStateConfig): AdvancedStateInstance {
  return GlobalStateManager.createGlobalState(config);
}

// Middleware for logging
export const createLoggingMiddleware = (logger: (action: StateAction) => void): StateMiddleware => {
  return (action, next) => {
    logger(action);
    next();
  };
};

// Middleware for validation
export const createValidationMiddleware = (rules: Record<string, (value: any) => boolean>): StateMiddleware => {
  return (action, next) => {
    if (action.payload && rules[action.type]) {
      const isValid = rules[action.type](action.payload);
      if (!isValid) {
        console.error(`Validation failed for action: ${action.type}`, action.payload);
        return;
      }
    }
    next();
  };
};

// State validator for required fields
export const createRequiredFieldsValidator = (requiredFields: string[]): StateValidator => {
  return (state) => {
    for (const field of requiredFields) {
      if (!(field in state) || state[field] === undefined || state[field] === null) {
        return false;
      }
    }
    return true;
  };
};

// State validator for type checking
export const createTypeValidator = (typeMap: Record<string, (value: any) => boolean>): StateValidator => {
  return (state) => {
    for (const [field, validator] of Object.entries(typeMap)) {
      if (field in state && !validator(state[field])) {
        return false;
      }
    }
    return true;
  };
};