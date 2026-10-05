import type { SNode, Slot, Cdo, RenderContext, ComponentInstance, ComponentOptions, ScoperOptions, Scoper, StyleInjection, LifecycleHooks, ParsedPart } from './index.js'
import { parseTemplate, createRenderContext, resolvePath, generateScopeId, createStateProxy, lookup } from './index.js'
import { DebugManager, DebugManagerOptions, getDebugManager } from './debug-manager-simple.js'
import { ErrorBoundary } from './error-boundary.js'

function isNestedInstanceHost(element: Element): boolean {
  const el = element as unknown as { _yqInstance?: unknown }
  return Boolean(el._yqInstance)
}

function hasOwn(target: object, key: string | symbol): boolean {
  return Object.prototype.hasOwnProperty.call(target, key)
}

function createPropsOverlay(state: Record<string, any>, props: Record<string, any>): Record<string, any> {
  return new Proxy(state, {
    get(target, key, receiver) {
      if (typeof key === 'string' && hasOwn(props, key) && props[key] !== undefined) return props[key]
      return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
      if (typeof key === 'string' && hasOwn(props, key)) {
        props[key] = value
        return true
      }
      return Reflect.set(target, key, value, receiver)
    },
    has(target, key) {
      if (typeof key === 'string' && hasOwn(props, key) && props[key] !== undefined) return true
      return Reflect.has(target, key)
    },
    ownKeys(target) {
      const keys = new Set<string | symbol>(Reflect.ownKeys(target))
      for (const key of Object.keys(props)) {
        keys.add(key)
      }
      return Array.from(keys)
    },
    getOwnPropertyDescriptor(target, key) {
      if (typeof key === 'string' && hasOwn(props, key) && props[key] !== undefined) {
        return { value: props[key], writable: true, enumerable: true, configurable: true }
      }
      return Reflect.getOwnPropertyDescriptor(target, key)
    }
  }) as Record<string, any>
}

const PROP_SKIP_ATTRS = new Set(['class', 'style', 'id', 'yq-key', 'yq-is'])

function collectElementProps(element: Element, skipAttrs?: Set<string>): Record<string, any> {
  const props: Record<string, any> = {}
  const el = element as unknown as { attrs?: Record<string, string>; dataset?: Record<string, string>; getAttributeNames?: () => string[] }
  const names = typeof el.getAttributeNames === 'function'
    ? el.getAttributeNames()
    : Object.keys(el.attrs || el.dataset || {})
  for (const attr of names) {
    if (PROP_SKIP_ATTRS.has(attr)) continue
    if (skipAttrs && skipAttrs.has(attr)) continue
    if (attr.startsWith('yq-on:') || attr.startsWith('data-yq') || attr.startsWith('yq-model')) continue
    const value = element.getAttribute(attr)
    if (value == null) continue
    if (value.startsWith('{{') && value.endsWith('}}')) continue
    props[attr] = value
  }
  return props
}

function distributeSlotContent(root: Element, captured: Element[]): void {
  if (!captured || captured.length === 0) return
  const placeholders: Array<{ element: Element; name: string | null }> = []
  function walk(el: Element): void {
    for (const child of Array.from(el.children || [])) {
      if ((child.tagName || '').toLowerCase() === 'slot') {
        placeholders.push({ element: child, name: child.getAttribute('name') })
      } else {
        walk(child)
      }
    }
  }
  walk(root)
  if (placeholders.length === 0) return
  const namedNodes = new Map<string, Element[]>()
  const defaultNodes: Element[] = []
  for (const node of captured) {
    const name = node.getAttribute ? node.getAttribute('slot') : null
    if (name) {
      const bucket = namedNodes.get(name) || []
      bucket.push(node)
      namedNodes.set(name, bucket)
    } else {
      defaultNodes.push(node)
    }
  }
  for (const placeholder of placeholders) {
    const targets = placeholder.name ? (namedNodes.get(placeholder.name) || []) : defaultNodes
    for (const target of targets) {
      placeholder.element.appendChild(target)
    }
  }
}

function collectDistributedNodes(root: Element): Element[] {
  const out: Element[] = []
  function walk(el: Element): void {
    if ((el.tagName || '').toLowerCase() === 'slot') {
      for (const child of Array.from(el.children || [])) {
        out.push(child)
        walk(child)
      }
      return
    }
    if (isNestedInstanceHost(el)) {
      return
    }
    for (const child of Array.from(el.children || [])) {
      walk(child)
    }
  }
  walk(root)
  return out
}

function bindSlotEvent(element: Element, slot: Extract<Slot, { kind: 'event' }>, parentInstance: ComponentInstance, childInstance: ComponentInstance): void {
  const handlers = parentInstance.handlers
  if (!handlers) return
  const handler = handlers[slot.handler]
  let listener: ((event: Event) => void) | null = null
  if (typeof handler === 'function') {
    listener = (event: Event) => {
      try {
        handler.call(parentInstance.container, parentInstance.state, event)
      } catch (error) {
        console.error(`[yq:event] handler "${slot.handler}" failed:`, error)
      }
    }
  } else {
    listener = createEmitListener(slot.handler, () => parentInstance.state, parentInstance.container)
    if (!listener) return
  }
  element.addEventListener(slot.event, listener as EventListener)
  if (!childInstance.slotEventCleanups) childInstance.slotEventCleanups = []
  childInstance.slotEventCleanups.push(() => {
    element.removeEventListener(slot.event, listener as EventListener)
  })
}

function renderSlotContent(parentInstance: ComponentInstance | null | undefined, childInstance: ComponentInstance): void {
  if (!parentInstance) return
  const distributed = collectDistributedNodes(childInstance.root)
  if (distributed.length === 0) return
  const parentNodeIds = new Set(parentInstance.cdo.nodes.map((node) => node.id))
  const nodeCache = new Map<number, Element>()
  const subtreeIds = new Set<number>()
  for (const el of distributed) {
    const id = parseInt((el as HTMLElement).dataset.yqNodeId || '0', 10)
    if (!id || !parentNodeIds.has(id)) continue
    const snode = parentInstance.cdo.nodeIndex.get(id)
    if (!snode) continue
    nodeCache.set(id, el)
    collectSubtreeIds(snode, subtreeIds)
  }
  if (nodeCache.size === 0) return
  for (const slot of parentInstance.cdo.slots) {
    if (!subtreeIds.has(slot.nodeId)) continue
    const target = nodeCache.get(slot.nodeId)
    if (!target) continue
    if (slot.kind === 'text') {
      fillTextSlot(target, slot, parentInstance.context, parentInstance.cdo)
    } else if (slot.kind === 'attr') {
      fillAttrSlot(target, slot, parentInstance.context)
    } else if (slot.kind === 'bool') {
      fillBoolSlot(target, slot, parentInstance.context)
    } else if (slot.kind === 'model') {
      fillModelSlot(target, slot, parentInstance.context)
    } else if (slot.kind === 'event') {
      bindSlotEvent(target, slot, parentInstance, childInstance)
    }
  }
  childInstance.slotContent = { parentInstance, nodeCache, subtreeIds }
}

function updateSlotContent(childInstance: ComponentInstance): void {
  const info = childInstance.slotContent
  if (!info) return
  const { parentInstance, nodeCache, subtreeIds } = info
  for (const slot of parentInstance.cdo.slots) {
    if (!subtreeIds.has(slot.nodeId)) continue
    const target = nodeCache.get(slot.nodeId)
    if (!target || !target.isConnected) continue
    if (slot.kind === 'text') {
      fillTextSlot(target, slot, parentInstance.context, parentInstance.cdo)
    } else if (slot.kind === 'attr') {
      fillAttrSlot(target, slot, parentInstance.context)
    } else if (slot.kind === 'bool') {
      fillBoolSlot(target, slot, parentInstance.context)
    } else if (slot.kind === 'model') {
      fillModelSlot(target, slot, parentInstance.context)
    }
  }
}

function componentTagName(tag: string): boolean {
  if (typeof tag !== 'string' || tag.length === 0) return false
  try {
    return lookup(tag) !== undefined
  } catch (error) {
    return false
  }
}

function applyProps(instance: ComponentInstance, props: Record<string, any>): void {
  if (!instance.props) instance.props = {}
  let changed = false
  for (const [key, value] of Object.entries(props)) {
    if (instance.props[key] !== value) {
      instance.props[key] = value
      changed = true
    }
  }
  if (changed && typeof instance.requestUpdate === 'function') {
    instance.requestUpdate()
  }
}

function syncNestedProps(cdo: Cdo, context: RenderContext): void {
  const boundAttrs = new Map<Element, Set<string>>()
  for (const slot of cdo.slots) {
    if (slot.kind !== 'attr' && slot.kind !== 'bool') continue
    if (!slot.path) continue
    const snode = cdo.nodeIndex.get(slot.nodeId)
    if (!snode || !componentTagName(snode.tag)) continue
    const element = context.nodeCache.get(slot.nodeId)
    if (!element) continue
    const skip = boundAttrs.get(element) || new Set<string>()
    skip.add(slot.attr)
    boundAttrs.set(element, skip)
    const instance = (element as unknown as { _yqInstance?: ComponentInstance })._yqInstance
    if (!instance) continue
    applyProps(instance, { [slot.attr]: resolvePath(context.state, slot.path) })
  }
  for (const [element, skip] of boundAttrs) {
    const instance = (element as unknown as { _yqInstance?: ComponentInstance })._yqInstance
    if (!instance) continue
    applyProps(instance, collectElementProps(element, skip))
  }
  for (const [, element] of context.nodeCache) {
    if (boundAttrs.has(element)) continue
    const instance = (element as unknown as { _yqInstance?: ComponentInstance })._yqInstance
    if (!instance) continue
    applyProps(instance, collectElementProps(element))
  }
}

function assignPath(state: Record<string, any>, path: string[], value: any): void {
  let current = state
  for (let i = 0; i < path.length - 1; i++) {
    if (!current || typeof current !== 'object') return
    current = current[path[i]]
  }
  if (!current || typeof current !== 'object') return
  current[path[path.length - 1]] = value
}

function composeText(snode: SNode, state: Record<string, any>): string {
  let out = ''
  for (const part of snode.text) {
    if ('static' in part) {
      out += part.static
    } else {
      const value = resolvePath(state, part.path)
      out += value == null ? '' : String(value)
    }
  }
  return out
}

function cloneStaticNode(node: SNode): Element {
  const element = document.createElement(node.tag) as HTMLElement
  element.dataset.yqNodeId = node.id.toString()
  
  for (const [attr, value] of Object.entries(node.staticAttrs)) {
    element.setAttribute(attr, value)
  }
  
  for (const [attr, parts] of Object.entries(node.dynAttrs)) {
    let currentValue: string = ''
    for (const part of parts) {
      if ('path' in part && Array.isArray(part.path)) {
        currentValue += '{{' + part.path.join('.') + '}}'
      } else if ('static' in part) {
        currentValue += part.static
      }
    }
    element.setAttribute(attr, currentValue)
  }
  
  element.textContent = ''
  for (const part of node.text) {
    if ('path' in part && Array.isArray(part.path)) {
      element.textContent += '{{' + part.path.join('.') + '}}'
    } else if ('static' in part) {
      element.textContent += part.static
    }
  }
  
  for (const child of node.children) {
    element.appendChild(cloneStaticNode(child))
  }
  
  return element
}

function fillTextSlot(node: Element, slot: Extract<Slot, { kind: 'text' }>, context: RenderContext, cdo: Cdo): void {
  const snode = cdo.nodeIndex.get(slot.nodeId)
  if (!snode || snode.children.length > 0) return
  const text = composeText(snode, context.state)
  if (node.textContent !== text) {
    ;(node as HTMLElement).textContent = text
  }
}

function fillAttrSlot(node: Element, slot: Extract<Slot, { kind: 'attr' }>, context: RenderContext): void {
  const value = slot.path ? resolvePath(context.state, slot.path) : undefined
  if (value != null) {
    node.setAttribute(slot.attr, String(value))
  }
}

function fillBoolSlot(node: Element, slot: Extract<Slot, { kind: 'bool' }>, context: RenderContext): void {
  const value = slot.path ? resolvePath(context.state, slot.path) : undefined
  if (value) {
    node.setAttribute(slot.attr, '')
  } else {
    node.removeAttribute(slot.attr)
  }
}

function collectSubtreeIds(node: SNode, out: Set<number>): void {
  out.add(node.id)
  for (const child of node.children) {
    collectSubtreeIds(child, out)
  }
}

export interface RowEventBindings {
  handlers: Record<string, (...args: any[]) => any>
  host: Element | null
}

interface RowEventHolder {
  _yqRowEventCleanups?: Array<() => void>
}

function createRowState(state: Record<string, any>, slot: Extract<Slot, { kind: 'list' }>, item: any, index: number): Record<string, any> {
  const overlay = new Map<string | symbol, any>()
  overlay.set(slot.itemVar, item)
  if (slot.indexVar) {
    overlay.set(slot.indexVar, index)
  }
  return new Proxy(state, {
    get(target, key, receiver) {
      if (overlay.has(key)) return overlay.get(key)
      return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
      if (overlay.has(key)) {
        overlay.set(key, value)
        return true
      }
      return Reflect.set(target, key, value, receiver)
    },
    has(target, key) {
      if (overlay.has(key)) return true
      return Reflect.has(target, key)
    },
    ownKeys(target) {
      const keys = new Set<string | symbol>(Reflect.ownKeys(target))
      for (const key of overlay.keys()) {
        keys.add(key)
      }
      return Array.from(keys)
    },
    getOwnPropertyDescriptor(target, key) {
      if (overlay.has(key)) {
        return { value: overlay.get(key), writable: true, enumerable: true, configurable: true }
      }
      return Reflect.getOwnPropertyDescriptor(target, key)
    }
  }) as Record<string, any>
}

function rowBindings(context: RenderContext): RowEventBindings | undefined {
  if (!context.handlers) return undefined
  return { handlers: context.handlers, host: context.host || null }
}

function unbindRowEvents(rowElement: Element): void {
  const holder = rowElement as Element & RowEventHolder
  const cleanups = holder._yqRowEventCleanups
  if (!cleanups || cleanups.length === 0) return
  for (const cleanup of cleanups) {
    cleanup()
  }
  holder._yqRowEventCleanups = []
}

function unbindRowEventsIn(node: Element | null): void {
  if (!node) return
  const holder = node as Element & RowEventHolder
  if (holder._yqRowEventCleanups && holder._yqRowEventCleanups.length > 0) {
    unbindRowEvents(node)
  }
  for (const child of Array.from(node.children)) {
    unbindRowEventsIn(child)
  }
}

function bindRowEvents(cdo: Cdo, containerNode: SNode, rowElement: Element, rowCache: Map<number, Element>, rowState: Record<string, any>, bindings: RowEventBindings): void {
  unbindRowEvents(rowElement)
  const rowIds = new Set<number>()
  collectSubtreeIds(containerNode, rowIds)
  const cleanups: Array<() => void> = []
  for (const slot of cdo.slots) {
    if (slot.kind !== 'event') continue
    if (!rowIds.has(slot.nodeId)) continue
    const target = slot.nodeId === containerNode.id ? rowElement : rowCache.get(slot.nodeId)
    if (!target) continue
    const handler = bindings.handlers[slot.handler]
    let listener: ((event: Event) => void) | null = null
    if (typeof handler === 'function') {
      listener = (event: Event) => {
        try {
          handler.call(bindings.host || target, rowState, event)
        } catch (error) {
          console.error(`[yq:event] handler "${slot.handler}" failed:`, error)
        }
      }
    } else {
      listener = createEmitListener(slot.handler, () => rowState, bindings.host || target)
      if (!listener) continue
    }
    target.addEventListener(slot.event, listener as EventListener)
    cleanups.push(() => {
      target.removeEventListener(slot.event, listener as EventListener)
    })
  }
  const holder = rowElement as Element & RowEventHolder
  holder._yqRowEventCleanups = cleanups
}

function fillListRow(cdo: Cdo, containerNode: SNode, rowElement: Element, itemState: Record<string, any>, bindings?: RowEventBindings): void {
  const rowIds = new Set<number>()
  collectSubtreeIds(containerNode, rowIds)
  const rowContext = createRenderContext(itemState, cdo.slots)
  const rowCache = new Map<number, Element>()
  function indexRow(element: Element): void {
    if (isNestedInstanceHost(element)) return
    const dataset = (element as HTMLElement).dataset
    if (dataset && dataset.yqNodeId) {
      rowCache.set(parseInt(dataset.yqNodeId || '0', 10), element)
    }
    for (const child of Array.from(element.children)) {
      indexRow(child)
    }
  }
  indexRow(rowElement)
  for (const childSlot of cdo.slots) {
    if (childSlot.kind === 'list') continue
    if (childSlot.kind === 'event') continue
    if (!rowIds.has(childSlot.nodeId)) continue
    if (childSlot.nodeId === containerNode.id && childSlot.kind === 'text' && containerNode.children.length > 0) continue
    const target = childSlot.nodeId === containerNode.id ? rowElement : rowCache.get(childSlot.nodeId)
    if (!target) continue
    if (childSlot.kind === 'text') {
      fillTextSlot(target, childSlot, rowContext, cdo)
    } else if (childSlot.kind === 'attr') {
      fillAttrSlot(target, childSlot, rowContext)
    } else if (childSlot.kind === 'bool') {
      fillBoolSlot(target, childSlot, rowContext)
    }
  }
  if (bindings) {
    bindRowEvents(cdo, containerNode, rowElement, rowCache, itemState, bindings)
  }
}

function createListItem(cdo: Cdo, slot: Extract<Slot, { kind: 'list' }>, item: any, context: RenderContext, index = 0): Element {
  const containerNode = cdo.nodeIndex.get(slot.nodeId)
  if (!containerNode) return document.createElement('div')
  const itemState = createRowState(context.state, slot, item, index)
  const rowElement = cloneStaticNode(containerNode)
  fillListRow(cdo, containerNode, rowElement, itemState, rowBindings(context))
  return rowElement
}

function renderList(cdo: Cdo, node: Element, slot: Extract<Slot, { kind: 'list' }>, context: RenderContext): void {
  const containerNode = cdo.nodeIndex.get(slot.nodeId)
  if (!containerNode) return
  const rawItems = resolvePath(context.state, slot.itemsPath)
  const items = Array.isArray(rawItems) ? rawItems : []
  const bindings = rowBindings(context)
  const existing = new Map<string, Element[]>()
  for (const child of Array.from(node.children)) {
    const key = (child as HTMLElement).dataset.yqKey
    if (key == null) continue
    const bucket = existing.get(key)
    if (bucket) {
      bucket.push(child)
    } else {
      existing.set(key, [child])
    }
  }
  const fragment = document.createDocumentFragment()
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const key = slot.keyProp ? String(item[slot.keyProp]) : String(i)
    const bucket = existing.get(key)
    let rowElement: Element
    if (bucket && bucket.length > 0) {
      rowElement = bucket.shift() as Element
    } else {
      rowElement = cloneStaticNode(containerNode)
    }
    const itemState = createRowState(context.state, slot, item, i)
    fillListRow(cdo, containerNode, rowElement, itemState, bindings)
    ;(rowElement as HTMLElement).dataset.yqKey = key
    fragment.appendChild(rowElement)
  }
  for (const rowsWithSameKey of existing.values()) {
    for (const leftover of rowsWithSameKey) {
      unbindRowEvents(leftover)
      if (typeof (leftover as HTMLElement).remove === 'function') {
        ;(leftover as HTMLElement).remove()
      } else {
        ;(leftover as HTMLElement).parentElement?.removeChild(leftover)
      }
    }
  }
  node.innerHTML = ''
  node.appendChild(fragment)
}

function fillListSlot(node: Element, slot: Extract<Slot, { kind: 'list' }>, context: RenderContext, cdo: Cdo): void {
  renderList(cdo, node, slot, context)
}

function renderSkeleton(cdo: Cdo, container: HTMLElement): Element {
  const fragment = document.createDocumentFragment()
  const root = cloneStaticNode(cdo.root)
  
  const options: ScoperOptions = {
    scopeId: cdo.scopeId,
    useShadowDOM: false
  }
  
  const scopedRoot = scoper.createScopedElement(root as HTMLElement, cdo.scopeId, options)
  fragment.appendChild(scopedRoot)
  container.appendChild(fragment)
  
  if (cdo.styleText) {
    scoper.injectStyle(cdo.styleText, cdo.scopeId)
  }
  
  return scopedRoot
}

function populateNodeCache(cdo: Cdo, root: Element): Map<number, Element> {
  const nodeCache = new Map<number, Element>()
  
  function traverse(element: Element): void {
    if ((element.tagName || '').toLowerCase() === 'slot') {
      return
    }
    const dataset = (element as HTMLElement).dataset
    if (dataset && dataset.yqKey != null) {
      return
    }
    if (dataset && 'yqNodeId' in dataset) {
      const nodeId = parseInt(dataset.yqNodeId || '0')
      nodeCache.set(nodeId, element)
    }
    if (isNestedInstanceHost(element)) {
      return
    }

    for (const child of Array.from(element.children)) {
      traverse(child)
    }
  }

  traverse(root)
  return nodeCache
}

function belongsToListItem(cdo: Cdo, nodeId: number): boolean {
  for (const slot of cdo.slots) {
    if (slot.kind !== 'list') continue
    const containerNode = cdo.nodeIndex.get(slot.nodeId)
    if (!containerNode) continue
    const rowIds = new Set<number>()
    collectSubtreeIds(containerNode, rowIds)
    if (rowIds.has(nodeId)) return true
  }
  return false
}

function elementInParent(parent: Element, element: Element): boolean {
  const children = parent.children
  if (!children) return false
  for (let i = 0; i < children.length; i++) {
    if (children[i] === element) return true
  }
  return false
}

function clearInstanceRefs(element: Element): void {
  const el = element as unknown as { _yqInstance?: ComponentInstance | null; _yqMounted?: boolean }
  if ('_yqInstance' in el) el._yqInstance = null
  if ('_yqMounted' in el) el._yqMounted = false
  for (const child of Array.from(element.children || [])) {
    clearInstanceRefs(child)
  }
}

function setCondPresence(element: Element, present: boolean): void {
  const holder = element as Element & { _yqCondAnchor?: Element | null; _yqCondParent?: Element | null }
  if (present) {
    const parent = holder._yqCondParent || element.parentElement
    if (!parent || elementInParent(parent, element)) return
    const anchor = holder._yqCondAnchor
    if (anchor && anchor.parentElement === parent && typeof parent.insertBefore === 'function') {
      parent.insertBefore(element, anchor)
    } else if (typeof parent.appendChild === 'function') {
      parent.appendChild(element)
    }
  } else {
    const parent = element.parentElement
    if (!parent) return
    holder._yqCondParent = parent
    const children = parent.children || []
    let index = -1
    for (let i = 0; i < children.length; i++) {
      if (children[i] === element) {
        index = i
        break
      }
    }
    holder._yqCondAnchor = index > -1 && index + 1 < children.length ? children[index + 1] : null
    if (typeof element.remove === 'function') {
      element.remove()
    } else if (typeof parent.removeChild === 'function') {
      parent.removeChild(element)
    }
    clearInstanceRefs(element)
  }
}

function evaluateCond(spec: NonNullable<SNode['cond']>, context: RenderContext): boolean {
  if (spec.mode === 'else') return true
  if (!spec.path) return false
  const value = resolvePath(context.state, spec.path)
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

function processConditions(cdo: Cdo, context: RenderContext): void {
  function walk(snode: SNode): void {
    if (snode.list) return
    const children = snode.children
    let i = 0
    while (i < children.length) {
      const child = children[i]
      if (!child.cond) {
        walk(child)
        i++
        continue
      }
      if (child.cond.mode === 'show') {
        const element = context.nodeCache.get(child.id)
        if (element) {
          if (evaluateCond(child.cond, context)) {
            element.removeAttribute('hidden')
          } else {
            element.setAttribute('hidden', '')
          }
        }
        walk(child)
        i++
        continue
      }
      let chosen = -1
      let j = i
      while (j < children.length && children[j].cond && children[j].cond!.mode !== 'show') {
        const spec = children[j].cond!
        if (spec.mode === 'if' && j > i) break
        if (evaluateCond(spec, context)) {
          chosen = j
          break
        }
        j++
      }
      let k = i
      while (k < children.length && children[k].cond && children[k].cond!.mode !== 'show') {
        const spec = children[k].cond!
        if (spec.mode === 'if' && k > i) break
        const element = context.nodeCache.get(children[k].id)
        if (element) setCondPresence(element, k === chosen)
        k++
      }
      for (let m = i; m < k; m++) {
        walk(children[m])
      }
      i = k > i ? k : i + 1
    }
  }
  walk(cdo.root)
}

function fillModelSlot(node: Element, slot: Extract<Slot, { kind: 'model' }>, context: RenderContext): void {
  const value = resolvePath(context.state, slot.path)
  const el = node as HTMLInputElement
  const tag = (node.tagName || '').toLowerCase()
  if (tag === 'input') {
    const type = ((node.getAttribute('type') || 'text') as string).toLowerCase()
    if (type === 'checkbox') {
      if (Array.isArray(value)) {
        el.checked = value.map(String).includes(String(el.value))
      } else {
        el.checked = Boolean(value)
      }
      return
    }
    if (type === 'radio') {
      el.checked = value != null && String(value) === String(el.value)
      return
    }
  }
  el.value = value == null ? '' : String(value)
}

function readModelValue(node: Element, slot: Extract<Slot, { kind: 'model' }>): { ok: boolean; value: any } {
  const el = node as unknown as HTMLInputElement & { checked?: boolean }
  const tag = (node.tagName || '').toLowerCase()
  if (tag === 'input') {
    const type = ((node.getAttribute('type') || 'text') as string).toLowerCase()
    if (type === 'checkbox') {
      return { ok: true, value: Boolean(el.checked) }
    }
    if (type === 'radio') {
      if (!el.checked) return { ok: false, value: undefined }
      return { ok: true, value: el.value }
    }
  }
  return { ok: true, value: el.value }
}

function syncModelFromElement(instance: ComponentInstance, node: Element, slot: Extract<Slot, { kind: 'model' }>): void {
  const read = readModelValue(node, slot)
  if (!read.ok) return
  let value = read.value
  if (slot.trim && typeof value === 'string') value = value.trim()
  if (slot.number) {
    const num = Number(value)
    if (!Number.isNaN(num)) value = num
  }
  assignPath(instance.state, slot.path, value)
}

function bindModelEvents(instance: ComponentInstance, cleanups: Array<() => void>): void {
  for (const slot of instance.cdo.slots) {
    if (slot.kind !== 'model') continue
    if (belongsToListItem(instance.cdo, slot.nodeId)) continue
    const element = instance.context.nodeCache.get(slot.nodeId)
    if (!element) continue
    const eventName = slot.lazy ? 'change' : 'input'
    const listener = () => {
      syncModelFromElement(instance, element, slot)
    }
    element.addEventListener(eventName, listener as EventListener)
    cleanups.push(() => {
      element.removeEventListener(eventName, listener as EventListener)
    })
  }
  instance.eventCleanups = cleanups
}

function renderDynamic(node: Element, slot: Extract<Slot, { kind: 'dynamic' }>, context: RenderContext, parentInstance?: ComponentInstance): void {
  const holder = node as Element & { _yqDynamicName?: string | null; _yqDynamicInstance?: ComponentInstance | null }
  const boundName = slot.path ? resolvePath(context.state, slot.path) : undefined
  const name = boundName != null ? String(boundName) : node.getAttribute('yq-is')
  if (holder._yqDynamicName === name) return
  if (holder._yqDynamicInstance) {
    unmountComponent(holder._yqDynamicInstance)
    holder._yqDynamicInstance = null
  }
  holder._yqDynamicName = name || null
  if (!name) return
  let entry: { name: string; cdo: Cdo } | undefined
  try {
    entry = lookup(name)
  } catch (error) {
    entry = undefined
  }
  if (!entry) return
  const child = createInstanceFromCdo(entry.name, entry.cdo, node as HTMLElement, parentInstance)
  mountComponent(child)
  bindEvents(child)
  const host = node as unknown as { _yqInstance?: ComponentInstance | null }
  host._yqInstance = child
  holder._yqDynamicInstance = child
}

function fillSlots(cdo: Cdo, context: RenderContext, instance?: ComponentInstance): void {
  const rootNode = context.nodeCache.get(cdo.root.id)
  
  if (!rootNode) {
    console.error('Root node not found in cache for ID:', cdo.root.id)
    console.error('Available node IDs:', Array.from(context.nodeCache.keys()))
    return
  }
  
  const cache = new Map<number, Element>()

  function traverse(element: Element): void {
    const dataset = (element as HTMLElement).dataset
    if (dataset && dataset.yqKey != null) {
      return
    }
    if (dataset && dataset.yqNodeId) {
      cache.set(parseInt(dataset.yqNodeId || '0', 10), element)
    }
    if (isNestedInstanceHost(element)) {
      return
    }

    for (const child of Array.from(element.children)) {
      traverse(child)
    }
  }

  traverse(rootNode)

  processConditions(cdo, context)

  for (const slot of cdo.slots) {
    if (slot.kind !== 'list' && belongsToListItem(cdo, slot.nodeId)) continue
    const node = cache.get(slot.nodeId)
    if (!node) continue

    if (slot.kind === 'text') {
      fillTextSlot(node, slot, context, cdo)
    } else if (slot.kind === 'attr') {
      fillAttrSlot(node, slot, context)
    } else if (slot.kind === 'bool') {
      fillBoolSlot(node, slot, context)
    } else if (slot.kind === 'list') {
      renderList(cdo, node, slot, context)
    } else if (slot.kind === 'model') {
      fillModelSlot(node, slot, context)
    } else if (slot.kind === 'dynamic') {
      renderDynamic(node, slot, context, instance)
    }
  }

  syncNestedProps(cdo, context)
}

function updateSlots(cdo: Cdo, context: RenderContext, instance?: ComponentInstance): void {
  fillSlots(cdo, context, instance)
}

const EMIT_PATTERN = /^\$emit\(\s*(['"])([^'"]+)\1\s*(?:,\s*([\w.$]+))?\s*\)$/

function createEmitListener(handlerName: string, getState: () => Record<string, any>, target: Element): ((event: Event) => void) | null {
  const match = EMIT_PATTERN.exec(handlerName)
  if (!match) return null
  const eventName = match[2]
  const payloadPath = match[3]
  return () => {
    try {
      const payload = payloadPath ? resolvePath(getState(), payloadPath.split('.').filter(Boolean)) : undefined
      const event = typeof CustomEvent === 'function'
        ? new CustomEvent(eventName, { detail: payload, bubbles: true })
        : { type: eventName, detail: payload, bubbles: true }
      target.dispatchEvent(event as Event)
    } catch (error) {
      console.error(`[yq:emit] "$emit(${eventName})" failed:`, error)
    }
  }
}

function bindEvents(instance: ComponentInstance): void {
  const handlers = instance.handlers
  if (!handlers) return
  if (instance.eventCleanups && instance.eventCleanups.length > 0) return
  const cleanups: Array<() => void> = []
  const cache = instance.context.nodeCache
  for (const slot of instance.cdo.slots) {
    if (slot.kind !== 'event') continue
    if (belongsToListItem(instance.cdo, slot.nodeId)) continue
    const element = cache.get(slot.nodeId)
    if (!element) continue
    const handler = handlers[slot.handler]
    let listener: ((event: Event) => void) | null = null
    if (typeof handler === 'function') {
      listener = (event: Event) => {
        try {
          handler.call(instance.container, instance.state, event)
        } catch (error) {
          console.error(`[yq:event] handler "${slot.handler}" failed:`, error)
        }
      }
    } else {
      listener = createEmitListener(slot.handler, () => instance.state, instance.container)
      if (!listener) continue
    }
    element.addEventListener(slot.event, listener as EventListener)
    cleanups.push(() => {
      element.removeEventListener(slot.event, listener as EventListener)
    })
  }
  bindModelEvents(instance, cleanups)
}

function unbindEvents(instance: ComponentInstance): void {
  unbindRowEventsIn(instance.root)
  if (!instance.eventCleanups) return
  for (const cleanup of instance.eventCleanups) {
    cleanup()
  }
  instance.eventCleanups = []
}

const styleInjections = new Map<string, StyleInjection>()
const themeVariables = new Map<string, string>()
const globalStyles = new Map<string, string>()

function generateScopedCSS(cssText: string, scopeId: string): string {
  if (!cssText.trim()) return ''
  
  const scopeAttr = `data-yq-scope="${scopeId}"`
  
  const scopedCSS = cssText
    .replace(/([^{}]+)(?=[,{])/g, (selector) => {
      if (selector.trim().startsWith('*')) {
        return selector
      }
      
      if (selector.includes(':') || selector.includes('::')) {
        return selector
      }
      
      const trimmedSelector = selector.trim()
      if (trimmedSelector) {
        return `${trimmedSelector}[${scopeAttr}]`
      }
      return selector
    })
    .replace(/([{}])/g, (match) => match)
  
  return scopedCSS
}

function hashStyleKey(cssText: string, scopeId: string): string {
  let hash = 5381
  for (let i = 0; i < cssText.length; i++) {
    hash = (hash * 33) ^ cssText.charCodeAt(i)
  }
  return `${scopeId}-${cssText.length}-${(hash >>> 0).toString(36)}`
}

function injectStyle(cssText: string, scopeId: string): StyleInjection {
  const id = hashStyleKey(cssText, scopeId)
  
  const existing = styleInjections.get(id)
  if (existing) {
    existing.references++
    return existing
  }
  
  const scopedCSS = generateScopedCSS(cssText, scopeId)
  
  const styleElement = document.createElement('style')
  styleElement.textContent = scopedCSS
  styleElement.setAttribute('data-yq-scope-id', scopeId)
  styleElement.setAttribute('data-yq-style-id', id)
  
  document.head.appendChild(styleElement)
  
  const injection: StyleInjection = {
    id,
    cssText: scopedCSS,
    scopeId,
    references: 1,
    element: styleElement
  }
  
  styleInjections.set(id, injection)
  return injection
}

function removeStyle(injection: StyleInjection): void {
  injection.references--
  
  if (injection.references <= 0) {
    if (injection.element) {
      injection.element.remove()
    }
    styleInjections.delete(injection.id)
  }
}

function updateTheme(themeVars: Record<string, string>): void {
  for (const [key, value] of Object.entries(themeVars)) {
    themeVariables.set(key, value)
  }
  
  for (const [key, value] of Object.entries(themeVars)) {
    document.documentElement.style.setProperty(`--yq-${key}`, value)
  }
}

function getThemeVariables(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of themeVariables) {
    result[key] = value
  }
  return result
}

function resetTheme(): void {
  const defaultTheme = {
    'primary-color': '#3b82f6',
    'secondary-color': '#6b7280',
    'background-color': '#ffffff',
    'text-color': '#1f2937',
    'border-color': '#e5e7eb',
    'shadow-color': 'rgba(0, 0, 0, 0.1)'
  }
  
  themeVariables.clear()
  updateTheme(defaultTheme)
}

function addGlobalStyle(cssText: string, id?: string): string {
  const styleId = id || `global-${Date.now()}`
  globalStyles.set(styleId, cssText)
  
  const styleElement = document.createElement('style')
  styleElement.textContent = cssText
  styleElement.setAttribute('data-yq-global-style', styleId)
  document.head.appendChild(styleElement)
  
  return styleId
}

function removeGlobalStyle(id: string): void {
  const cssText = globalStyles.get(id)
  if (cssText) {
    globalStyles.delete(id)
    const styleElements = document.querySelectorAll(`style[data-yq-global-style="${id}"]`)
    styleElements.forEach(element => element.remove())
  }
}

function getGlobalStyles(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [id, cssText] of globalStyles) {
    result[id] = cssText
  }
  return result
}

function clearGlobalStyles(): void {
  globalStyles.clear()
  const styleElements = document.querySelectorAll('style[data-yq-global-style]')
  styleElements.forEach(element => element.remove())
}

function createScopedElement(element: HTMLElement, scopeId: string, options?: ScoperOptions): HTMLElement {
  if (options?.useShadowDOM) {
    const shadowRoot = element.attachShadow({ mode: 'open' })
    const scopedElement = element.cloneNode(true) as HTMLElement
    shadowRoot.appendChild(scopedElement)
    
    const allElements = shadowRoot.querySelectorAll('*')
    allElements.forEach(el => {
      if (el && typeof el.setAttribute === 'function') {
        el.setAttribute('data-yq-scope', scopeId)
      }
    })
    
    return element
  } else {
    const scopedElement = element.cloneNode(true) as HTMLElement
    if (element.dataset.yqNodeId) {
      scopedElement.dataset.yqNodeId = element.dataset.yqNodeId
    }
    scopedElement.setAttribute('data-yq-scope', scopeId)
    return scopedElement
  }
}

function createComponent(options: ComponentOptions): ComponentInstance {
  const { name, template, script, container = document.body } = options
  const parsed = parseTemplate(name, template)
  const scopeId = generateScopeId()
  const cdo: Cdo = {
    name,
    root: parsed.root,
    nodes: parsed.nodes,
    nodeIndex: parsed.nodeIndex,
    styleText: '',
    scriptFactory: script ? (() => script) : null,
    slots: parsed.slots,
    scopeId
  }
  const scriptResult = runScriptResult(cdo)
  const state: Record<string, any> = extractScriptState(scriptResult)
  const derivedStates: Record<string, any> = {}
  const effects: (() => void)[] = []
  const context = createRenderContext(state, cdo.slots)
  const root = renderSkeleton(cdo, container)

  context.nodeCache = populateNodeCache(cdo, root)
  context.host = container
  
  const debugManager = getDebugManager()
  const instance: ComponentInstance = {
    name,
    state,
    props: {},
    derivedStates,
    effects,
    context,
    cdo,
    container,
    root,
    lifecycleHooks: {},
    lifecycleState: 'created',
    children: [],
    parent: null,
    updateLogs: [],
    errorInfo: null,
    errorBoundary: null,
    hasError: false,
    errorCount: 0,
    lastErrorTime: null
  }

  instance.lifecycleHooks = extractDeclarativeHooks(scriptResult, instance)
  instance.context.state = createPropsOverlay(instance.state, instance.props)

  debugManager.trackComponent(instance)

  return instance
}

function runScriptResult(cdo: Cdo): Record<string, any> | null {
  if (!cdo.scriptFactory) return null
  const scriptFn = cdo.scriptFactory()
  if (typeof scriptFn !== 'function') return null
  const result = scriptFn()
  if (result && typeof result === 'object') return result as Record<string, any>
  return null
}

function extractScriptState(result: Record<string, any> | null): Record<string, any> {
  if (!result) return {}
  const stateValue = result.state
  if (stateValue && typeof stateValue === 'object') {
    return { ...stateValue }
  }
  return {}
}

const RESERVED_SCRIPT_KEYS = new Set(['state', 'onMount', 'onUpdate', 'onUnmount'])

function extractHandlers(result: Record<string, any> | null): Record<string, (...args: any[]) => any> {
  const handlers: Record<string, (...args: any[]) => any> = {}
  if (!result) return handlers
  for (const key of Object.keys(result)) {
    if (RESERVED_SCRIPT_KEYS.has(key)) continue
    if (typeof result[key] === 'function') {
      handlers[key] = result[key] as (...args: any[]) => any
    }
  }
  return handlers
}

const DECLARATIVE_HOOK_KEYS = ['onMount', 'onUpdate', 'onUnmount'] as const

function extractDeclarativeHooks(result: Record<string, any> | null, instance: ComponentInstance): LifecycleHooks {
  const hooks: LifecycleHooks = {}
  if (!result) return hooks
  for (const key of DECLARATIVE_HOOK_KEYS) {
    const fn = result[key]
    if (typeof fn === 'function') {
      hooks[key] = () => fn(instance.state)
    }
  }
  return hooks
}

function createInstanceFromCdo(name: string, cdo: Cdo, host: HTMLElement, parentInstance?: ComponentInstance | null): ComponentInstance {
  const scriptResult = runScriptResult(cdo)
  const state: Record<string, any> = extractScriptState(scriptResult)
  const handlers = extractHandlers(scriptResult)
  const derivedStates: Record<string, any> = {}
  const effects: (() => void)[] = []
  const context = createRenderContext(state, cdo.slots)
  const capturedSlotContent: Element[] = Array.from(host.children as unknown as Element[] || [])

  if ('innerHTML' in host) {
    host.innerHTML = ''
  }
  const root = renderSkeleton(cdo, host)
  distributeSlotContent(root, capturedSlotContent)
  context.nodeCache = populateNodeCache(cdo, root)

  const debugManager = getDebugManager()
  const initialProps = collectElementProps(host)
  const instance: ComponentInstance = {
    name,
    state,
    props: initialProps,
    derivedStates,
    effects,
    context,
    cdo,
    container: host,
    root,
    lifecycleHooks: {},
    lifecycleState: 'created',
    children: [],
    parent: parentInstance || null,
    updateLogs: [],
    errorInfo: null,
    errorBoundary: null,
    hasError: false,
    errorCount: 0,
    lastErrorTime: null,
    autoSync: true,
    handlers
  }
  if (parentInstance) {
    parentInstance.children.push(instance)
  }
  renderSlotContent(parentInstance, instance)

  instance.lifecycleHooks = extractDeclarativeHooks(scriptResult, instance)

  let updateScheduled = false
  const requestUpdate = (): void => {
    if (updateScheduled) return
    if (instance.lifecycleState === 'unmounted') return
    updateScheduled = true
    Promise.resolve().then(() => {
      updateScheduled = false
      if (instance.lifecycleState === 'unmounted') return
      updateComponent(instance)
    })
  }
  instance.requestUpdate = requestUpdate

  instance.state = createStateProxy(state, requestUpdate)
  instance.props = { ...initialProps }
  instance.context.state = createPropsOverlay(instance.state, instance.props)
  instance.context.handlers = handlers
  instance.context.host = host
  
  debugManager.trackComponent(instance)
  
  return instance
}

function mountComponent(instance: ComponentInstance): void {
  if (instance.lifecycleState !== 'created') {
    console.warn(`[yq:lifecycle] Component ${instance.name} is already mounted`)
    return
  }
  
  try {
    fillSlots(instance.cdo, instance.context, instance)

    if (instance.cdo.scriptFactory && !instance.autoSync) {
      const scriptFn = instance.cdo.scriptFactory()
      if (typeof scriptFn === 'function') {
        scriptFn()
      }
    }
    
    instance.lifecycleState = 'mounted'
    
    if (instance.lifecycleHooks.onMount) {
      instance.lifecycleHooks.onMount()
    }
    
    instance.updateLogs.push({
      timestamp: Date.now(),
      type: 'effect',
      path: 'mount'
    })
    
    const debugManager = getDebugManager()
    debugManager.logEvent({
      timestamp: Date.now(),
      type: 'mount',
      componentName: instance.name,
      data: { timestamp: Date.now() }
    })
  } catch (error) {
    instance.hasError = true
    instance.errorCount++
    instance.lastErrorTime = Date.now()
    
    instance.errorInfo = {
      hasError: true,
      error: error as Error,
      timestamp: Date.now()
    }
    
    console.error(`[yq:lifecycle] Component ${instance.name} mount failed:`, error)
    
    const debugManager = getDebugManager()
    debugManager.trackError(instance, error as Error, (error as Error).stack)
    
    if (instance.errorBoundary) {
      instance.errorBoundary.componentDidCatch(error as Error, {
        componentStack: `Component: ${instance.name}`,
        hasError: true,
        timestamp: Date.now(),
        error: error as Error
      })
    }
  }
}

function updateComponent(instance: ComponentInstance): void {
  if (instance.lifecycleState === 'unmounted') {
    console.warn(`[yq:lifecycle] Component ${instance.name} is already unmounted`)
    return
  }
  
  try {
    if (instance.context.nodeCache.size === 0) {
      instance.context.nodeCache = populateNodeCache(instance.cdo, instance.root)
    }

    updateSlots(instance.cdo, instance.context, instance)
    for (const child of instance.children) {
      updateSlotContent(child)
    }

    instance.lifecycleState = 'updated'
    
    if (instance.lifecycleHooks.onUpdate) {
      instance.lifecycleHooks.onUpdate()
    }
    
    instance.updateLogs.push({
      timestamp: Date.now(),
      type: 'effect',
      path: 'update'
    })
    
    const debugManager = getDebugManager()
    debugManager.logEvent({
      timestamp: Date.now(),
      type: 'update',
      componentName: instance.name,
      data: { timestamp: Date.now() }
    })
  } catch (error) {
    instance.hasError = true
    instance.errorCount++
    instance.lastErrorTime = Date.now()
    
    instance.errorInfo = {
      hasError: true,
      error: error as Error,
      timestamp: Date.now()
    }
    console.error(`[yq:lifecycle] Component ${instance.name} update failed:`, error)
    
    const debugManager = getDebugManager()
    debugManager.trackError(instance, error as Error, (error as Error).stack)
    
    if (instance.errorBoundary) {
      instance.errorBoundary.componentDidCatch(error as Error, {
        componentStack: `Component: ${instance.name}`,
        hasError: true,
        timestamp: Date.now(),
        error: error as Error
      })
    }
  }
}

function unmountComponent(instance: ComponentInstance): void {
  if (instance.lifecycleState === 'unmounted') {
    console.warn(`[yq:lifecycle] Component ${instance.name} is already unmounted`)
    return
  }
  
  try {
    unbindEvents(instance)
    if (instance.slotEventCleanups) {
      for (const cleanup of instance.slotEventCleanups) {
        cleanup()
      }
      instance.slotEventCleanups = []
    }
    for (const child of instance.children) {
      unmountComponent(child)
    }
    instance.children.length = 0

    instance.container.innerHTML = ''
    
    const styleElements = document.querySelectorAll(`style[data-yq-scope-id="${instance.cdo.scopeId}"]`)
    styleElements.forEach(element => {
      const injectionId = element.getAttribute('data-yq-style-id')
      if (injectionId) {
        const injection = styleInjections.get(injectionId)
        if (injection) {
          scoper.removeStyle(injection)
        }
      }
    })
    
    for (const effect of instance.effects) {
      effect()
    }
    instance.effects.length = 0
    
    instance.lifecycleState = 'unmounted'
    
    if (instance.lifecycleHooks.onUnmount) {
      instance.lifecycleHooks.onUnmount()
    }
    
    if (instance.parent) {
      const index = instance.parent.children.indexOf(instance)
      if (index > -1) {
        instance.parent.children.splice(index, 1)
      }
    }
    
    instance.updateLogs.push({
      timestamp: Date.now(),
      type: 'effect',
      path: 'unmount'
    })
    
    const debugManager = getDebugManager()
    debugManager.logEvent({
      timestamp: Date.now(),
      type: 'unmount',
      componentName: instance.name,
      data: { timestamp: Date.now() }
    })
    
    if (instance.errorBoundary) {
      instance.errorBoundary.destroy()
      instance.errorBoundary = null
    }
    
    instance.errorInfo = null
    instance.hasError = false
    instance.errorCount = 0
    instance.lastErrorTime = null
  } catch (error) {
    console.error(`[yq:lifecycle] Component ${instance.name} unmount failed:`, error)
    
    const debugManager = getDebugManager()
    debugManager.trackError(instance, error as Error, (error as Error).stack)
  }
}

function withErrorBoundary(componentName: string, fallback?: (error: Error, errorInfo: any) => any): (instance: ComponentInstance) => ComponentInstance {
  return (instance: ComponentInstance): ComponentInstance => {
    const errorBoundary = new ErrorBoundary({
      fallback: fallback || ((error: Error, errorInfo: any) => {
        return `<div style="padding: 20px; border: 1px solid #ff4757; border-radius: 4px; background-color: #fff5f5; color: #842029;">
          <h3>⚠️ Component Error</h3>
          <p><strong>Component:</strong> ${componentName}</p>
          <p><strong>Error:</strong> ${error.message}</p>
          <button onclick="this.closest('.error-boundary').reset()">Retry</button>
        </div>`
      }),
      onError: (error: Error, errorInfo: any) => {
        console.error(`[ErrorBoundary] ${componentName}:`, error)
      }
    })
    
    instance.errorBoundary = errorBoundary
    return instance
  }
}

function getErrorBoundaryInfo(instance: ComponentInstance): any {
  if (!instance.errorBoundary) {
    return null
  }
  
  return {
    hasError: instance.hasError,
    errorCount: instance.errorCount,
    lastErrorTime: instance.lastErrorTime,
    errorInfo: instance.errorInfo
  }
}

function resetErrorBoundary(instance: ComponentInstance): void {
  if (instance.errorBoundary) {
    instance.errorBoundary.reset()
    instance.hasError = false
    instance.errorCount = 0
    instance.lastErrorTime = null
    instance.errorInfo = null
  }
}

const scoper: Scoper = {
  generateScopedCSS,
  injectStyle,
  removeStyle,
  updateTheme,
  getThemeVariables,
  resetTheme,
  createScopedElement,
  addGlobalStyle,
  removeGlobalStyle,
  getGlobalStyles,
  clearGlobalStyles
}

export {
  renderSkeleton,
  populateNodeCache,
  fillSlots,
  updateSlots,
  createComponent,
  mountComponent,
  updateComponent,
  unmountComponent,
  scoper,
  withErrorBoundary,
  getErrorBoundaryInfo,
  resetErrorBoundary,
  generateScopedCSS,
  injectStyle,
  removeStyle,
  updateTheme,
  getThemeVariables,
  resetTheme,
  addGlobalStyle,
  removeGlobalStyle,
  getGlobalStyles,
  clearGlobalStyles,
  createScopedElement,
  cloneStaticNode,
  createInstanceFromCdo,
  fillTextSlot,
  fillAttrSlot,
  fillBoolSlot,
  createListItem,
  fillListSlot,
  createRowState,
  bindRowEvents,
  unbindRowEvents,
  bindEvents,
  unbindEvents,
  processConditions,
  setCondPresence,
  fillModelSlot,
  syncModelFromElement,
  bindModelEvents,
  renderDynamic,
  createPropsOverlay,
  collectElementProps,
  applyProps,
  syncNestedProps,
  createEmitListener
}