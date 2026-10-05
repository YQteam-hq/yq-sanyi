function makeStyle() {
  return {
    cssText: '',
    borderBottomColor: '',
    color: '',
    display: '',
    left: '',
    top: '',
    right: '',
    bottom: '',
    cursor: ''
  }
}

function createElement(tag) {
  const element = {
    tagName: String(tag).toUpperCase(),
    attrs: {},
    children: [],
    listeners: {},
    textContent: '',
    value: '',
    type: '',
    placeholder: '',
    parentNode: null,
    style: makeStyle(),
    rect: { left: 0, top: 0 },
    focused: false,
    setAttribute(name, value) {
      element.attrs[name] = String(value)
    },
    getAttribute(name) {
      return name in element.attrs ? element.attrs[name] : null
    },
    removeAttribute(name) {
      delete element.attrs[name]
    },
    appendChild(child) {
      element.children.push(child)
      child.parentNode = element
      return child
    },
    removeChild(child) {
      const index = element.children.indexOf(child)
      if (index > -1) {
        element.children.splice(index, 1)
        child.parentNode = null
      }
      return child
    },
    addEventListener(name, fn) {
      element.listeners[name] = element.listeners[name] || []
      element.listeners[name].push(fn)
    },
    removeEventListener(name, fn) {
      const list = element.listeners[name] || []
      const index = list.indexOf(fn)
      if (index > -1) {
        list.splice(index, 1)
      }
    },
    dispatch(name, event) {
      const list = (element.listeners[name] || []).slice()
      for (const fn of list) {
        fn(event)
      }
    },
    focus() {
      element.focused = true
    },
    blur() {
      element.focused = false
    },
    setSelectionRange() {},
    getBoundingClientRect() {
      return { left: element.rect.left, top: element.rect.top }
    }
  }
  Object.defineProperty(element, 'innerHTML', {
    get() {
      return element._html || ''
    },
    set(value) {
      element._html = String(value)
      for (const child of element.children.slice()) {
        child.parentNode = null
      }
      element.children = []
    },
    configurable: true
  })
  return element
}

export function findByRole(root, role) {
  if (root.getAttribute && root.getAttribute('data-yq-debug-panel') === role) {
    return root
  }
  for (const child of root.children || []) {
    const found = findByRole(child, role)
    if (found) {
      return found
    }
  }
  return null
}

export function findAllByRole(root, role, out = []) {
  if (root.getAttribute && root.getAttribute('data-yq-debug-panel') === role) {
    out.push(root)
  }
  for (const child of root.children || []) {
    findAllByRole(child, role, out)
  }
  return out
}

export function findTab(root, key) {
  if (root.getAttribute && root.getAttribute('data-yq-debug-tab') === key) {
    return root
  }
  for (const child of root.children || []) {
    const found = findTab(child, key)
    if (found) {
      return found
    }
  }
  return null
}

export function installPanelDom() {
  const documentListeners = {}
  const intervals = new Map()
  const previous = {
    document: global.document,
    window: global.window,
    setInterval: global.setInterval,
    clearInterval: global.clearInterval
  }
  let nextTimerId = 1

  const body = createElement('body')

  const document = {
    body,
    createElement: (tag) => createElement(tag),
    addEventListener(name, fn) {
      documentListeners[name] = documentListeners[name] || []
      documentListeners[name].push(fn)
    },
    removeEventListener(name, fn) {
      const list = documentListeners[name] || []
      const index = list.indexOf(fn)
      if (index > -1) {
        list.splice(index, 1)
      }
    },
    listenerCount(name) {
      return (documentListeners[name] || []).length
    }
  }

  const window = {
    innerWidth: 1200,
    innerHeight: 800,
    setInterval(fn, ms) {
      const id = nextTimerId
      nextTimerId += 1
      intervals.set(id, { fn, ms })
      return id
    },
    clearInterval(id) {
      intervals.delete(id)
    }
  }

  global.document = document
  global.window = window
  global.setInterval = window.setInterval
  global.clearInterval = window.clearInterval

  return {
    document,
    window,
    body,
    intervals,
    dispatchDocument(name, event) {
      for (const fn of (documentListeners[name] || []).slice()) {
        fn(event)
      }
    },
    listenerCount(name) {
      return (documentListeners[name] || []).length
    },
    restore() {
      global.document = previous.document
      global.window = previous.window
      global.setInterval = previous.setInterval
      global.clearInterval = previous.clearInterval
    }
  }
}
