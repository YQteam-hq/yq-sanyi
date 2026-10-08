/**
 * Event Utils - Advanced Event Management and Delegation Utilities for yq-sanyi
 * 
 * This package provides comprehensive event management, delegation, pub/sub,
 * and observer pattern utilities for yq-sanyi applications. It includes event
 * emitters, event listeners, event delegation, and advanced event handling.
 * 
 * @packageDocumentation
 */

/**
 * Event types
 */
export type EventType = string;

/**
 * Event data structure
 */
export interface Event<T = any> {
  type: EventType;
  data: T;
  timestamp: number;
  target?: any;
  currentTarget?: any;
  bubbles?: boolean;
  cancelable?: boolean;
  defaultPrevented?: boolean;
  propagationStopped?: boolean;
}

/**
 * Event listener function
 */
export type EventListener<T = any> = (event: Event<T>) => void | Promise<void>;

/**
 * Event listener options
 */
export interface EventListenerOptions {
  once?: boolean;
  passive?: boolean;
  capture?: boolean;
  priority?: number;
  signal?: AbortSignal;
}

/**
 * Event emitter interface
 */
export interface EventEmitter {
  on<T = any>(type: EventType, listener: EventListener<T>, options?: EventListenerOptions): void;
  off<T = any>(type: EventType, listener: EventListener<T>): void;
  emit<T = any>(type: EventType, data: T, options?: EventEmitOptions): boolean;
  once<T = any>(type: EventType, listener: EventListener<T>, options?: EventListenerOptions): void;
  removeAllListeners(type?: EventType): void;
  listenerCount(type: EventType): number;
  listeners(type: EventType): EventListener[];
  hasListener(type: EventType, listener: EventListener): boolean;
}

/**
 * Event emit options
 */
export interface EventEmitOptions {
  bubbles?: boolean;
  cancelable?: boolean;
  target?: any;
  currentTarget?: any;
}

/**
 * Event delegation interface
 */
export interface EventDelegator {
  delegate<T = any>(selector: string, type: EventType, listener: EventListener<T>, options?: EventListenerOptions): void;
  undelegate<T = any>(selector: string, type: EventType, listener: EventListener<T>): void;
  undelegateAll(selector?: string): void;
  getDelegatedEvents<T = any>(): Array<{ selector: string; type: EventType; listener: EventListener<T> }>;
}

/**
 * Pub/Sub interface
 */
export interface PubSub {
  publish<T = any>(channel: string, data: T): void;
  subscribe<T = any>(channel: string, listener: EventListener<T>, options?: EventListenerOptions): () => void;
  unsubscribe<T = any>(channel: string, listener: EventListener<T>): void;
  unsubscribeAll(channel?: string): void;
  getSubscriptions<T = any>(channel?: string): Array<{ channel: string; listener: EventListener<T> }>;
}

/**
 * Observer interface
 */
export interface Observer<T = any> {
  next(value: T): void;
  error(error: any): void;
  complete(): void;
}

/**
 * Observable interface
 */
export interface Observable<T = any> {
  subscribe(observer: Observer<T> | EventListener<T>): () => void;
  pipe<R>(...operators: Array<(source: Observable<T>) => Observable<R>>): Observable<R>;
  map<R>(project: (value: T) => R): Observable<R>;
  filter(predicate: (value: T) => boolean): Observable<T>;
  debounceTime(duration: number): Observable<T>;
  throttleTime(duration: number): Observable<T>;
  distinctUntilChanged(): Observable<T>;
  take(count: number): Observable<T>;
  takeUntil(predicate: (value: T) => boolean): Observable<T>;
}

/**
 * Event bus interface
 */
export interface EventBus {
  emit<T = any>(type: EventType, data: T, options?: EventEmitOptions): boolean;
  on<T = any>(type: EventType, listener: EventListener<T>, options?: EventListenerOptions): void;
  off<T = any>(type: EventType, listener: EventListener<T>): void;
  once<T = any>(type: EventType, listener: EventListener<T>, options?: EventListenerOptions): void;
  removeAllListeners(type?: EventType): void;
}

/**
 * Event statistics
 */
export interface EventStats {
  totalEvents: number;
  eventsByType: Record<EventType, number>;
  listenersCount: number;
  averageEventTime: number;
  maxEventTime: number;
  minEventTime: number;
}

/**
 * Event throttler options
 */
export interface ThrottleOptions {
  leading?: boolean;
  trailing?: boolean;
  limit?: number;
  interval?: number;
}

/**
 * Event debouncer options
 */
export interface DebounceOptions {
  leading?: boolean;
  trailing?: boolean;
  wait?: number;
  maxWait?: number;
}

/**
 * Base event emitter implementation
 */
export class BaseEventEmitter implements EventEmitter {
  private events: Map<EventType, Array<{ listener: EventListener; options: EventListenerOptions }>> = new Map();
  private stats: EventStats = {
    totalEvents: 0,
    eventsByType: {},
    listenersCount: 0,
    averageEventTime: 0,
    maxEventTime: 0,
    minEventTime: 0
  };
  
  on<T = any>(type: EventType, listener: EventListener<T>, options: EventListenerOptions = {}): void {
    if (!this.events.has(type)) {
      this.events.set(type, []);
    }
    
    const listeners = this.events.get(type)!;
    listeners.push({ listener, options });
    
    this.stats.listenersCount++;
    this.stats.eventsByType[type] = (this.stats.eventsByType[type] || 0) + 1;
    
    // Handle once option
    if (options.once) {
      const onceWrapper: EventListener = (event) => {
        listener(event);
        this.off(type, onceWrapper);
      };
      // Replace the listener with the wrapper
      listeners[listeners.length - 1].listener = onceWrapper;
    }
    
    // Handle signal option
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        this.off(type, listener);
      });
    }
  }
  
  off<T = any>(type: EventType, listener: EventListener<T>): void {
    const listeners = this.events.get(type);
    if (!listeners) return;
    
    const index = listeners.findIndex(l => l.listener === listener);
    if (index > -1) {
      listeners.splice(index, 1);
      this.stats.listenersCount--;
      
      if (listeners.length === 0) {
        this.events.delete(type);
      }
    }
  }
  
  emit<T = any>(type: EventType, data: T, options: EventEmitOptions = {}): boolean {
    const startTime = performance.now();
    const listeners = this.events.get(type);
    
    if (!listeners || listeners.length === 0) {
      return false;
    }
    
    const event: Event<T> = {
      type,
      data,
      timestamp: Date.now(),
      bubbles: options.bubbles || false,
      cancelable: options.cancelable || false,
      target: options.target,
      currentTarget: options.currentTarget
    };
    
    let defaultPrevented = false;
    let propagationStopped = false;
    
    // Create a copy of listeners to handle removal during iteration
    const listenersCopy = [...listeners];
    
    for (const { listener, options: listenerOptions } of listenersCopy) {
      if (propagationStopped) break;
      
      // Update event state
      event.defaultPrevented = defaultPrevented;
      event.propagationStopped = propagationStopped;
      
      // Call listener
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
      
      // Check if event was canceled
      if (event.cancelable && event.defaultPrevented) {
        defaultPrevented = true;
      }
      
      // Check if propagation was stopped
      if (event.propagationStopped) {
        propagationStopped = true;
      }
    }
    
    // Update statistics
    const eventTime = performance.now() - startTime;
    this.stats.totalEvents++;
    this.stats.eventsByType[type] = (this.stats.eventsByType[type] || 0) + 1;
    
    // Update average event time
    this.stats.averageEventTime = (this.stats.averageEventTime * (this.stats.totalEvents - 1) + eventTime) / this.stats.totalEvents;
    
    // Update max/min event time
    if (eventTime > this.stats.maxEventTime) {
      this.stats.maxEventTime = eventTime;
    }
    if (eventTime < this.stats.minEventTime || this.stats.minEventTime === 0) {
      this.stats.minEventTime = eventTime;
    }
    
    return !defaultPrevented;
  }
  
  once<T = any>(type: EventType, listener: EventListener<T>, options: EventListenerOptions = {}): void {
    this.on(type, listener, { ...options, once: true });
  }
  
  removeAllListeners(type?: EventType): void {
    if (type) {
      const listeners = this.events.get(type);
      if (listeners) {
        this.stats.listenersCount -= listeners.length;
        this.events.delete(type);
      }
    } else {
      this.stats.listenersCount = 0;
      this.events.clear();
    }
  }
  
  listenerCount(type: EventType): number {
    return this.events.get(type)?.length || 0;
  }
  
  listeners(type: EventType): EventListener[] {
    return this.events.get(type)?.map(l => l.listener) || [];
  }
  
  hasListener(type: EventType, listener: EventListener): boolean {
    return this.events.get(type)?.some(l => l.listener === listener) || false;
  }
  
  getStats(): EventStats {
    return { ...this.stats };
  }
}

/**
 * Event delegation implementation
 */
export class EventDelegatorImpl implements EventDelegator {
  private delegatedEvents: Map<string, Array<{ selector: string; type: EventType; listener: EventListener; options: EventListenerOptions }>> = new Map();
  private element: HTMLElement;
  
  constructor(element: HTMLElement) {
    this.element = element;
    this.setupDelegation();
  }
  
  delegate<T = any>(selector: string, type: EventType, listener: EventListener<T>, options: EventListenerOptions = {}): void {
    if (!this.delegatedEvents.has(type)) {
      this.delegatedEvents.set(type, []);
    }
    
    this.delegatedEvents.get(type)!.push({ selector, type, listener, options });
  }
  
  undelegate<T = any>(selector: string, type: EventType, listener: EventListener<T>): void {
    const events = this.delegatedEvents.get(type);
    if (!events) return;
    
    const index = events.findIndex(e => e.selector === selector && e.listener === listener);
    if (index > -1) {
      events.splice(index, 1);
      
      if (events.length === 0) {
        this.delegatedEvents.delete(type);
      }
    }
  }
  
  undelegateAll(selector?: string): void {
    if (selector) {
      // Remove all delegated events for the specific selector
      this.delegatedEvents.forEach((events, type) => {
        const filtered = events.filter(e => e.selector !== selector);
        if (filtered.length === 0) {
          this.delegatedEvents.delete(type);
        } else {
          this.delegatedEvents.set(type, filtered);
        }
      });
    } else {
      // Remove all delegated events
      this.delegatedEvents.clear();
    }
  }
  
  getDelegatedEvents(): Array<{ selector: string; type: EventType; listener: EventListener }> {
    const result: Array<{ selector: string; type: EventType; listener: EventListener }> = [];
    
    this.delegatedEvents.forEach(events => {
      events.forEach(event => {
        result.push({
          selector: event.selector,
          type: event.type,
          listener: event.listener
        });
      });
    });
    
    return result;
  }
  
  private setupDelegation(): void {
    this.element.addEventListener('click', this.handleDelegation.bind(this) as any);
    this.element.addEventListener('change', this.handleDelegation.bind(this) as any);
    this.element.addEventListener('input', this.handleDelegation.bind(this) as any);
    this.element.addEventListener('submit', this.handleDelegation.bind(this) as any);
    this.element.addEventListener('focus', this.handleDelegation.bind(this) as any);
    this.element.addEventListener('blur', this.handleDelegation.bind(this) as any);
    this.element.addEventListener('keydown', this.handleDelegation.bind(this) as any);
    this.element.addEventListener('keyup', this.handleDelegation.bind(this) as any);
    this.element.addEventListener('keypress', this.handleDelegation.bind(this) as any);
  }
  
  private handleDelegation(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target) return;
    
    this.delegatedEvents.forEach((events, type) => {
      if (event.type !== type) return;
      
      events.forEach(({ selector, listener, options }) => {
        const matchingElement = target.closest(selector);
        if (matchingElement) {
          const delegatedEvent: Event = {
            type,
            data: { originalEvent: event },
            timestamp: Date.now(),
            target: matchingElement,
            currentTarget: target,
            bubbles: event.bubbles,
            cancelable: event.cancelable,
            defaultPrevented: event.defaultPrevented,
            propagationStopped: false
          };
          
          listener(delegatedEvent);
        }
      });
    });
  }
}

/**
 * Pub/Sub implementation
 */
export class PubSubImpl implements PubSub {
  private subscriptions: Map<string, Array<{ listener: EventListener; options: EventListenerOptions }>> = new Map();
  
  publish<T = any>(channel: string, data: T): void {
    const listeners = this.subscriptions.get(channel);
    if (!listeners || listeners.length === 0) return;
    
    const event: Event<T> = {
      type: channel,
      data,
      timestamp: Date.now()
    };
    
    // Create a copy of listeners to handle removal during iteration
    const listenersCopy = [...listeners];
    
    listenersCopy.forEach(({ listener, options }) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Pub/Sub listener error:', err);
      }
    });
  }
  
  subscribe<T = any>(channel: string, listener: EventListener<T>, options: EventListenerOptions = {}): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, []);
    }
    
    this.subscriptions.get(channel)!.push({ listener, options });
    
    // Return unsubscribe function
    return () => {
      this.unsubscribe(channel, listener);
    };
  }
  
  unsubscribe<T = any>(channel: string, listener: EventListener<T>): void {
    const listeners = this.subscriptions.get(channel);
    if (!listeners) return;
    
    const index = listeners.findIndex(l => l.listener === listener);
    if (index > -1) {
      listeners.splice(index, 1);
      
      if (listeners.length === 0) {
        this.subscriptions.delete(channel);
      }
    }
  }
  
  unsubscribeAll(channel?: string): void {
    if (channel) {
      this.subscriptions.delete(channel);
    } else {
      this.subscriptions.clear();
    }
  }
  
  getSubscriptions(channel?: string): Array<{ channel: string; listener: EventListener }> {
    const result: Array<{ channel: string; listener: EventListener }> = [];
    
    const channels = channel ? [channel] : Array.from(this.subscriptions.keys());
    
    channels.forEach(ch => {
      const listeners = this.subscriptions.get(ch);
      if (listeners) {
        listeners.forEach(({ listener }) => {
          result.push({ channel: ch, listener });
        });
      }
    });
    
    return result;
  }
}

/**
 * Observable implementation
 */
export class ObservableImpl<T = any> implements Observable<T> {
  private observers: Array<Observer<T> | EventListener<T>> = [];
  private isComplete = false;
  private errorValue: any = null;
  
  constructor(private source?: Observable<T> | ((observer: Observer<T>) => () => void)) {}
  
  subscribe(observer: Observer<T> | EventListener<T>): () => void {
    if (this.isComplete) {
      if ('complete' in observer) {
        observer.complete();
      }
      return () => {};
    }
    
    if (this.errorValue) {
      if ('error' in observer) {
        observer.error(this.errorValue);
      }
      return () => {};
    }
    
    // If source is a function, use it to create the subscription
    if (typeof this.source === 'function') {
      const obsObserver: Observer<T> = 'next' in observer ? 
        observer : 
        { 
          next: (data: T) => observer({ type: 'data', data, timestamp: Date.now() } as any), 
          error: (err: any) => { if ('error' in observer) (observer as any).error(err); },
          complete: () => { if ('complete' in observer) (observer as any).complete(); }
        };
      return this.source(obsObserver);
    }
    
    this.observers.push(observer);
    
    // Return unsubscribe function
    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }
  
  next(value: T): void {
    if (this.isComplete) return;
    
    this.observers.forEach(observer => {
      try {
        if ('next' in observer) {
          observer.next(value);
        } else {
          observer({ type: 'next', data: value, timestamp: Date.now() });
        }
      } catch (err) {
        console.error('Observable observer error:', err);
      }
    });
  }
  
  error(err: any): void {
    if (this.isComplete) return;
    
    this.errorValue = err;
    this.isComplete = true;
    
    this.observers.forEach(observer => {
      try {
        if ('error' in observer) {
          observer.error(err);
        }
      } catch (err) {
        console.error('Observable observer error:', err);
      }
    });
    
    this.observers = [];
  }
  
  complete(): void {
    if (this.isComplete) return;
    
    this.isComplete = true;
    
    this.observers.forEach(observer => {
      try {
        if ('complete' in observer) {
          observer.complete();
        }
      } catch (error) {
        console.error('Observable observer error:', error);
      }
    });
    
    this.observers = [];
  }
  
  pipe<R>(...operators: Array<(source: Observable<T>) => Observable<R>>): Observable<R> {
    let result: Observable<any> = this;
    
    for (const operator of operators) {
      result = operator(result);
    }
    
    return result as Observable<R>;
  }
  
  map<R>(project: (value: T) => R): Observable<R> {
    return new ObservableImpl<R>((observer: Observer<R>) => {
      return this.subscribe({
        next: value => observer.next(project(value)),
        error: err => observer.error(err),
        complete: () => observer.complete()
      });
    });
  }
  
  filter(predicate: (value: T) => boolean): Observable<T> {
    return new ObservableImpl<T>((observer: Observer<T>) => {
      return this.subscribe({
        next: value => {
          if (predicate(value)) {
            observer.next(value);
          }
        },
        error: err => observer.error(err),
        complete: () => observer.complete()
      });
    });
  }
  
  debounceTime(duration: number): Observable<T> {
    return new ObservableImpl<T>((observer: Observer<T>) => {
      let timeout: any;
      
      return this.subscribe({
        next: value => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            observer.next(value);
          }, duration);
        },
        error: err => observer.error(err),
        complete: () => {
          clearTimeout(timeout);
          observer.complete();
        }
      });
    });
  }
  
  throttleTime(duration: number): Observable<T> {
    return new ObservableImpl<T>((observer: Observer<T>) => {
      const throttledSource = new ObservableImpl<T>();
      let lastEmit = 0;
      let pending: T | null = null;
      let timeout: any;
      
      return this.subscribe({
        next: value => {
          const now = Date.now();
          
          if (now - lastEmit >= duration) {
            lastEmit = now;
            observer.next(value);
          } else {
            pending = value;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              if (pending !== null) {
                observer.next(pending);
                pending = null;
              }
            }, duration - (now - lastEmit));
          }
        },
        error: err => observer.error(err),
        complete: () => observer.complete()
      });
    });
  }
  
  distinctUntilChanged(): Observable<T> {
    return new ObservableImpl<T>((observer: Observer<T>) => {
      let lastValue: T | null = null;
      
      return this.subscribe({
        next: value => {
          if (lastValue === null || lastValue !== value) {
            lastValue = value;
            observer.next(value);
          }
        },
        error: err => observer.error(err),
        complete: () => observer.complete()
      });
    });
  }
  
  take(count: number): Observable<T> {
    return new ObservableImpl<T>((observer: Observer<T>) => {
      let taken = 0;
      
      return this.subscribe({
        next: value => {
          if (taken < count) {
            observer.next(value);
            taken++;
          }
          
          if (taken >= count) {
            observer.complete();
          }
        },
        error: err => observer.error(err),
        complete: () => observer.complete()
      });
    });
  }
  
  takeUntil(predicate: (value: T) => boolean): Observable<T> {
    return new ObservableImpl<T>((observer: Observer<T>) => {
      return this.subscribe({
        next: value => {
          if (predicate(value)) {
            observer.complete();
          } else {
            observer.next(value);
          }
        },
        error: err => observer.error(err),
        complete: () => observer.complete()
      });
    });
  }
}

/**
 * Event bus implementation
 */
export class EventBusImpl extends BaseEventEmitter implements EventBus {
  // Implementation is inherited from BaseEventEmitter
}

/**
 * Event utilities
 */
export const eventUtils = {
  /**
   * Create a new event emitter
   */
  createEmitter: (): EventEmitter => {
    return new BaseEventEmitter();
  },
  
  /**
   * Create a new event bus
   */
  createBus: (): EventBus => {
    return new EventBusImpl();
  },
  
  /**
   * Create a new pub/sub instance
   */
  createPubSub: (): PubSub => {
    return new PubSubImpl();
  },
  
  /**
   * Create a new observable
   */
  createObservable: <T>(initialValue?: T): Observable<T> => {
    const observable = new ObservableImpl<T>();
    
    if (initialValue !== undefined) {
      observable.next(initialValue);
    }
    
    return observable;
  },
  
  /**
   * Throttle function calls
   */
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    options: ThrottleOptions = {}
  ): T => {
    const { leading = true, trailing = true, limit = 1, interval = 1000 } = options;
    let lastCall = 0;
    let pendingTimeout: any;
    let pendingArgs: Parameters<T> | null = null;
    
    return ((...args: Parameters<T>): ReturnType<T> => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;
      
      if (timeSinceLastCall >= interval) {
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          pendingTimeout = null;
          pendingArgs = null;
        }
        
        if (leading) {
          lastCall = now;
          return func(...args);
        }
      } else if (trailing && pendingArgs === null) {
        pendingArgs = args;
        pendingTimeout = setTimeout(() => {
          if (pendingArgs !== null) {
            lastCall = Date.now();
            func(...pendingArgs);
            pendingArgs = null;
          }
        }, interval - timeSinceLastCall);
      }
      
      return undefined as ReturnType<T>;
    }) as T;
  },
  
  /**
   * Debounce function calls
   */
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    options: DebounceOptions = {}
  ): T => {
    const { leading = false, trailing = true, wait = 100, maxWait } = options;
    let timeout: any;
    let lastCall = 0;
    let pendingArgs: Parameters<T> | null = null;
    
    return ((...args: Parameters<T>): ReturnType<T> => {
      const now = Date.now();
      const callImmediately = leading && !timeout;
      
      clearTimeout(timeout);
      
      if (callImmediately) {
        lastCall = now;
        return func(...args);
      }
      
      pendingArgs = args;
      
      timeout = setTimeout(() => {
        if (pendingArgs !== null) {
          if (trailing) {
            func(...pendingArgs);
          }
          pendingArgs = null;
        }
      }, wait);
      
      // Handle max wait
      if (maxWait && now - lastCall >= maxWait) {
        if (pendingArgs !== null) {
          func(...pendingArgs);
          pendingArgs = null;
        }
      }
      
      return undefined as ReturnType<T>;
    }) as T;
  },
  
  /**
   * Create event delegation on an element
   */
  createDelegator: (element: HTMLElement): EventDelegator => {
    return new EventDelegatorImpl(element);
  },
  
  /**
   * Create custom event
   */
  createEvent: <T>(type: EventType, data: T, options: EventEmitOptions = {}): Event<T> => {
    return {
      type,
      data,
      timestamp: Date.now(),
      bubbles: options.bubbles || false,
      cancelable: options.cancelable || false,
      target: options.target,
      currentTarget: options.currentTarget
    };
  }
};

/**
 * Event monitoring utilities
 */
export const eventMonitoring = {
  /**
   * Monitor event emitter performance
   */
  monitorEmitter: (emitter: BaseEventEmitter, interval: number = 60000): () => void => {
    const intervalId = setInterval(() => {
      const stats = emitter.getStats();
      console.log('Event emitter stats:', stats);
    }, interval);
    
    return () => clearInterval(intervalId);
  },
  
  /**
   * Get event frequency analysis
   */
  getFrequencyAnalysis: (events: Array<{ type: EventType; timestamp: number }>, window: number = 60000): Record<EventType, number> => {
    const now = Date.now();
    const recentEvents = events.filter(event => now - event.timestamp <= window);
    
    const frequency: Record<EventType, number> = {};
    
    recentEvents.forEach(event => {
      frequency[event.type] = (frequency[event.type] || 0) + 1;
    });
    
    return frequency;
  },
  
  /**
   * Detect event storms
   */
  detectEventStorms: (events: Array<{ type: EventType; timestamp: number }>, threshold: number = 100, window: number = 1000): Array<{ type: EventType; count: number; timestamp: number }> => {
    const now = Date.now();
    const storms: Array<{ type: EventType; count: number; timestamp: number }> = [];
    
    // Group events by type
    const eventsByType: Record<EventType, Array<number>> = {};
    
    events.forEach(event => {
      if (now - event.timestamp <= window) {
        if (!eventsByType[event.type]) {
          eventsByType[event.type] = [];
        }
        eventsByType[event.type].push(event.timestamp);
      }
    });
    
    // Check for storms
    Object.entries(eventsByType).forEach(([type, timestamps]) => {
      if (timestamps.length >= threshold) {
        storms.push({
          type,
          count: timestamps.length,
          timestamp: Math.max(...timestamps)
        });
      }
    });
    
    return storms;
  }
};

/**
 * Event validation utilities
 */
export const eventValidation = {
  /**
   * Validate event data
   */
  validateEventData: (event: Event<any>): boolean => {
    return (
      typeof event === 'object' &&
      typeof event.type === 'string' &&
      typeof event.timestamp === 'number' &&
      event.timestamp > 0 &&
      event.data !== undefined
    );
  }
};

/**
 * Event sanitizer utilities
 */
export const eventSanitizer = {
  /**
   * Sanitize event data
   */
  sanitizeEventData: (event: Event<any>): Event<any> => {
    if (typeof event.data === 'string') {
      return {
        ...event,
        data: event.data.replace(/[<>]/g, '')
      };
    }
    return event;
  }
};