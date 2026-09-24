import { performance } from 'node:perf_hooks'

const FRAME_MS = 16

const RENDER_OP_KEYS = ['created', 'attribute', 'attributeRemoved', 'inserted', 'removed', 'text', 'listener']

const renderOps = {
  created: 0,
  attribute: 0,
  attributeRemoved: 0,
  inserted: 0,
  removed: 0,
  text: 0,
  listener: 0
}

let opCountingEnabled = false

function enableRenderOpCounting(enabled) {
  opCountingEnabled = Boolean(enabled)
  resetRenderOps()
}

function resetRenderOps() {
  for (const key of RENDER_OP_KEYS) {
    renderOps[key] = 0
  }
}

function readRenderOps() {
  const snapshot = {}
  for (const key of RENDER_OP_KEYS) {
    snapshot[key] = renderOps[key]
  }
  return snapshot
}

function totalRenderOps(snapshot) {
  const bag = snapshot || renderOps
  let total = 0
  for (const key of RENDER_OP_KEYS) {
    total += bag[key]
  }
  return total
}

function toCamelCase(name) {
  return name.replace(/-([a-z])/g, function (match, letter) {
    return letter.toUpperCase()
  })
}

function createElement(tag) {
  if (opCountingEnabled) {
    renderOps.created++
  }
  const element = {
    tagName: String(tag).toUpperCase(),
    attrs: {},
    dataset: {},
    style: { setProperty() {}, removeProperty() {}, cssText: '' },
    classList: { add() {}, remove() {}, contains() { return false } },
    children: [],
    listeners: {},
    isConnected: false,
    parentElement: null,
    setAttribute(name, value) {
      if (opCountingEnabled) {
        renderOps.attribute++
      }
      element.attrs[name] = String(value)
      if (name.startsWith('data-')) {
        element.dataset[toCamelCase(name.slice(5))] = String(value)
      }
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(element.attrs, name) ? element.attrs[name] : null
    },
    removeAttribute(name) {
      if (Object.prototype.hasOwnProperty.call(element.attrs, name)) {
        if (opCountingEnabled) {
          renderOps.attributeRemoved++
        }
        delete element.attrs[name]
      }
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(element.attrs, name)
    },
    appendChild(child) {
      if (child && child.nodeType === 11) {
        for (const item of child.children.slice()) {
          element.appendChild(item)
        }
        return child
      }
      if (opCountingEnabled) {
        renderOps.inserted++
      }
      element.children.push(child)
      child.parentElement = element
      return child
    },
    insertBefore(node, anchor) {
      const index = element.children.indexOf(anchor)
      if (index === -1) {
        return element.appendChild(node)
      }
      if (opCountingEnabled) {
        renderOps.inserted++
      }
      element.children.splice(index, 0, node)
      node.parentElement = element
      return node
    },
    removeChild(child) {
      const index = element.children.indexOf(child)
      if (index > -1) {
        if (opCountingEnabled) {
          renderOps.removed++
        }
        element.children.splice(index, 1)
        child.parentElement = null
      }
      return child
    },
    remove() {
      if (element.parentElement) {
        element.parentElement.removeChild(element)
      }
    },
    cloneNode(deep) {
      const clone = createElement(tag)
      clone.attrs = { ...element.attrs }
      clone.dataset = { ...element.dataset }
      clone.textContent = element.textContent
      if (deep) {
        clone.children = element.children.map(function (child) {
          return child && typeof child.cloneNode === 'function' ? child.cloneNode(true) : child
        })
        for (const child of clone.children) {
          child.parentElement = clone
        }
      }
      return clone
    },
    addEventListener(type, listener) {
      if (opCountingEnabled) {
        renderOps.listener++
      }
      element.listeners[type] = element.listeners[type] || []
      element.listeners[type].push(listener)
    },
    removeEventListener(type, listener) {
      const list = element.listeners[type] || []
      const index = list.indexOf(listener)
      if (index > -1) {
        list.splice(index, 1)
      }
    },
    dispatch(type, detail) {
      const list = (element.listeners[type] || []).slice()
      for (const listener of list) {
        listener({ type: type, target: element, detail: detail, preventDefault() {}, stopPropagation() {} })
      }
    },
    dispatchEvent(event) {
      element.dispatch(event.type, event.detail)
      return true
    },
    querySelector() {
      return null
    },
    querySelectorAll() {
      return []
    }
  }
  let text = ''
  Object.defineProperty(element, 'textContent', {
    get() {
      return text
    },
    set(value) {
      if (opCountingEnabled) {
        renderOps.text++
      }
      text = value
    },
    enumerable: true,
    configurable: true
  })
  let html = ''
  Object.defineProperty(element, 'innerHTML', {
    get() {
      return html
    },
    set(value) {
      html = value
      if (value === '') {
        for (const child of element.children.slice()) {
          child.parentElement = null
        }
        element.children = []
      }
    },
    configurable: true
  })
  return element
}

function createDocumentFragment() {
  const fragment = {
    nodeType: 11,
    children: [],
    appendChild(child) {
      fragment.children.push(child)
      return child
    }
  }
  return fragment
}

function now() {
  return performance.now()
}

function nextFrame() {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve(performance.now())
    }, FRAME_MS)
  })
}

function installEnv() {
  const registry = new Map()
  const document = {
    createElement(tag) {
      const element = createElement(tag)
      const constructor = registry.get(String(tag).toLowerCase())
      if (constructor) {
        element.connectedCallback = constructor.prototype.connectedCallback
        element.disconnectedCallback = constructor.prototype.disconnectedCallback
        element._yqInstance = null
        element._yqMounted = false
      }
      return element
    },
    createElementNS(namespace, tag) {
      return document.createElement(tag)
    },
    createTextNode(text) {
      return { nodeType: 3, textContent: String(text), children: [], parentElement: null }
    },
    createDocumentFragment,
    head: createElement('head'),
    body: createElement('body'),
    documentElement: { style: { setProperty() {}, removeProperty() {} } },
    querySelector() {
      return null
    },
    querySelectorAll() {
      return []
    },
    addEventListener() {},
    removeEventListener() {}
  }
  const window = {
    document,
    performance: { now },
    requestAnimationFrame: nextFrame,
    cancelAnimationFrame(handle) {
      clearTimeout(handle)
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    addEventListener() {},
    removeEventListener() {},
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    scrollY: 0
  }
  class HTMLElement {
    constructor() {
      Object.assign(this, createElement('div'))
    }
  }
  globalThis.document = document
  globalThis.window = window
  globalThis.HTMLElement = HTMLElement
  globalThis.Element = HTMLElement
  globalThis.Node = class Node {}
  globalThis.Text = class Text {
    constructor(text) {
      this.textContent = String(text === undefined ? '' : text)
    }
  }
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = type
      this.detail = init ? init.detail : undefined
      this.bubbles = Boolean(init && init.bubbles)
    }
  }
  globalThis.customElements = {
    define(name, constructor) {
      registry.set(name, constructor)
    },
    get(name) {
      return registry.get(name)
    }
  }
  globalThis.requestAnimationFrame = nextFrame
  globalThis.cancelAnimationFrame = window.cancelAnimationFrame
  return { registry, document, window }
}

function mountHost(tag) {
  const host = globalThis.document.createElement(tag)
  host.isConnected = true
  if (typeof host.connectedCallback === 'function') {
    host.connectedCallback()
  }
  return host
}

export {
  installEnv,
  mountHost,
  nextFrame,
  now,
  enableRenderOpCounting,
  resetRenderOps,
  readRenderOps,
  totalRenderOps,
  FRAME_MS
}
