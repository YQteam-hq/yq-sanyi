/**
 * Client-side routing and navigation utilities for yq-sanyi
 * @packageDocumentation
 */

/**
 * Route configuration interface
 */
export interface RouteConfig {
  path: string
  component: string
  name?: string
  meta?: Record<string, any>
  props?: Record<string, any>
  beforeEnter?: (route: Route) => boolean | Promise<boolean>
  afterLeave?: (route: Route) => void | Promise<void>
}

/**
 * Route interface
 */
export interface Route {
  path: string
  params: Record<string, string>
  query: Record<string, string>
  hash: string
  name?: string
  meta?: Record<string, any>
  props?: Record<string, any>
  component: string
}

/**
 * Router configuration interface
 */
export interface RouterConfig {
  routes: RouteConfig[]
  mode?: 'hash' | 'history'
  base?: string
  fallback?: string
  notFound?: string
  linkActiveClass?: string
  linkExactActiveClass?: string
}

/**
 * Navigation options interface
 */
export interface NavigationOptions {
  replace?: boolean
  force?: boolean
  params?: Record<string, string>
  query?: Record<string, string>
  hash?: string
  state?: any
}

/**
 * History mode interface
 */
export interface HistoryMode {
  push: (path: string) => void
  replace: (path: string) => void
  back: () => void
  forward: () => void
  go: (delta: number) => void
  current: () => string
  listen: (callback: (path: string) => void) => () => void
}

/**
 * Hash mode interface
 */
export interface HashMode {
  push: (path: string) => void
  replace: (path: string) => void
  back: () => void
  forward: () => void
  go: (delta: number) => void
  current: () => string
  listen: (callback: (path: string) => void) => () => void
}

/**
 * Router class for managing client-side routing
 */
export class Router {
  private routes: Map<string, RouteConfig> = new Map()
  private currentRoute: Route | null = null
  private historyMode: HistoryMode | null = null
  private hashMode: HashMode | null = null
  private base: string = ''
  private fallback: string = '/'
  private notFound: string = '/404'
  private linkActiveClass: string = 'active'
  private linkExactActiveClass: string = 'exact-active'
  private routeListeners: Set<(route: Route) => void> = new Set()
  private navigationGuard: ((to: Route, from: Route) => boolean | Promise<boolean>) | null = null

  constructor(config: RouterConfig) {
    this.base = config.base || ''
    this.fallback = config.fallback || '/'
    this.notFound = config.notFound || '/404'
    this.linkActiveClass = config.linkActiveClass || 'active'
    this.linkExactActiveClass = config.linkExactActiveClass || 'exact-active'

    // Initialize routes
    config.routes.forEach(route => {
      this.routes.set(route.path, route)
    })

    // Initialize routing mode
    if (config.mode === 'history') {
      this.initHistoryMode()
    } else {
      this.initHashMode()
    }

    // Handle initial route
    this.handleInitialRoute()
  }

  /**
   * Initialize history mode routing
   */
  private initHistoryMode(): void {
    this.historyMode = {
      push: (path: string) => {
        window.history.pushState({}, '', path)
        this.handleRouteChange(path)
      },
      replace: (path: string) => {
        window.history.replaceState({}, '', path)
        this.handleRouteChange(path)
      },
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      go: (delta: number) => window.history.go(delta),
      current: () => window.location.pathname + window.location.search + window.location.hash,
      listen: (callback: (path: string) => void) => {
        const handlePopstate = () => callback(window.location.pathname + window.location.search + window.location.hash)
        window.addEventListener('popstate', handlePopstate)
        return () => window.removeEventListener('popstate', handlePopstate)
      }
    }
  }

  /**
   * Initialize hash mode routing
   */
  private initHashMode(): void {
    this.hashMode = {
      push: (path: string) => {
        window.location.hash = path
        this.handleRouteChange(window.location.hash)
      },
      replace: (path: string) => {
        window.location.replace('#' + path)
        this.handleRouteChange(window.location.hash)
      },
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      go: (delta: number) => window.history.go(delta),
      current: () => window.location.hash.slice(1) || '/',
      listen: (callback: (path: string) => void) => {
        const handleHashchange = () => callback(window.location.hash.slice(1) || '/')
        window.addEventListener('hashchange', handleHashchange)
        return () => window.removeEventListener('hashchange', handleHashchange)
      }
    }
  }

  /**
   * Handle initial route setup
   */
  private handleInitialRoute(): void {
    const currentPath = this.getCurrentPath()
    this.handleRouteChange(currentPath)
  }

  /**
   * Get current path based on routing mode
   */
  private getCurrentPath(): string {
    if (this.historyMode) {
      return window.location.pathname + window.location.search + window.location.hash
    } else {
      return window.location.hash.slice(1) || '/'
    }
  }

  /**
   * Handle route change
   */
  private async handleRouteChange(path: string): Promise<void> {
    const route = this.parseRoute(path)
    
    if (!route) {
      this.handleNotFound()
      return
    }

    const from = this.currentRoute
    this.currentRoute = route

    // Run navigation guard
    if (this.navigationGuard) {
      const guardResult = await this.navigationGuard(route, from || route)
      if (!guardResult) {
        if (from) {
          this.navigate(from.path, { replace: true })
        }
        return
      }
    }

    // Run route hooks
    await this.runRouteHooks(route, from)

    // Notify listeners
    this.routeListeners.forEach(listener => listener(route))
  }

  /**
   * Parse route from path
   */
  private parseRoute(path: string): Route | null {
    // Remove base path
    let cleanPath = path
    if (this.base && path.startsWith(this.base)) {
      cleanPath = path.slice(this.base.length)
    }

    // Parse URL components
    const url = new URL(cleanPath, window.location.origin)
    const pathname = url.pathname
    const searchParams = new URLSearchParams(url.search)
    const hash = url.hash.slice(1)

    // Convert search params to query object
    const query: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      query[key] = value
    })

    // Find matching route
    for (const [routePath, routeConfig] of this.routes) {
      const match = this.matchRoute(pathname, routePath)
      if (match) {
        return {
          path: routePath,
          params: match.params,
          query,
          hash,
          name: routeConfig.name,
          meta: routeConfig.meta,
          props: routeConfig.props,
          component: routeConfig.component
        }
      }
    }

    return null
  }

  /**
   * Match route path with pattern
   */
  private matchRoute(path: string, pattern: string): { params: Record<string, string> } | null {
    const pathParts = path.split('/').filter(p => p)
    const patternParts = pattern.split('/').filter(p => p)

    if (pathParts.length !== patternParts.length) {
      return null
    }

    const params: Record<string, string> = {}

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i]
      const pathPart = pathParts[i]

      if (patternPart.startsWith(':')) {
        const paramName = patternPart.slice(1)
        params[paramName] = pathPart
      } else if (patternPart !== pathPart) {
        return null
      }
    }

    return { params }
  }

  /**
   * Handle not found route
   */
  private handleNotFound(): void {
    const notFoundRoute = this.routes.get(this.notFound)
    if (notFoundRoute) {
      this.currentRoute = {
        path: this.notFound,
        params: {},
        query: {},
        hash: '',
        component: notFoundRoute.component,
        name: notFoundRoute.name,
        meta: notFoundRoute.meta,
        props: notFoundRoute.props
      }
      this.routeListeners.forEach(listener => listener(this.currentRoute!))
    }
  }

  /**
   * Run route hooks
   */
  private async runRouteHooks(route: Route, from: Route | null): Promise<void> {
    const routeConfig = this.routes.get(route.path)
    if (!routeConfig) return

    // Run beforeEnter hook
    if (routeConfig.beforeEnter) {
      const result = await routeConfig.beforeEnter(route)
      if (!result) {
        if (from) {
          this.navigate(from.path, { replace: true })
        }
        return
      }
    }

    // Run afterLeave hook from previous route
    if (from && routeConfig.afterLeave) {
      await routeConfig.afterLeave(from)
    }
  }

  /**
   * Navigate to a route
   */
  public navigate(path: string, options: NavigationOptions = {}): void {
    const fullPath = this.buildPath(path, options.params, options.query, options.hash)
    
    if (options.replace) {
      this.historyMode?.replace(fullPath) || this.hashMode?.replace(fullPath)
    } else {
      this.historyMode?.push(fullPath) || this.hashMode?.push(fullPath)
    }
  }

  /**
   * Build full path from components
   */
  private buildPath(path: string, params?: Record<string, string>, query?: Record<string, string>, hash?: string): string {
    // Replace params in path
    let fullPath = path
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        fullPath = fullPath.replace(`:${key}`, value)
      })
    }

    // Add query string
    if (query && Object.keys(query).length > 0) {
      const queryString = new URLSearchParams(query).toString()
      fullPath += `?${queryString}`
    }

    // Add hash
    if (hash) {
      fullPath += `#${hash}`
    }

    return fullPath
  }

  /**
   * Get current route
   */
  public getCurrentRoute(): Route | null {
    return this.currentRoute
  }

  /**
   * Add route listener
   */
  public addRouteListener(callback: (route: Route) => void): () => void {
    this.routeListeners.add(callback)
    return () => this.routeListeners.delete(callback)
  }

  /**
   * Set navigation guard
   */
  public setNavigationGuard(guard: (to: Route, from: Route) => boolean | Promise<boolean>): void {
    this.navigationGuard = guard
  }

  /**
   * Add route
   */
  public addRoute(route: RouteConfig): void {
    this.routes.set(route.path, route)
  }

  /**
   * Remove route
   */
  public removeRoute(path: string): void {
    this.routes.delete(path)
  }

  /**
   * Get all routes
   */
  public getRoutes(): RouteConfig[] {
    return Array.from(this.routes.values())
  }

  /**
   * Get link classes for a route
   */
  public getLinkClasses(path: string): string {
    const currentPath = this.getCurrentPath()
    const isActive = this.isActiveRoute(path, currentPath)
    const isExactActive = this.isExactActiveRoute(path, currentPath)
    
    const classes = []
    if (isActive) classes.push(this.linkActiveClass)
    if (isExactActive) classes.push(this.linkExactActiveClass)
    
    return classes.join(' ')
  }

  /**
   * Check if route is active
   */
  private isActiveRoute(path: string, currentPath: string): boolean {
    const route = this.parseRoute(currentPath)
    return route?.path === path
  }

  /**
   * Check if route is exact active
   */
  private isExactActiveRoute(path: string, currentPath: string): boolean {
    return currentPath === path
  }
}

/**
 * Navigation utility functions
 */
export class Navigation {
  private router: Router

  constructor(router: Router) {
    this.router = router
  }

  /**
   * Navigate to a route or delta in history
   */
  public go(to: string | number, options?: NavigationOptions): void {
    if (typeof to === 'string') {
      this.router.navigate(to, options)
    } else {
      this.router['historyMode']?.go(to) || this.router['hashMode']?.go(to)
    }
  }

  /**
   * Navigate back
   */
  public back(): void {
    this.router['historyMode']?.back() || this.router['hashMode']?.back()
  }

  /**
   * Navigate forward
   */
  public forward(): void {
    this.router['historyMode']?.forward() || this.router['hashMode']?.forward()
  }

  /**
   * Replace current route
   */
  public replace(path: string, options?: NavigationOptions): void {
    this.router.navigate(path, { ...options, replace: true })
  }

  /**
   * Get link classes for a route
   */
  public getLinkClasses(path: string): string {
    return this.router.getLinkClasses(path)
  }
}

/**
 * Route matching utility
 */
export class RouteMatcher {
  /**
   * Match a path against a route pattern
   */
  public static match(path: string, pattern: string): { params: Record<string, string> } | null {
    const router = new Router({ routes: [] })
    return router['matchRoute'](path, pattern)
  }

  /**
   * Extract parameters from a path
   */
  public static extractParams(path: string, pattern: string): Record<string, string> | null {
    const match = this.match(path, pattern)
    return match?.params || null
  }

  /**
   * Generate a path from a pattern and parameters
   */
  public static generatePath(pattern: string, params: Record<string, string>): string {
    let path = pattern
    Object.entries(params).forEach(([key, value]) => {
      path = path.replace(`:${key}`, value)
    })
    return path
  }
}

/**
 * Route guards utility
 */
export class RouteGuards {
  /**
   * Create an authentication guard
   */
  public static requireAuth(redirectPath: string = '/login'): (to: Route, from: Route) => boolean {
    return (to: Route, from: Route) => {
      // Check if user is authenticated
      const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true'
      if (!isAuthenticated) {
        // Store the intended destination
        localStorage.setItem('redirectAfterAuth', to.path)
        return false
      }
      return true
    }
  }

  /**
   * Create a role-based guard
   */
  public static requireRole(roles: string[]): (to: Route, from: Route) => boolean {
    return (to: Route, from: Route) => {
      const userRole = localStorage.getItem('userRole')
      return !!userRole && roles.includes(userRole)
    }
  }

  /**
   * Create a permission-based guard
   */
  public static requirePermission(permission: string): (to: Route, from: Route) => boolean {
    return (to: Route, from: Route) => {
      const userPermissions = JSON.parse(localStorage.getItem('userPermissions') || '[]')
      return Array.isArray(userPermissions) && userPermissions.includes(permission)
    }
  }

  /**
   * Create a loading guard
   */
  public static requireData(fetchData: () => Promise<boolean>): (to: Route, from: Route) => Promise<boolean> {
    return async (to: Route, from: Route) => {
      return await fetchData()
    }
  }
}

/**
 * Router utilities
 */
export const RouterUtils = {
  createRouter: (config: RouterConfig) => new Router(config),
  createNavigation: (router: Router) => new Navigation(router),
  RouteMatcher,
  RouteGuards
}

/**
 * Default router instance
 */
let defaultRouter: Router | null = null

/**
 * Create default router
 */
export function createDefaultRouter(config: RouterConfig): Router {
  defaultRouter = new Router(config)
  return defaultRouter
}

/**
 * Get default router
 */
export function getDefaultRouter(): Router | null {
  return defaultRouter
}

/**
 * Navigate to a route using default router
 */
export function navigate(path: string, options?: NavigationOptions): void {
  if (defaultRouter) {
    defaultRouter.navigate(path, options)
  }
}

/**
 * Get current route using default router
 */
export function getCurrentRoute(): Route | null {
  return defaultRouter?.getCurrentRoute() || null
}

/**
 * Add route listener using default router
 */
export function addRouteListener(callback: (route: Route) => void): () => void {
  if (defaultRouter) {
    return defaultRouter.addRouteListener(callback)
  }
  return () => {}
}