/**
 * Cache Utils - Advanced Caching Strategies and Utilities for yq-sanyi
 * 
 * This package provides comprehensive caching utilities with multiple storage backends,
 * cache strategies, invalidation policies, and performance optimization features
 * for yq-sanyi applications.
 * 
 * @packageDocumentation
 */

/**
 * Cache storage types
 */
export type CacheStorage = 'memory' | 'local-storage' | 'session-storage' | 'indexed-db';

/**
 * Cache strategies
 */
export type CacheStrategy = 
  | 'cache-first'
  | 'network-first'
  | 'network-only'
  | 'cache-only'
  | 'stale-while-revalidate'
  | 'stale-if-error'
  | 'freshness-first';

/**
 * Cache entry status
 */
export type CacheEntryStatus = 'fresh' | 'stale' | 'invalid';

/**
 * Cache entry metadata
 */
export interface CacheEntryMetadata {
  timestamp: number;
  ttl?: number;
  hits: number;
  lastAccessed: number;
  size: number;
  tags?: string[];
  priority?: number;
}

/**
 * Cache entry
 */
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  metadata: CacheEntryMetadata;
  status: CacheEntryStatus;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  storage: CacheStorage;
  maxSize?: number;
  defaultTTL?: number;
  strategy?: CacheStrategy;
  compression?: boolean;
  encryption?: boolean;
  version?: string;
}

/**
 * Cache options
 */
export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  priority?: number;
  compress?: boolean;
  encrypt?: boolean;
  strategy?: CacheStrategy;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  evictionCount: number;
  expiredCount: number;
}

/**
 * Cache event types
 */
export type CacheEventType = 
  | 'hit'
  | 'miss'
  | 'set'
  | 'delete'
  | 'clear'
  | 'expire'
  | 'evict';

/**
 * Cache event
 */
export interface CacheEvent {
  type: CacheEventType;
  key: string;
  value?: any;
  timestamp: number;
  metadata?: CacheEntryMetadata;
}

/**
 * Cache event handler
 */
export type CacheEventHandler = (event: CacheEvent) => void;

/**
 * Cache interface
 */
export interface Cache {
  get<T = any>(key: string, options?: CacheOptions): Promise<T | null>;
  set<T = any>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  size(): Promise<number>;
  stats(): CacheStats;
  on(event: CacheEventType, handler: CacheEventHandler): void;
  off(event: CacheEventType, handler: CacheEventHandler): void;
}

/**
 * Cache manager interface
 */
export interface CacheManager {
  createCache(name: string, config: CacheConfig): Cache;
  getCache(name: string): Cache | null;
  deleteCache(name: string): boolean;
  clearAll(): void;
  getStats(): Record<string, CacheStats>;
}

/**
 * Memory cache implementation
 */
export class MemoryCache implements Cache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private handlers: Map<CacheEventType, CacheEventHandler[]> = new Map();
  private statsData: CacheStats = {
    totalEntries: 0,
    hits: 0,
    misses: 0,
    hitRate: 0,
    size: 0,
    evictionCount: 0,
    expiredCount: 0
  };
  
  constructor(config: CacheConfig) {
    this.config = config;
  }
  
  async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.statsData.misses++;
      this.updateHitRate();
      this.emit('miss', { type: 'miss', key, timestamp: Date.now() });
      return null;
    }
    
    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.statsData.expiredCount++;
    this.statsData.totalEntries--;
      this.updateHitRate();
      this.emit('expire', { type: 'expire', key, timestamp: Date.now(), metadata: entry.metadata });
      return null;
    }
    
    // Update access time and hits
    entry.metadata.lastAccessed = Date.now();
    entry.metadata.hits++;
    entry.status = this.getStatus(entry);
    
    this.statsData.hits++;
    this.updateHitRate();
    this.emit('hit', { type: 'hit', key, value: entry.value, timestamp: Date.now(), metadata: entry.metadata });
    
    return entry.value;
  }
  
  async set<T = any>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || this.config.defaultTTL;
    const timestamp = Date.now();
    
    const entry: CacheEntry<T> = {
      key,
      value,
      metadata: {
        timestamp,
        ttl,
        hits: 0,
        lastAccessed: timestamp,
        size: this.calculateSize(value),
        tags: options?.tags,
        priority: options?.priority || 0
      },
      status: 'fresh'
    };
    
    // Check if we need to evict entries
    if (this.config.maxSize && this.cache.size >= this.config.maxSize) {
      this.evictEntries();
    }
    
    this.cache.set(key, entry);
    this.statsData.totalEntries++;
    this.statsData.size += entry.metadata.size;
    
    this.emit('set', { type: 'set', key, value, timestamp, metadata: entry.metadata });
    
    // Set expiration timeout
    if (ttl) {
      setTimeout(() => {
        this.delete(key);
      }, ttl * 1000);
    }
  }
  
  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.statsData.totalEntries--;
    this.statsData.size -= entry.metadata.size;
    this.statsData.evictionCount++;
      this.emit('delete', { type: 'delete', key, timestamp: Date.now(), metadata: entry.metadata });
      return true;
    }
    return false;
  }
  
  async clear(): Promise<void> {
    const size = this.statsData.size;
    this.cache.clear();
    this.statsData.totalEntries = 0;
    this.statsData.size = 0;
    this.statsData.evictionCount += size;
    this.emit('clear', { type: 'clear', key: '*', timestamp: Date.now() });
  }
  
  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }
  
  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }
  
  async size(): Promise<number> {
    return this.cache.size;
  }
  
  stats(): CacheStats {
    return { ...this.statsData };
  }
  
  on(event: CacheEventType, handler: CacheEventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }
  
  off(event: CacheEventType, handler: CacheEventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  /**
   * Evict entries based on priority and access time
   */
  private evictEntries(): void {
    const entries = Array.from(this.cache.values());
    
    // Sort by priority (higher first) and then by last accessed time (older first)
    entries.sort((a, b) => {
      if (a.metadata.priority !== b.metadata.priority) {
        return (b.metadata.priority || 0) - (a.metadata.priority || 0);
      }
      return a.metadata.lastAccessed - b.metadata.lastAccessed;
    });
    
    // Remove entries until we're under the max size
    while (this.cache.size > this.config.maxSize! && entries.length > 0) {
      const entry = entries.shift()!;
      this.cache.delete(entry.key);
      this.statsData.totalEntries--;
      this.statsData.size -= entry.metadata.size;
      this.statsData.evictionCount++;
      this.emit('evict', { type: 'evict', key: entry.key, timestamp: Date.now(), metadata: entry.metadata });
    }
  }
  
  /**
   * Check if an entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.metadata.ttl) return false;
    return Date.now() - entry.metadata.timestamp > entry.metadata.ttl * 1000;
  }
  
  /**
   * Get the status of an entry
   */
  private getStatus(entry: CacheEntry): CacheEntryStatus {
    if (!entry.metadata.ttl) return 'fresh';
    
    const age = Date.now() - entry.metadata.timestamp;
    const staleThreshold = entry.metadata.ttl * 1000 * 0.5; // 50% of TTL
    
    if (age > staleThreshold) {
      return 'stale';
    }
    return 'fresh';
  }
  
  /**
   * Calculate the size of a value
   */
  private calculateSize(value: any): number {
    return JSON.stringify(value).length;
  }
  
  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.statsData.hits + this.statsData.misses;
    this.statsData.hitRate = total > 0 ? this.statsData.hits / total : 0;
  }
  
  /**
   * Emit an event
   */
  private emit(type: CacheEventType, event: CacheEvent): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Cache event handler error:', error);
        }
      });
    }
  }
}

/**
 * Cache manager implementation
 */
export class CacheManagerImpl implements CacheManager {
  private caches: Map<string, Cache> = new Map();
  private globalConfig: CacheConfig;
  
  constructor(config: CacheConfig) {
    this.globalConfig = config;
  }
  
  createCache(name: string, config: CacheConfig): Cache {
    const finalConfig = { ...this.globalConfig, ...config };
    const cache = new MemoryCache(finalConfig);
    this.caches.set(name, cache);
    return cache;
  }
  
  getCache(name: string): Cache | null {
    return this.caches.get(name) || null;
  }
  
  deleteCache(name: string): boolean {
    const cache = this.caches.get(name);
    if (cache) {
      this.caches.delete(name);
      return true;
    }
    return false;
  }
  
  clearAll(): void {
    this.caches.clear();
  }
  
  getStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    this.caches.forEach((cache, name) => {
      stats[name] = cache.stats();
    });
    return stats;
  }
}

/**
 * Cache utilities
 */
export const cacheUtils = {
  /**
   * Create a new cache instance
   */
  create: (config: CacheConfig): Cache => {
    return new MemoryCache(config);
  },
  
  /**
   * Create a cache manager
   */
  createManager: (config: CacheConfig): CacheManager => {
    return new CacheManagerImpl(config);
  },
  
  /**
   * Cache with strategy
   */
  withStrategy: <T>(
    cache: Cache,
    strategy: CacheStrategy,
    fetch: () => Promise<T>
  ): Promise<T> => {
    switch (strategy) {
      case 'cache-first':
        return cacheFirst(cache, fetch);
      case 'network-first':
        return networkFirst(cache, fetch);
      case 'network-only':
        return networkOnly(fetch);
      case 'cache-only':
        return cacheOnly(cache);
      case 'stale-while-revalidate':
        return staleWhileRevalidate(cache, fetch);
      case 'stale-if-error':
        return staleIfError(cache, fetch);
      case 'freshness-first':
        return freshnessFirst(cache, fetch);
      default:
        return networkOnly(fetch);
    }
  }
};

/**
 * Cache strategy implementations
 */
async function cacheFirst<T>(cache: Cache, fetch: () => Promise<T>): Promise<T> {
  // Try cache first
  const cached = await cache.get<T>('key');
  if (cached !== null) {
    return cached;
  }
  
  // If not in cache, fetch from network
  const data = await fetch();
  await cache.set('key', data);
  return data;
}

async function networkFirst<T>(cache: Cache, fetch: () => Promise<T>): Promise<T> {
  try {
    // Try network first
    const data = await fetch();
    await cache.set('key', data);
    return data;
  } catch (error) {
    // If network fails, try cache
    const cached = await cache.get<T>('key');
    if (cached !== null) {
      return cached;
    }
    throw error;
  }
}

async function networkOnly<T>(fetch: () => Promise<T>): Promise<T> {
  return fetch();
}

async function cacheOnly<T>(cache: Cache): Promise<T> {
  const cached = await cache.get<T>('key');
  if (cached === null) {
    throw new Error('Data not found in cache');
  }
  return cached;
}

async function staleWhileRevalidate<T>(cache: Cache, fetch: () => Promise<T>): Promise<T> {
  // Return cached data immediately if available
  const cached = await cache.get<T>('key');
  if (cached !== null) {
    // Background refresh
    fetch().then(data => {
      cache.set('key', data);
    });
    return cached;
  }
  
  // If no cached data, fetch from network
  const data = await fetch();
  await cache.set('key', data);
  return data;
}

async function staleIfError<T>(cache: Cache, fetch: () => Promise<T>): Promise<T> {
  try {
    // Try network first
    const data = await fetch();
    await cache.set('key', data);
    return data;
  } catch (error) {
    // If network fails, return stale cache data if available
    const cached = await cache.get<T>('key');
    if (cached !== null) {
      return cached;
    }
    throw error;
  }
}

async function freshnessFirst<T>(cache: Cache, fetch: () => Promise<T>): Promise<T> {
  const cached = await cache.get<T>('key');
  
  if (cached !== null) {
    // Check if cached data is fresh
    const entry = (cache as any).cache?.get('key');
    if (entry && entry.metadata.ttl) {
      const age = Date.now() - entry.metadata.timestamp;
      const isFresh = age < entry.metadata.ttl * 1000 * 0.8; // 80% of TTL
      
      if (isFresh) {
        return cached;
      }
    }
  }
  
  // Fetch fresh data
  const data = await fetch();
  await cache.set('key', data);
  return data;
}

/**
 * Cache storage utilities
 */
export const cacheStorage = {
  /**
   * Get browser storage type availability
   */
  getStorageAvailability: (): Record<CacheStorage, boolean> => {
    return {
      'memory': true,
      'local-storage': typeof localStorage !== 'undefined',
      'session-storage': typeof sessionStorage !== 'undefined',
      'indexed-db': typeof indexedDB !== 'undefined'
    };
  },
  
  /**
   * Estimate storage quota
   */
  getStorageQuota: async (storage: CacheStorage): Promise<{ used: number; total: number; available: number }> => {
    switch (storage) {
      case 'memory':
        return { used: 0, total: Number.MAX_SAFE_INTEGER, available: Number.MAX_SAFE_INTEGER };
      
      case 'local-storage':
      case 'session-storage':
        try {
          const used = JSON.stringify(localStorage || sessionStorage).length;
          return { used, total: 5 * 1024 * 1024, available: 5 * 1024 * 1024 - used };
        } catch (error) {
          return { used: 0, total: 0, available: 0 };
        }
      
      case 'indexed-db':
        try {
          // This is a simplified implementation
          return { used: 0, total: 50 * 1024 * 1024, available: 50 * 1024 * 1024 };
        } catch (error) {
          return { used: 0, total: 0, available: 0 };
        }
      
      default:
        return { used: 0, total: 0, available: 0 };
    }
  }
};

/**
 * Cache monitoring utilities
 */
export const cacheMonitoring = {
  /**
   * Monitor cache performance
   */
  monitor: (cache: Cache, interval: number = 60000): () => void => {
    const intervalId = setInterval(() => {
      const stats = cache.stats();
      console.log('Cache stats:', stats);
    }, interval);
    
    return () => clearInterval(intervalId);
  },
  
  /**
   * Get cache health report
   */
  getHealthReport: (caches: Cache[]): {
    totalCaches: number;
    totalHits: number;
    totalMisses: number;
    averageHitRate: number;
    totalSize: number;
    largestCache: string;
    smallestCache: string;
  } => {
    if (caches.length === 0) {
      return {
        totalCaches: 0,
        totalHits: 0,
        totalMisses: 0,
        averageHitRate: 0,
        totalSize: 0,
        largestCache: '',
        smallestCache: ''
      };
    }
    
    const stats = caches.map(cache => cache.stats());
    const totalHits = stats.reduce((sum, stat) => sum + stat.hits, 0);
    const totalMisses = stats.reduce((sum, stat) => sum + stat.misses, 0);
    const totalSize = stats.reduce((sum, stat) => sum + stat.size, 0);
    const averageHitRate = stats.reduce((sum, stat) => sum + stat.hitRate, 0) / stats.length;
    
    const largestCache = stats.reduce((largest, stat, index) => {
      if (stat.size > largest.size) {
        return { size: stat.size, index };
      }
      return largest;
    }, { size: 0, index: 0 });
    
    const smallestCache = stats.reduce((smallest, stat, index) => {
      if (stat.size < smallest.size) {
        return { size: stat.size, index };
      }
      return smallest;
    }, { size: Number.MAX_SAFE_INTEGER, index: 0 });
    
    return {
      totalCaches: caches.length,
      totalHits,
      totalMisses,
      averageHitRate,
      totalSize,
      largestCache: `Cache ${largestCache.index}`,
      smallestCache: `Cache ${smallestCache.index}`
    };
  }
};

/**
 * Cache utilities for common patterns
 */
export const cachePatterns = {
  /**
   * Memoize a function with cache
   */
  memoize: <T extends (...args: any[]) => any>(
    fn: T,
    cache: Cache,
    keyGenerator?: (...args: Parameters<T>) => string
  ): T => {
    return ((...args: Parameters<T>): ReturnType<T> => {
      const key = keyGenerator ? keyGenerator(...args) : `memoize_${args.join('_')}`;
      
      return (async () => {
        // Try to get from cache
        const cached = await cache.get<ReturnType<T>>(key);
        if (cached !== null) {
          return cached;
        }
        
        // Execute function and cache result
        const result = await fn(...args);
        await cache.set(key, result);
        return result;
      })() as ReturnType<T>;
    }) as T;
  },
  
  /**
   * Cache with TTL
   */
  withTTL: <T>(cache: Cache, ttl: number): Cache => {
    const wrappedCache = { ...cache };
    
    wrappedCache.set = async <T = any>(key: string, value: T, options?: CacheOptions) => {
      const finalOptions = { ...options, ttl };
      return cache.set(key, value, finalOptions);
    };
    
    return wrappedCache;
  },
  
  /**
   * Cache with compression
   */
  withCompression: <T>(cache: Cache): Cache => {
    const wrappedCache = { ...cache };
    
    wrappedCache.get = async <T = any>(key: string, options?: CacheOptions): Promise<T | null> => {
      const compressed = await cache.get<string>(key);
      if (!compressed) return null;
      
      try {
        const decompressed = cachePatternsUtils.decompress(compressed);
        return JSON.parse(decompressed);
      } catch (error) {
        return null;
      }
    };
    
    wrappedCache.set = async <T = any>(key: string, value: T, options?: CacheOptions): Promise<void> => {
      const serialized = JSON.stringify(value);
      const compressed = cachePatternsUtils.compress(serialized);
      return cache.set(key, compressed, options);
    };
    
    return wrappedCache;
  }
};

// Helper methods for compression/decompression
const cachePatternsUtils = {
  compress: (data: string): string => {
    // Simple compression implementation
    // In production, use a proper compression library
    return btoa(data);
  },
  
  decompress: (data: string): string => {
    // Simple decompression implementation
    // In production, use a proper compression library
    return atob(data);
  }
};

// Assign helper methods to cachePatterns
Object.assign(cachePatterns, cachePatternsUtils);