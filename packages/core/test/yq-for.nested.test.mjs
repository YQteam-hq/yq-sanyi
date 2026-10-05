import { test } from 'node:test'
import assert from 'node:assert/strict'
import { define } from '../dist/core.mjs'
import { installGlobals, flush, mount } from './helpers/dom-mock.mjs'

installGlobals()

function textOf(el) {
  return (el && el.textContent) || ''
}

function outerRows(instance) {
  return instance.root.children[0].children
}

function innerRows(rowElement) {
  return rowElement.children[0].children
}

function nestedGroups() {
  return {
    groups: [
      { id: 'g1', rows: [{ sku: 'a', name: 'alpha' }, { sku: 'b', name: 'beta' }] },
      { id: 'g2', rows: [{ sku: 'c', name: 'gamma' }] }
    ]
  }
}

test('nested yq-for renders one inner row per item of every outer row', () => {
  define('x-nest-basic', {
    name: 'x-nest-basic',
    template:
      '<div><ul yq-for="group in groups" yq-key="id"><li yq-for="row in group.rows" yq-key="sku">{{ row.name }}</li></ul></div>',
    style: '',
    script: function () {
      return { state: nestedGroups() }
    }
  })
  const host = mount('x-nest-basic')
  const groups = outerRows(host._yqInstance)
  assert.equal(groups.length, 2)
  assert.deepEqual(innerRows(groups[0]).map(textOf), ['alpha', 'beta'])
  assert.deepEqual(innerRows(groups[1]).map(textOf), ['gamma'])
  host.disconnectedCallback()
})

test('nested rows read their own item and the enclosing row item', () => {
  define('x-nest-scope', {
    name: 'x-nest-scope',
    template:
      '<div><section yq-for="group in groups" yq-key="id"><h3>{{ group.title }}</h3><p yq-for="row in group.rows" yq-key="sku">{{ group.title }}/{{ row.name }}</p></section></div>',
    style: '',
    script: function () {
      return {
        state: {
          groups: [{ id: 1, title: 'fruit', rows: [{ sku: 'a', name: 'apple' }, { sku: 'b', name: 'pear' }] }]
        }
      }
    }
  })
  const host = mount('x-nest-scope')
  const group = outerRows(host._yqInstance)[0]
  assert.equal(textOf(group.children[0]), 'fruit')
  assert.deepEqual(group.children[1].children.map(textOf), ['fruit/apple', 'fruit/pear'])
  host.disconnectedCallback()
})

test('nested rows keep the row index of their own level', () => {
  define('x-nest-index', {
    name: 'x-nest-index',
    template:
      '<div><ul yq-for="(group, gi) in groups" yq-key="id"><li yq-for="(row, ri) in group.rows" yq-key="sku">{{ gi }}-{{ ri }}</li></ul></div>',
    style: '',
    script: function () {
      return { state: nestedGroups() }
    }
  })
  const host = mount('x-nest-index')
  const groups = outerRows(host._yqInstance)
  assert.deepEqual(groups.map((group) => innerRows(group).map(textOf)), [['0-0', '0-1'], ['1-0']])
  host.disconnectedCallback()
})

test('adding an inner item re-renders only the group that changed', async () => {
  define('x-nest-add', {
    name: 'x-nest-add',
    template:
      '<div><ul yq-for="group in groups" yq-key="id"><li yq-for="row in group.rows" yq-key="sku">{{ row.name }}</li></ul></div>',
    style: '',
    script: function () {
      return {
        state: {
          groups: [
            { id: 'g1', rows: [{ sku: 'a', name: 'alpha' }] },
            { id: 'g2', rows: [{ sku: 'c', name: 'gamma' }] }
          ]
        }
      }
    }
  })
  const host = mount('x-nest-add')
  const instance = host._yqInstance
  const firstGroup = outerRows(instance)[0]
  instance.state.groups = [
    { id: 'g1', rows: [{ sku: 'a', name: 'alpha' }, { sku: 'b', name: 'beta' }] },
    { id: 'g2', rows: [{ sku: 'c', name: 'gamma' }] }
  ]
  await flush()
  const groups = outerRows(instance)
  assert.equal(groups.length, 2)
  assert.equal(groups[0], firstGroup)
  assert.deepEqual(innerRows(groups[0]).map(textOf), ['alpha', 'beta'])
  assert.deepEqual(innerRows(groups[1]).map(textOf), ['gamma'])
  host.disconnectedCallback()
})

test('a stable inner yq-key reuses the existing inner row element', async () => {
  define('x-nest-key', {
    name: 'x-nest-key',
    template:
      '<div><ul yq-for="group in groups" yq-key="id"><li yq-for="row in group.rows" yq-key="sku">{{ row.name }}</li></ul></div>',
    style: '',
    script: function () {
      return {
        state: {
          groups: [{ id: 'g1', rows: [{ sku: 'a', name: 'alpha' }, { sku: 'b', name: 'beta' }] }]
        }
      }
    }
  })
  const host = mount('x-nest-key')
  const instance = host._yqInstance
  const reused = innerRows(outerRows(instance)[0])[1]
  instance.state.groups = [{ id: 'g1', rows: [{ sku: 'z', name: 'zeta' }, { sku: 'b', name: 'beta' }] }]
  await flush()
  const rows = innerRows(outerRows(instance)[0])
  assert.deepEqual(rows.map(textOf), ['zeta', 'beta'])
  assert.equal(rows[1], reused)
  host.disconnectedCallback()
})

test('removing the last group also removes its nested rows', async () => {
  define('x-nest-remove', {
    name: 'x-nest-remove',
    template:
      '<div><ul yq-for="group in groups" yq-key="id"><li yq-for="row in group.rows" yq-key="sku">{{ row.name }}</li></ul></div>',
    style: '',
    script: function () {
      return { state: nestedGroups() }
    }
  })
  const host = mount('x-nest-remove')
  const instance = host._yqInstance
  assert.equal(outerRows(instance).length, 2)
  instance.state.groups = [{ id: 'g1', rows: [{ sku: 'a', name: 'alpha' }, { sku: 'b', name: 'beta' }] }]
  await flush()
  const groups = outerRows(instance)
  assert.equal(groups.length, 1)
  assert.deepEqual(innerRows(groups[0]).map(textOf), ['alpha', 'beta'])
  host.disconnectedCallback()
})

test('an event bound inside a nested row receives the nested row state', async () => {
  const seen = []
  define('x-nest-event', {
    name: 'x-nest-event',
    template:
      '<div><ul yq-for="group in groups" yq-key="id"><li yq-for="row in group.rows" yq-key="sku"><button yq-on:click="pick">{{ row.name }}</button></li></ul></div>',
    style: '',
    script: function () {
      return {
        state: {
          groups: [{ id: 'g1', rows: [{ sku: 'a', name: 'alpha' }, { sku: 'b', name: 'beta' }] }]
        },
        pick: function (state) {
          seen.push(state.group.id + ':' + state.row.sku)
        }
      }
    }
  })
  const host = mount('x-nest-event')
  const rows = innerRows(outerRows(host._yqInstance)[0])
  rows[1].children[0].dispatch('click')
  await flush()
  assert.deepEqual(seen, ['g1:b'])
  host.disconnectedCallback()
})

test('an event bound inside a nested row survives an outer re-render', async () => {
  const seen = []
  define('x-nest-event-update', {
    name: 'x-nest-event-update',
    template:
      '<div><ul yq-for="group in groups" yq-key="id"><li yq-for="row in group.rows" yq-key="sku"><button yq-on:click="pick">{{ row.name }}</button></li></ul></div>',
    style: '',
    script: function () {
      return {
        state: {
          groups: [{ id: 'g1', rows: [{ sku: 'a', name: 'alpha' }] }]
        },
        pick: function (state) {
          seen.push(state.row.sku)
        }
      }
    }
  })
  const host = mount('x-nest-event-update')
  const instance = host._yqInstance
  instance.state.groups = [{ id: 'g1', rows: [{ sku: 'a', name: 'alpha' }, { sku: 'b', name: 'beta' }] }]
  await flush()
  const rows = innerRows(outerRows(instance)[0])
  assert.equal(rows.length, 2)
  rows[1].children[0].dispatch('click')
  await flush()
  assert.deepEqual(seen, ['b'])
  host.disconnectedCallback()
})

test('three levels of yq-for nest', () => {
  define('x-nest-deep', {
    name: 'x-nest-deep',
    template:
      '<div><a yq-for="x in xs" yq-key="id"><b yq-for="y in x.ys" yq-key="id"><c yq-for="z in y.zs" yq-key="id">{{ x.id }}{{ y.id }}{{ z.id }}</c></b></a></div>',
    style: '',
    script: function () {
      return {
        state: {
          xs: [
            { id: '1', ys: [{ id: 'a', zs: [{ id: 'p' }, { id: 'q' }] }, { id: 'b', zs: [{ id: 'r' }] }] },
            { id: '2', ys: [{ id: 'c', zs: [{ id: 's' }] }] }
          ]
        }
      }
    }
  })
  const host = mount('x-nest-deep')
  const flat = []
  for (const x of outerRows(host._yqInstance)) {
    for (const y of innerRows(x)) {
      for (const z of innerRows(y)) {
        flat.push(textOf(z))
      }
    }
  }
  assert.deepEqual(flat, ['1ap', '1aq', '1br', '2cs'])
  host.disconnectedCallback()
})

test('a group with an empty inner array renders no inner row', () => {
  define('x-nest-empty', {
    name: 'x-nest-empty',
    template:
      '<div><ul yq-for="group in groups" yq-key="id"><li yq-for="row in group.rows" yq-key="sku">{{ row.name }}</li></ul></div>',
    style: '',
    script: function () {
      return {
        state: {
          groups: [{ id: 'g1', rows: [] }, { id: 'g2', rows: [{ sku: 'c', name: 'gamma' }] }]
        }
      }
    }
  })
  const host = mount('x-nest-empty')
  const groups = outerRows(host._yqInstance)
  assert.equal(groups.length, 2)
  assert.equal(innerRows(groups[0]).length, 0)
  assert.deepEqual(innerRows(groups[1]).map(textOf), ['gamma'])
  host.disconnectedCallback()
})

test('a bound attribute on a nested row is applied per row', () => {
  define('x-nest-attr', {
    name: 'x-nest-attr',
    template:
      '<div><ul yq-for="group in groups" yq-key="id"><li yq-for="row in group.rows" yq-key="sku" data-sku="{{ row.sku }}">{{ row.name }}</li></ul></div>',
    style: '',
    script: function () {
      return {
        state: {
          groups: [{ id: 'g1', rows: [{ sku: 'a', name: 'alpha' }, { sku: 'b', name: 'beta' }] }]
        }
      }
    }
  })
  const host = mount('x-nest-attr')
  const rows = innerRows(outerRows(host._yqInstance)[0])
  assert.deepEqual(rows.map((row) => row.getAttribute('data-sku')), ['a', 'b'])
  host.disconnectedCallback()
})

test('a single level yq-for still renders exactly as before nesting was allowed', () => {
  define('x-nest-flat', {
    name: 'x-nest-flat',
    template: '<ul><li yq-for="item in items" yq-key="id"><span>{{ item.text }}</span></li></ul>',
    style: '',
    script: function () {
      return {
        state: { items: [{ id: 1, text: 'a' }, { id: 2, text: 'b' }] }
      }
    }
  })
  const host = mount('x-nest-flat')
  const rows = outerRows(host._yqInstance)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map((row) => textOf(row.children[0])), ['a', 'b'])
  host.disconnectedCallback()
})
