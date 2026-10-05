export const version = '0.3.0'

import { getDebugManager } from './debug-manager-simple.js'
import { ErrorBoundary } from './error-boundary.js'
import { registerElement } from './elements.js'

export interface ComponentDefinition {
  readonly name: string
  readonly template: string
  readonly style: string
  readonly script: unknown
}

const BOOLEAN_ATTRS = new Set(['checked', 'disabled', 'hidden', 'selected', 'readonly', 'required', 'autofocus', 'open', 'multiple', 'muted', 'itemscope', 'noshade', 'compact'])
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])

export type ParsedPart = { static: string } | { path: string[] }
export interface ListSpec { itemVar: string; indexVar: string | null; itemsPath: string[]; keyProp: string | null }
export type CondSpec = { mode: 'if' | 'elseif' | 'else' | 'show'; path: string[] | null }
export interface SNode {
  id: number
  tag: string
  staticAttrs: Record<string, string>
  dynAttrs: Record<string, ParsedPart[]>
  text: ParsedPart[]
  children: SNode[]
  list: ListSpec | null
  cond: CondSpec | null
}
export type Slot =
  | { kind: 'text'; nodeId: number; partIndex: number; path?: string[] }
  | { kind: 'attr'; nodeId: number; attr: string; path?: string[] }
  | { kind: 'bool'; nodeId: number; attr: string; path?: string[] }
  | { kind: 'event'; nodeId: number; event: string; handler: string }
  | { kind: 'list'; nodeId: number; itemVar: string; indexVar: string | null; itemsPath: string[]; keyProp: string | null }
  | { kind: 'model'; nodeId: number; path: string[]; trim: boolean; number: boolean; lazy: boolean }
  | { kind: 'dynamic'; nodeId: number; path?: string[] }
export interface Cdo {
  name: string
  root: SNode
  nodes: SNode[]
  nodeIndex: Map<number, SNode>
  styleText: string
  scriptFactory: (() => unknown) | null
  slots: Slot[]
  scopeId: string
}

export interface State<T> {
  value: T
  dispose(): void
}

export interface Derived<T> extends State<T> {
  dependencies: State<any>[]
}

export interface Effect {
  fn: () => void
  dependencies: State<any>[]
  cleanup?: () => void
  dirty?: boolean
}

export interface RenderContext {
  state: Record<string, any>
  slots: Slot[]
  nodeCache: Map<number, Element>
  listElements: Map<string, Element[]>
  handlers?: Record<string, (...args: any[]) => any>
  host?: Element
}

export interface ScoperOptions {
  scopeId: string
  useShadowDOM?: boolean
  themeVariables?: Record<string, string>
}

export interface StyleInjection {
  id: string
  cssText: string
  scopeId: string
  references: number
  element: HTMLStyleElement | null
}

export interface Scoper {
  generateScopedCSS(cssText: string, scopeId: string): string
  injectStyle(cssText: string, scopeId: string): StyleInjection
  removeStyle(injection: StyleInjection): void
  updateTheme(themeVariables: Record<string, string>): void
  getThemeVariables(): Record<string, string>
  resetTheme(): void
  createScopedElement(element: HTMLElement, scopeId: string, options?: ScoperOptions): HTMLElement
  addGlobalStyle(cssText: string, id?: string): string
  removeGlobalStyle(id: string): void
  getGlobalStyles(): Record<string, string>
  clearGlobalStyles(): void
}

export interface ComponentOptions {
  name: string
  template: string
  script?: unknown
  container?: HTMLElement
}

export interface LifecycleHooks {
  onMount?: () => void
  onUpdate?: () => void
  onUnmount?: () => void
}

export type LifecycleState = 'created' | 'mounted' | 'updated' | 'unmounted'

export interface UpdateLog {
  timestamp: number
  type: 'state' | 'derived' | 'effect'
  path?: string
  oldValue?: any
  newValue?: any
}

export interface ComponentInstance {
  name: string
  state: Record<string, any>
  props: Record<string, any>
  derivedStates: Record<string, any>
  effects: (() => void)[]
  context: RenderContext
  cdo: Cdo
  container: HTMLElement
  root: Element
  lifecycleHooks: LifecycleHooks
  lifecycleState: LifecycleState
  children: ComponentInstance[]
  parent: ComponentInstance | null
  updateLogs: UpdateLog[]
  errorInfo: { hasError: boolean; error?: Error; timestamp?: number } | null
  errorBoundary: any
  hasError: boolean
  errorCount: number
  lastErrorTime: number | null
  autoSync?: boolean
  requestUpdate?: () => void
  handlers?: Record<string, (...args: any[]) => any>
  eventCleanups?: Array<() => void>
  slotContent?: { parentInstance: ComponentInstance; nodeCache: Map<number, Element>; subtreeIds: Set<number> }
  slotEventCleanups?: Array<() => void>
}

export function createRenderContext(state: Record<string, any>, slots: Slot[]): RenderContext {
  return {
    state,
    slots,
    nodeCache: new Map(),
    listElements: new Map()
  }
}

export function resolvePath(state: Record<string, any>, path?: string[]): any {
  if (!path || path.length === 0) return undefined
  let current = state
  for (const segment of path) {
    if (current && typeof current === 'object' && segment in current) {
      current = current[segment]
    } else {
      return undefined
    }
  }
  return current
}

const RESERVED_ELEMENT_NAMES = new Set(['annotation-xml', 'color-profile', 'font-face', 'font-face-src', 'font-face-uri', 'font-face-format', 'font-face-name', 'missing-glyph'])

export function isValidTagName(name: string): boolean {
  if (typeof name !== 'string' || name.length === 0) return false
  if (!/^[a-z][a-z0-9._-]*$/.test(name)) return false
  if (!name.includes('-')) return false
  return !RESERVED_ELEMENT_NAMES.has(name)
}

export function createStateProxy<T extends object>(target: T, onChange: () => void): T {
  if (target === null || typeof target !== 'object') return target
  const proxyCache = new WeakMap<object, object>()

  function wrap<T2 extends object>(value: T2): T2 {
    if (value === null || typeof value !== 'object') return value
    const cached = proxyCache.get(value)
    if (cached) return cached as T2
    const proxy = new Proxy(value, {
      get(t, key, receiver) {
        const raw = Reflect.get(t, key, receiver)
        if (typeof raw === 'function') {
          if (typeof key === 'symbol') return raw
          return raw.bind(receiver)
        }
        if (raw !== null && typeof raw === 'object') {
          return wrap(raw)
        }
        return raw
      },
      set(t, key, newValue, receiver) {
        const result = Reflect.set(t, key, newValue, receiver)
        if (result) onChange()
        return result
      },
      deleteProperty(t, key) {
        const result = Reflect.deleteProperty(t, key)
        if (result) onChange()
        return result
      }
    }) as T2
    proxyCache.set(value, proxy)
    return proxy
  }

  return wrap(target)
}

const definitions = new Map<string, ComponentDefinition>()

function parsePath(path: string): string[] {
  const parts = path.split('.')
  if (parts.length === 0 || parts.some(p => p.length === 0)) {
    throw new Error(`[yq:parse] invalid path: ${path}`)
  }
  return parts
}

function decodeEntities(text: string): string {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}

function parseTextParts(text: string, slots: Slot[], nodeId: number): ParsedPart[] {
  const parts: ParsedPart[] = []
  const segments = text.split('{{')
  if (segments.length === 1) {
    const trimmed = segments[0].trim()
    if (trimmed.length > 0) {
      parts.push({ static: decodeEntities(trimmed) })
    }
    return parts
  }
  const first = decodeEntities(segments[0])
  if (first.length > 0) {
    parts.push({ static: first })
  }
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i]
    const closing = segment.indexOf('}}')
    if (closing === -1) {
      throw new Error('unclosed {{ expression')
    }
    const path = segment.substring(0, closing).trim()
    if (path.length === 0) {
      throw new Error('[yq:parse] empty expression in {{ }}')
    }
    const pathSegments = parsePath(path)
    slots.push({ kind: 'text', nodeId, partIndex: parts.length })
    parts.push({ path: pathSegments })
    const rest = segment.substring(closing + 2)
    if (rest.length > 0) {
      parts.push({ static: decodeEntities(rest) })
    }
  }
  return parts
}

function parseAttributeValue(value: string, attr: string, slots: Slot[], nodeId: number): ParsedPart[] {
  if (value.includes('{{') && value.includes('}}')) {
    const trimmed = value.trim()
    if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
      const inner = trimmed.substring(2, trimmed.length - 2).trim()
      if (inner.includes('{{') || inner.includes('}}')) {
        throw new Error(`[yq:parse] attribute binding only supports whole value form: ${attr}="${value}"`)
      }
      const pathSegments = parsePath(inner)
      if (BOOLEAN_ATTRS.has(attr)) {
        slots.push({ kind: 'bool', nodeId, attr, path: pathSegments })
      } else {
        slots.push({ kind: 'attr', nodeId, attr, path: pathSegments })
      }
      return [{ path: pathSegments }]
    } else {
      throw new Error(`[yq:parse] attribute binding only supports whole value form: ${attr}="${value}"`)
    }
  }
  return [{ static: decodeEntities(value) }]
}

function parseListSpec(value: string, keyAttr: string | null): ListSpec {
  let itemVar = 'item'
  let indexVar: string | null = null
  let itemsPath: string[] = []
  if (value.includes(' in ')) {
    const parts = value.split(' in ')
    if (parts.length !== 2) {
      throw new Error(`invalid yq-for format: ${value}`)
    }
    const binding = parts[0].trim()
    itemsPath = parsePath(parts[1].trim())
    if (binding.startsWith('(') && binding.endsWith(')')) {
      const names = binding.slice(1, -1).split(',').map(part => part.trim())
      if (names.length !== 2 || names[0].length === 0 || names[1].length === 0) {
        throw new Error(`invalid yq-for row binding: ${value}`)
      }
      if (names[0] === names[1]) {
        throw new Error(`duplicate yq-for row binding name: ${value}`)
      }
      itemVar = names[0]
      indexVar = names[1]
    } else {
      if (binding.length === 0) {
        throw new Error(`invalid yq-for item name: ${value}`)
      }
      itemVar = binding
    }
  } else {
    itemsPath = parsePath(value.trim())
  }
  return { itemVar, indexVar, itemsPath, keyProp: keyAttr }
}

function parseTemplate(name: string, template: string): { root: SNode; nodes: SNode[]; nodeIndex: Map<number, SNode>; slots: Slot[] } {
  const slots: Slot[] = []
  const nodes: SNode[] = []
  let inList = false
  let nodeId = 0

  function error(message: string): never {
    throw new Error(`[yq:parse] ${name}: ${message}`)
  }

  function handleAttr(node: SNode, attr: string, value: string): void {
    if (attr === 'yq-for') {
      if (inList) error('nested yq-for not allowed')
      inList = true
      node.list = parseListSpec(value, node.staticAttrs['yq-key'] || null)
      delete node.staticAttrs['yq-key']
    } else if (attr === 'yq-key') {
      if (!node.list) error('yq-key without yq-for')
      node.list.keyProp = value
    } else if (attr.startsWith('yq-on:')) {
      const eventName = attr.substring('yq-on:'.length)
      if (eventName.length === 0) error('empty event name in yq-on')
      if (value.trim().length === 0) error('empty handler in yq-on:' + eventName)
      slots.push({ kind: 'event', nodeId: node.id, event: eventName, handler: value.trim() })
    } else if (attr === 'yq-if' || attr === 'yq-else-if' || attr === 'yq-else' || attr === 'yq-show') {
      const mode = attr === 'yq-if' ? 'if' : attr === 'yq-else-if' ? 'elseif' : attr === 'yq-else' ? 'else' : 'show'
      if (mode !== 'else' && value.trim().length === 0) error('empty condition in ' + attr)
      node.cond = { mode, path: mode === 'else' ? null : parsePath(value.trim()) }
    } else if (attr === 'yq-model' || attr.startsWith('yq-model.')) {
      if (value.trim().length === 0) error('empty path in yq-model')
      const modifiers = attr.slice('yq-model'.length).split('.').filter(Boolean)
      slots.push({ kind: 'model', nodeId: node.id, path: parsePath(value.trim()), trim: modifiers.includes('trim'), number: modifiers.includes('number'), lazy: modifiers.includes('lazy') })
    } else if (attr === 'yq-is' && node.tag === 'yq-component') {
      const trimmed = value.trim()
      if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
        const inner = trimmed.substring(2, trimmed.length - 2).trim()
        if (inner.length === 0) error('empty expression in yq-is')
        slots.push({ kind: 'dynamic', nodeId: node.id, path: parsePath(inner) })
      } else {
        if (trimmed.length === 0) error('empty component name in yq-is')
        slots.push({ kind: 'dynamic', nodeId: node.id })
        node.staticAttrs['yq-is'] = trimmed
      }
    } else {
      const dynValue = parseAttributeValue(value, attr, slots, node.id)
      if (dynValue.length === 1 && 'static' in dynValue[0] && dynValue[0].static === value) {
        node.staticAttrs[attr] = value
      } else {
        node.dynAttrs[attr] = dynValue
      }
    }
  }

  function parseNode(html: string): { node: SNode; remaining: string } {
    const node: SNode = {
      id: nodeId++,
      tag: '',
      staticAttrs: {},
      dynAttrs: {},
      text: [],
      children: [],
      list: null,
      cond: null
    }
    nodes.push(node)

    let i = 0
    if (html.startsWith('<!--')) {
      const commentEnd = html.indexOf('-->')
      if (commentEnd === -1) error('unclosed comment')
      return { node, remaining: html.substring(commentEnd + 3) }
    }
    if (html.startsWith('<!DOCTYPE')) {
      const doctypeEnd = html.indexOf('>')
      if (doctypeEnd === -1) error('unclosed DOCTYPE')
      return { node, remaining: html.substring(doctypeEnd + 1) }
    }
    if (html[i] !== '<') error('expected < at start of tag')
    i++
    const tagNameStart = i
    while (i < html.length && !/[ \t\n\r>\/]/.test(html[i])) i++
    node.tag = html.substring(tagNameStart, i)
    if (node.tag.length === 0) error('empty tag name')

    let inSelfClosing = false
    let currentAttr = ''
    let currentAttrValue: string[] = []
    let inQuote = null

    while (i < html.length) {
      const char = html[i]
      if (inQuote) {
        if (char === inQuote) {
          inQuote = null
          const value = currentAttrValue.join('')
          handleAttr(node, currentAttr, value)
          currentAttr = ''
          currentAttrValue = []
        } else {
          currentAttrValue.push(char)
        }
        i++
      } else if (char === '=') {
        if (currentAttr.length > 0) {
          i++
          while (i < html.length && /[ \t\n\r]/.test(html[i])) i++
          if (i < html.length && (html[i] === '"' || html[i] === "'")) {
            inQuote = html[i]
            currentAttrValue = []
            i++
          }
        } else {
          i++
        }
      } else if (char === '"' || char === "'") {
        inQuote = char
        currentAttrValue = []
        i++
      } else if (char === '>') {
        i++
        break
      } else if (char === '/') {
        inSelfClosing = true
        i++
        if (i < html.length && html[i] === '>') {
          i++
          break
        }
      } else if (/[ \t\n\r]/.test(char)) {
        if (currentAttr.length > 0) {
          const value = currentAttrValue.join('')
          handleAttr(node, currentAttr, value)
          currentAttr = ''
          currentAttrValue = []
        }
        i++
      } else {
        if (currentAttr.length === 0) {
          currentAttr = char
        } else {
          currentAttr += char
        }
        i++
      }
    }

    if (inQuote) error('unclosed attribute quote')
    if (currentAttr.length > 0) {
      const value = currentAttrValue.join('')
      handleAttr(node, currentAttr, value)
    }

    if (node.list) {
      slots.push({ kind: 'list', nodeId: node.id, itemVar: node.list.itemVar, indexVar: node.list.indexVar, itemsPath: node.list.itemsPath, keyProp: node.list.keyProp })
    }

    if (VOID_TAGS.has(node.tag) || inSelfClosing) {
      return { node, remaining: html.substring(i) }
    }

    const closeTag = '</' + node.tag + '>'
    let depth = 1
    let searchPos = i
    let contentEnd = -1
    const openTagPrefix = '<' + node.tag

    while (depth > 0) {
      const nextClose = html.indexOf(closeTag, searchPos)
      if (nextClose === -1) error(`unclosed tag: ${node.tag}`)

      let scanPos = searchPos
      while (scanPos < nextClose) {
        const nextOpen = html.indexOf(openTagPrefix, scanPos)
        if (nextOpen === -1 || nextOpen >= nextClose) break
        const afterOpen = nextOpen + openTagPrefix.length
        if (afterOpen < html.length && /[ =>\/\t\n\r]/.test(html[afterOpen])) {
          depth++
        }
        scanPos = nextOpen + 1
      }

      depth--
      if (depth === 0) {
        contentEnd = nextClose
        break
      }
      searchPos = nextClose + closeTag.length
    }

    const content = html.substring(i, contentEnd)
    const afterClose = contentEnd + node.tag.length + 3

    let childContent = content
    while (childContent.length > 0) {
      const trimmed = childContent.trim()
      if (trimmed.length === 0) break
      
      if (childContent[0] !== '<') {
        const tagStart = childContent.indexOf('<')
        const textPart = tagStart === -1 ? childContent : childContent.substring(0, tagStart)
        const textParts = parseTextParts(textPart, slots, node.id)
        if (node.text.length === 0) {
          node.text = textParts
        } else {
          node.text.push(...textParts)
        }
        childContent = tagStart === -1 ? '' : childContent.substring(tagStart)
      } else {
        const childResult = parseNode(childContent)
        node.children.push(childResult.node)
        childContent = childResult.remaining
      }
    }

    return { node, remaining: html.substring(afterClose) }
  }

  const trimmed = template.trim()
  if (trimmed.length === 0) error('empty template')

  let remaining = trimmed
  let rootResult: { node: SNode; remaining: string } | null = null

  while (remaining.length > 0) {
    if (remaining[0] !== '<') {
      const textNode: SNode = {
        id: nodeId++,
        tag: '',
        staticAttrs: {},
        dynAttrs: {},
        text: parseTextParts(remaining, slots, nodeId - 1),
        children: [],
        list: null,
        cond: null
      }
      nodes.push(textNode)
      rootResult = { node: textNode, remaining: '' }
      break
    }
    const result = parseNode(remaining)
    if (!rootResult) rootResult = result
    remaining = result.remaining.trim()
    if (remaining.length === 0) break
  }

  if (!rootResult) error('no root element found')

  const root = rootResult.node

  if (root.cond) error('yq-if / yq-show on the root element is not supported')

  const nodeIndex = new Map<number, SNode>()
  for (const node of nodes) nodeIndex.set(node.id, node)

  return { root, nodes, nodeIndex, slots }
}

function createScriptFactory(script: unknown): (() => unknown) | null {
  if (typeof script === 'function') {
    return () => script
  }
  if (typeof script === 'string') {
    try {
      const fn = new Function('return ' + script)
      return () => fn()
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw e
      }
      throw new Error('invalid script string: ' + (e as Error).message)
    }
  }
  return null
}

import { renderSkeleton, populateNodeCache, fillSlots, updateSlots, createComponent, mountComponent, updateComponent, unmountComponent, scoper, withErrorBoundary, getErrorBoundaryInfo, resetErrorBoundary, generateScopedCSS, injectStyle, removeStyle, updateTheme, getThemeVariables, resetTheme, addGlobalStyle, removeGlobalStyle, getGlobalStyles, clearGlobalStyles, createScopedElement } from './renderer.js'

let effectStack: Effect[] = []
let allEffects: Effect[] = []
let allDeriveds: any[] = []
let batchQueue: Array<() => void> = []
let isFlushing = false
let flushScheduled = false

function flushBatchQueue(): void {
  if (isFlushing) return
  isFlushing = true
  try {
    while (batchQueue.length > 0) {
      const job = batchQueue.shift()
      job?.()
    }
  } finally {
    isFlushing = false
  }
}

function scheduleFlush(): void {
  if (!flushScheduled) {
    flushScheduled = true
    Promise.resolve().then(() => {
      flushScheduled = false
      flushBatchQueue()
    })
  }
}

function trackState<T>(state: State<T>): void {
  if (effectStack.length > 0) {
    const currentEffect = effectStack[effectStack.length - 1]
    if (!currentEffect.dependencies.includes(state)) {
      currentEffect.dependencies.push(state)
    }
  }
}

function triggerState(state: State<any>): void {
  const dirtyDeriveds: any[] = []
  for (const derivedObj of allDeriveds) {
    if (derivedObj.dependencies.includes(state)) {
      derivedObj.dirty = true
      dirtyDeriveds.push(derivedObj)
    }
  }
  let queue = [...dirtyDeriveds]
  while (queue.length > 0) {
    const dirtyDerived = queue.shift()!
    for (const derivedObj of allDeriveds) {
      if (!derivedObj.dirty && derivedObj.dependencies.includes(dirtyDerived)) {
        derivedObj.dirty = true
        queue.push(derivedObj)
      }
    }
  }
  const allDirty = new Set<State<any>>([state, ...dirtyDeriveds])
  const pending = new Set<Effect>()
  for (const effect of allEffects) {
    for (const dep of effect.dependencies) {
      if (allDirty.has(dep)) {
        pending.add(effect)
        break
      }
    }
  }
  if (pending.size === 0) return
  for (const effect of pending) {
    const alreadyQueued = batchQueue.some(job => (job as any)._effect === effect)
    if (!alreadyQueued) {
      const job = () => { effect.fn() }
      ;(job as any)._effect = effect
      batchQueue.push(job)
    }
  }
  scheduleFlush()
}

function state<T>(initialValue: T, componentName?: string): State<T> {
  let value = initialValue
  const stateObj: State<T> = {
    get value(): T {
      trackState(stateObj)
      return value
    },
    set value(newValue: T) {
      if (value !== newValue) {
        value = newValue
        triggerState(stateObj)
        if (componentName) {
          const debugManager = getDebugManager()
          debugManager.logEvent({
            timestamp: Date.now(),
            type: 'effect',
            componentName,
            data: { 
              property: 'state', 
              oldValue: value, 
              newValue: newValue,
              timestamp: Date.now()
            }
          })
        }
      }
    },
    dispose(): void {
    }
  }
  return stateObj
}

function derived<T>(computeFn: () => T): Derived<T> {
  let cachedValue: T | undefined
  const dependencies: State<any>[] = []
  const derivedObj: Derived<T> & { dirty: boolean; computing: boolean } = {
    dirty: true,
    computing: false,
    get value(): T {
      if (this.computing) {
        throw new Error('Circular dependency detected')
      }
      if (this.dirty) {
        this.computing = true
        effectStack.push({ fn: () => {}, dependencies: [] })
        try {
          cachedValue = computeFn()
          this.dirty = false
        } finally {
          const currentEffect = effectStack.pop()
          if (currentEffect) {
            dependencies.length = 0
            dependencies.push(...currentEffect.dependencies)
          }
          this.computing = false
        }
      }
      trackState(derivedObj)
      return cachedValue!
    },
    dispose(): void {
      const idx = allDeriveds.indexOf(derivedObj as any)
      if (idx > -1) allDeriveds.splice(idx, 1)
      dependencies.length = 0
    },
    dependencies
  }
  allDeriveds.push(derivedObj as any)
  return derivedObj
}

function effect(fn: () => void | (() => void), componentName?: string): () => void {
  const dependencies: State<any>[] = []
  let cleanup: (() => void) | null = null
  const effectObj: Effect = { fn: () => {}, dependencies, dirty: false }
  let prevStart = 0
  let prevEnd = 0
  function wrappedFn(): void {
    while (allEffects.length > prevStart) {
      allEffects.pop()
    }
    effectStack.push(effectObj)
    try {
      const result = fn()
      if (typeof result === 'function') {
        cleanup = result
      }
    } finally {
      effectStack.pop()
    }
    prevStart = prevEnd
    prevEnd = allEffects.length
  }
  effectObj.fn = wrappedFn
  allEffects.push(effectObj)
  prevStart = allEffects.length
  prevEnd = allEffects.length
  wrappedFn()
  if (componentName) {
    const debugManager = getDebugManager()
    debugManager.trackEffect(componentName)
  }
  return () => {
    const idx = allEffects.indexOf(effectObj)
    if (idx > -1) allEffects.splice(idx, 1)
    if (cleanup) {
      cleanup()
      cleanup = null
    }
  }
}

function resetReactiveState(): void {
  allEffects.length = 0
  allDeriveds.length = 0
  batchQueue.length = 0
  effectStack.length = 0
  isFlushing = false
  flushScheduled = false
}

function dumpReactiveState(): { states: any[]; effects: any[] } {
  const states: any[] = []
  const effects: any[] = []
  for (const effect of allEffects) {
    effects.push({ dependencies: effect.dependencies.map(d => d.value) })
    for (const dep of effect.dependencies) {
      if (!states.includes(dep)) {
        states.push(dep)
      }
    }
  }
  for (const derivedObj of allDeriveds) {
    for (const dep of derivedObj.dependencies) {
      if (!states.includes(dep)) {
        states.push(dep)
      }
    }
  }
  return { states, effects }
}

function define(name: string, definition: ComponentDefinition): ComponentDefinition {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('component name must be a non-empty string')
  }
  if (typeof definition !== 'object' || definition === null) {
    throw new TypeError('component definition must be an object')
  }
  if (!definition.template || typeof definition.template !== 'string') {
    throw new TypeError('component definition must include template string')
  }
  if (typeof definition.style !== 'string') {
    throw new TypeError('component definition must include style string')
  }
  if (typeof definition.script !== 'function' && typeof definition.script !== 'string' && definition.script !== null) {
    throw new TypeError('script must be function, string, or null')
  }
  if (definitions.has(name)) {
    throw new Error('duplicate component definition: ' + name)
  }
  definitions.set(name, definition)
  registerElement(name)
  return definition
}

interface CachedComponentDefinition extends ComponentDefinition {
  cdo?: Cdo
}

function lookup(name: string): { name: string; cdo: Cdo } | undefined {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('component name must be a non-empty string')
  }
  const definition = definitions.get(name) as CachedComponentDefinition | undefined
  if (!definition) return undefined
  
  if (!definition.cdo) {
    const { root, nodes, nodeIndex, slots } = parseTemplate(name, definition.template)
    definition.cdo = {
      name,
      root,
      nodes,
      nodeIndex,
      styleText: definition.style,
      scriptFactory: createScriptFactory(definition.script),
      slots,
      scopeId: generateScopeId()
    }
  }
  
  return { name, cdo: definition.cdo! }
}

function generateScopeId(): string {
  return `yq-scope-${Math.random().toString(36).substr(2, 9)}`
}

function setLifecycleHooks(instance: ComponentInstance, hooks: LifecycleHooks): void {
  instance.lifecycleHooks = { ...instance.lifecycleHooks, ...hooks }
}

function addChildComponent(parent: ComponentInstance, child: ComponentInstance): void {
  child.parent = parent
  if (!parent.children.includes(child)) {
    parent.children.push(child)
  }
}

function getComponentTree(instance: ComponentInstance): any {
  return {
    name: instance.name,
    lifecycleState: instance.lifecycleState,
    children: instance.children.map(child => getComponentTree(child)),
    hasError: instance.errorInfo?.hasError || false
  }
}

function getUpdateLogs(instance: ComponentInstance): UpdateLog[] {
  return instance.updateLogs.slice()
}

function getStateSnapshot(instance: ComponentInstance): Record<string, any> {
  return {
    state: { ...instance.state },
    derivedStates: { ...instance.derivedStates },
    lifecycleState: instance.lifecycleState
  }
}

export { 
  generateScopeId,
  define, 
  lookup, 
  parseTemplate, 
  createScriptFactory, 
  renderSkeleton, 
  fillSlots, 
  updateSlots, 
  state, 
  derived, 
  effect, 
  dumpReactiveState,
  resetReactiveState,
  createComponent, 
  mountComponent, 
  updateComponent, 
  unmountComponent, 
  setLifecycleHooks,
  addChildComponent,
  getComponentTree,
  getUpdateLogs,
  getStateSnapshot,
  scoper,
  ErrorBoundary,
  withErrorBoundary,
  getErrorBoundaryInfo,
  resetErrorBoundary 
}