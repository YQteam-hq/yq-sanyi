import { test } from 'node:test'
import assert from 'node:assert/strict'
import { define } from '../dist/core.mjs'
import { installGlobals, flush, mount } from './helpers/dom-mock.mjs'

installGlobals()

function findTag(el, tag) {
  for (const child of el.children || []) {
    if (child.tagName.toLowerCase() === tag) return child
    const found = findTag(child, tag)
    if (found) return found
  }
  return null
}

test('yq-for rows support their own event bindings', async () => {
  define('x-row-todo', {
    name: 'x-row-todo',
    template: '<ul><li yq-for="item in items" yq-key="id"><span>{{ item.text }}</span><button yq-on:click="del">x</button></li></ul>',
    style: '',
    script: function () {
      return {
        state: {
          items: [
            { id: 1, text: 'a' },
            { id: 2, text: 'b' },
            { id: 3, text: 'c' }
          ]
        },
        del: function (state) {
          state.items = state.items.filter((t) => t.id !== state.item.id)
        }
      }
    }
  })
  const host = mount('x-row-todo')
  // yq-for replaces host with rows; root.children are the rows directly
  const rows = host._yqInstance.root.children
  assert.equal(rows.length, 3)
  // row2 (id=2): delete its button (button is row.children[1])
  const delBtn = rows[1].children[1]
  delBtn.dispatch('click')
  await flush()
  assert.equal(host._yqInstance.root.children.length, 2)
  assert.equal(host._yqInstance.root.children[0].children[0].textContent, 'a')
  assert.equal(host._yqInstance.root.children[1].children[0].textContent, 'c')
  host.disconnectedCallback()
})

test('row event handlers receive the row state', async () => {
  const seen = []
  define('x-row-state', {
    name: 'x-row-state',
    template: '<ul><li yq-for="item in items" yq-key="id"><button yq-on:click="log">log</button></li></ul>',
    style: '',
    script: function () {
      return {
        state: { items: [{ id: 1, text: 'a' }] },
        log: function (state) {
          seen.push(state.item.text)
        }
      }
    }
  })
  const host = mount('x-row-state')
  const button = host._yqInstance.root.children[0].children[0]
  button.dispatch('click')
  await flush()
  assert.deepEqual(seen, ['a'])
  host.disconnectedCallback()
})

test('row $emit reaches the component host listener', async () => {
  define('x-row-emit', {
    name: 'x-row-emit',
    template: '<ul><li yq-for="item in items" yq-key="id"><button yq-on:click="$emit(\'row-picked\', item.text)">go</button></li></ul>',
    style: '',
    script: function () {
      return { state: { items: [{ id: 1, text: 'a' }], picked: '' } }
    }
  })
  define('x-row-emit-parent', {
    name: 'x-row-emit-parent',
    template: '<div><x-row-emit yq-on:row-picked="onPick"></x-row-emit></div>',
    style: '',
    script: function () {
      return {
        state: { picked: '' },
        onPick: function (state, event) {
          state.picked = event.detail
        }
      }
    }
  })
  const host = mount('x-row-emit-parent')
  const inst = host._yqInstance
  const button = findTag(inst.root.children[0], 'button')
  button.dispatch('click')
  await flush()
  await flush()
  assert.equal(inst.state.picked, 'a')
  host.disconnectedCallback()
})
