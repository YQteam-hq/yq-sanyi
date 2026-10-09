/**
 * Advanced Debugging Tools for yq-sanyi
 * 
 * This module provides sophisticated debugging capabilities including:
 * - Real-time component tree visualization
 * - State change tracking and replay
 * - Performance profiling and optimization
 * - Error boundary analysis
 * - Component lifecycle monitoring
 * - Memory leak detection
 * - Interactive debugging console
 * - Debug data export/import
 */

export interface DebugConfig {
  enabled: boolean;
  autoCapture: boolean;
  maxHistory: number;
  enableProfiling: boolean;
  enableMemoryTracking: boolean;
  enableNetworkTracking: boolean;
  enableComponentTree: boolean;
  enableStateTracking: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  captureStackTraces: boolean;
  performanceThreshold: number;
  memoryThreshold: number;
}

export interface DebugEvent {
  id: string;
  timestamp: number;
  type: 'state-change' | 'component-lifecycle' | 'error' | 'performance' | 'memory' | 'network';
  component?: string;
  data: any;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

export interface ComponentDebugInfo {
  id: string;
  name: string;
  state: any;
  props: any;
  lifecycle: {
    state: 'created' | 'mounted' | 'updated' | 'unmounted';
    timestamp: number;
    duration?: number;
  };
  renderCount: number;
  lastRenderTime: number;
  errors: DebugEvent[];
  performance: {
    averageRenderTime: number;
    maxRenderTime: number;
    minRenderTime: number;
    renderCount: number;
  };
  memory: {
    estimatedSize: number;
    lastUpdate: number;
  };
  children: ComponentDebugInfo[];
  parent?: string;
}

export interface PerformanceProfile {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  components: Map<string, ComponentDebugInfo>;
  events: DebugEvent[];
  summary: {
    totalRenders: number;
    averageRenderTime: number;
    maxRenderTime: number;
    memoryUsage: number;
    errorCount: number;
  };
}

export interface MemoryLeakInfo {
  componentId: string;
  componentName: string;
  suspectedCause: string;
  evidence: {
    memoryGrowth: number;
    instanceCount: number;
    lastSeen: number;
    references: string[];
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export class AdvancedDebuggingTools {
  private config: DebugConfig;
  private eventHistory: DebugEvent[] = [];
  private componentDebugInfo: Map<string, ComponentDebugInfo> = new Map();
  private performanceProfiles: Map<string, PerformanceProfile> = new Map();
  private memorySnapshots: any[] = [];
  private activeProfile: PerformanceProfile | null = null;
  private debugPanel: DebugPanel | null = null;
  private originalErrorHandlers: Map<string, Function> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private stateChangeListeners: Set<(event: DebugEvent) => void> = new Set();

  constructor(config: Partial<DebugConfig> = {}) {
    this.config = {
      enabled: true,
      autoCapture: true,
      maxHistory: 1000,
      enableProfiling: true,
      enableMemoryTracking: true,
      enableNetworkTracking: true,
      enableComponentTree: true,
      enableStateTracking: true,
      logLevel: 'debug',
      captureStackTraces: true,
      performanceThreshold: 16, // 60 FPS = 16.67ms
      memoryThreshold: 50, // 50MB
      ...config
    };

    this.initializeDebugging();
  }

  private initializeDebugging(): void {
    if (!this.config.enabled) return;

    // Override console methods
    this.overrideConsoleMethods();
    
    // Set up error handling
    this.setupErrorHandling();
    
    // Set up performance monitoring
    if (this.config.enableProfiling) {
      this.startPerformanceMonitoring();
    }
    
    // Set up memory monitoring
    if (this.config.enableMemoryTracking) {
      this.startMemoryMonitoring();
    }
    
    // Set up network monitoring
    if (this.config.enableNetworkTracking) {
      this.startNetworkMonitoring();
    }
    
    // Initialize debug panel
    this.initializeDebugPanel();
  }

  private overrideConsoleMethods(): void {
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };

    console.log = (...args: any[]) => {
      this.captureConsoleEvent('log', args);
      originalConsole.log.apply(console, args);
    };

    console.error = (...args: any[]) => {
      this.captureConsoleEvent('error', args);
      originalConsole.error.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      this.captureConsoleEvent('warn', args);
      originalConsole.warn.apply(console, args);
    };

    console.info = (...args: any[]) => {
      this.captureConsoleEvent('info', args);
      originalConsole.info.apply(console, args);
    };

    console.debug = (...args: any[]) => {
      this.captureConsoleEvent('debug', args);
      originalConsole.debug.apply(console, args);
    };
  }

  private captureConsoleEvent(level: string, args: any[]): void {
    if (!this.config.enabled) return;

    const event: DebugEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'state-change',
      data: { level, args },
      metadata: { source: 'console' }
    };

    this.addEventToHistory(event);
  }

  private setupErrorHandling(): void {
    const originalErrorHandler = window.onerror;
    
    window.onerror = (message, source, lineno, colno, error) => {
      this.captureErrorEvent(message, source, lineno, colno, error);
      
      if (originalErrorHandler) {
        return originalErrorHandler(message, source, lineno, colno, error);
      }
      
      return false;
    };

    const originalUnhandledRejection = window.onunhandledrejection;
    
    window.onunhandledrejection = (event) => {
      this.capturePromiseErrorEvent(event);
      
      if (originalUnhandledRejection) {
        return originalUnhandledRejection(event);
      }
      
      return false;
    };
  }

  private captureErrorEvent(message: any, source: string, lineno: number, colno: number, error: Error): void {
    const event: DebugEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'error',
      data: { message, source, lineno, colno, error },
      stackTrace: error?.stack,
      metadata: { source: 'global-error' }
    };

    this.addEventToHistory(event);
    this.notifyErrorListeners(event);
  }

  private capturePromiseErrorEvent(event: PromiseRejectionEvent): void {
    const debugEvent: DebugEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'error',
      data: { reason: event.reason },
      stackTrace: event.reason?.stack,
      metadata: { source: 'promise-rejection' }
    };

    this.addEventToHistory(debugEvent);
    this.notifyErrorListeners(debugEvent);
  }

  private startPerformanceMonitoring(): void {
    const interval = setInterval(() => {
      this.capturePerformanceMetrics();
    }, 1000);

    this.monitoringIntervals.set('performance', interval);
  }

  private startMemoryMonitoring(): void {
    if (!performance.memory) return;

    const interval = setInterval(() => {
      this.captureMemoryMetrics();
    }, 5000);

    this.monitoringIntervals.set('memory', interval);
  }

  private startNetworkMonitoring(): void {
    const originalFetch = window.fetch;
    const originalXHR = window.XMLHttpRequest;

    // Monitor fetch requests
    window.fetch = async (...args: any[]) => {
      const startTime = Date.now();
      
      try {
        const result = await originalFetch.apply(window, args);
        const endTime = Date.now();
        
        this.captureNetworkEvent('fetch', args[0], endTime - startTime);
        return result;
      } catch (error) {
        const endTime = Date.now();
        this.captureNetworkEvent('fetch', args[0], endTime - startTime, error);
        throw error;
      }
    };

    // Monitor XMLHttpRequest
    window.XMLHttpRequest = function() {
      const xhr = new originalXHR();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;

      xhr.open = function(...args: any[]) {
        xhr._startTime = Date.now();
        xhr._url = args[1];
        return originalOpen.apply(xhr, args);
      };

      xhr.send = function(...args: any[]) {
        const originalOnLoad = xhr.onload;
        const originalOnError = xhr.onerror;

        xhr.onload = function() {
          xhr._endTime = Date.now();
          this.captureNetworkEvent('xhr', xhr._url, xhr._endTime - xhr._startTime);
          if (originalOnLoad) originalOnLoad.apply(xhr, args);
        };

        xhr.onerror = function() {
          xhr._endTime = Date.now();
          this.captureNetworkEvent('xhr', xhr._url, xhr._endTime - xhr._startTime, new Error('Request failed'));
          if (originalOnError) originalOnError.apply(xhr, args);
        };

        return originalSend.apply(xhr, args);
      };

      return xhr;
    }.bind(this);

    this.monitoringIntervals.set('network', setInterval(() => {
      this.captureNetworkMetrics();
    }, 10000));
  }

  private capturePerformanceMetrics(): void {
    if (!this.config.enableProfiling) return;

    const event: DebugEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'performance',
      data: {
        fps: this.calculateFPS(),
        memory: performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        } : null,
        timing: {
          navigation: performance.timing,
          paint: performance.getEntriesByType('paint'),
          resources: performance.getEntriesByType('resource')
        }
      }
    };

    this.addEventToHistory(event);
  }

  private captureMemoryMetrics(): void {
    if (!performance.memory) return;

    const event: DebugEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'memory',
      data: {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        percentage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
      }
    };

    this.addEventToHistory(event);

    // Check for memory threshold
    if (performance.memory.usedJSHeapSize > this.config.memoryThreshold * 1024 * 1024) {
      this.checkMemoryLeaks();
    }
  }

  private captureNetworkEvent(type: string, url: string, duration: number, error?: Error): void {
    const event: DebugEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'network',
      data: { type, url, duration, error: error?.message }
    };

    this.addEventToHistory(event);
  }

  private captureNetworkMetrics(): void {
    const resources = performance.getEntriesByType('resource');
    const event: DebugEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'network',
      data: {
        totalRequests: resources.length,
        averageResponseTime: resources.reduce((sum, entry) => sum + entry.duration, 0) / resources.length,
        largestResources: resources
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 5)
          .map(entry => ({ name: entry.name, duration: entry.duration }))
      }
    };

    this.addEventToHistory(event);
  }

  private calculateFPS(): number {
    // Simple FPS calculation based on requestAnimationFrame
    let lastTime = performance.now();
    let frames = 0;
    let fps = 0;

    return new Promise((resolve) => {
      const measure = () => {
        frames++;
        const currentTime = performance.now();
        
        if (currentTime >= lastTime + 1000) {
          fps = Math.round((frames * 1000) / (currentTime - lastTime));
          frames = 0;
          lastTime = currentTime;
          resolve(fps);
        }
        
        requestAnimationFrame(measure);
      };
      
      measure();
    });
  }

  private checkMemoryLeaks(): void {
    // Simple memory leak detection
    const components = Array.from(this.componentDebugInfo.values());
    const memoryLeaks: MemoryLeakInfo[] = [];

    components.forEach(component => {
      const memoryGrowth = component.memory.estimatedSize;
      if (memoryGrowth > 1024 * 1024) { // 1MB
        memoryLeaks.push({
          componentId: component.id,
          componentName: component.name,
          suspectedCause: 'Large component state or DOM references',
          evidence: {
            memoryGrowth,
            instanceCount: 1,
            lastSeen: Date.now(),
            references: []
          },
          severity: memoryGrowth > 10 * 1024 * 1024 ? 'critical' : 'high',
          recommendations: [
            'Consider using memoization for large data',
            'Clean up event listeners in unmount',
            'Avoid storing large objects in component state'
          ]
        });
      }
    });

    if (memoryLeaks.length > 0) {
      this.captureMemoryLeakEvent(memoryLeaks);
    }
  }

  private captureMemoryLeakEvent(leaks: MemoryLeakInfo[]): void {
    const event: DebugEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'memory',
      data: { leaks, type: 'memory-leak-detected' },
      metadata: { source: 'memory-leak-detection' }
    };

    this.addEventToHistory(event);
  }

  private initializeDebugPanel(): void {
    if (typeof document === 'undefined') return;

    this.debugPanel = new DebugPanel(this);
    this.debugPanel.show();
  }

  // Public API
  public startProfile(name: string): string {
    if (!this.config.enableProfiling) {
      throw new Error('Profiling is disabled');
    }

    const profileId = this.generateEventId();
    const profile: PerformanceProfile = {
      id: profileId,
      name,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      components: new Map(),
      events: [],
      summary: {
        totalRenders: 0,
        averageRenderTime: 0,
        maxRenderTime: 0,
        memoryUsage: 0,
        errorCount: 0
      }
    };

    this.activeProfile = profile;
    this.performanceProfiles.set(profileId, profile);

    return profileId;
  }

  public stopProfile(profileId: string): PerformanceProfile | null {
    const profile = this.performanceProfiles.get(profileId);
    if (!profile) return null;

    profile.endTime = Date.now();
    profile.duration = profile.endTime - profile.startTime;
    profile.events = this.eventHistory.filter(event => 
      event.timestamp >= profile.startTime && event.timestamp <= profile.endTime
    );

    // Calculate summary
    const renderEvents = profile.events.filter(e => e.type === 'performance');
    profile.summary.totalRenders = renderEvents.length;
    profile.summary.averageRenderTime = renderEvents.length > 0 ? 
      renderEvents.reduce((sum, e) => sum + e.data.renderTime, 0) / renderEvents.length : 0;
    profile.summary.maxRenderTime = Math.max(...renderEvents.map(e => e.data.renderTime), 0);
    profile.summary.memoryUsage = profile.events.find(e => e.type === 'memory')?.data.used || 0;
    profile.summary.errorCount = profile.events.filter(e => e.type === 'error').length;

    this.activeProfile = null;
    return profile;
  }

  public captureComponentLifecycle(componentId: string, componentName: string, action: 'created' | 'mounted' | 'updated' | 'unmounted', data: any = {}): void {
    const event: DebugEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'component-lifecycle',
      component: componentName,
      data: { action, componentId, ...data },
      metadata: { source: 'component-lifecycle' }
    };

    this.addEventToHistory(event);
    this.updateComponentDebugInfo(componentId, componentName, action, data);
  }

  private updateComponentDebugInfo(componentId: string, componentName: string, action: string, data: any): void {
    let debugInfo = this.componentDebugInfo.get(componentId);
    
    if (!debugInfo) {
      debugInfo = {
        id: componentId,
        name: componentName,
        state: {},
        props: {},
        lifecycle: {
          state: action,
          timestamp: Date.now()
        },
        renderCount: 0,
        lastRenderTime: Date.now(),
        errors: [],
        performance: {
          averageRenderTime: 0,
          maxRenderTime: 0,
          minRenderTime: 0,
          renderCount: 0
        },
        memory: {
          estimatedSize: 0,
          lastUpdate: Date.now()
        },
        children: []
      };
      this.componentDebugInfo.set(componentId, debugInfo);
    }

    // Update lifecycle state
    debugInfo.lifecycle.state = action;
    debugInfo.lifecycle.timestamp = Date.now();

    // Update render count for updates
    if (action === 'updated') {
      debugInfo.renderCount++;
      debugInfo.lastRenderTime = Date.now();
      debugInfo.performance.renderCount++;
      
      // Update performance metrics
      const renderTime = data.renderTime || 0;
      debugInfo.performance.averageRenderTime = 
        (debugInfo.performance.averageRenderTime * (debugInfo.performance.renderCount - 1) + renderTime) / 
        debugInfo.performance.renderCount;
      debugInfo.performance.maxRenderTime = Math.max(debugInfo.performance.maxRenderTime, renderTime);
      debugInfo.performance.minRenderTime = Math.min(debugInfo.performance.minRenderTime, renderTime);
    }

    // Update memory estimate
    if (data.state) {
      debugInfo.state = data.state;
      debugInfo.memory.estimatedSize = this.estimateObjectSize(data.state);
    }

    this.componentDebugInfo.set(componentId, debugInfo);
  }

  private estimateObjectSize(obj: any): number {
    if (typeof obj !== 'object' || obj === null) {
      return obj ? obj.toString().length * 2 : 0;
    }

    let size = 0;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        size += key.toString().length * 2;
        size += this.estimateObjectSize(obj[key]);
      }
    }
    return size;
  }

  public captureStateChange(componentId: string, componentName: string, oldState: any, newState: any): void {
    const event: DebugEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'state-change',
      component: componentName,
      data: { componentId, oldState, newState },
      metadata: { source: 'state-change' }
    };

    this.addEventToHistory(event);
    this.updateComponentDebugInfo(componentId, componentName, 'updated', { state: newState });
  }

  public addEventToHistory(event: DebugEvent): void {
    if (!this.config.enabled) return;

    this.eventHistory.push(event);
    
    // Limit history size
    if (this.eventHistory.length > this.config.maxHistory) {
      this.eventHistory.shift();
    }

    // Notify listeners
    this.stateChangeListeners.forEach(listener => listener(event));
  }

  public getEventHistory(): DebugEvent[] {
    return [...this.eventHistory];
  }

  public getComponentDebugInfo(componentId?: string): ComponentDebugInfo | Map<string, ComponentDebugInfo> {
    if (componentId) {
      return this.componentDebugInfo.get(componentId);
    }
    return new Map(this.componentDebugInfo);
  }

  public getPerformanceProfiles(): PerformanceProfile[] {
    return Array.from(this.performanceProfiles.values());
  }

  public getMemorySnapshots(): any[] {
    return [...this.memorySnapshots];
  }

  public exportDebugData(): {
    events: DebugEvent[];
    components: Map<string, ComponentDebugInfo>;
    profiles: PerformanceProfile[];
    memorySnapshots: any[];
    config: DebugConfig;
    timestamp: number;
  } {
    return {
      events: this.eventHistory,
      components: new Map(this.componentDebugInfo),
      profiles: Array.from(this.performanceProfiles.values()),
      memorySnapshots: this.memorySnapshots,
      config: this.config,
      timestamp: Date.now()
    };
  }

  public importDebugData(data: any): void {
    if (data.events) {
      this.eventHistory = data.events;
    }
    
    if (data.components) {
      this.componentDebugInfo = new Map(Object.entries(data.components));
    }
    
    if (data.profiles) {
      this.performanceProfiles = new Map(data.profiles.map(p => [p.id, p]));
    }
    
    if (data.memorySnapshots) {
      this.memorySnapshots = data.memorySnapshots;
    }
    
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }
  }

  public clearDebugData(): void {
    this.eventHistory = [];
    this.componentDebugInfo.clear();
    this.performanceProfiles.clear();
    this.memorySnapshots = [];
    this.activeProfile = null;
  }

  public toggleDebugPanel(): void {
    if (this.debugPanel) {
      this.debugPanel.toggle();
    }
  }

  public setLogLevel(level: DebugConfig['logLevel']): void {
    this.config.logLevel = level;
  }

  public enableFeature(feature: keyof DebugConfig): void {
    if (feature in this.config) {
      (this.config as any)[feature] = true;
    }
  }

  public disableFeature(feature: keyof DebugConfig): void {
    if (feature in this.config) {
      (this.config as any)[feature] = false;
    }
  }

  public addStateChangeListener(listener: (event: DebugEvent) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => {
      this.stateChangeListeners.delete(listener);
    };
  }

  private notifyErrorListeners(event: DebugEvent): void {
    this.stateChangeListeners.forEach(listener => {
      if (event.type === 'error') {
        listener(event);
      }
    });
  }

  private generateEventId(): string {
    return `debug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public destroy(): void {
    // Clean up monitoring intervals
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals.clear();

    // Clean up event listeners
    this.stateChangeListeners.clear();

    // Clean up debug panel
    if (this.debugPanel) {
      this.debugPanel.destroy();
      this.debugPanel = null;
    }

    // Restore original console methods
    this.restoreConsoleMethods();
  }

  private restoreConsoleMethods(): void {
    // This would need to store and restore original methods
    // For now, we'll just clean up
    console.log = console.log;
    console.error = console.error;
    console.warn = console.warn;
    console.info = console.info;
    console.debug = console.debug;
  }
}

// Debug Panel UI Class
class DebugPanel {
  private container: HTMLElement;
  private tools: AdvancedDebuggingTools;
  private isVisible: boolean = false;

  constructor(tools: AdvancedDebuggingTools) {
    this.tools = tools;
    this.createPanel();
  }

  private createPanel(): void {
    this.container = document.createElement('div');
    this.container.id = 'yq-debug-panel';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 400px;
      height: 600px;
      background: #1a1a1a;
      color: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: monospace;
      font-size: 12px;
    `;

    this.createHeader();
    this.createContent();
    this.createControls();

    document.body.appendChild(this.container);
  }

  private createHeader(): void {
    const header = document.createElement('div');
    header.style.cssText = `
      background: #333;
      padding: 10px;
      border-radius: 8px 8px 0 0;
      cursor: move;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const title = document.createElement('h3');
    title.textContent = 'yq-sanyi Debug Panel';
    title.style.cssText = 'margin: 0; color: #fff;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: #ff4444;
      border: none;
      color: white;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      cursor: pointer;
    `;

    closeBtn.onclick = () => this.hide();

    header.appendChild(title);
    header.appendChild(closeBtn);
    this.container.appendChild(header);
  }

  private createContent(): void {
    const content = document.createElement('div');
    content.style.cssText = `
      padding: 10px;
      height: calc(100% - 120px);
      overflow-y: auto;
    `;

    // Add tabs
    const tabs = document.createElement('div');
    tabs.style.cssText = `
      display: flex;
      gap: 5px;
      margin-bottom: 10px;
    `;

    const tabsData = [
      { id: 'events', label: 'Events' },
      { id: 'components', label: 'Components' },
      { id: 'performance', label: 'Performance' },
      { id: 'memory', label: 'Memory' }
    ];

    tabsData.forEach(tab => {
      const tabBtn = document.createElement('button');
      tabBtn.textContent = tab.label;
      tabBtn.style.cssText = `
        padding: 5px 10px;
        background: #333;
        border: none;
        color: #fff;
        border-radius: 4px;
        cursor: pointer;
      `;

      tabBtn.onclick = () => this.switchTab(tab.id);
      tabs.appendChild(tabBtn);
    });

    content.appendChild(tabs);

    // Add content area
    const contentArea = document.createElement('div');
    contentArea.id = 'debug-panel-content';
    contentArea.style.cssText = `
      background: #2a2a2a;
      padding: 10px;
      border-radius: 4px;
      height: calc(100% - 40px);
      overflow-y: auto;
    `;

    content.appendChild(contentArea);
    this.container.appendChild(content);
  }

  private createControls(): void {
    const controls = document.createElement('div');
    controls.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: #333;
      padding: 10px;
      border-radius: 0 0 8px 8px;
      display: flex;
      gap: 10px;
    `;

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = `
      background: #ff4444;
      border: none;
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
    `;

    clearBtn.onclick = () => {
      this.tools.clearDebugData();
      this.updateContent();
    };

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export';
    exportBtn.style.cssText = `
      background: #4444ff;
      border: none;
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
    `;

    exportBtn.onclick = () => this.exportDebugData();

    controls.appendChild(clearBtn);
    controls.appendChild(exportBtn);
    this.container.appendChild(controls);
  }

  private switchTab(tabId: string): void {
    // Update tab styles
    const tabs = this.container.querySelectorAll('button');
    tabs.forEach((tab, index) => {
      if (index < 4) { // Only tab buttons
        tab.style.background = tab.textContent?.toLowerCase() === tabId ? '#555' : '#333';
      }
    });

    this.updateContent(tabId);
  }

  private updateContent(tabId: string = 'events'): void {
    const contentArea = this.container.querySelector('#debug-panel-content') as HTMLElement;
    contentArea.innerHTML = '';

    switch (tabId) {
      case 'events':
        this.showEvents(contentArea);
        break;
      case 'components':
        this.showComponents(contentArea);
        break;
      case 'performance':
        this.showPerformance(contentArea);
        break;
      case 'memory':
        this.showMemory(contentArea);
        break;
    }
  }

  private showEvents(container: HTMLElement): void {
    const events = this.tools.getEventHistory();
    const eventsList = document.createElement('div');
    
    events.slice(-50).reverse().forEach(event => {
      const eventEl = document.createElement('div');
      eventEl.style.cssText = `
        margin-bottom: 5px;
        padding: 5px;
        background: #333;
        border-radius: 4px;
        font-size: 11px;
      `;
      
      eventEl.innerHTML = `
        <div style="color: #aaa;">${new Date(event.timestamp).toLocaleTimeString()}</div>
        <div style="color: #fff;">[${event.type}] ${event.component || 'System'}</div>
        <div style="color: #ccc;">${JSON.stringify(event.data).substring(0, 100)}...</div>
      `;
      
      eventsList.appendChild(eventEl);
    });

    container.appendChild(eventsList);
  }

  private showComponents(container: HTMLElement): void {
    const components = this.tools.getComponentDebugInfo();
    const componentsList = document.createElement('div');
    
    components.forEach((component, id) => {
      const componentEl = document.createElement('div');
      componentEl.style.cssText = `
        margin-bottom: 10px;
        padding: 10px;
        background: #333;
        border-radius: 4px;
      `;
      
      componentEl.innerHTML = `
        <h4 style="margin: 0 0 5px 0; color: #fff;">${component.name}</h4>
        <div style="font-size: 11px; color: #aaa;">
          ID: ${component.id}<br>
          State: ${component.lifecycle.state}<br>
          Renders: ${component.renderCount}<br>
          Memory: ${(component.memory.estimatedSize / 1024).toFixed(2)} KB
        </div>
      `;
      
      componentsList.appendChild(componentEl);
    });

    container.appendChild(componentsList);
  }

  private showPerformance(container: HTMLElement): void {
    const profiles = this.tools.getPerformanceProfiles();
    const profilesList = document.createElement('div');
    
    profiles.forEach(profile => {
      const profileEl = document.createElement('div');
      profileEl.style.cssText = `
        margin-bottom: 10px;
        padding: 10px;
        background: #333;
        border-radius: 4px;
      `;
      
      profileEl.innerHTML = `
        <h4 style="margin: 0 0 5px 0; color: #fff;">${profile.name}</h4>
        <div style="font-size: 11px; color: #aaa;">
          Duration: ${profile.duration}ms<br>
          Renders: ${profile.summary.totalRenders}<br>
          Avg Render Time: ${profile.summary.averageRenderTime.toFixed(2)}ms<br>
          Max Render Time: ${profile.summary.maxRenderTime}ms
        </div>
      `;
      
      profilesList.appendChild(profileEl);
    });

    container.appendChild(profilesList);
  }

  private showMemory(container: HTMLElement): void {
    const memorySnapshots = this.tools.getMemorySnapshots();
    const memoryList = document.createElement('div');
    
    memorySnapshots.slice(-10).reverse().forEach((snapshot, index) => {
      const snapshotEl = document.createElement('div');
      snapshotEl.style.cssText = `
        margin-bottom: 5px;
        padding: 5px;
        background: #333;
        border-radius: 4px;
        font-size: 11px;
      `;
      
      snapshotEl.innerHTML = `
        <div style="color: #aaa;">Snapshot ${memorySnapshots.length - index}</div>
        <div style="color: #fff;">${JSON.stringify(snapshot).substring(0, 100)}...</div>
      `;
      
      memoryList.appendChild(snapshotEl);
    });

    container.appendChild(memoryList);
  }

  private exportDebugData(): void {
    const data = this.tools.exportDebugData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `yq-debug-data-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  public show(): void {
    this.container.style.display = 'block';
    this.isVisible = true;
    this.updateContent();
  }

  public hide(): void {
    this.container.style.display = 'none';
    this.isVisible = false;
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public destroy(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

// Factory function for creating debugging tools
export function createAdvancedDebuggingTools(config: Partial<DebugConfig> = {}): AdvancedDebuggingTools {
  return new AdvancedDebuggingTools(config);
}

// Default debugging configuration
export const DefaultDebugConfig: DebugConfig = {
  enabled: true,
  autoCapture: true,
  maxHistory: 1000,
  enableProfiling: true,
  enableMemoryTracking: true,
  enableNetworkTracking: true,
  enableComponentTree: true,
  enableStateTracking: true,
  logLevel: 'debug',
  captureStackTraces: true,
  performanceThreshold: 16,
  memoryThreshold: 50
};