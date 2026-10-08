/**
 * HTTP Client Utilities for yq-sanyi
 * 
 * Provides advanced HTTP client functionality with interceptors, caching,
 * request/response handling, and error management for yq-sanyi applications.
 * 
 * @packageDocumentation
 */

/**
 * HTTP request methods
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

/**
 * HTTP response status codes
 */
export type HTTPStatus = number

/**
 * Request configuration interface
 */
export interface RequestConfig {
  url: string
  method?: HTTPMethod
  headers?: Record<string, string>
  body?: any
  timeout?: number
  retries?: number
  cache?: CacheConfig
  params?: Record<string, any>
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer'
  timestamp?: number
}

/**
 * Response interface
 */
export interface Response<T = any> {
  data: T
  status: HTTPStatus
  statusText: string
  headers: Record<string, string>
  config: RequestConfig
  request?: RequestConfig
  responseTime: number
  timestamp: number
  url: string
}

/**
 * Error interface
 */
export interface HTTPError {
  message: string
  code?: string
  status?: HTTPStatus
  response?: Response
  request?: RequestConfig
  isNetworkError?: boolean
  isTimeoutError?: boolean
  isAbortError?: boolean
}

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  enabled: boolean
  ttl?: number
  maxSize?: number
  strategy?: 'cache-first' | 'network-first' | 'cache-only' | 'network-only'
  keyGenerator?: (config: RequestConfig) => string
}

/**
 * Cache entry interface
 */
export interface CacheEntry {
  key: string
  data: any
  timestamp: number
  expires: number
  hits: number
  size: number
}

/**
 * Interceptor interface
 */
export interface Interceptor {
  request?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>
  response?: (response: Response) => Response | Promise<Response>
  error?: (error: HTTPError) => any | Promise<any>
}

/**
 * HTTP client class with advanced features
 */
export class HTTPClient {
  private baseUrl: string = ''
  private defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  private interceptors: Interceptor[] = []
  private cache: Map<string, CacheEntry> = new Map()
  private requestTimeout: number = 30000
  private maxRetries: number = 3

  /**
   * Create a new HTTP client instance
   */
  constructor(config?: {
    baseUrl?: string
    headers?: Record<string, string>
    timeout?: number
    maxRetries?: number
  }) {
    if (config?.baseUrl) {
      this.baseUrl = config.baseUrl
    }
    if (config?.headers) {
      this.defaultHeaders = { ...this.defaultHeaders, ...config.headers }
    }
    if (config?.timeout) {
      this.requestTimeout = config.timeout
    }
    if (config?.maxRetries) {
      this.maxRetries = config.maxRetries
    }
  }

  /**
   * Set base URL for all requests
   */
  public setBaseUrl(url: string): void {
    this.baseUrl = url
  }

  /**
   * Set default headers
   */
  public setDefaultHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers }
  }

  /**
   * Add interceptor
   */
  public addInterceptor(interceptor: Interceptor): void {
    this.interceptors.push(interceptor)
  }

  /**
   * Remove interceptor
   */
  public removeInterceptor(interceptor: Interceptor): void {
    const index = this.interceptors.indexOf(interceptor)
    if (index > -1) {
      this.interceptors.splice(index, 1)
    }
  }

  /**
   * Clear all interceptors
   */
  public clearInterceptors(): void {
    this.interceptors = []
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache entry
   */
  public getCacheEntry(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key)
    if (entry && entry.expires > Date.now()) {
      entry.hits++
      return entry
    }
    if (entry) {
      this.cache.delete(key)
    }
    return undefined
  }

  /**
   * Set cache entry
   */
  public setCacheEntry(key: string, data: any, ttl: number = 300000): void {
    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      expires: Date.now() + ttl,
      hits: 0,
      size: JSON.stringify(data).length
    }
    this.cache.set(key, entry)
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(url: string, params?: Record<string, any>): string {
    let fullUrl = this.baseUrl ? `${this.baseUrl}${url}` : url
    
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      const paramString = searchParams.toString()
      if (paramString) {
        fullUrl += `?${paramString}`
      }
    }
    
    return fullUrl
  }

  /**
   * Build headers
   */
  private buildHeaders(headers: Record<string, string> = {}): Record<string, string> {
    return { ...this.defaultHeaders, ...headers }
  }

  /**
   * Apply request interceptors
   */
  private async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let finalConfig = config
    
    for (const interceptor of this.interceptors) {
      if (interceptor.request) {
        const result = await interceptor.request(finalConfig)
        finalConfig = result || finalConfig
      }
    }
    
    return finalConfig
  }

  /**
   * Apply response interceptors
   */
  private async applyResponseInterceptors(response: Response): Promise<Response> {
    let finalResponse = response
    
    for (const interceptor of this.interceptors) {
      if (interceptor.response) {
        const result = await interceptor.response(finalResponse)
        finalResponse = result || finalResponse
      }
    }
    
    return finalResponse
  }

  /**
   * Apply error interceptors
   */
  private async applyErrorInterceptors(error: HTTPError): Promise<any> {
    let finalError = error
    
    for (const interceptor of this.interceptors) {
      if (interceptor.error) {
        const result = await interceptor.error(finalError)
        if (result !== undefined) {
          finalError = result
        }
      }
    }
    
    return finalError
  }

  /**
   * Check cache first
   */
  private async checkCache(config: RequestConfig): Promise<Response | null> {
    if (!config.cache?.enabled) {
      return null
    }

    const cacheKey = config.cache.keyGenerator 
      ? config.cache.keyGenerator(config)
      : this.generateCacheKey(config)

    const cached = this.getCacheEntry(cacheKey)
    if (cached && config.cache.strategy !== 'network-first') {
      const response: Response = {
        data: cached.data,
        status: 200,
        statusText: 'OK',
        headers: { 'X-Cache': 'HIT' },
        config,
        request: config,
        responseTime: 0,
        timestamp: Date.now(),
        url: config.url
      }
      return response
    }

    return null
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(config: RequestConfig): string {
    const { method = 'GET', url, params, body } = config
    const keyData = { method, url, params, body }
    return btoa(JSON.stringify(keyData))
  }

  /**
   * Make HTTP request with retry logic
   */
  public async request<T = any>(config: RequestConfig): Promise<Response<T>> {
    const startTime = Date.now()
    
    // Check cache first
    if (config.cache?.enabled) {
      const cachedResponse = await this.checkCache(config)
      if (cachedResponse) {
        return cachedResponse
      }
    }

    // Apply request interceptors
    let finalConfig = await this.applyRequestInterceptors(config)

    // Build full URL and headers
    finalConfig.url = this.buildUrl(finalConfig.url, finalConfig.params)
    finalConfig.headers = this.buildHeaders(finalConfig.headers)

    let retryCount = 0
    let lastError: HTTPError | null = null

    while (retryCount <= (finalConfig.retries || this.maxRetries)) {
      try {
        const response = await this.makeRequest<T>(finalConfig)
        const responseTime = Date.now() - startTime

        // Apply response interceptors
        const finalResponse = await this.applyResponseInterceptors({
          ...response,
          responseTime,
          timestamp: Date.now()
        })

        // Cache the response if caching is enabled
        if (finalConfig.cache?.enabled && finalResponse.status === 200) {
          const cacheKey = finalConfig.cache.keyGenerator 
            ? finalConfig.cache.keyGenerator(finalConfig)
            : this.generateCacheKey(finalConfig)
          
          const ttl = finalConfig.cache.ttl || 300000
          this.setCacheEntry(cacheKey, finalResponse.data, ttl)
        }

        return finalResponse
      } catch (error) {
        lastError = await this.applyErrorInterceptors(error as HTTPError)
        
        if (retryCount < (finalConfig.retries || this.maxRetries)) {
          retryCount++
          // Exponential backoff
          const delay = Math.pow(2, retryCount) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        } else {
          throw lastError
        }
      }
    }

    throw lastError || new Error('Max retries exceeded')
  }

  /**
   * Make actual HTTP request
   */
  private async makeRequest<T = any>(config: RequestConfig): Promise<Response<T>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || this.requestTimeout)

    try {
      const response = await fetch(config.url, {
        method: config.method || 'GET',
        headers: config.headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      let data: any
      switch (config.responseType || 'json') {
        case 'json':
          data = await response.json()
          break
        case 'text':
          data = await response.text()
          break
        case 'blob':
          data = await response.blob()
          break
        case 'arrayBuffer':
          data = await response.arrayBuffer()
          break
        default:
          data = await response.json()
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: this.parseHeaders(response.headers),
        config,
        request: config,
        responseTime: Date.now() - (config.timestamp || Date.now()),
        timestamp: Date.now(),
        url: config.url
      }
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error) {
        const httpError: HTTPError = {
          message: error.message,
          isNetworkError: !navigator.onLine,
          isTimeoutError: error.name === 'AbortError',
          isAbortError: error.name === 'AbortError',
          request: config
        }

        if (error.name === 'AbortError') {
          httpError.message = 'Request timeout'
          httpError.isTimeoutError = true
        }

        throw httpError
      }

      throw error
    }
  }

  /**
   * Parse headers from Headers object
   */
  private parseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {}
    headers.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  /**
   * GET request
   */
  public async get<T = any>(url: string, config?: Omit<RequestConfig, 'method' | 'url'>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'GET' })
  }

  /**
   * POST request
   */
  public async post<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'body'>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'POST', body: data })
  }

  /**
   * PUT request
   */
  public async put<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'body'>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'PUT', body: data })
  }

  /**
   * DELETE request
   */
  public async delete<T = any>(url: string, config?: Omit<RequestConfig, 'method' | 'url'>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'DELETE' })
  }

  /**
   * PATCH request
   */
  public async patch<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'body'>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'PATCH', body: data })
  }

  /**
   * HEAD request
   */
  public async head<T = any>(url: string, config?: Omit<RequestConfig, 'method' | 'url'>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'HEAD' })
  }

  /**
   * OPTIONS request
   */
  public async options<T = any>(url: string, config?: Omit<RequestConfig, 'method' | 'url'>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'OPTIONS' })
  }
}

/**
 * Create HTTP client instance
 */
export function createHttpClient(config?: {
  baseUrl?: string
  headers?: Record<string, string>
  timeout?: number
  maxRetries?: number
}): HTTPClient {
  return new HTTPClient(config)
}

/**
 * Create GET request shortcut
 */
export async function httpGet<T = any>(
  url: string, 
  config?: Omit<RequestConfig, 'method' | 'url'>
): Promise<Response<T>> {
  const client = new HTTPClient()
  return client.get<T>(url, config)
}

/**
 * Create POST request shortcut
 */
export async function httpPost<T = any>(
  url: string, 
  data?: any, 
  config?: Omit<RequestConfig, 'method' | 'url' | 'body'>
): Promise<Response<T>> {
  const client = new HTTPClient()
  return client.post<T>(url, data, config)
}

/**
 * Create PUT request shortcut
 */
export async function httpPut<T = any>(
  url: string, 
  data?: any, 
  config?: Omit<RequestConfig, 'method' | 'url' | 'body'>
): Promise<Response<T>> {
  const client = new HTTPClient()
  return client.put<T>(url, data, config)
}

/**
 * Create DELETE request shortcut
 */
export async function httpDelete<T = any>(
  url: string, 
  config?: Omit<RequestConfig, 'method' | 'url'>
): Promise<Response<T>> {
  const client = new HTTPClient()
  return client.delete<T>(url, config)
}

/**
 * Create PATCH request shortcut
 */
export async function httpPatch<T = any>(
  url: string, 
  data?: any, 
  config?: Omit<RequestConfig, 'method' | 'url' | 'body'>
): Promise<Response<T>> {
  const client = new HTTPClient()
  return client.patch<T>(url, data, config)
}

/**
 * Common cache strategies
 */
export const CacheStrategies = {
  /**
   * Cache-first strategy: check cache first, then network
   */
  cacheFirst: (ttl: number = 300000): CacheConfig => ({
    enabled: true,
    ttl,
    strategy: 'cache-first'
  }),

  /**
   * Network-first strategy: check network first, then cache
   */
  networkFirst: (ttl: number = 300000): CacheConfig => ({
    enabled: true,
    ttl,
    strategy: 'network-first'
  }),

  /**
   * Cache-only strategy: only use cache
   */
  cacheOnly: (ttl: number = 300000): CacheConfig => ({
    enabled: true,
    ttl,
    strategy: 'cache-only'
  }),

  /**
   * Network-only strategy: only use network
   */
  networkOnly: (): CacheConfig => ({
    enabled: true,
    strategy: 'network-only'
  })
}

/**
 * Common HTTP interceptors
 */
export const Interceptors = {
  /**
   * Authorization header interceptor
   */
  authorization: (token: string): Interceptor => ({
    request: (config) => ({
      ...config,
      headers: {
        ...config.headers,
        Authorization: `Bearer ${token}`
      }
    })
  }),

  /**
   * JSON content type interceptor
   */
  jsonContent: (): Interceptor => ({
    request: (config) => ({
      ...config,
      headers: {
        ...config.headers,
        'Content-Type': 'application/json'
      }
    })
  }),

  /**
   * Logging interceptor
   */
  logging: (logger: (message: string) => void = console.log): Interceptor => ({
    request: (config) => {
      logger(`Request: ${config.method} ${config.url}`)
      return config
    },
    response: (response) => {
      logger(`Response: ${response.status} ${response.url}`)
      return response
    },
    error: (error) => {
      logger(`Error: ${error.message}`)
      return error
    }
  }),

  /**
   * Timing interceptor
   */
  timing: (): Interceptor => ({
    response: (response) => {
      console.log(`Request took ${response.responseTime}ms`)
      return response
    }
  })
}

/**
 * Request and response utilities
 */
export const HTTPUtils = {
  /**
   * Parse URL to extract components
   */
  parseURL(url: string): {
    protocol: string
    hostname: string
    port: string
    pathname: string
    search: string
    hash: string
  } {
    const urlObj = new URL(url)
    return {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port,
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash
    }
  },

  /**
   * Convert object to query string
   */
  toQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    })
    return searchParams.toString()
  },

  /**
   * Convert query string to object
   */
  fromQueryString(queryString: string): Record<string, string> {
    const params: Record<string, string> = {}
    const searchParams = new URLSearchParams(queryString)
    searchParams.forEach((value, key) => {
      params[key] = value
    })
    return params
  },

  /**
   * Check if status code is successful (2xx)
   */
  isSuccessful(status: number): boolean {
    return status >= 200 && status < 300
  },

  /**
   * Check if status code is a client error (4xx)
   */
  isClientError(status: number): boolean {
    return status >= 400 && status < 500
  },

  /**
   * Check if status code is a server error (5xx)
   */
  isServerError(status: number): boolean {
    return status >= 500 && status < 600
  },

  /**
   * Get error message from response
   */
  getErrorMessage(response: Response): string {
    if (response.data && typeof response.data === 'object' && 'message' in response.data) {
      return String(response.data.message)
    }
    return response.statusText || 'Unknown error'
  },

  /**
   * Get error code from response
   */
  getErrorCode(response: Response): string | undefined {
    if (response.data && typeof response.data === 'object' && 'code' in response.data) {
      return String(response.data.code)
    }
    return undefined
  }
}

export default HTTPClient