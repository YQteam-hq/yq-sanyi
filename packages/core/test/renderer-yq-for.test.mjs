import { test } from 'node:test'
import assert from 'node:assert/strict'
import { define } from '../dist/core.mjs'
import { installGlobals, flush, mount } from './helpers/dom-mock.mjs'

installGlobals()

test('clicking a yq-on:click button inside yq-for row fires the row-scoped handler', async () => {
  const calls = []
  define('x-row-click', {
    name: 'x-row-click',
    template:
      '<ul><li yq-for="item in items" yq-key="id"><span>{{ item.text }}</span><button yq-on:click="remove(item.id)">x</button></li></ul>',
    style: '',
    script: () => {
      return {
        state: {
          items: [{ id: 3, text: 'foo' }, { id: 2, text: 'bar' }, { id: 1, text: 'baz' }]
        },
        remove(state, id) {
          calls.push({ id, len: state.items.length })
          state.items = state.items.filter((item) => item.id !== id)
        }
      }
    }
  })
  const host = mount('x-row-click')
  const ul = host._yqInstance.root
  // yq-for ALWAYS replaces its host element with rendered rows (no wrapper kept, Bug #2 fix v0.5)
  assert.equal(ul.children.length, 3, 'three rows are direct children of ul')
  // row2 = ul.children[1], its button = ul.children[1].children[1]
  ul.children[1].children[1].dispatch('click')
  await flush()
  assert.equal(calls.length, 1, 'row-scoped handler fires exactly once')
  assert.equal(calls[0].id, 2, 'handler receives the row context id')
  assert.equal(calls[0].len, 3, 'handler sees the items array at call time')
  assert.equal(ul.children.length, 2, 'the clicked row is removed after re-render')
  assert.equal(ul.children[0].children[0].textContent, 'foo')
  assert.equal(ul.children[1].children[0].textContent, 'baz')
  host.disconnectedCallback()
})

test('yq-for renders rows directly without a wrapper', () => {
  define('x-row-clean', {
    name: 'x-row-clean',
    template:
      '<ul><li yq-for="t in items" class="row"><span>{{ t.text }}</span></li></ul>',
    style: '',
    script: function () {
      return {
        state: {
          items: [{ text: 'a' }, { text: 'b' }]
        }
      }
    }
  })
  const host = mount('x-row-clean')
  const ul = host._yqInstance.root
  assert.equal(ul.children.length, 2, 'two rows are direct children of ul (no wrapper)')
  for (const child of ul.children) {
    assert.equal(child.tagName.toLowerCase(), 'li', 'each child is the iterated row tag')
    assert.equal(child.attrs.class, 'row', 'row attributes are preserved on the row itself')
  }
  host.disconnectedCallback()
})

test('yq-for re-renders and newly added rows have yq-on handlers attached', async () => {
  define('x-row-add2', {
    name: 'x-row-add2',
    template: '<ul><li yq-for="item in items" yq-key="id"><button yq-on:click="noop">{{ item.text }}</button></li></ul>',
    style: '',
    script: function () {
      return {
        state: {
          items: [{ id: 1, text: 'a' }]
        },
        noop() {}
      }
    }
  })
  const host = mount('x-row-add2')
  const ul = host._yqInstance.root
  assert.equal(ul.children.length, 1, 'initial render has one row directly under ul')
  host._yqInstance.state.items = [{ id: 2, text: 'b' }, { id: 3, text: 'c' }]
  await flush()
  assert.equal(ul.children.length, 2, 're-render placed the two new rows directly under ul')
  assert.equal(ul.children[0].tagName.toLowerCase(), 'li')
  assert.equal(ul.children[1].tagName.toLowerCase(), 'li')
  assert.ok(
    ul.children[0].children[0].listeners && (ul.children[0].children[0].listeners.click || []).length > 0,
    'newly rendered row button has its click handler attached'
  )
  assert.ok(
    ul.children[1].children[0].listeners && (ul.children[1].children[0].listeners.click || []).length > 0,
    'second newly rendered row button has its click handler attached'
  )
  host.disconnectedCallback()
})
