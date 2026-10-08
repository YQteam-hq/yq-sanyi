/**
 * Storage utilities for local storage, session storage, and cache management
 * @packageDocumentation
 */

/**
 * Storage type enum
 */
export enum StorageType {
  LOCAL = 'local',
  SESSION = 'session',
  MEMORY = 'memory'
}

/**
 * Cache strategy enum
 */
export enum CacheStrategy {
  MEMORY = 'memory',
  LOCAL_STORAGE = 'localStorage',
  SESSION_STORAGE = 'sessionStorage',
  HYBRID = 'hybrid'
}

/**
 * Storage configuration interface
 */
export interface StorageConfig {
  type: StorageType
  prefix?: string
  expires?: number
  maxSize?: number
  compress?: boolean
  serialize?: (value: any) => string
  deserialize?: (value: string) => any
}

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  strategy: CacheStrategy
  ttl?: number
  maxSize?: number
  cleanupInterval?: number
  serialize?: (value: any) => string
  deserialize?: (value: string) => any
}

/**
 * Cache entry interface
 */
export interface CacheEntry<T = any> {
  key: string
  value: T
  timestamp: number
  expires: number
  hits: number
  size: number
}

/**
 * Storage options interface
 */
export interface StorageOptions {
  expires?: number
  compress?: boolean
  serialize?: (value: any) => string
  deserialize?: (value: string) => any
}

/**
 * Enhanced storage class with advanced features
 */
export class EnhancedStorage {
  private storage: Storage
  private prefix: string
  private memoryCache: Map<string, any> = new Map()
  private compression: boolean = false
  private serializer: (value: any) => string = JSON.stringify
  private deserializer: (value: string) => any = JSON.parse

  constructor(config: StorageConfig) {
    this.storage = config.type === StorageType.LOCAL ? localStorage : 
                  config.type === StorageType.SESSION ? sessionStorage : 
                  (new Map() as any)
    this.prefix = config.prefix || ''
    this.compression = config.compress || false
    
    // Set custom serializer/deserializer if provided
    if (config.serialize) this.serializer = config.serialize
    if (config.deserialize) this.deserializer = config.deserialize
  }

  /**
   * Set item in storage
   */
  public set<T>(key: string, value: T, options?: StorageOptions): void {
    const fullKey = this.getFullKey(key)
    const expires = options?.expires || 0
    const timestamp = Date.now()
    
    // Create storage entry
    const entry = {
      value,
      timestamp,
      expires: expires > 0 ? timestamp + expires : 0,
      size: this.calculateSize(value)
    }

    // Compress if enabled
    const serializedValue = this.serializer(entry)
    const compressedValue = this.compression ? this.compress(serializedValue) : serializedValue

    // Store in appropriate storage
    if (this.storage instanceof Map) {
      this.storage.set(fullKey, compressedValue)
      this.memoryCache.set(fullKey, entry)
    } else {
      this.storage.setItem(fullKey, compressedValue)
    }

    // Handle expiration cleanup
    if (expires > 0) {
      setTimeout(() => this.remove(key), expires)
    }
  }

  /**
   * Get item from storage
   */
  public get<T>(key: string): T | null {
    const fullKey = this.getFullKey(key)
    
    // Check memory cache first
    if (this.memoryCache.has(fullKey)) {
      const entry = this.memoryCache.get(fullKey) as CacheEntry<T>
      if (this.isExpired(entry)) {
        this.remove(key)
        return null
      }
      entry.hits++
      return entry.value
    }

    // Get from storage
    const compressedValue = this.storage instanceof Map ? 
      this.storage.get(fullKey) : 
      this.storage.getItem(fullKey)

    if (!compressedValue) return null

    // Decompress if needed
    const serializedValue = this.compression ? this.decompress(compressedValue) : compressedValue
    
    try {
      const entry = this.deserializer(serializedValue) as CacheEntry<T>
      
      // Check expiration
      if (this.isExpired(entry)) {
        this.remove(key)
        return null
      }

      // Update memory cache
      entry.hits++
      this.memoryCache.set(fullKey, entry)
      
      return entry.value
    } catch (error) {
      console.error(`Error deserializing value for key ${key}:`, error)
      return null
    }
  }

  /**
   * Remove item from storage
   */
  public remove(key: string): void {
    const fullKey = this.getFullKey(key)
    
    if (this.storage instanceof Map) {
      this.storage.delete(fullKey)
    } else {
      this.storage.removeItem(fullKey)
    }
    
    this.memoryCache.delete(fullKey)
  }

  /**
   * Check if item exists in storage
   */
  public has(key: string): boolean {
    const fullKey = this.getFullKey(key)
    
    if (this.memoryCache.has(fullKey)) {
      const entry = this.memoryCache.get(fullKey) as CacheEntry
      return !this.isExpired(entry)
    }

    const value = this.storage instanceof Map ? 
      this.storage.get(fullKey) : 
      this.storage.getItem(fullKey)
    
    return value !== null
  }

  /**
   * Get all keys in storage
   */
  public keys(): string[] {
    const keys: string[] = []
    
    if (this.storage instanceof Map) {
      this.storage.forEach((_, key) => {
        if (key.startsWith(this.prefix)) {
          keys.push(key.slice(this.prefix.length))
        }
      })
    } else {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i)
        if (key && key.startsWith(this.prefix)) {
          keys.push(key.slice(this.prefix.length))
        }
      }
    }
    
    return keys
  }

  /**
   * Get all values in storage
   */
  public values<T = any>(): T[] {
    return this.keys().map(key => this.get<T>(key)).filter(value => value !== null) as T[]
  }

  /**
   * Get all entries in storage
   */
  public entries<T = any>(): Array<[string, T]> {
    return this.keys().map(key => [key, this.get<T>(key)!])
  }

  /**
   * Clear all items from storage
   */
  public clear(): void {
    if (this.storage instanceof Map) {
      this.storage.clear()
    } else {
      // Clear only prefixed items
      const keys = this.keys()
      keys.forEach(key => this.remove(key))
    }
    
    this.memoryCache.clear()
  }

  /**
   * Get storage size
   */
  public size(): number {
    return this.keys().length
  }

  /**
   * Get storage size in bytes
   */
  public sizeInBytes(): number {
    let totalSize = 0
    this.memoryCache.forEach(entry => {
      totalSize += entry.size
    })
    return totalSize
  }

  /**
   * Cleanup expired items
   */
  public cleanup(): void {
    const keys = this.keys()
    keys.forEach(key => {
      if (!this.has(key)) {
        this.remove(key)
      }
    })
  }

  /**
   * Get storage statistics
   */
  public getStats(): {
    totalItems: number
    totalSize: number
    hitCount: number
    missCount: number
    expiredCount: number
  } {
    let hitCount = 0
    let missCount = 0
    let expiredCount = 0
    let totalSize = 0

    this.memoryCache.forEach(entry => {
      if (this.isExpired(entry)) {
        expiredCount++
      } else {
        hitCount += entry.hits
        totalSize += entry.size
      }
    })

    return {
      totalItems: this.size(),
      totalSize,
      hitCount,
      missCount: expiredCount,
      expiredCount
    }
  }

  /**
   * Get full key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.prefix}${key}`
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return entry.expires > 0 && Date.now() > entry.expires
  }

  /**
   * Calculate size of value in bytes
   */
  private calculateSize(value: any): number {
    return new Blob([this.serializer(value)]).size
  }

  /**
   * Compress string
   */
  private compress(str: string): string {
    // Simple compression - in real implementation, use a proper compression library
    return btoa(encodeURIComponent(str))
  }

  /**
   * Decompress string
   */
  private decompress(str: string): string {
    // Simple decompression - in real implementation, use a proper compression library
    return decodeURIComponent(atob(str))
  }
}

/**
 * Cache manager with advanced strategies
 */
export class CacheManager {
  private caches: Map<string, EnhancedStorage> = new Map()
  private cleanupTimer: number | null = null
  private stats: {
    hits: number
    misses: number
    evictions: number
  } = { hits: 0, misses: 0, evictions: 0 }

  constructor(private defaultConfig: CacheConfig = { strategy: CacheStrategy.MEMORY }) {}

  /**
   * Get cache instance
   */
  private getCache(namespace: string): EnhancedStorage {
    if (!this.caches.has(namespace)) {
      const config = this.createStorageConfig(this.defaultConfig)
      const storage = new EnhancedStorage(config)
      
      // Setup cleanup if needed
      if (this.defaultConfig.cleanupInterval) {
        this.setupCleanup()
      }
      
      this.caches.set(namespace, storage)
    }
    
    return this.caches.get(namespace)!
  }

  /**
   * Create storage configuration from cache config
   */
  private createStorageConfig(config: CacheConfig): StorageConfig {
    switch (config.strategy) {
      case CacheStrategy.LOCAL_STORAGE:
        return { type: StorageType.LOCAL, prefix: `cache_${config.strategy}_` }
      case CacheStrategy.SESSION_STORAGE:
        return { type: StorageType.SESSION, prefix: `cache_${config.strategy}_` }
      case CacheStrategy.HYBRID:
        // Use memory for frequent access, localStorage for persistence
        return { type: StorageType.MEMORY, prefix: `cache_${config.strategy}_` }
      default:
        return { type: StorageType.MEMORY, prefix: `cache_${config.strategy}_` }
    }
  }

  /**
   * Setup cleanup timer
   */
  private setupCleanup(): void {
    if (this.cleanupTimer) return
    
    this.cleanupTimer = window.setInterval(() => {
      this.caches.forEach(cache => cache.cleanup())
    }, this.defaultConfig.cleanupInterval || 300000) // 5 minutes default
  }

  /**
   * Set cache value
   */
  public set<T>(namespace: string, key: string, value: T, ttl?: number): void {
    const cache = this.getCache(namespace)
    cache.set(key, value, { expires: ttl })
  }

  /**
   * Get cache value
   */
  public get<T>(namespace: string, key: string): T | null {
    const cache = this.getCache(namespace)
    const value = cache.get<T>(key)
    
    if (value !== null) {
      this.stats.hits++
    } else {
      this.stats.misses++
    }
    
    return value
  }

  /**
   * Remove cache value
   */
  public remove(namespace: string, key: string): void {
    const cache = this.getCache(namespace)
    cache.remove(key)
  }

  /**
   * Check if cache value exists
   */
  public has(namespace: string, key: string): boolean {
    const cache = this.getCache(namespace)
    return cache.has(key)
  }

  /**
   * Get all keys in cache namespace
   */
  public keys(namespace: string): string[] {
    const cache = this.getCache(namespace)
    return cache.keys()
  }

  /**
   * Clear cache namespace
   */
  public clear(namespace: string): void {
    const cache = this.getCache(namespace)
    cache.clear()
  }

  /**
   * Clear all caches
   */
  public clearAll(): void {
    this.caches.forEach(cache => cache.clear())
    this.caches.clear()
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): {
    hits: number
    misses: number
    evictions: number
    namespaces: number
    totalSize: number
  } {
    let totalSize = 0
    this.caches.forEach(cache => {
      totalSize += cache.sizeInBytes()
    })
    
    return {
      ...this.stats,
      namespaces: this.caches.size,
      totalSize
    }
  }

  /**
   * Get cache statistics for specific namespace
   */
  public getNamespaceStats(namespace: string): any {
    const cache = this.getCache(namespace)
    return cache.getStats()
  }
}

/**
 * Session storage utility
 */
export class SessionStorage extends EnhancedStorage {
  constructor(config?: StorageConfig) {
    super({ ...config, type: StorageType.SESSION })
  }
}

/**
 * Local storage utility
 */
export class LocalStorage extends EnhancedStorage {
  constructor(config?: StorageConfig) {
    super({ ...config, type: StorageType.LOCAL })
  }
}

/**
 * Memory storage utility
 */
export class MemoryStorage extends EnhancedStorage {
  constructor(config?: StorageConfig) {
    super({ ...config, type: StorageType.MEMORY })
  }
}

/**
 * Storage utilities
 */
export const StorageUtils = {
  createStorage: (config: StorageConfig) => new EnhancedStorage(config),
  createLocalStorage: (config?: StorageConfig) => new LocalStorage(config),
  createSessionStorage: (config?: StorageConfig) => new SessionStorage(config),
  createMemoryStorage: (config?: StorageConfig) => new MemoryStorage(config),
  createCacheManager: (config?: CacheConfig) => new CacheManager(config)
}

/**
 * Default cache manager instance
 */
let defaultCacheManager: CacheManager | null = null

/**
 * Create default cache manager
 */
export function createDefaultCacheManager(config?: CacheConfig): CacheManager {
  defaultCacheManager = new CacheManager(config)
  return defaultCacheManager
}

/**
 * Get default cache manager
 */
export function getDefaultCacheManager(): CacheManager | null {
  return defaultCacheManager
}

/**
 * Global cache functions
 */
export const Cache = {
  set: (key: string, value: any, ttl?: number) => {
    if (defaultCacheManager) {
      defaultCacheManager.set('global', key, value, ttl)
    }
  },
  get: <T = any>(key: string): T | null => {
    return defaultCacheManager?.get<T>('global', key) || null
  },
  remove: (key: string) => {
    defaultCacheManager?.remove('global', key)
  },
  has: (key: string): boolean => {
    return defaultCacheManager?.has('global', key) || false
  },
  clear: () => {
    defaultCacheManager?.clear('global')
  }
}

/**
 * Session storage functions
 */
export const Session = {
  set: (key: string, value: any, options?: StorageOptions) => {
    const session = new SessionStorage()
    session.set(key, value, options)
  },
  get: <T = any>(key: string): T | null => {
    const session = new SessionStorage()
    return session.get<T>(key)
  },
  remove: (key: string) => {
    const session = new SessionStorage()
    session.remove(key)
  },
  has: (key: string): boolean => {
    const session = new SessionStorage()
    return session.has(key)
  },
  clear: () => {
    const session = new SessionStorage()
    session.clear()
  }
}

/**
 * Local storage functions
 */
export const Local = {
  set: (key: string, value: any, options?: StorageOptions) => {
    const local = new LocalStorage()
    local.set(key, value, options)
  },
  get: <T = any>(key: string): T | null => {
    const local = new LocalStorage()
    return local.get<T>(key)
  },
  remove: (key: string) => {
    const local = new LocalStorage()
    local.remove(key)
  },
  has: (key: string): boolean => {
    const local = new LocalStorage()
    return local.has(key)
  },
  clear: () => {
    const local = new LocalStorage()
    local.clear()
  }
}

/**
 * Memory storage functions
 */
export const Memory = {
  set: (key: string, value: any, options?: StorageOptions) => {
    const memory = new MemoryStorage()
    memory.set(key, value, options)
  },
  get: <T = any>(key: string): T | null => {
    const memory = new MemoryStorage()
    return memory.get<T>(key)
  },
  remove: (key: string) => {
    const memory = new MemoryStorage()
    memory.remove(key)
  },
  has: (key: string): boolean => {
    const memory = new MemoryStorage()
    return memory.has(key)
  },
  clear: () => {
    const memory = new MemoryStorage()
    memory.clear()
  }
}