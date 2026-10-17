import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoper } from '../dist/core.mjs'

const {
  injectStyle,
  removeStyle,
  addGlobalStyle,
  removeGlobalStyle,
  getGlobalStyles,
  clearGlobalStyles,
  updateTheme,
  getThemeVariables,
  resetTheme
} = scoper

const headElements = []
const cssVarCalls = []

function makeElement(tagName) {
  const attributes = {}
  const element = {
    tagName,
    textContent: '',
    setAttribute(key, value) {
      attributes[key] = value
    },
    getAttribute(key) {
      return attributes[key]
    },
    remove() {
      const index = headElements.indexOf(element)
      if (index > -1) headElements.splice(index, 1)
    }
  }
  return element
}

global.document = {
  createElement: (tagName) => makeElement(tagName),
  head: {
    appendChild(element) {
      headElements.push(element)
    }
  },
  documentElement: {
    style: {
      setProperty(key, value) {
        cssVarCalls.push([key, value])
      }
    }
  },
  querySelectorAll(selector) {
    const match = /^style\[data-yq-global-style(?:="([^"]*)")?\]$/.exec(selector)
    if (!match) return []
    return headElements.filter((element) => {
      if (element.tagName !== 'style') return false
      const value = element.getAttribute('data-yq-global-style')
      if (match[1] === undefined) return value !== undefined
      return value === match[1]
    })
  }
}

const globalStyleCount = () => Object.keys(getGlobalStyles()).length
const globalElementsInHead = () =>
  headElements.filter((element) => element.getAttribute('data-yq-global-style') !== undefined).length

test('injectStyle shares one injection for identical css and increments the reference count', () => {
  const first = injectStyle('.shared { color: red; }', 'lc-scope-a')
  const second = injectStyle('.shared { color: red; }', 'lc-scope-a')
  assert.strictEqual(first, second, 'identical css + scope returns the same injection object')
  assert.strictEqual(first.references, 2, 'the second inject bumps the reference count to 2')
  assert.strictEqual(headElements.length, 1, 'only one style element is created')
  removeStyle(first)
  removeStyle(second)
})

test('removeStyle only drops the element after the last reference is released', () => {
  const injection = injectStyle('.counted { color: blue; }', 'lc-scope-b')
  assert.strictEqual(injection.references, 1)
  const again = injectStyle('.counted { color: blue; }', 'lc-scope-b')
  assert.strictEqual(injection.references, 2)
  removeStyle(again)
  assert.strictEqual(injection.references, 1, 'one reference is still held')
  assert.strictEqual(headElements.length, 1, 'the element stays in the document')
  removeStyle(injection)
  assert.strictEqual(injection.references, 0, 'the last reference is released')
  assert.strictEqual(headElements.length, 0, 'the element is removed once fully released')
})

test('injectStyle keeps distinct css text under separate injections', () => {
  const a = injectStyle('.one { color: red; }', 'lc-scope-c')
  const b = injectStyle('.two { color: green; }', 'lc-scope-c')
  assert.notStrictEqual(a, b, 'different css text produces a distinct injection')
  assert.strictEqual(a.references, 1)
  assert.strictEqual(b.references, 1)
  removeStyle(a)
  removeStyle(b)
})

test('addGlobalStyle stores the style under the supplied id and appends an element', () => {
  const before = globalStyleCount()
  const beforeHead = globalElementsInHead()
  const id = addGlobalStyle('.global { margin: 0; }', 'lc-global-1')
  assert.strictEqual(id, 'lc-global-1')
  assert.strictEqual(getGlobalStyles()['lc-global-1'], '.global { margin: 0; }')
  assert.strictEqual(globalStyleCount(), before + 1)
  assert.strictEqual(globalElementsInHead(), beforeHead + 1)
  removeGlobalStyle('lc-global-1')
})

test('addGlobalStyle auto-generates an id when none is supplied', () => {
  const id = addGlobalStyle('.auto { padding: 4px; }')
  assert.ok(typeof id === 'string' && id.length > 0, 'an id is generated')
  assert.strictEqual(getGlobalStyles()[id], '.auto { padding: 4px; }')
  removeGlobalStyle(id)
})

test('removeGlobalStyle removes a single global style and is safe for unknown ids', () => {
  const id = addGlobalStyle('.removable { color: teal; }', 'lc-global-2')
  removeGlobalStyle('lc-global-2')
  assert.strictEqual(getGlobalStyles()['lc-global-2'], undefined, 'the style is gone from the registry')
  assert.strictEqual(globalElementsInHead(), 0, 'the element left the document')
  assert.doesNotThrow(() => removeGlobalStyle('lc-global-missing'))
})

test('clearGlobalStyles empties every global style', () => {
  addGlobalStyle('.a { color: red; }', 'lc-global-a')
  addGlobalStyle('.b { color: blue; }', 'lc-global-b')
  assert.strictEqual(globalStyleCount(), 2)
  clearGlobalStyles()
  assert.deepEqual(getGlobalStyles(), {})
  assert.strictEqual(globalElementsInHead(), 0)
})

test('updateTheme writes css variables and is reflected by getThemeVariables', () => {
  resetTheme()
  updateTheme({ 'primary-color': '#abcdef', 'accent-color': '#123456' })
  const theme = getThemeVariables()
  assert.strictEqual(theme['primary-color'], '#abcdef')
  assert.strictEqual(theme['accent-color'], '#123456')
  assert.ok(
    cssVarCalls.some(([key, value]) => key === '--yq-primary-color' && value === '#abcdef'),
    'the css custom property is written to documentElement'
  )
})

test('resetTheme restores the documented default theme', () => {
  updateTheme({ 'primary-color': '#abcdef' })
  resetTheme()
  const theme = getThemeVariables()
  assert.strictEqual(theme['primary-color'], '#3b82f6', 'primary-color returns to its default')
  assert.strictEqual(theme['secondary-color'], '#6b7280', 'secondary-color returns to its default')
  assert.strictEqual(theme['accent-color'], undefined, 'keys added by updateTheme are cleared')
})
