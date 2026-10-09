/**
 * Advanced Component Composition System for yq-sanyi
 * 
 * This module provides sophisticated component composition capabilities including:
 * - Component inheritance and extension
 * - Higher-order components (HOCs)
 * - Mixin patterns for shared functionality
 * - Component decorators and metadata
 * - Dynamic component loading
 * - Component lifecycle management
 * - Slot composition and projection
 * - Component dependency injection
 */

export interface ComponentMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  props?: ComponentProp[];
  events?: ComponentEvent[];
  slots?: ComponentSlot[];
  styles?: string[];
  features?: string[];
}

export interface ComponentProp {
  name: string;
  type: string;
  required?: boolean;
  default?: any;
  description?: string;
  validator?: (value: any) => boolean;
}

export interface ComponentEvent {
  name: string;
  payload?: any;
  description?: string;
}

export interface ComponentSlot {
  name: string;
  fallback?: string;
  description?: string;
}

export interface ComponentConfig {
  name: string;
  extends?: string;
  mixins?: ComponentMixin[];
  template?: string;
  style?: string;
  script?: ComponentScript;
  props?: Record<string, any>;
  slots?: Record<string, string>;
  decorators?: ComponentDecorator[];
  metadata?: ComponentMetadata;
  dependencies?: Record<string, any>;
}

export interface ComponentMixin {
  name: string;
  template?: string;
  style?: string;
  script?: ComponentScript;
  props?: Record<string, any>;
  lifecycle?: Partial<LifecycleHooks>;
  methods?: Record<string, (...args: any[]) => any>;
  computed?: Record<string, () => any>;
  watch?: Record<string, (newVal: any, oldVal: any) => void>;
}

export interface ComponentDecorator {
  name: string;
  decorator: (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => any;
  options?: any;
}

export interface LifecycleHooks {
  onBeforeCreate?: () => void;
  onCreated?: () => void;
  onBeforeMount?: () => void;
  onMounted?: () => void;
  onBeforeUpdate?: () => void;
  onUpdated?: () => void;
  onBeforeUnmount?: () => void;
  onUnmounted?: () => void;
  onError?: (error: Error) => void;
}

export interface ComponentInstance {
  id: string;
  name: string;
  config: ComponentConfig;
  state: Record<string, any>;
  props: Record<string, any>;
  methods: Record<string, (...args: any[]) => any>;
  computed: Record<string, () => any>;
  watchers: Record<string, (newVal: any, oldVal: any) => void>;
  lifecycle: LifecycleHooks;
  children: ComponentInstance[];
  parent: ComponentInstance | null;
  element: HTMLElement | null;
  metadata: ComponentMetadata;
  dependencies: Record<string, any>;
  mixins: ComponentMixin[];
  decorators: ComponentDecorator[];
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

export interface HigherOrderComponent {
  (Component: ComponentFactory): ComponentFactory;
  displayName?: string;
  description?: string;
}

export interface ComponentFactory {
  (name: string, config: ComponentConfig): ComponentInstance;
}

export interface ComponentLoader {
  load(name: string): Promise<ComponentConfig>;
  preload(names: string[]): Promise<void>;
  clearCache(): void;
}

export class AdvancedComponentComposition {
  private componentRegistry = new Map<string, ComponentConfig>();
  private componentInstances = new Map<string, ComponentInstance>();
  private higherOrderComponents = new Map<string, HigherOrderComponent>();
  private mixins = new Map<string, ComponentMixin>();
  private decorators = new Map<string, ComponentDecorator>();
  private componentLoader: ComponentLoader;
  private dependencyGraph = new Map<string, Set<string>>();

  constructor(loader?: ComponentLoader) {
    this.componentLoader = loader || this.createDefaultLoader();
    this.initializeBuiltMixins();
    this.initializeBuiltDecorators();
  }

  private createDefaultLoader(): ComponentLoader {
    return {
      load: async (name: string) => {
        // Simulate async loading
        return new Promise((resolve) => {
          setTimeout(() => {
            const config = this.componentRegistry.get(name);
            if (config) {
              resolve(config);
            } else {
              throw new Error(`Component ${name} not found`);
            }
          }, 100);
        });
      },
      preload: async (names: string[]) => {
        await Promise.all(names.map(name => this.componentLoader.load(name)));
      },
      clearCache: () => {
        // Clear any internal caching
      }
    };
  }

  private initializeBuiltMixins(): void {
    // Built-in mixins
    this.mixins.set('stateful', {
      name: 'stateful',
      script: () => ({
        state: {},
        lifecycle: {
          onCreated() {
            console.log(`Component ${this.name} created with state`);
          }
        }
      })
    });

    this.mixins.set('eventful', {
      name: 'eventful',
      script: () => ({
        methods: {
          emit(event: string, data?: any) {
            const customEvent = new CustomEvent(event, { detail: data });
            this.element?.dispatchEvent(customEvent);
          },
          on(event: string, handler: (event: CustomEvent) => void) {
            this.element?.addEventListener(event, handler);
          }
        }
      })
    });

    this.mixins.set('stylable', {
      name: 'stylable',
      style: '',
      script: () => ({
        methods: {
          addStyle(css: string) {
            if (this.element) {
              const style = document.createElement('style');
              style.textContent = css;
              this.element.appendChild(style);
            }
          },
          removeStyle(selector: string) {
            if (this.element) {
              const element = this.element.querySelector(selector);
              if (element) {
                element.remove();
              }
            }
          }
        }
      })
    });
  }

  private initializeBuiltDecorators(): void {
    // Built-in decorators
    this.decorators.set('log', {
      name: 'log',
      decorator: (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
        if (descriptor) {
          const originalMethod = descriptor.value;
          descriptor.value = function(...args: any[]) {
            console.log(`Method ${propertyKey} called with args:`, args);
            const result = originalMethod.apply(this, args);
            console.log(`Method ${propertyKey} returned:`, result);
            return result;
          };
        }
        return target;
      }
    });

    this.decorators.set('debounce', {
      name: 'debounce',
      decorator: (target: any, propertyKey?: string, descriptor?: PropertyDescriptor, options: { delay?: number } = {}) => {
        if (descriptor) {
          const originalMethod = descriptor.value;
          const delay = options.delay || 300;
          let timeoutId: NodeJS.Timeout;
          
          descriptor.value = function(...args: any[]) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              originalMethod.apply(this, args);
            }, delay);
          };
        }
        return target;
      },
      options: { delay: 300 }
    });

    this.decorators.set('throttle', {
      name: 'throttle',
      decorator: (target: any, propertyKey?: string, descriptor?: PropertyDescriptor, options: { limit?: number } = {}) => {
        if (descriptor) {
          const originalMethod = descriptor.value;
          const limit = options.limit || 1000;
          let lastCall = 0;
          
          descriptor.value = function(...args: any[]) {
            const now = Date.now();
            if (now - lastCall >= limit) {
              lastCall = now;
              originalMethod.apply(this, args);
            }
          };
        }
        return target;
      },
      options: { limit: 1000 }
    });
  }

  public registerComponent(config: ComponentConfig): void {
    // Validate component config
    this.validateComponentConfig(config);
    
    // Process inheritance
    if (config.extends) {
      const parentConfig = this.componentRegistry.get(config.extends);
      if (parentConfig) {
        config = this.mergeWithParent(config, parentConfig);
      }
    }

    // Process mixins
    if (config.mixins) {
      config = this.applyMixins(config, config.mixins);
    }

    // Store component
    this.componentRegistry.set(config.name, config);
    this.updateDependencyGraph(config);
  }

  private validateComponentConfig(config: ComponentConfig): void {
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Component name is required and must be a string');
    }

    if (!config.template || typeof config.template !== 'string') {
      throw new Error('Component template is required and must be a string');
    }

    if (this.componentRegistry.has(config.name)) {
      throw new Error(`Component ${config.name} is already registered`);
    }

    // Validate component name format
    if (!/^[a-z][a-z0-9-]*$/.test(config.name)) {
      throw new Error('Component name must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens');
    }
  }

  private mergeWithChild(child: ComponentConfig, parent: ComponentConfig): ComponentConfig {
    return {
      ...parent,
      ...child,
      template: child.template || parent.template,
      style: child.style || parent.style,
      script: child.script || parent.script,
      props: { ...parent.props, ...child.props },
      slots: { ...parent.slots, ...child.slots },
      mixins: [...(parent.mixins || []), ...(child.mixins || [])],
      decorators: [...(parent.decorators || []), ...(child.decorators || [])],
      metadata: {
        ...parent.metadata,
        ...child.metadata,
        dependencies: { ...parent.metadata?.dependencies, ...child.metadata?.dependencies }
      }
    };
  }

  private mergeWithParent(child: ComponentConfig, parent: ComponentConfig): ComponentConfig {
    return this.mergeWithChild(parent, child);
  }

  private applyMixins(config: ComponentConfig, mixinNames: string[]): ComponentConfig {
    const mixins = mixinNames.map(name => this.mixins.get(name)).filter(Boolean);
    
    let mergedConfig = { ...config };
    
    for (const mixin of mixins) {
      if (mixin.template) {
        mergedConfig.template = `${mergedConfig.template}\n${mixin.template}`;
      }
      
      if (mixin.style) {
        mergedConfig.style = `${mergedConfig.style}\n${mixin.style}`;
      }
      
      if (mixin.script) {
        mergedConfig.script = this.mergeScripts(mergedConfig.script, mixin.script);
      }
      
      if (mixin.props) {
        mergedConfig.props = { ...mergedConfig.props, ...mixin.props };
      }
      
      if (mixin.lifecycle) {
        mergedConfig.script = this.mergeLifecycleHooks(mergedConfig.script, mixin.lifecycle);
      }
    }
    
    return mergedConfig;
  }

  private mergeScripts(existingScript: ComponentScript, mixinScript: ComponentScript): ComponentScript {
    if (!existingScript) return mixinScript;
    if (!mixinScript) return existingScript;

    const existingFn = typeof existingScript === 'function' ? existingScript : 
      (() => new Function('return ' + existingScript)());
    const mixinFn = typeof mixinScript === 'function' ? mixinScript : 
      (() => new Function('return ' + mixinScript)());

    return () => {
      const existingResult = existingFn();
      const mixinResult = mixinFn();
      return { ...existingResult, ...mixinResult };
    };
  }

  private mergeLifecycleHooks(existingScript: ComponentScript, lifecycleHooks: Partial<LifecycleHooks>): ComponentScript {
    if (!existingScript) return () => ({ lifecycle: lifecycleHooks });

    const existingFn = typeof existingScript === 'function' ? existingScript : 
      (() => new Function('return ' + existingScript)());

    return () => {
      const result = existingFn();
      return {
        ...result,
        lifecycle: {
          ...result.lifecycle,
          ...lifecycleHooks
        }
      };
    };
  }

  private updateDependencyGraph(config: ComponentConfig): void {
    const dependencies = new Set<string>();
    
    if (config.extends) {
      dependencies.add(config.extends);
    }
    
    if (config.mixins) {
      config.mixins.forEach(mixin => dependencies.add(mixin.name));
    }
    
    if (config.metadata?.dependencies) {
      Object.keys(config.metadata.dependencies).forEach(dep => dependencies.add(dep));
    }
    
    this.dependencyGraph.set(config.name, dependencies);
  }

  public createComponent(name: string, props: Record<string, any> = {}): ComponentInstance {
    const config = this.componentRegistry.get(name);
    if (!config) {
      throw new Error(`Component ${name} not found`);
    }

    const instance: ComponentInstance = {
      id: this.generateInstanceId(),
      name,
      config,
      props: { ...config.props, ...props },
      state: {},
      methods: {},
      computed: {},
      watchers: {},
      lifecycle: {},
      children: [],
      parent: null,
      element: null,
      metadata: config.metadata || { name, version: '1.0.0' },
      dependencies: config.metadata?.dependencies || {},
      mixins: config.mixins || [],
      decorators: config.decorators || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true
    };

    // Initialize component
    this.initializeComponent(instance);
    
    // Store instance
    this.componentInstances.set(instance.id, instance);
    
    return instance;
  }

  private generateInstanceId(): string {
    return `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeComponent(instance: ComponentInstance): void {
    // Initialize script
    if (instance.config.script) {
      const scriptFn = typeof instance.config.script === 'function' ? 
        instance.config.script : 
        (() => new Function('return ' + instance.config.script)());
      
      const scriptResult = scriptFn.call(instance);
      
      // Initialize state
      if (scriptResult.state) {
        instance.state = { ...scriptResult.state };
      }
      
      // Initialize methods
      if (scriptResult.methods) {
        instance.methods = { ...scriptResult.methods };
      }
      
      // Initialize computed properties
      if (scriptResult.computed) {
        instance.computed = { ...scriptResult.computed };
      }
      
      // Initialize watchers
      if (scriptResult.watch) {
        instance.watchers = { ...scriptResult.watch };
      }
      
      // Initialize lifecycle hooks
      if (scriptResult.lifecycle) {
        instance.lifecycle = { ...scriptResult.lifecycle };
      }
    }

    // Apply decorators
    this.applyDecorators(instance);

    // Execute lifecycle hooks
    this.executeLifecycleHook(instance, 'onBeforeCreate');
  }

  private applyDecorators(instance: ComponentInstance): void {
    for (const decorator of instance.decorators) {
      if (this.decorators.has(decorator.name)) {
        const decoratorFn = this.decorators.get(decorator.name)!;
        // Apply decorator to component instance
        decoratorFn(instance, undefined, undefined, decorator.options);
      }
    }
  }

  private executeLifecycleHook(instance: ComponentInstance, hook: keyof LifecycleHooks): void {
    if (instance.lifecycle[hook]) {
      try {
        instance.lifecycle[hook]!.call(instance);
      } catch (error) {
        console.error(`Error executing lifecycle hook ${hook}:`, error);
        if (instance.lifecycle.onError) {
          instance.lifecycle.onError.call(instance, error as Error);
        }
      }
    }
  }

  public createHigherOrderComponent(name: string, hoc: HigherOrderComponent): void {
    this.higherOrderComponents.set(name, hoc);
  }

  public applyHigherOrderComponent(componentName: string, hocName: string): ComponentFactory {
    const hoc = this.higherOrderComponents.get(hocName);
    if (!hoc) {
      throw new Error(`Higher-order component ${hocName} not found`);
    }

    const originalFactory = (name: string, config: ComponentConfig) => {
      const component = this.createComponent(name, config);
      return hoc(() => component)(name, config);
    };

    return originalFactory;
  }

  public createMixin(name: string, mixin: ComponentMixin): void {
    this.mixins.set(name, mixin);
  }

  public createDecorator(name: string, decorator: ComponentDecorator['decorator'], options?: any): void {
    this.decorators.set(name, { name, decorator, options });
  }

  public getComponent(name: string): ComponentConfig | undefined {
    return this.componentRegistry.get(name);
  }

  public getInstance(id: string): ComponentInstance | undefined {
    return this.componentInstances.get(id);
  }

  public getAllComponents(): ComponentConfig[] {
    return Array.from(this.componentRegistry.values());
  }

  public getAllInstances(): ComponentInstance[] {
    return Array.from(this.componentInstances.values());
  }

  public getDependencies(componentName: string): string[] {
    const dependencies = this.dependencyGraph.get(componentName);
    return dependencies ? Array.from(dependencies) : [];
  }

  public getDependents(componentName: string): string[] {
    const dependents: string[] = [];
    for (const [name, deps] of this.dependencyGraph) {
      if (deps.has(componentName)) {
        dependents.push(name);
      }
    }
    return dependents;
  }

  public hasCircularDependency(componentName: string, visited: Set<string> = new Set()): boolean {
    if (visited.has(componentName)) {
      return true;
    }
    
    visited.add(componentName);
    const dependencies = this.getDependencies(componentName);
    
    for (const dep of dependencies) {
      if (this.hasCircularDependency(dep, visited)) {
        return true;
      }
    }
    
    visited.delete(componentName);
    return false;
  }

  public validateComponentTree(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const [name, config] of this.componentRegistry) {
      // Check for circular dependencies
      if (this.hasCircularDependency(name)) {
        errors.push(`Circular dependency detected for component ${name}`);
      }
      
      // Check if parent exists
      if (config.extends && !this.componentRegistry.has(config.extends)) {
        errors.push(`Parent component ${config.extends} not found for component ${name}`);
      }
      
      // Check if mixins exist
      for (const mixin of config.mixins || []) {
        if (!this.mixins.has(mixin.name)) {
          errors.push(`Mixin ${mixin.name} not found for component ${name}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  public cloneComponent(sourceName: string, newName: string, overrides: Partial<ComponentConfig> = {}): void {
    const sourceConfig = this.componentRegistry.get(sourceName);
    if (!sourceConfig) {
      throw new Error(`Source component ${sourceName} not found`);
    }

    const clonedConfig: ComponentConfig = {
      ...sourceConfig,
      name: newName,
      ...overrides
    };

    this.registerComponent(clonedConfig);
  }

  public updateComponent(name: string, updates: Partial<ComponentConfig>): void {
    const existingConfig = this.componentRegistry.get(name);
    if (!existingConfig) {
      throw new Error(`Component ${name} not found`);
    }

    const updatedConfig: ComponentConfig = {
      ...existingConfig,
      ...updates
    };

    this.registerComponent(updatedConfig);
  }

  public deleteComponent(name: string): void {
    if (!this.componentRegistry.has(name)) {
      throw new Error(`Component ${name} not found`);
    }

    // Check if other components depend on this one
    const dependents = this.getDependents(name);
    if (dependents.length > 0) {
      throw new Error(`Cannot delete component ${name} because it is depended upon by: ${dependents.join(', ')}`);
    }

    this.componentRegistry.delete(name);
    this.dependencyGraph.delete(name);
  }

  public exportComponent(name: string): ComponentConfig {
    const config = this.componentRegistry.get(name);
    if (!config) {
      throw new Error(`Component ${name} not found`);
    }

    return JSON.parse(JSON.stringify(config));
  }

  public importComponent(config: ComponentConfig): void {
    this.registerComponent(config);
  }

  public clearRegistry(): void {
    this.componentRegistry.clear();
    this.componentInstances.clear();
    this.dependencyGraph.clear();
  }
}

// Utility functions for component composition
export const CompositionUtils = {
  createComponent: (name: string, config: ComponentConfig) => {
    return AdvancedComponentCompositionRegistry.createComponent(name, config);
  },

  createMixin: (name: string, mixin: ComponentMixin) => {
    return AdvancedComponentCompositionRegistry.createMixin(name, mixin);
  },

  createDecorator: (name: string, decorator: ComponentDecorator['decorator'], options?: any) => {
    return AdvancedComponentCompositionRegistry.createDecorator(name, decorator, options);
  },

  createHigherOrderComponent: (name: string, hoc: HigherOrderComponent) => {
    return AdvancedComponentCompositionRegistry.createHigherOrderComponent(name, hoc);
  },

  validateComponent: (config: ComponentConfig) => {
    return AdvancedComponentCompositionRegistry.validateComponentTree();
  },

  exportComponent: (name: string) => {
    return AdvancedComponentCompositionRegistry.exportComponent(name);
  },

  importComponent: (config: ComponentConfig) => {
    return AdvancedComponentCompositionRegistry.importComponent(config);
  }
};

// Create global instance
export const AdvancedComponentCompositionRegistry = new AdvancedComponentComposition();

// Built-in higher-order components
export const withProps = (props: Record<string, any>): HigherOrderComponent => {
  return (Component) => {
    return (name: string, config: ComponentConfig) => {
      const enhancedConfig = {
        ...config,
        props: { ...config.props, ...props }
      };
      return Component(name, enhancedConfig);
    };
  };
};

export const withState = (initialState: Record<string, any>): HigherOrderComponent => {
  return (Component) => {
    return (name: string, config: ComponentConfig) => {
      const enhancedConfig = {
        ...config,
        script: () => ({
          ...config.script?.(),
          state: { ...initialState, ...config.script?.()?.state }
        })
      };
      return Component(name, enhancedConfig);
    };
  };
};

export const withLifecycle = (lifecycle: Partial<LifecycleHooks>): HigherOrderComponent => {
  return (Component) => {
    return (name: string, config: ComponentConfig) => {
      const enhancedConfig = {
        ...config,
        script: () => ({
          ...config.script?.(),
          lifecycle: { ...config.script?.()?.lifecycle, ...lifecycle }
        })
      };
      return Component(name, enhancedConfig);
    };
  };
};

export const withMethods = (methods: Record<string, (...args: any[]) => any>): HigherOrderComponent => {
  return (Component) => {
    return (name: string, config: ComponentConfig) => {
      const enhancedConfig = {
        ...config,
        script: () => ({
          ...config.script?.(),
          methods: { ...config.script?.()?.methods, ...methods }
        })
      };
      return Component(name, enhancedConfig);
    };
  };
};

// Common mixins
export const CommonMixins = {
  LoadingMixin: {
    name: 'loading',
    script: () => ({
      state: { isLoading: false },
      methods: {
        startLoading() {
          this.state.isLoading = true;
        },
        stopLoading() {
          this.state.isLoading = false;
        },
        withLoading(asyncTask: () => Promise<any>) {
          this.startLoading();
          try {
            return await asyncTask();
          } finally {
            this.stopLoading();
          }
        }
      }
    })
  },

  ErrorMixin: {
    name: 'error',
    script: () => ({
      state: { error: null },
      methods: {
        setError(error: Error) {
          this.state.error = error;
        },
        clearError() {
          this.state.error = null;
        },
        withError(fn: () => any) {
          try {
            return fn();
          } catch (error) {
            this.setError(error as Error);
            throw error;
          }
        }
      }
    })
  },

  ValidationMixin: {
    name: 'validation',
    script: () => ({
      state: { errors: {} },
      methods: {
        validate(rules: Record<string, (value: any) => boolean>, data: Record<string, any>) {
          const errors: Record<string, string> = {};
          
          for (const [field, rule] of Object.entries(rules)) {
            if (!rule(data[field])) {
              errors[field] = 'Invalid value';
            }
          }
          
          this.state.errors = errors;
          return Object.keys(errors).length === 0;
        },
        clearValidation() {
          this.state.errors = {};
        },
        hasError(field: string) {
          return !!this.state.errors[field];
        },
        getError(field: string) {
          return this.state.errors[field];
        }
      }
    })
  }
};

// Common decorators
export const CommonDecorators = {
  Async: (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      const originalMethod = descriptor.value;
      descriptor.value = async function(...args: any[]) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          console.error(`Error in async method ${propertyKey}:`, error);
          throw error;
        }
      };
    }
    return target;
  },

  Memoize: (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      const originalMethod = descriptor.value;
      const cache = new Map();
      
      descriptor.value = function(...args: any[]) {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
          return cache.get(key);
        }
        
        const result = originalMethod.apply(this, args);
        cache.set(key, result);
        return result;
      };
    }
    return target;
  },

  Debounce: (delay: number = 300) => {
    return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
      if (descriptor) {
        const originalMethod = descriptor.value;
        let timeoutId: NodeJS.Timeout;
        
        descriptor.value = function(...args: any[]) {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            originalMethod.apply(this, args);
          }, delay);
        };
      }
      return target;
    };
  }
};