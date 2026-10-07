let activeRegistry = new Map()

function makeElement(tag) {
  const element = {
    tagName: String(tag).toUpperCase(),
    dataset: {},
    attrs: {},
    children: [],
    listeners: {},
    textContent: '',
    parentElement: null,
    isConnected: false,
    _html: '',
    checked: false,
    value: '',
    setAttribute(name, value) {
      element.attrs[name] = String(value)
      if (name.startsWith('data-')) element.dataset[name.slice(5)] = String(value)
    },
    getAttribute(name) {
      return name in element.attrs ? element.attrs[name] : null
    },
    removeAttribute(name) {
      delete element.attrs[name]
      if (name.startsWith('data-')) delete element.dataset[name.slice(5)]
    },
    appendChild(child) {
      if (child && child.children && child.tagName === undefined) {
        for (const c of child.children.slice()) {
          if (c) element.appendChild(c)
        }
        return child
      }
      if (child.parentElement && child.parentElement !== element) {
        const oldParent = child.parentElement
        const idx = oldParent.children.indexOf(child)
        if (idx > -1) oldParent.children.splice(idx, 1)
      }
      element.children.push(child)
      child.parentElement = element
      if (element.isConnected) connectNode(child)
      return child
    },
    insertBefore(newNode, anchor) {
      if (newNode && newNode.children && newNode.tagName === undefined) {
        for (const c of newNode.children.slice()) {
          if (c) element.insertBefore(c, anchor)
        }
        return newNode
      }
      const idx = element.children.indexOf(anchor)
      if (idx === -1) {
        element.appendChild(newNode)
      } else {
        element.children.splice(idx, 0, newNode)
        newNode.parentElement = element
        if (element.isConnected) connectNode(newNode)
      }
      return newNode
    },
    removeChild(child) {
      const idx = element.children.indexOf(child)
      if (idx > -1) {
        element.children.splice(idx, 1)
        child.parentElement = null
        disconnectNode(child)
      }
    },
    remove() {
      if (element.parentElement) element.parentElement.removeChild(element)
    },
    contains(node) {
      if (node === element) return true
      for (const c of element.children || []) {
        if (c === node || (c.contains && c.contains(node))) return true
      }
      return false
    },
    cloneNode(deep) {
      const clone = createElementLike(tag)
      clone.attrs = { ...element.attrs }
      clone.dataset = { ...element.dataset }
      clone.textContent = element.textContent
      clone._html = element._html
      if (deep) {
        clone.children = (element.children || []).map((c) => (c && c.cloneNode ? c.cloneNode(true) : c))
        for (const c of clone.children) c.parentElement = clone
      }
      return clone
    },
    addEventListener(event, fn) {
      element.listeners[event] = element.listeners[event] || []
      element.listeners[event].push(fn)
    },
    removeEventListener(event, fn) {
      const list = element.listeners[event] || []
      const idx = list.indexOf(fn)
      if (idx > -1) list.splice(idx, 1)
    },
    dispatch(eventName, detail) {
      const list = element.listeners[eventName] || []
      for (const fn of list.slice()) {
        fn({ type: eventName, target: element, detail })
      }
    },
    dispatchEvent(event) {
      element.dispatch(event.type, event.detail)
    }
  }
  Object.defineProperty(element, 'innerHTML', {
    get() {
      return element._html
    },
    set(value) {
      element._html = value
      if (value === '') {
        for (const c of element.children.slice()) {
          c.parentElement = null
          disconnectNode(c)
        }
        element.children = []
      }
    },
    configurable: true
  })
  Object.defineProperty(element, 'parentNode', {
    get() { return element.parentElement },
    configurable: true
  })
  return element
}

function createElementLike(tag) {
  const raw = makeElement(tag)
  const cls = activeRegistry.get(String(tag).toLowerCase())
  if (!cls) return raw
  const proto = cls.prototype
  raw.connectedCallback = proto.connectedCallback
  raw.disconnectedCallback = proto.disconnectedCallback
  raw._yqInstance = null
  raw._yqMounted = false
  raw.isConnected = false
  return raw
}

function connectNode(element) {
  element.isConnected = true
  if (typeof element.connectedCallback === 'function' && !element._yqMounted && !element._yqInstance) {
    element.connectedCallback()
  }
  for (const child of (element.children || []).slice()) {
    connectNode(child)
  }
}

function disconnectNode(element) {
  element.isConnected = false
  for (const child of (element.children || []).slice()) {
    disconnectNode(child)
  }
  if (typeof element.disconnectedCallback === 'function' && element._yqInstance) {
    element.disconnectedCallback()
  }
}

function installGlobals() {
  const registry = new Map()
  activeRegistry = registry
  global.customElements = {
    get: (name) => registry.get(name) || undefined,
    define: (name, cls) => {
      registry.set(name, cls)
    }
  }
  global.HTMLElement = class HTMLElement {
    constructor() {
      Object.assign(this, makeElement('div'))
      this.isConnected = false
    }
  }
  global.document = {
    createElement: (tag) => createElementLike(tag),
    createDocumentFragment: () => {
      const frag = {
        children: [],
        appendChild(child) {
          if (child && child.parentElement && child.parentElement !== frag) {
            const oldParent = child.parentElement
            const idx = oldParent.children.indexOf(child)
            if (idx > -1) oldParent.children.splice(idx, 1)
          }
          child.parentElement = frag
          frag.children.push(child)
          return child
        }
      }
      return frag
    },
    head: makeElement('head'),
    body: makeElement('body'),
    documentElement: { style: { setProperty() {}, removeProperty() {} } },
    querySelectorAll: () => []
  }
  return registry
}

function flush() {
  return Promise.resolve().then(() => undefined)
}

function mount(tag) {
  const host = createElementLike(tag)
  host.isConnected = true
  host.connectedCallback()
  return host
}

export { installGlobals, createElementLike, flush, mount }
