/**
 * Advanced component composition utilities for yq-sanyi
 * @packageDocumentation
 */

// Type definitions for ComponentDefinition and ComponentScript
export type ComponentScript = (this: any) => any

export interface ComponentDefinition {
  readonly name: string
  readonly template: string
  readonly style: string
  readonly script?: ComponentScript
}

export interface ComponentConfig {
  name: string
  template: string
  style?: string
  script?: ComponentScript
  props?: string[]
  slots?: string[]
  emits?: string[]
  extends?: string
}

export interface ComponentHook {
  onBeforeMount?: () => void
  onMounted?: () => void
  onBeforeUpdate?: () => void
  onUpdated?: () => void
  onBeforeUnmount?: () => void
  onUnmounted?: () => void
}

export interface ComponentComposition {
  name: string
  base?: string
  mixins?: ComponentHook[]
  extends?: string
  props?: Record<string, any>
  slots?: Record<string, string>
  emits?: Record<string, (...args: any[]) => void>
  template?: string
  style?: string
  script?: ComponentScript
}

/**
 * Component composition utilities
 */
export class ComponentComposer {
  private components: Map<string, ComponentDefinition> = new Map()
  private compositions: Map<string, ComponentComposition> = new Map()

  /**
   * Register a base component
   */
  registerComponent(definition: ComponentDefinition): void {
    this.components.set(definition.name, definition)
  }

  /**
   * Create a component with composition
   */
  compose(composition: ComponentComposition): ComponentDefinition {
    // Validate base component exists
    if (composition.extends && !this.components.has(composition.extends)) {
      throw new Error(`Base component '${composition.extends}' not found`)
    }

    // Apply mixins
    const hooks = this.applyMixins(composition.mixins || [])

    // Generate component definition
    const definition: ComponentDefinition = {
      name: composition.name,
      template: this.generateTemplate(composition),
      style: this.generateStyle(composition),
      script: this.generateScript(composition, hooks)
    }

    // Register the component
    this.components.set(composition.name, definition)
    this.compositions.set(composition.name, composition)

    return definition
  }

  /**
   * Create a higher-order component
   */
  createHOC(
    baseName: string,
    hocName: string,
    hocFn: (baseComponent: ComponentDefinition) => ComponentDefinition
  ): ComponentDefinition {
    const baseComponent = this.components.get(baseName)
    if (!baseComponent) {
      throw new Error(`Base component '${baseName}' not found`)
    }

    const hocComponent = hocFn(baseComponent)
    this.components.set(hocName, hocComponent)
    
    return hocComponent
  }

  /**
   * Create a component with props validation
   */
  createValidatedComponent(
    name: string,
    config: ComponentConfig & {
      props?: Record<string, {
        type: string
        required?: boolean
        default?: any
        validator?: (value: any) => boolean
      }>
    }
  ): ComponentDefinition {
    const propsScript = this.generatePropsScript(config.props || {})
    
    const script: ComponentScript = function (this: any) {
      const baseScript = typeof config.script === 'function' ? config.script() : {}
      const props = this.props || {}
      
      // Apply prop defaults
      for (const [propName, propConfig] of Object.entries(config.props || {})) {
        if ((propConfig as any).default !== undefined && props[propName] === undefined) {
          props[propName] = (propConfig as any).default
        }
      }
      
      // Validate props
      for (const [propName, propConfig] of Object.entries(config.props || {})) {
        const value = props[propName]
        if ((propConfig as any).required && value === undefined) {
          throw new Error(`Required prop '${propName}' is missing`)
        }
        if (value !== undefined && (propConfig as any).validator && !(propConfig as any).validator(value)) {
          throw new Error(`Prop '${propName}' validation failed`)
        }
      }
      
      return {
        ...(baseScript as any),
        props,
        propChanges: function (newProps: Record<string, any>) {
          // Handle prop changes
          for (const [key, value] of Object.entries(newProps)) {
            if (props[key] !== value) {
              props[key] = value
              ;(this as any).requestUpdate?.()
            }
          }
        }
      }
    }

    return this.compose({
      name,
      extends: config.name,
      props: Object.keys(config.props || {}),
      emits: (config.emits || []).reduce((acc, event) => {
        acc[event] = () => {}
        return acc
      }, {} as Record<string, (...args: any[]) => void>)
    })
  }

  private applyMixins(mixins: ComponentHook[]): ComponentHook {
    const result: ComponentHook = {}
    
    for (const mixin of mixins) {
      Object.assign(result, mixin)
    }
    
    return result
  }

  private generateTemplate(composition: ComponentComposition): string {
    if (composition.extends) {
      const baseComponent = this.components.get(composition.extends)
      if (baseComponent) {
        // Add slot placeholders
        let template = baseComponent.template
        
        if (composition.slots) {
          for (const [slotName, slotContent] of Object.entries(composition.slots)) {
            template = template.replace(
              `<slot name="${slotName}"></slot>`,
              slotContent
            )
          }
        }
        
        return template
      }
    }
    
    return composition.name
  }

  private generateStyle(composition: ComponentComposition): string {
    if (composition.extends) {
      const baseComponent = this.components.get(composition.extends)
      if (baseComponent) {
        return baseComponent.style
      }
    }
    
    return ''
  }

  private generateScript(composition: ComponentComposition, hooks: ComponentHook): ComponentScript {
    return function (this: any) {
      const baseScript = composition.extends ? 
        this.script?.() : {}
      
      return {
        ...baseScript,
        ...hooks,
        props: composition.props || {},
        emits: composition.emits || {}
      }
    }
  }

  private generatePropsScript(props: Record<string, any>): string {
    let script = `
      const props = {}
      const propDefaults = ${JSON.stringify(props)}
      
      function validateProps(newProps) {
        const errors = []
        for (const [key, config] of Object.entries(propDefaults)) {
          const value = newProps[key]
          if (config.required && value === undefined) {
            errors.push(\`Required prop '\${key}' is missing\`)
          }
          if (value !== undefined && config.validator && !config.validator(value)) {
            errors.push(\`Prop '\${key}' validation failed\`)
          }
        }
        return errors
      }
    `
    
    return script
  }
}

/**
 * Component factory utilities
 */
export class ComponentFactory {
  private composer = new ComponentComposer()

  /**
   * Create a simple component
   */
  createSimple(name: string, template: string, style: string, script?: ComponentScript): ComponentDefinition {
    return this.composer.compose({
      name,
      template,
      style,
      script
    })
  }

  /**
   * Create a container component
   */
  createContainer(name: string, children: ComponentDefinition[]): ComponentDefinition {
    const childTemplates = children.map(child => `<${child.name}></${child.name}>`).join('')
    
    return this.createSimple(
      name,
      `<div class="container">${childTemplates}</div>`,
      '.container { display: flex; flex-direction: column; gap: 1rem; }'
    )
  }

  /**
   * Create a list component
   */
  createList(name: string, itemName: string, itemTemplate: string): ComponentDefinition {
    return this.createSimple(
      name,
      `<div yq-for="item in items">
        <${itemName} yq-bind:item="item"></${itemName}>
      </div>`,
      `.list { display: flex; flex-direction: column; gap: 0.5rem; }`,
      function () {
        return {
          state: { items: [] },
          addItem: function (item: any) {
            ;(this as any).state.items.push(item)
            ;(this as any).requestUpdate?.()
          },
          removeItem: function (index: number) {
            ;(this as any).state.items.splice(index, 1)
            ;(this as any).requestUpdate?.()
          },
          clearItems: function () {
            ;(this as any).state.items = []
            ;(this as any).requestUpdate?.()
          }
        }
      }
    )
  }

  /**
   * Create a form component
   */
  createForm(name: string, fields: Array<{
    name: string
    type: string
    label: string
    required?: boolean
    validation?: (value: any) => boolean
  }>): ComponentDefinition {
    const fieldTemplates = fields.map(field => `
      <div class="form-field">
        <label for="${field.name}">${field.label}</label>
        <input 
          type="${field.type}" 
          id="${field.name}" 
          name="${field.name}"
          yq-model="${field.name}"
          ${field.required ? 'required' : ''}
        />
      </div>
    `).join('')

    return this.createSimple(
      name,
      `<form class="yq-form">${fieldTemplates}
        <button type="submit" yq-on:click="submit">Submit</button>
      </form>`,
      `.yq-form { display: flex; flex-direction: column; gap: 1rem; }
       .form-field { display: flex; flex-direction: column; gap: 0.5rem; }
       .form-field label { font-weight: 600; }
       .form-field input { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }`,
      function () {
        const initialValues = fields.reduce((acc, field) => {
          acc[field.name] = ''
          return acc
        }, {} as Record<string, any>)
        
        return {
          state: { ...initialValues, errors: {} },
          validateField: function (fieldName: string, value: any): boolean {
            const field = fields.find(f => f.name === fieldName)
            if (!field) return true
            
            if (field.required && !value) {
              ;(this as any).state.errors[fieldName] = 'This field is required'
              return false
            }
            
            if (field.validation && !field.validation(value)) {
              ;(this as any).state.errors[fieldName] = 'Invalid value'
              return false
            }
            
            delete (this as any).state.errors[fieldName]
            return true
          },
          validateForm: function (): boolean {
            let isValid = true
            for (const field of fields) {
              if (!(this as any).validateField(field.name, (this as any).state[field.name])) {
                isValid = false
              }
            }
            return isValid
          },
          submit: function () {
            if ((this as any).validateForm()) {
              // Emit submit event with form data
              ;(this as any).$emit('submit', (this as any).state)
            }
          }
        }
      }
    )
  }
}

/**
 * Reusable component patterns
 */
export const ComponentPatterns = {
  /**
   * Create a modal component
   */
  modal: (name: string, content: string): ComponentDefinition => ({
    name,
    template: `
      <div class="modal-overlay" yq-show="isOpen" yq-on:click="close">
        <div class="modal-content" yq-on:click.stop>
          <button class="modal-close" yq-on:click="close">&times;</button>
          ${content}
        </div>
      </div>
    `,
    style: `
      .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
      .modal-content { background: white; padding: 2rem; border-radius: 8px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; position: relative; }
      .modal-close { position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; }
    `,
    script: function () {
      return {
        state: { isOpen: false },
        open: function () {
          ;(this as any).state.isOpen = true
          document.body.style.overflow = 'hidden'
        },
        close: function () {
          ;(this as any).state.isOpen = false
          document.body.style.overflow = ''
        }
      }
    }
  }),

  /**
   * Create a tab component
   */
  tabs: (name: string, tabs: Array<{ id: string; label: string; content: string }>): ComponentDefinition => ({
    name,
    template: `
      <div class="tabs">
        <div class="tab-headers">
          ${tabs.map(tab => `
            <button class="tab-header" yq-class:active="activeTab === '${tab.id}'" yq-on:click="setTab('${tab.id}')">
              ${tab.label}
            </button>
          `).join('')}
        </div>
        <div class="tab-content">
          ${tabs.map(tab => `
            <div class="tab-panel" yq-show="activeTab === '${tab.id}'">
              ${tab.content}
            </div>
          `).join('')}
        </div>
      </div>
    `,
    style: `
      .tabs { border: 1px solid #ccc; border-radius: 4px; overflow: hidden; }
      .tab-headers { display: flex; background: #f5f5f5; border-bottom: 1px solid #ccc; }
      .tab-header { padding: 0.75rem 1.5rem; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; }
      .tab-header.active { border-bottom-color: #007bff; background: white; }
      .tab-content { padding: 1rem; }
      .tab-panel { display: none; }
      .tab-panel[yq-show] { display: block; }
    `,
    script: function () {
      return {
        state: { activeTab: tabs[0]?.id || '' },
        setTab: function (tabId: string) {
          ;(this as any).state.activeTab = tabId
        }
      }
    }
  }),

  /**
   * Create an accordion component
   */
  accordion: (name: string, items: Array<{ id: string; title: string; content: string }>): ComponentDefinition => ({
    name,
    template: `
      <div class="accordion">
        ${items.map(item => `
          <div class="accordion-item">
            <button class="accordion-header" yq-on:click="toggle('${item.id}')">
              ${item.title}
              <span class="accordion-icon" yq-class:open="expandedItems.includes('${item.id}')">▼</span>
            </button>
            <div class="accordion-content" yq-show="expandedItems.includes('${item.id}')">
              ${item.content}
            </div>
          </div>
        `).join('')}
      </div>
    `,
    style: `
      .accordion { border: 1px solid #ccc; border-radius: 4px; overflow: hidden; }
      .accordion-item { border-bottom: 1px solid #ccc; }
      .accordion-item:last-child { border-bottom: none; }
      .accordion-header { width: 100%; padding: 1rem; background: #f5f5f5; border: none; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
      .accordion-content { padding: 1rem; background: white; }
      .accordion-icon { transition: transform 0.3s; }
      .accordion-icon.open { transform: rotate(180deg); }
    `,
    script: function () {
      return {
        state: { expandedItems: [items[0]?.id || ''] },
        toggle: function (itemId: string) {
          const index = (this as any).state.expandedItems.indexOf(itemId)
          if (index > -1) {
            (this as any).state.expandedItems.splice(index, 1)
          } else {
            (this as any).state.expandedItems.push(itemId)
          }
        }
      }
    }
  })
}

// Export singleton instance
export const componentFactory = new ComponentFactory()
export const componentComposer = new ComponentComposer()