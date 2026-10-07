import { test } from 'node:test'
import assert from 'node:assert/strict'
import { define } from '../dist/core.mjs'
import { installGlobals, mount } from './helpers/dom-mock.mjs'

installGlobals()

test('yq-for drops wrapper when nesting invalid (li in li)', () => {
  define('x-li-drop', {
    name: 'x-li-drop',
    template: '<ul><li yq-for="t in items" class="task"><span>{{ t.text }}</span></li></ul>',
    style: '',
    script: () => ({ state: { items: [{ text: 'a' }, { text: 'b' }] } })
  })
  const host = mount('x-li-drop')
  const ul = host._yqInstance.root
  assert.equal(ul.children.length, 2, 'rows are direct children of ul')
  for (const child of ul.children) {
    assert.equal(child.tagName.toLowerCase(), 'li')
    assert.equal(child.attrs.class, 'task')
  }
  host.disconnectedCallback()
})

test('yq-for drops wrapper for <select><option>', () => {
  define('x-option-drop', {
    name: 'x-option-drop',
    template: '<select><option yq-for="i in items" value="{{ i.id }}">{{ i.text }}</option></select>',
    style: '',
    script: () => ({ state: { items: [{ id: 1, text: 'A' }, { id: 2, text: 'B' }] } })
  })
  const host = mount('x-option-drop')
  const select = host._yqInstance.root
  assert.equal(select.children.length, 2)
  for (const child of select.children) {
    assert.equal(child.tagName.toLowerCase(), 'option')
  }
  host.disconnectedCallback()
})

test('yq-for drops wrapper for <p><div> (block in p)', () => {
  define('x-p-div', {
    name: 'x-p-div',
    template: '<p><div yq-for="t in items" class="row">{{ t.text }}</div></p>',
    style: '',
    script: () => ({ state: { items: [{ text: 'a' }, { text: 'b' }] } })
  })
  const host = mount('x-p-div')
  const p = host._yqInstance.root
  assert.equal(p.tagName.toLowerCase(), 'p')
  assert.equal(p.children.length, 2, 'divs are direct children of p')
  for (const child of p.children) {
    assert.equal(child.tagName.toLowerCase(), 'div')
  }
  host.disconnectedCallback()
})

test('yq-for keeps wrapper for valid nesting (div in ul)', () => {
  define('x-div-stay', {
    name: 'x-div-stay',
    template: '<ul><div yq-for="t in items" class="row"><span>{{ t.text }}</span></div></ul>',
    style: '',
    script: () => ({ state: { items: [{ text: 'a' }, { text: 'b' }] } })
  })
  const host = mount('x-div-stay')
  const ul = host._yqInstance.root
  assert.equal(ul.children.length, 1, 'ul has exactly one wrapper child')
  const wrapper = ul.children[0]
  assert.equal(wrapper.tagName.toLowerCase(), 'div')
  assert.equal(wrapper.attrs.class, 'row')
  assert.equal(wrapper.children.length, 2, 'rows are nested in wrapper')
  host.disconnectedCallback()
})

test('yq-for keeps wrapper for <table><tbody><tr>', () => {
  define('x-tr-stay', {
    name: 'x-tr-stay',
    template: '<table><tbody><tr yq-for="i in items"><td>{{ i.text }}</td></tr></tbody></table>',
    style: '',
    script: () => ({ state: { items: [{ text: 'a' }, { text: 'b' }] } })
  })
  const host = mount('x-tr-stay')
  let tbody = null
  for (const c of host._yqInstance.root.children) {
    if (c.tagName.toLowerCase() === 'tbody') {
      tbody = c
      break
    }
  }
  assert.ok(tbody, 'tbody wrapper exists')
  assert.equal(tbody.children.length, 2, 'rows inside tbody')
  for (const child of tbody.children) {
    assert.equal(child.tagName.toLowerCase(), 'tr')
  }
  host.disconnectedCallback()
})