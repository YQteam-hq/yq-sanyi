import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installGlobals, mount, flush } from './helpers/dom-mock.mjs'
import { define } from '../dist/core.mjs'

installGlobals()

function childNodes(element) {
  return element.children || []
}

function textNodes(element) {
  return childNodes(element).filter(node => node.nodeType === 3)
}

function elementNodes(element, tag) {
  return childNodes(element).filter(node => node.tagName === String(tag).toUpperCase())
}

function readText(element) {
  return textNodes(element).map(node => node.nodeValue).join('')
}

async function mountDefinition(name, template, state) {
  define(name, { template, style: '', script: () => ({ state }) })
  const host = mount(name)
  await flush()
  return host
}

test('a text binding in front of element children is rendered', async () => {
  const host = await mountDefinition('mixed-lead', '<div>Count: {{ n }} <b>{{ unit }}</b></div>', { n: 7, unit: 'px' })
  const root = host.children[0]
  assert.strictEqual(readText(root), 'Count: 7 ')
  assert.strictEqual(elementNodes(root, 'b')[0].textContent, 'px')
})

test('a text binding in front of element children is updated with the state', async () => {
  const host = await mountDefinition('mixed-lead-update', '<div>Count: {{ n }} <b>!</b></div>', { n: 7 })
  const root = host.children[0]
  assert.strictEqual(readText(root), 'Count: 7 ')
  host._yqInstance.state.n = 42
  await flush()
  await flush()
  assert.strictEqual(readText(root), 'Count: 42 ')
  assert.strictEqual(elementNodes(root, 'b').length, 1)
})

test('a text binding behind element children keeps its position', async () => {
  const host = await mountDefinition('mixed-trail', '<div><b>#</b>{{ id }}</div>', { id: 3 })
  const root = host.children[0]
  const nodes = childNodes(root)
  assert.strictEqual(nodes.length, 2)
  assert.strictEqual(nodes[0].tagName, 'B')
  assert.strictEqual(nodes[1].nodeType, 3)
  assert.strictEqual(nodes[1].nodeValue, '3')
})

test('static text around element children keeps its position', async () => {
  const host = await mountDefinition('mixed-static', '<div>Hello <b>world</b>!</div>', {})
  const root = host.children[0]
  const nodes = childNodes(root)
  assert.strictEqual(nodes.length, 3)
  assert.strictEqual(nodes[0].nodeType, 3)
  assert.strictEqual(nodes[0].nodeValue, 'Hello')
  assert.strictEqual(nodes[1].tagName, 'B')
  assert.strictEqual(nodes[2].nodeType, 3)
  assert.strictEqual(nodes[2].nodeValue, '!')
})

test('text around a bound child element is rendered in source order', async () => {
  const host = await mountDefinition(
    'mixed-around',
    '<p>Hello <b>{{ name }}</b>, you have {{ n }}</p>',
    { name: 'Ada', n: 5 }
  )
  const root = host.children[0]
  const nodes = childNodes(root)
  assert.strictEqual(nodes.length, 3)
  assert.strictEqual(nodes[0].nodeValue, 'Hello')
  assert.strictEqual(nodes[1].textContent, 'Ada')
  assert.strictEqual(nodes[2].nodeValue, ', you have 5')
})

test('no binding placeholder is left in the rendered output', async () => {
  const host = await mountDefinition('mixed-placeholder', '<div>{{ a }} <span>{{ b }}</span> {{ c }}</div>', { a: 'one', b: 'two', c: 'three' })
  const root = host.children[0]
  const rendered = childNodes(root).map(node => (node.nodeType === 3 ? node.nodeValue : node.textContent)).join('')
  assert.ok(!rendered.includes('{{'))
  assert.ok(rendered.includes('one'))
  assert.ok(rendered.includes('two'))
  assert.ok(rendered.includes('three'))
})

test('a text binding inside a list row keeps working next to element children', async () => {
  const host = await mountDefinition(
    'mixed-row',
    '<ul><li yq-for="item in items" yq-key="id"><span>{{ item.name }}</span> #{{ item.id }}</li></ul>',
    { items: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] }
  )
  const rows = childNodes(childNodes(host)[0])[0]
  const rendered = childNodes(rows)
  assert.strictEqual(rendered.length, 2)
  const first = childNodes(rendered[0])
  assert.strictEqual(first[0].textContent, 'a')
  assert.strictEqual(first[1].nodeValue, ' #1')
  const second = childNodes(rendered[1])
  assert.strictEqual(second[1].nodeValue, ' #2')
})

test('a text binding inside a list row follows the row state', async () => {
  const host = await mountDefinition(
    'mixed-row-update',
    '<ul><li yq-for="item in items" yq-key="id"><b>{{ item.name }}</b> has {{ item.n }}</li></ul>',
    { items: [{ id: 1, name: 'a', n: 1 }] }
  )
  const rows = childNodes(childNodes(host)[0])[0]
  const row = childNodes(rows)[0]
  assert.strictEqual(childNodes(row)[1].nodeValue, ' has 1')
  host._yqInstance.state.items = [{ id: 1, name: 'a', n: 5 }]
  await flush()
  await flush()
  const updated = childNodes(childNodes(childNodes(host)[0])[0])[0]
  assert.strictEqual(childNodes(updated)[1].nodeValue, ' has 5')
})

test('an element without element children still renders through textContent', async () => {
  const host = await mountDefinition('mixed-plain', '<div>{{ n }}</div>', { n: 5 })
  const root = host.children[0]
  assert.strictEqual(textNodes(root).length, 0)
  assert.strictEqual(root.textContent, '5')
})
