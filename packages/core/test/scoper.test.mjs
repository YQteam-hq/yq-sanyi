
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

test('generateScopedCSS 保留伪类选择器', () => {
  const pseudoCSS = `
  .button:hover {
    color: blue;
  }
  .input:focus {
    outline: none;
  }
`
  const pseudoScoped = generateScopedCSS(pseudoCSS, 'test-scope')
  assert.ok(pseudoScoped.includes('.button:hover'))
  assert.ok(pseudoScoped.includes('.input:focus'))
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

test('generateScopedCSS scopes every selector of a comma separated group', () => {
  const grouped = 'h1, h2, h3 { margin: 0; }'
  const groupedScoped = generateScopedCSS(grouped, 'test-scope')
  assert.ok(groupedScoped.includes('h1[data-yq-scope="test-scope"]'))
  assert.ok(groupedScoped.includes('h2[data-yq-scope="test-scope"]'))
  assert.ok(groupedScoped.includes('h3[data-yq-scope="test-scope"]'))
  assert.ok(!/,\s*h2\s*\{/.test(groupedScoped))
})

test('generateScopedCSS scopes pseudo class selectors instead of skipping them', () => {
  const pseudoScoped = generateScopedCSS('a:hover { color: red; }', 'test-scope')
  assert.ok(pseudoScoped.includes('data-yq-scope="test-scope"'))
  assert.ok(!/a:hover\s*\{/.test(pseudoScoped))
})

test('generateScopedCSS keeps pseudo elements last', () => {
  const scoped = generateScopedCSS('li::before { content: "-"; }', 'test-scope')
  assert.ok(scoped.includes('li[data-yq-scope="test-scope"]::before'))
})

test('generateScopedCSS leaves keyframe selectors untouched', () => {
  const keyframes = '@keyframes fade { 0% { opacity: 0; } to { opacity: 1; } }'
  const scoped = generateScopedCSS(keyframes, 'test-scope')
  assert.ok(scoped.includes('0%'))
  assert.ok(scoped.includes('to'))
  assert.ok(!scoped.includes('0%[data-yq-scope'))
})

test('generateScopedCSS keeps commas inside a functional pseudo class together', () => {
  const scoped = generateScopedCSS('.row :not(.a, .b) { color: red; }', 'test-scope')
  assert.ok(scoped.includes(':not(.a, .b)'))
  assert.strictEqual((scoped.match(/\[data-yq-scope/g) || []).length, 1)
})

test('generateScopedCSS keeps media queries unscoped but scopes inner rules', () => {
  const media = '@media (max-width: 600px) { .card { padding: 4px; } }'
  const scoped = generateScopedCSS(media, 'test-scope')
  assert.ok(scoped.includes('@media (max-width: 600px)'))
  assert.ok(scoped.includes('.card[data-yq-scope="test-scope"]'))
})

test('generateScopedCSS leaves the universal selector unscoped beside a scoped one', () => {
  const scoped = generateScopedCSS('*, .card { margin: 0; }', 'test-scope')
  assert.ok(scoped.includes('.card[data-yq-scope="test-scope"]'))
  assert.ok(scoped.includes('*,.'))
})

test('generateScopedCSS leaves a lone at-rule untouched', () => {
  const scoped = generateScopedCSS('@font-face { font-family: Example; }', 'test-scope')
  assert.ok(scoped.includes('@font-face'))
  assert.ok(!scoped.includes('@font-face[data-yq-scope'))
})

test('generateScopedCSS scopes the members around an empty selector', () => {
  const scoped = generateScopedCSS('.a, , .b { color: red; }', 'test-scope')
  assert.ok(scoped.includes('.a[data-yq-scope="test-scope"]'))
  assert.ok(scoped.includes('.b[data-yq-scope="test-scope"]'))
})

test('generateScopedCSS scopes a descendant and a child combinator alike', () => {
  const scoped = generateScopedCSS('.wrap .item { color: red; } .wrap > .item { color: blue; }', 'test-scope')
  assert.strictEqual((scoped.match(/\[data-yq-scope/g) || []).length, 2)
})

test('generateScopedCSS handles a large component stylesheet within a sane budget', () => {
  let css = ''
  for (let i = 0; i < 500; i++) {
    css += `.block${i} .item, .block${i} > .row:hover, .block${i}::before { color: #fff; padding: ${i % 9}px; }\n`
  }
  const started = Date.now()
  const scoped = generateScopedCSS(css, 'test-scope')
  const elapsed = Date.now() - started
  assert.ok(scoped.length > 0)
  assert.ok(elapsed < 200, 'a large stylesheet should be scoped quickly, took ' + elapsed + 'ms')
})

test('generateScopedCSS trims whitespace around each selector', () => {
  const scoped = generateScopedCSS('.card,\n\t.panel  { margin: 0; }', 'test-scope')
  assert.ok(scoped.includes('.card[data-yq-scope="test-scope"]'))
  assert.ok(scoped.includes('.panel[data-yq-scope="test-scope"]'))
  assert.ok(!scoped.includes('.panel  ['))
})

test('generateScopedCSS keeps a nested functional selector in one piece', () => {
  const scoped = generateScopedCSS('.a :is(.b, .c) > .d { color: red; }', 'test-scope')
  assert.ok(scoped.includes(':is(.b, .c)'))
  assert.strictEqual((scoped.match(/\[data-yq-scope/g) || []).length, 1)
})
