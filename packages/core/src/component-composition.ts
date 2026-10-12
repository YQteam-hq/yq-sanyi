import { State, Derived, ComponentDefinition } from './index.js'

export interface ComponentProps {
  [key: string]: any
}

export interface ComponentContext {
  [key: string]: any
}

export interface ComponentCompositionOptions {
  inheritAttrs?: boolean
  provide?: ComponentContext
  inject?: (key: string) => any
  slots?: { [key: string]: any }
  scoped?: boolean
  lazy?: boolean
  suspense?: boolean
}

export interface ComponentHook {
  name: string
  fn: (context: any) => void | (() => void)
}

export interface ComponentDirective {
  name: string
  handler: (element: HTMLElement, value: string, context: any) => void
}

export interface ComponentSlot {
  name: string
  props?: ComponentProps
  children?: any[]
}

export interface ComponentMetadata {
  name: string
  version: string
  description?: string
  dependencies?: string[]
  props?: ComponentProps
  events?: string[]
  slots?: string[]
  styles?: string[]
  hooks?: string[]
}

export class ComponentComposition {
  private static componentRegistry = new Map<string, ComponentDefinition>()
  private static hooks = new Map<string, ComponentHook[]>()
  private static directives = new Map<string, ComponentDirective>()
  private static contexts = new Map<string, ComponentContext>()
  private static metadata = new Map<string, ComponentMetadata>()

  // Component composition
  static compose(
    name: string,
    components: ComponentDefinition[],
    options: ComponentCompositionOptions = {}
  ): ComponentDefinition {
    const composedComponent = this.createComposedComponent(name, components, options)
    
    // Register the composed component
    this.registerComponent(name, composedComponent)
    
    return composedComponent
  }

  private static createComposedComponent(
    name: string,
    components: ComponentDefinition[],
    options: ComponentCompositionOptions
  ): ComponentDefinition {
    const componentStates: State<any>[] = []
    const componentHooks: ComponentHook[] = []
    const componentSlots: ComponentSlot[] = []
    
    // Merge component states
    for (const component of components) {
      if (component.script && component.script.state) {
        componentStates.push(component.script.state)
      }
      if (component.script && component.script.hooks) {
        componentHooks.push(...component.script.hooks)
      }
    }

    // Create composed template
    const composedTemplate = this.mergeTemplates(components, options)
    
    // Create composed script
    const composedScript = this.mergeScripts(components, options, componentStates)
    
    // Create composed styles
    const composedStyles = this.mergeStyles(components, options)

    return {
      template: composedTemplate,
      script: composedScript,
      style: composedStyles,
      options: {
        ...options,
        name,
        components: components.map(c => c.template || c.script?.name || 'anonymous')
      }
    }
  }

  private static mergeTemplates(
    components: ComponentDefinition[],
    options: ComponentCompositionOptions
  ): string {
    let mergedTemplate = ''
    
    for (const component of components) {
      if (component.template) {
        mergedTemplate += component.template + '\n'
      }
    }

    // Handle slots
    if (options.slots) {
      for (const [slotName, slotContent] of Object.entries(options.slots)) {
        mergedTemplate = mergedTemplate.replace(
          new RegExp(`<slot\\s+name="${slotName}"[^>]*>.*?</slot>`, 'g'),
          slotContent
        )
      }
    }

    return mergedTemplate
  }

  private static mergeScripts(
    components: ComponentDefinition[],
    options: ComponentCompositionOptions,
    componentStates: State<any>[]
  ): any {
    const mergedScript: any = {
      state: {},
      hooks: [],
      methods: {},
      computed: {},
      lifecycle: {}
    }

    // Merge states
    for (const component of components) {
      if (component.script && component.script.state) {
        Object.assign(mergedScript.state, component.script.state)
      }
    }

    // Merge methods
    for (const component of components) {
      if (component.script && component.script.methods) {
        Object.assign(mergedScript.methods, component.script.methods)
      }
    }

    // Merge computed properties
    for (const component of components) {
      if (component.script && component.script.computed) {
        Object.assign(mergedScript.computed, component.script.computed)
      }
    }

    // Merge lifecycle hooks
    for (const component of components) {
      if (component.script && component.script.lifecycle) {
        Object.assign(mergedScript.lifecycle, component.script.lifecycle)
      }
    }

    // Add composition-specific methods
    mergedScript.composition = {
      getComponents: () => components,
      getOptions: () => options,
      getContext: (key: string) => options.provide?.[key],
      setContext: (key: string, value: any) => {
        if (!options.provide) options.provide = {}
        options.provide[key] = value
      }
    }

    return mergedScript
  }

  private static mergeStyles(
    components: ComponentDefinition[],
    options: ComponentCompositionOptions
  ): string {
    let mergedStyles = ''
    
    for (const component of components) {
      if (component.style) {
        mergedStyles += component.style + '\n'
      }
    }

    // Add scoped styles if requested
    if (options.scoped) {
      mergedStyles = `[data-component="${options.name}"] {\n${mergedStyles}\n}`
    }

    return mergedStyles
  }

  // Component inheritance
  static extend(
    baseComponent: ComponentDefinition,
    extension: Partial<ComponentDefinition>,
    options: ComponentCompositionOptions = {}
  ): ComponentDefinition {
    const extendedComponent = {
      template: extension.template || baseComponent.template,
      script: this.extendScript(baseComponent.script, extension.script, options),
      style: extension.style || baseComponent.style,
      options: {
        ...baseComponent.options,
        ...options,
        extends: baseComponent.options?.name
      }
    }

    return extendedComponent
  }

  private static extendScript(
    baseScript: any,
    extensionScript: any,
    options: ComponentCompositionOptions
  ): any {
    const extendedScript = {
      state: { ...baseScript.state, ...extensionScript?.state },
      hooks: [...(baseScript.hooks || []), ...(extensionScript?.hooks || [])],
      methods: { ...baseScript.methods, ...extensionScript?.methods },
      computed: { ...baseScript.computed, ...extensionScript?.computed },
      lifecycle: { ...baseScript.lifecycle, ...extensionScript?.lifecycle }
    }

    // Add super methods for method override
    if (extensionScript?.methods) {
      for (const [methodName, method] of Object.entries(extensionScript.methods)) {
        if (baseScript.methods[methodName]) {
          extendedScript.methods[`super_${methodName}`] = baseScript.methods[methodName]
        }
      }
    }

    return extendedScript
  }

  // Component hooks
  static addHook(componentName: string, hook: ComponentHook): void {
    if (!this.hooks.has(componentName)) {
      this.hooks.set(componentName, [])
    }
    this.hooks.get(componentName)!.push(hook)
  }

  static getHooks(componentName: string): ComponentHook[] {
    return this.hooks.get(componentName) || []
  }

  static removeHook(componentName: string, hookName: string): void {
    const hooks = this.hooks.get(componentName)
    if (hooks) {
      const index = hooks.findIndex(h => h.name === hookName)
      if (index > -1) {
        hooks.splice(index, 1)
      }
    }
  }

  // Component directives
  static addDirective(name: string, directive: ComponentDirective): void {
    this.directives.set(name, directive)
  }

  static getDirective(name: string): ComponentDirective | undefined {
    return this.directives.get(name)
  }

  static removeDirective(name: string): void {
    this.directives.delete(name)
  }

  // Component context
  static provideContext(key: string, value: any): void {
    this.contexts.set(key, value)
  }

  static injectContext(key: string): any {
    return this.contexts.get(key)
  }

  // Component metadata
  static registerMetadata(metadata: ComponentMetadata): void {
    this.metadata.set(metadata.name, metadata)
  }

  static getMetadata(name: string): ComponentMetadata | undefined {
    return this.metadata.get(name)
  }

  static getAllMetadata(): ComponentMetadata[] {
    return Array.from(this.metadata.values())
  }

  // Component registry
  static registerComponent(name: string, component: ComponentDefinition): void {
    this.componentRegistry.set(name, component)
  }

  static getComponent(name: string): ComponentDefinition | undefined {
    return this.componentRegistry.get(name)
  }

  static getAllComponents(): ComponentDefinition[] {
    return Array.from(this.componentRegistry.values())
  }

  // Component utilities
  static createHigherOrderComponent<T extends ComponentDefinition>(
    component: T,
    hocFn: (component: T) => T
  ): T {
    return hocFn(component)
  }

  static createConditionalComponent(
    condition: () => boolean,
    trueComponent: ComponentDefinition,
    falseComponent: ComponentDefinition
  ): ComponentDefinition {
    return {
      template: condition() ? trueComponent.template : falseComponent.template,
      script: condition() ? trueComponent.script : falseComponent.script,
      style: condition() ? trueComponent.style : falseComponent.style,
      options: {
        condition,
        trueComponent: trueComponent.options?.name,
        falseComponent: falseComponent.options?.name
      }
    }
  }

  static createLazyComponent(
    loader: () => Promise<ComponentDefinition>,
    fallback?: ComponentDefinition
  ): Promise<ComponentDefinition> {
    return loader()
  }

  static createErrorBoundary(
    fallback: ComponentDefinition,
    errorComponent?: ComponentDefinition
  ): ComponentDefinition {
    return {
      template: errorComponent?.template || fallback.template,
      script: {
        state: { hasError: false, error: null },
        methods: {
          catchError: (error: Error) => {
            this.state.hasError = true
            this.state.error = error
          }
        },
        lifecycle: {
          onError: (error: Error) => {
            this.state.catchError(error)
          }
        }
      },
      style: fallback.style,
      options: {
        errorBoundary: true,
        fallback: fallback.options?.name
      }
    }
  }

  // Component composition patterns
  static createLayoutComponent(
    children: ComponentDefinition[],
    layout: string
  ): ComponentDefinition {
    const layoutTemplate = this.getLayoutTemplate(layout)
    
    return {
      template: layoutTemplate,
      script: this.mergeLayoutScripts(children),
      style: this.mergeLayoutStyles(children),
      options: {
        layout,
        children: children.map(c => c.options?.name)
      }
    }
  }

  private static getLayoutTemplate(layout: string): string {
    const layouts = {
      'grid': `
        <div class="grid-layout">
          <slot name="header"></slot>
          <div class="main-content">
            <slot name="main"></slot>
          </div>
          <slot name="sidebar"></slot>
          <slot name="footer"></slot>
        </div>
      `,
      'flex': `
        <div class="flex-layout">
          <slot name="header"></slot>
          <div class="flex-content">
            <slot name="main"></slot>
            <slot name="sidebar"></slot>
          </div>
          <slot name="footer"></slot>
        </div>
      `,
      'stack': `
        <div class="stack-layout">
          <slot name="header"></slot>
          <slot name="main"></slot>
          <slot name="footer"></slot>
        </div>
      `
    }

    return layouts[layout as keyof typeof layouts] || layouts.stack
  }

  private static mergeLayoutScripts(children: ComponentDefinition[]): any {
    return {
      state: {},
      methods: {},
      computed: {},
      lifecycle: {}
    }
  }

  private static mergeLayoutStyles(children: ComponentDefinition[]): string {
    return `
      .grid-layout {
        display: grid;
        grid-template-areas: 
          "header header"
          "main sidebar"
          "footer footer";
        min-height: 100vh;
      }
      .flex-layout {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }
      .stack-layout {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }
    `
  }

  // Component lifecycle management
  static createLifecycleManager(components: ComponentDefinition[]): {
    mount: () => void
    unmount: () => void
    update: () => void
  } {
    const mountedComponents = new Set<ComponentDefinition>()

    return {
      mount: () => {
        for (const component of components) {
          if (component.script?.lifecycle?.onMount) {
            component.script.lifecycle.onMount()
          }
          mountedComponents.add(component)
        }
      },
      unmount: () => {
        for (const component of components) {
          if (component.script?.lifecycle?.onUnmount) {
            component.script.lifecycle.onUnmount()
          }
          mountedComponents.delete(component)
        }
      },
      update: () => {
        for (const component of components) {
          if (component.script?.lifecycle?.onUpdate) {
            component.script.lifecycle.onUpdate()
          }
        }
      }
    }
  }

  // Cleanup
  static cleanup(): void {
    this.componentRegistry.clear()
    this.hooks.clear()
    this.directives.clear()
    this.contexts.clear()
    this.metadata.clear()
  }
}

// Component composition utilities
export const CompositionUtils = {
  // Create a component with props
  createComponentWithProps: (
    name: string,
    template: string,
    props: ComponentProps,
    options: ComponentCompositionOptions = {}
  ): ComponentDefinition => {
    return {
      template,
      script: {
        state: props,
        methods: {},
        computed: {},
        lifecycle: {}
      },
      style: '',
      options: {
        ...options,
        name
      }
    }
  },

  // Create a component with slots
  createComponentWithSlots: (
    name: string,
    template: string,
    slots: { [key: string]: ComponentDefinition },
    options: ComponentCompositionOptions = {}
  ): ComponentDefinition => {
    return {
      template,
      script: {
        state: {},
        methods: {},
        computed: {},
        lifecycle: {}
      },
      style: '',
      options: {
        ...options,
        name,
        slots: Object.keys(slots)
      }
    }
  },

  // Create a reusable component
  createReusableComponent: (
    name: string,
    factory: (props: ComponentProps) => ComponentDefinition,
    options: ComponentCompositionOptions = {}
  ): ((props: ComponentProps) => ComponentDefinition) => {
    return (props: ComponentProps) => {
      const component = factory(props)
      component.options = {
        ...component.options,
        ...options,
        name,
        reusable: true
      }
      return component
    }
  },

  // Create a component provider
  createComponentProvider: (
    name: string,
    value: any,
    children: ComponentDefinition,
    options: ComponentCompositionOptions = {}
  ): ComponentDefinition => {
    return {
      template: children.template,
      script: {
        state: { providerValue: value },
        methods: {},
        computed: {},
        lifecycle: {
          onMount: () => {
            ComponentComposition.provideContext(name, value)
          }
        }
      },
      style: children.style,
      options: {
        ...options,
        name,
        provider: true
      }
    }
  }
}