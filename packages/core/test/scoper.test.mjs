
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoper } from '../dist/core.mjs'

const { generateScopedCSS, injectStyle, removeStyle } = scoper

const mockStyleElements = []
const mockDOM = {
  createElement: (tagName) => {
    const element = {
      tagName,
      textContent: '',
      setAttribute: (key, value) => {},
      remove: () => {
        const index = mockStyleElements.indexOf(element)
        if (index > -1) mockStyleElements.splice(index, 1)
      }
    }
    return element
  },
  head: {
    appendChild: (element) => {
      mockStyleElements.push(element)
    }
  }
}

global.document = mockDOM

test('generateScopedCSS 基础选择器加 scope 属性', () => {
  const basicCSS = `
  .button {
    color: red;
  }
  .container {
    background: blue;
  }
`
  const scopedCSS = generateScopedCSS(basicCSS, 'test-scope')
  assert.ok(scopedCSS.includes('.button[data-yq-scope="test-scope"]'))
})

test('generateScopedCSS 空 CSS 返回空串', () => {
  const emptyScoped = generateScopedCSS('', 'test-scope')
  assert.strictEqual(emptyScoped, '')
})

test('generateScopedCSS 保留全局选择器', () => {
  const globalCSS = `
  * {
    margin: 0;
  }
  .local-class {
    padding: 10px;
  }
`
  const globalScoped = generateScopedCSS(globalCSS, 'test-scope')
  assert.ok(globalScoped.includes('*'))
  assert.ok(globalScoped.includes('.local-class[data-yq-scope="test-scope"]'))
})

test('generateScopedCSS keeps the scope attribute in front of a pseudo-class', () => {
  const pseudoCSS = `
  .button:hover {
    color: blue;
  }
  .input:focus {
    outline: none;
  }
`
  const pseudoScoped = generateScopedCSS(pseudoCSS, 'test-scope')
  assert.ok(pseudoScoped.includes('.button[data-yq-scope="test-scope"]:hover'))
  assert.ok(pseudoScoped.includes('.input[data-yq-scope="test-scope"]:focus'))
  assert.ok(!pseudoScoped.includes('.button:hover'))
})

test('injectStyle 注入样式并 removeStyle 移除', () => {
  const injection = injectStyle('.test { color: red; }', 'test-scope')
  assert.strictEqual(mockStyleElements.length, 1)
  assert.strictEqual(injection.scopeId, 'test-scope')
  assert.strictEqual(injection.references, 1)
  assert.ok(injection.cssText.includes('.test[data-yq-scope="test-scope"]'))
  removeStyle(injection)
  assert.strictEqual(injection.references, 0)
  assert.strictEqual(mockStyleElements.length, 0)
})
