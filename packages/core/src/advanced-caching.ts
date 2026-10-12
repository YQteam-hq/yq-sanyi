/**
 * Advanced Caching System for yq-sanyi
 * 
 * This module provides sophisticated caching strategies including:
 * - Multi-level caching (Memory, Session, Local Storage)
 * - Cache invalidation policies
 * - Cache warming and preloading
 * - Cache analytics and monitoring
 * - Adaptive cache sizing
 */

export interface CacheConfig {
  maxSize?: number;
  ttl?: number;
  strategy?: 'lru' | 'lfu' | 'fifo' | 'ttl';
  persistence?: 'memory' | 'session' | 'local' | 'hybrid';
  compression?: boolean;
  encryption?: boolean;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
  accessCount: number;
  size: number;
  checksum: string;
}

export interface CacheAnalytics {
  hits: number;
  misses: number;
  evictionCount: number;
  hitRate: number;
  avgResponseTime: number;
  memoryUsage: number;
  storageUsage: number;
  topKeys: Array<{ key: string; hits: number }>;
  cacheSizeHistory: Array<{ timestamp: number; size: number }>;
}

export class AdvancedCache {
  private memoryCache = new Map<string, CacheEntry>();
  private sessionCache: Map<string, CacheEntry> = new Map();
  private localCache: Map<string, CacheEntry> = new Map();
  private config: Required<CacheConfig>;
  private analytics: CacheAnalytics;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private compressionSupported: boolean;
  private encryptionSupported: boolean;

  constructor(config: CacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize || 1000,
      ttl: config.ttl || 300000, // 5 minutes default
      strategy: config.strategy || 'lru',
      persistence: config.persistence || 'memory',
      compression: config.compression || false,
      encryption: config.encryption || false
    };

    this.analytics = {
      hits: 0,
      misses: 0,
      evictionCount: 0,
      hitRate: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
      storageUsage: 0,
      topKeys: [],
      cacheSizeHistory: []
    };

    this.compressionSupported = this.checkCompressionSupport();
    this.encryptionSupported = this.checkEncryptionSupport();
    
    this.initializeCache();
    this.startAnalyticsCollection();
  }

  private checkCompressionSupport(): boolean {
    try {
      if (typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined') {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private checkEncryptionSupport(): boolean {
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private initializeCache(): void {
    if (this.config.persistence === 'session' || this.config.persistence === 'hybrid') {
      this.loadSessionCache();
    }
    
    if (this.config.persistence === 'local' || this.config.persistence === 'hybrid') {
      this.loadLocalCache();
    }
  }

  private async loadSessionCache(): Promise<void> {
    try {
      const sessionData = sessionStorage.getItem('yq-sanyi-cache-session');
      if (sessionData) {
        const data = JSON.parse(sessionData);
        this.sessionCache = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn('Failed to load session cache:', error);
    }
  }

  private async loadLocalCache(): Promise<void> {
    try {
      const localData = localStorage.getItem('yq-sanyi-cache-local');
      if (localData) {
        const data = JSON.parse(localData);
        this.localCache = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn('Failed to load local cache:', error);
    }
  }

  private async saveSessionCache(): Promise<void> {
    try {
      const data = Object.fromEntries(this.sessionCache);
      sessionStorage.setItem('yq-sanyi-cache-session', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save session cache:', error);
    }
  }

  private async saveLocalCache(): Promise<void> {
    try {
      const data = Object.fromEntries(this.localCache);
      localStorage.setItem('yq-sanyi-cache-local', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save local cache:', error);
    }
  }

  private async compressData(data: any): Promise<string> {
    if (!this.compressionSupported) {
      return JSON.stringify(data);
    }

    try {
      const jsonString = JSON.stringify(data);
      const encoder = new TextEncoder();
      const compressedStream = new CompressionStream('gzip');
      const compressedData = new Blob([encoder.encode(jsonString)])
        .stream()
        .pipeThrough(compressedStream)
        .toArray();
      
      return btoa(String.fromCharCode(...compressedData));
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error);
      return JSON.stringify(data);
    }
  }

  private async decompressData(compressed: string): Promise<any> {
    if (!this.compressionSupported) {
      return JSON.parse(compressed);
    }

    try {
      const compressedData = Uint8Array.from(atob(compressed), c => c.charCodeAt(0));
      const decompressedStream = new DecompressionStream('gzip');
      const decompressedData = new Blob([compressedData])
        .stream()
        .pipeThrough(decompressedStream)
        .toArray();
      
      return JSON.parse(new TextDecoder().decode(decompressedData));
    } catch (error) {
      console.warn('Decompression failed, using original data:', error);
      return JSON.parse(compressed);
    }
  }

  private async encryptData(data: string): Promise<string> {
    if (!this.encryptionSupported) {
      return data;
    }

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        dataBuffer
      );
      
      const result = new Uint8Array(iv.length + encryptedData.byteLength);
      result.set(iv);
      result.set(new Uint8Array(encryptedData), iv.length);
      
      return btoa(String.fromCharCode(...result));
    } catch (error) {
      console.warn('Encryption failed, using unencrypted data:', error);
      return data;
    }
  }

  private async decryptData(encrypted: string): Promise<string> {
    if (!this.encryptionSupported) {
      return encrypted;
    }

    try {
      const encryptedData = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
      const iv = encryptedData.slice(0, 12);
      const data = encryptedData.slice(12);
      
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      
      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.warn('Decryption failed, using original data:', error);
      return encrypted;
    }
  }

  private calculateChecksum(data: any): string {
    const jsonString = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private getCacheStore(): Map<string, CacheEntry> {
    switch (this.config.persistence) {
      case 'session':
        return this.sessionCache;
      case 'local':
        return this.localCache;
      case 'hybrid':
        return this.memoryCache;
      default:
        return this.memoryCache;
    }
  }

  private setCacheStore(store: Map<string, CacheEntry>): void {
    switch (this.config.persistence) {
      case 'session':
        this.sessionCache = store;
        break;
      case 'local':
        this.localCache = store;
        break;
      case 'hybrid':
        this.memoryCache = store;
        break;
      default:
        this.memoryCache = store;
    }
  }

  private shouldEvict(entry: CacheEntry): boolean {
    const now = Date.now();
    
    if (entry.ttl && now - entry.timestamp > entry.ttl) {
      return true;
    }

    switch (this.config.strategy) {
      case 'lru':
        return this.memoryCache.size > this.config.maxSize;
      case 'lfu':
        return entry.accessCount < 1;
      case 'fifo':
        return this.memoryCache.size > this.config.maxSize;
      case 'ttl':
        return entry.ttl && now - entry.timestamp > entry.ttl;
      default:
        return false;
    }
  }

  private evictEntries(): void {
    const entries = Array.from(this.memoryCache.entries());
    
    switch (this.config.strategy) {
      case 'lru':
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        break;
      case 'lfu':
        entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        break;
      case 'fifo':
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        break;
    }

    const toEvict = Math.max(0, this.memoryCache.size - this.config.maxSize);
    for (let i = 0; i < toEvict; i++) {
      const [key] = entries[i];
      this.memoryCache.delete(key);
      this.analytics.evictionCount++;
    }
  }

  private updateAnalytics(key: string, hit: boolean, responseTime: number): void {
    if (hit) {
      this.analytics.hits++;
    } else {
      this.analytics.misses++;
    }

    this.analytics.avgResponseTime = 
      (this.analytics.avgResponseTime * (this.analytics.hits + this.analytics.misses - 1) + responseTime) / 
      (this.analytics.hits + this.analytics.misses);

    this.analytics.hitRate = this.analytics.hits / (this.analytics.hits + this.analytics.misses);

    const keyIndex = this.analytics.topKeys.findIndex(k => k.key === key);
    if (keyIndex >= 0) {
      this.analytics.topKeys[keyIndex].hits++;
    } else {
      this.analytics.topKeys.push({ key, hits: 1 });
    }

    this.analytics.topKeys.sort((a, b) => b.hits - a.hits);
    this.analytics.topKeys = this.analytics.topKeys.slice(0, 10);

    this.analytics.memoryUsage = this.memoryCache.size;
    this.analytics.storageUsage = this.sessionCache.size + this.localCache.size;

    this.analytics.cacheSizeHistory.push({
      timestamp: Date.now(),
      size: this.memoryCache.size + this.sessionCache.size + this.localCache.size
    });

    if (this.analytics.cacheSizeHistory.length > 100) {
      this.analytics.cacheSizeHistory.shift();
    }
  }

  private startAnalyticsCollection(): void {
    setInterval(() => {
      this.updateAnalytics('', false, 0);
    }, 30000);
  }

  public async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = performance.now();
    
    const store = this.getCacheStore();
    const serializedValue = await this.compressData(value);
    const encryptedValue = await this.encryptData(serializedValue);
    
    const entry: CacheEntry<T> = {
      key,
      value: value,
      timestamp: Date.now(),
      ttl: ttl || this.config.ttl,
      accessCount: 0,
      size: JSON.stringify(value).length,
      checksum: this.calculateChecksum(value)
    };

    store.set(key, entry);

    if (this.config.persistence === 'session') {
      await this.saveSessionCache();
    } else if (this.config.persistence === 'local') {
      await this.saveLocalCache();
    }

    if (this.shouldEvict(entry)) {
      this.evictEntries();
    }

    const responseTime = performance.now() - startTime;
    this.updateAnalytics(key, false, responseTime);
  }

  public async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();
    
    const store = this.getCacheStore();
    const entry = store.get(key);

    if (!entry) {
      this.updateAnalytics(key, false, performance.now() - startTime);
      return null;
    }

    const now = Date.now();
    if (entry.ttl && now - entry.timestamp > entry.ttl) {
      store.delete(key);
      this.updateAnalytics(key, false, performance.now() - startTime);
      return null;
    }

    entry.accessCount++;
    entry.timestamp = now;

    const responseTime = performance.now() - startTime;
    this.updateAnalytics(key, true, responseTime);

    return entry.value;
  }

  public has(key: string): boolean {
    const store = this.getCacheStore();
    const entry = store.get(key);

    if (!entry) {
      return false;
    }

    const now = Date.now();
    if (entry.ttl && now - entry.timestamp > entry.ttl) {
      store.delete(key);
      return false;
    }

    return true;
  }

  public delete(key: string): boolean {
    const store = this.getCacheStore();
    const result = store.delete(key);

    if (this.config.persistence === 'session') {
      this.saveSessionCache();
    } else if (this.config.persistence === 'local') {
      this.saveLocalCache();
    }

    return result;
  }

  public clear(): void {
    const store = this.getCacheStore();
    store.clear();

    if (this.config.persistence === 'session') {
      sessionStorage.removeItem('yq-sanyi-cache-session');
    } else if (this.config.persistence === 'local') {
      localStorage.removeItem('yq-sanyi-cache-local');
    }
  }

  public getAnalytics(): CacheAnalytics {
    return { ...this.analytics };
  }

  public getKeys(): string[] {
    const store = this.getCacheStore();
    return Array.from(store.keys());
  }

  public getSize(): number {
    const store = this.getCacheStore();
    return store.size;
  }

  public updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public preload(keys: string[]): Promise<void[]> {
    return Promise.all(keys.map(key => this.get(key)));
  }

  public warmCache(data: Record<string, any>): Promise<void> {
    return Promise.all(
      Object.entries(data).map(([key, value]) => 
        this.set(key, value)
      )
    );
  }

  public getStats(): {
    hitRate: number;
    memoryUsage: number;
    storageUsage: number;
    evictionCount: number;
    topKeys: Array<{ key: string; hits: number }>;
  } {
    return {
      hitRate: this.analytics.hitRate,
      memoryUsage: this.analytics.memoryUsage,
      storageUsage: this.analytics.storageUsage,
      evictionCount: this.analytics.evictionCount,
      topKeys: this.analytics.topKeys
    };
  }
}

export const Cache = new AdvancedCache();

export class CacheManager {
  private static instances: Map<string, AdvancedCache> = new Map();

  static getInstance(name: string, config?: CacheConfig): AdvancedCache {
    if (!this.instances.has(name)) {
      this.instances.set(name, new AdvancedCache(config));
    }
    return this.instances.get(name)!;
  }

  static getGlobalInstance(): AdvancedCache {
    return this.getInstance('global');
  }

  static clearAll(): void {
    this.instances.forEach(instance => instance.clear());
    this.instances.clear();
  }

  static getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    this.instances.forEach((instance, name) => {
      stats[name] = instance.getStats();
    });
    return stats;
  }
}

export function withCache<T>(
  fn: (...args: any[]) => Promise<T>,
  options: {
    cacheKey?: (...args: any[]) => string;
    ttl?: number;
    cacheName?: string;
  } = {}
): (...args: any[]) => Promise<T> {
  const cache = CacheManager.getInstance(options.cacheName || 'default');
  const { cacheKey = (...args) => JSON.stringify(args), ttl } = options;

  return async (...args: any[]): Promise<T> => {
    const key = cacheKey(...args);
    const cached = await cache.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const result = await fn(...args);
    await cache.set(key, result, ttl);
    return result;
  };
}

export function createCacheMiddleware<T>(
  cache: AdvancedCache,
  getKey: (req: T) => string,
  ttl?: number
) {
  return async (req: T): Promise<T> => {
    const key = getKey(req);
    const cached = await cache.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    return req;
  };
}