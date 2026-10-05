import type { ComponentInstance } from './index.js'
import { lookup, isValidTagName } from './index.js'
import { createInstanceFromCdo, mountComponent, unmountComponent, bindEvents, unbindEvents } from './renderer.js'

const registeredElements = new Set<string>()

export function findParentInstance(element: Element): ComponentInstance | null {
  let current = element.parentElement
  while (current) {
    const inst = (current as unknown as { _yqInstance?: ComponentInstance })._yqInstance
    if (inst) return inst
    current = current.parentElement
  }
  return null
}

export function registerElement(name: string): void {
  if (typeof customElements === 'undefined') return
  if (registeredElements.has(name)) return
  if (customElements.get(name)) return
  if (!isValidTagName(name)) {
    throw new TypeError('custom element name must be lower-case and contain a hyphen: ' + name)
  }

  class YqElement extends HTMLElement {
    private _yqInstance: ComponentInstance | null = null
    private _yqMounted = false

    connectedCallback(): void {
      if (this._yqMounted || this._yqInstance) return
      if (!this.isConnected) return
      const entry = lookup(name)
      if (!entry) return
      this._yqMounted = true
      const parentInstance = findParentInstance(this)
      const instance = createInstanceFromCdo(name, entry.cdo, this, parentInstance)
      this._yqInstance = instance
      mountComponent(instance)
      bindEvents(instance)
    }

    disconnectedCallback(): void {
      const instance = this._yqInstance
      this._yqInstance = null
      this._yqMounted = false
      if (instance) {
        unbindEvents(instance)
        unmountComponent(instance)
      }
    }
  }

  customElements.define(name, YqElement)
  registeredElements.add(name)
}
