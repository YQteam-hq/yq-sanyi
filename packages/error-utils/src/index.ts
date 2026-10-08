/**
 * Error Utils - Advanced Error Handling and Recovery Utilities for yq-sanyi
 * 
 * This package provides comprehensive error handling, logging, monitoring,
 * and recovery mechanisms for yq-sanyi applications. It includes custom error
 * types, error recovery strategies, logging utilities, and error monitoring.
 * 
 * @packageDocumentation
 */

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories
 */
export type ErrorCategory = 'network' | 'validation' | 'authentication' | 'authorization' | 'business' | 'system' | 'unknown';

/**
 * Error recovery strategies
 */
export type RecoveryStrategy = 'retry' | 'fallback' | 'circuit-breaker' | 'rollback' | 'ignore' | 'custom';

/**
 * Error context information
 */
export interface ErrorContext {
  timestamp: number;
  userAgent?: string;
  url?: string;
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  data?: any;
  stack?: string;
}

/**
 * Error metadata
 */
export interface ErrorMetadata {
  severity: ErrorSeverity;
  category: ErrorCategory;
  retryCount?: number;
  recoveryAttempts?: number;
  errorCode?: string;
  documentation?: string;
  suggestions?: string[];
}

/**
 * Custom error class for yq-sanyi applications
 */
export class YQError extends Error {
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly context: ErrorContext;
  public readonly metadata: ErrorMetadata;
  public readonly retryable: boolean;
  
  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    severity: ErrorSeverity = 'medium',
    category: ErrorCategory = 'unknown',
    context: Partial<ErrorContext> = {},
    metadata: Partial<ErrorMetadata> = {},
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'YQError';
    this.code = code;
    this.severity = severity;
    this.category = category;
    this.context = {
      timestamp: Date.now(),
      ...context
    };
    this.metadata = {
      severity,
      category,
      ...metadata
    };
    this.retryable = retryable;
    
    // Capture stack trace (Node.js specific, not available in browsers)
    if (typeof Error !== 'undefined' && (Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, YQError);
    }
    
    // Add stack trace to context if not provided
    if (!this.context.stack && this.stack) {
      this.context.stack = this.stack;
    }
  }
  
  /**
   * Convert to JSON for serialization
   */
  toJSON(): any {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      category: this.category,
      context: this.context,
      metadata: this.metadata,
      retryable: this.retryable,
      stack: this.stack
    };
  }
  
  /**
   * Create error from existing error
   */
  static fromError(error: Error, overrides: Partial<YQError> = {}): YQError {
    return new YQError(
      error.message,
      overrides.code || 'UNKNOWN_ERROR',
      overrides.severity || 'medium',
      overrides.category || 'unknown',
      overrides.context || {},
      overrides.metadata || {},
      overrides.retryable || false
    );
  }
}

/**
 * Error handler interface
 */
export interface ErrorHandler {
  canHandle(error: Error): boolean;
  handle(error: Error, context?: ErrorContext): Promise<void> | void;
}

/**
 * Error recovery interface
 */
export interface ErrorRecovery {
  canRecover(error: Error): boolean;
  recover(error: Error, context?: ErrorContext): Promise<boolean> | boolean;
  getStrategy(): RecoveryStrategy;
}

/**
 * Error logger interface
 */
export interface ErrorLogger {
  log(error: Error, context?: ErrorContext): void;
  logError(error: YQError): void;
  logWarning(message: string, context?: ErrorContext): void;
  logInfo(message: string, context?: ErrorContext): void;
}

/**
 * Error monitoring interface
 */
export interface ErrorMonitor {
  trackError(error: Error, context?: ErrorContext): void;
  trackException(error: Error, context?: ErrorContext): void;
  getErrorStats(): ErrorStats;
  clearStats(): void;
}

/**
 * Error statistics
 */
export interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recentErrors: Array<{
    timestamp: number;
    error: YQError;
  }>;
  topErrors: Array<{
    code: string;
    count: number;
  }>;
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  maxRetries?: number;
  retryDelay?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
  enableLogging?: boolean;
  enableMonitoring?: boolean;
  logLevel?: ErrorSeverity;
  recoveryStrategies?: RecoveryStrategy[];
}

/**
 * Error Utils main class
 */
export class ErrorUtils {
  private static handlers: ErrorHandler[] = [];
  private static recoveryStrategies: ErrorRecovery[] = [];
  private static logger: ErrorLogger;
  private static monitor: ErrorMonitor;
  private static config: ErrorHandlerConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000,
    enableLogging: true,
    enableMonitoring: true,
    logLevel: 'medium',
    recoveryStrategies: ['retry', 'fallback', 'circuit-breaker', 'rollback']
  };
  
  private static circuitBreakers: Map<string, {
    failures: number;
    lastFailure: number;
    state: 'closed' | 'open' | 'half-open'
  }> = new Map();
  
  /**
   * Initialize error utils with configuration
   */
  public static init(config: Partial<ErrorHandlerConfig> = {}): void {
    this.config = { ...this.config, ...config };
    
    // Set up default logger
    if (!this.logger) {
      this.logger = new ConsoleErrorLogger();
    }
    
    // Set up default monitor
    if (!this.monitor) {
      this.monitor = new InMemoryErrorMonitor();
    }
    
    // Set up default recovery strategies
    if (this.recoveryStrategies.length === 0) {
      this.setupDefaultRecoveryStrategies();
    }
  }
  
  /**
   * Add error handler
   */
  public static addHandler(handler: ErrorHandler): void {
    this.handlers.push(handler);
  }
  
  /**
   * Add recovery strategy
   */
  public static addRecoveryStrategy(strategy: ErrorRecovery): void {
    this.recoveryStrategies.push(strategy);
  }
  
  /**
   * Set custom logger
   */
  public static setLogger(logger: ErrorLogger): void {
    this.logger = logger;
  }
  
  /**
   * Set custom monitor
   */
  public static setMonitor(monitor: ErrorMonitor): void {
    this.monitor = monitor;
  }
  
  /**
   * Get current monitor
   */
  public static getMonitor(): ErrorMonitor | null {
    return this.monitor;
  }
  
  /**
   * Handle an error with all registered handlers
   */
  public static async handleError(error: Error, context?: ErrorContext): Promise<void> {
    const yqError = error instanceof YQError ? error : YQError.fromError(error);
    
    // Log the error
    if (this.config.enableLogging) {
      this.logger.logError(yqError);
    }
    
    // Monitor the error
    if (this.config.enableMonitoring) {
      this.monitor.trackError(yqError, context);
    }
    
    // Handle with all handlers
    for (const handler of this.handlers) {
      if (handler.canHandle(yqError)) {
        await handler.handle(yqError, context);
      }
    }
    
    // Attempt recovery
    await this.attemptRecovery(yqError, context);
  }
  
  /**
   * Attempt to recover from an error
   */
  public static async attemptRecovery(error: Error, context?: ErrorContext): Promise<boolean> {
    const yqError = error instanceof YQError ? error : YQError.fromError(error);
    
    // Check circuit breaker first
    if (this.shouldCircuitBreak(yqError)) {
      return false;
    }
    
    // Try each recovery strategy
    for (const strategy of this.recoveryStrategies) {
      const recovery = this.recoveryStrategies.find(r => r.getStrategy() === strategy.getStrategy());
      if (recovery && recovery.canRecover(yqError)) {
        const success = await recovery.recover(yqError, context);
        if (success) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Execute a function with error handling
   */
  public static async executeWithRecovery<T>(
    fn: () => Promise<T>,
    context?: ErrorContext,
    fallbackValue?: T
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      await this.handleError(error as Error, context);
      return fallbackValue as T;
    }
  }
  
  /**
   * Execute a function with retry logic
   */
  public static async executeWithRetry<T>(
    fn: () => Promise<T>,
    context?: ErrorContext,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      shouldRetry?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries || this.config.maxRetries || 3;
    const retryDelay = options.retryDelay || this.config.retryDelay || 1000;
    const shouldRetry = options.shouldRetry || ((error) => error instanceof YQError && error.retryable);
    
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries || !shouldRetry(error as Error)) {
          break;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        
        // Update context with retry info
        if (context) {
          context.timestamp = Date.now();
        }
      }
    }
    
    // All retries failed
    await this.handleError(lastError!, context);
    throw lastError!;
  }
  
  /**
   * Create a circuit breaker for a specific operation
   */
  public static createCircuitBreaker(
    operation: () => Promise<any>,
    key: string,
    options: {
      threshold?: number;
      timeout?: number;
    } = {}
  ): () => Promise<any> {
    const threshold = options.threshold || this.config.circuitBreakerThreshold || 5;
    const timeout = options.timeout || this.config.circuitBreakerTimeout || 60000;
    
    return async () => {
      const breaker = this.circuitBreakers.get(key) || {
        failures: 0,
        lastFailure: 0,
        state: 'closed' as const
      };
      
      // Check if circuit is open
      if (breaker.state === 'open') {
        if (Date.now() - breaker.lastFailure > timeout) {
          breaker.state = 'half-open';
        } else {
          throw new YQError('Circuit breaker is open', 'CIRCUIT_BREAKER_OPEN', 'high', 'system');
        }
      }
      
      try {
        const result = await operation();
        
        // Reset on success
        if (breaker.state === 'half-open') {
          breaker.state = 'closed';
          breaker.failures = 0;
        }
        
        return result;
      } catch (error) {
        breaker.failures++;
        breaker.lastFailure = Date.now();
        
        if (breaker.failures >= threshold) {
          breaker.state = 'open';
        }
        
        this.circuitBreakers.set(key, breaker);
        throw error;
      }
    };
  }
  
  /**
   * Get error statistics
   */
  public static getErrorStats(): ErrorStats {
    return this.monitor.getErrorStats();
  }
  
  /**
   * Clear error statistics
   */
  public static clearStats(): void {
    this.monitor.clearStats();
  }
  
  /**
   * Check if operation should be blocked by circuit breaker
   */
  private static shouldCircuitBreak(error: YQError): boolean {
    if (error.category === 'network' || error.category === 'system') {
      const breaker = this.circuitBreakers.get(error.code);
      if (breaker && breaker.state === 'open') {
        return Date.now() - breaker.lastFailure < (this.config.circuitBreakerTimeout || 60000);
      }
    }
    return false;
  }
  
  /**
   * Set up default recovery strategies
   */
  private static setupDefaultRecoveryStrategies(): void {
    // Retry strategy
    this.addRecoveryStrategy({
      canRecover: (error) => error instanceof YQError && error.retryable,
      recover: async (error, context) => {
        // Simple retry logic
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
      },
      getStrategy: () => 'retry'
    });
    
    // Fallback strategy
    this.addRecoveryStrategy({
      canRecover: (error) => (error as YQError).category === 'network',
      recover: async (error, context) => {
        // Implement fallback logic
        return true;
      },
      getStrategy: () => 'fallback'
    });
    
    // Circuit breaker strategy
    this.addRecoveryStrategy({
      canRecover: (error) => (error as YQError).category === 'network' || (error as YQError).category === 'system',
      recover: async (error, context) => {
        // Circuit breaker handles this at a higher level
        return false;
      },
      getStrategy: () => 'circuit-breaker'
    });
  }
}

/**
 * Console-based error logger
 */
class ConsoleErrorLogger implements ErrorLogger {
  log(error: Error, context?: ErrorContext): void {
    console.error('Error:', error, context);
  }
  
  logError(error: YQError): void {
    console.error(`[${error.severity.toUpperCase()}] ${error.code}: ${error.message}`, {
      context: error.context,
      metadata: error.metadata
    });
  }
  
  logWarning(message: string, context?: ErrorContext): void {
    console.warn('Warning:', message, context);
  }
  
  logInfo(message: string, context?: ErrorContext): void {
    console.info('Info:', message, context);
  }
}

/**
 * In-memory error monitor
 */
class InMemoryErrorMonitor implements ErrorMonitor {
  private stats: ErrorStats = {
    totalErrors: 0,
    errorsByCategory: {
      network: 0,
      validation: 0,
      authentication: 0,
      authorization: 0,
      business: 0,
      system: 0,
      unknown: 0
    },
    errorsBySeverity: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    },
    recentErrors: [],
    topErrors: []
  };
  
  trackError(error: Error, context?: ErrorContext): void {
    if (error instanceof YQError) {
      this.stats.totalErrors++;
      this.stats.errorsByCategory[error.category]++;
      this.stats.errorsBySeverity[error.severity]++;
      
      // Add to recent errors
      this.stats.recentErrors.push({
        timestamp: Date.now(),
        error
      });
      
      // Keep only last 100 errors
      if (this.stats.recentErrors.length > 100) {
        this.stats.recentErrors = this.stats.recentErrors.slice(-100);
      }
      
      // Update top errors
      const existing = this.stats.topErrors.find(e => e.code === error.code);
      if (existing) {
        existing.count++;
      } else {
        this.stats.topErrors.push({
          code: error.code,
          count: 1
        });
      }
      
      // Sort top errors
      this.stats.topErrors.sort((a, b) => b.count - a.count);
      this.stats.topErrors = this.stats.topErrors.slice(0, 10);
    }
  }
  
  trackException(error: Error, context?: ErrorContext): void {
    this.trackError(error, context);
  }
  
  getErrorStats(): ErrorStats {
    return { ...this.stats };
  }
  
  clearStats(): void {
    this.stats = {
      totalErrors: 0,
      errorsByCategory: {
        network: 0,
        validation: 0,
        authentication: 0,
        authorization: 0,
        business: 0,
        system: 0,
        unknown: 0
      },
      errorsBySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      recentErrors: [],
      topErrors: []
    };
  }
}

/**
 * Error handling utilities
 */
export const errorHandling = {
  /**
   * Create a custom error
   */
  createError: (
    message: string,
    code: string = 'UNKNOWN_ERROR',
    severity: ErrorSeverity = 'medium',
    category: ErrorCategory = 'unknown',
    context?: Partial<ErrorContext>,
    metadata?: Partial<ErrorMetadata>,
    retryable: boolean = false
  ): YQError => {
    return new YQError(message, code, severity, category, context, metadata, retryable);
  },
  
  /**
   * Wrap an error with additional context
   */
  wrapError: (error: Error, context: Partial<ErrorContext> = {}): YQError => {
    return YQError.fromError(error, { context: { ...context } as any });
  },
  
  /**
   * Check if an error is retryable
   */
  isRetryable: (error: Error): boolean => {
    return error instanceof YQError && error.retryable;
  },
  
  /**
   * Check if an error is critical
   */
  isCritical: (error: Error): boolean => {
    return error instanceof YQError && error.severity === 'critical';
  }
};

/**
 * Error recovery utilities
 */
export const errorRecovery = {
  /**
   * Retry an operation with exponential backoff
   */
  retryWithBackoff: async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  },
  
  /**
   * Create a fallback operation
   */
  createFallback: <T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>
  ): () => Promise<T> => {
    return async () => {
      try {
        return await primary();
      } catch (error) {
        console.warn('Primary operation failed, using fallback:', error);
        return await fallback();
      }
    };
  }
};

/**
 * Error monitoring utilities
 */
export const errorMonitoring = {
  /**
   * Track an error
   */
  track: (error: Error, context?: ErrorContext): void => {
    const monitor = ErrorUtils.getMonitor();
    if (monitor) {
      monitor.trackError(error, context);
    }
  },
  
  /**
   * Get error statistics
   */
  getStats: (): ErrorStats => {
    return ErrorUtils.getErrorStats();
  },
  
  /**
   * Clear error statistics
   */
  clearStats: (): void => {
    ErrorUtils.clearStats();
  }
};

/**
 * Error validation utilities
 */
export const errorValidation = {
  /**
   * Validate error context
   */
  validateContext: (context: ErrorContext): boolean => {
    return (
      typeof context.timestamp === 'number' &&
      (context.timestamp > 0) &&
      (!context.url || typeof context.url === 'string') &&
      (!context.userId || typeof context.userId === 'string') &&
      (!context.sessionId || typeof context.sessionId === 'string') &&
      (!context.component || typeof context.component === 'string') &&
      (!context.action || typeof context.action === 'string')
    );
  },
  
  /**
   * Sanitize error message for logging
   */
  sanitizeMessage: (message: string): string => {
    // Remove sensitive information
    return message
      .replace(/password=[^&]*/gi, 'password=***')
      .replace(/token=[^&]*/gi, 'token=***')
      .replace(/api_key=[^&]*/gi, 'api_key=***');
  }
};