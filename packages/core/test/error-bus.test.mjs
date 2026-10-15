import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { installGlobals, mount, flush } from './helpers/dom-mock.mjs'
import { define, onError, _resetErrorHandlers, createComponent, mountComponent, withErrorBoundary } from '../dist/core.mjs'

installGlobals()

let seen = []
let unsubscribe = null

beforeEach(() => {
  seen = []
  _resetErrorHandlers()
  unsubscribe = onError((error, info) => seen.push({ error, info }))
})

afterEach(() => {
  if (unsubscribe) unsubscribe()
  _resetErrorHandlers()
})

const quiet = () => {
  const original = console.error
  console.error = () => {}
  return () => {
    console.error = original
  }
}

test('a mount failure reaches the error bus', async () => {
  const restore = quiet()
  define('bus-mount', {
    template: '<div>{{ boom }}</div>',
    style: '',
    script: () => ({ state: { get boom() { throw new Error('mount boom') } } })
  })
  mount('bus-mount')
  await flush()
  restore()
  assert.strictEqual(seen.length, 1)
  assert.strictEqual(seen[0].error.message, 'mount boom')
  assert.strictEqual(seen[0].info.phase, 'mount')
  assert.strictEqual(seen[0].info.component, 'bus-mount')
  assert.strictEqual(typeof seen[0].info.timestamp, 'number')
})

test('an update failure reaches the error bus', async () => {
  const restore = quiet()
  let armed = false
  define('bus-update', {
    template: '<div>{{ boom }}</div>',
    style: '',
    script: () => ({ state: { n: 0, get boom() { if (armed) throw new Error('update boom'); return 'ok' } } })
  })
  const host = mount('bus-update')
  await flush()
  assert.strictEqual(seen.length, 0)
  armed = true
  host._yqInstance.state.n = 1
  await flush()
  await flush()
  restore()
  assert.strictEqual(seen.length, 1)
  assert.strictEqual(seen[0].error.message, 'update boom')
  assert.strictEqual(seen[0].info.phase, 'update')
  assert.strictEqual(seen[0].info.component, 'bus-update')
})

test('a failing event handler reaches the error bus', async () => {
  const restore = quiet()
  define('bus-event', {
    template: '<button yq-on:click="explode">go</button>',
    style: '',
    script: () => ({
      state: {},
      explode: () => {
        throw new Error('handler boom')
      }
    })
  })
  const host = mount('bus-event')
  await flush()
  host.children[0].dispatch('click')
  restore()
  assert.strictEqual(seen.length, 1)
  assert.strictEqual(seen[0].error.message, 'handler boom')
  assert.strictEqual(seen[0].info.phase, 'event')
  assert.strictEqual(seen[0].info.component, 'bus-event')
  assert.strictEqual(seen[0].info.handler, 'explode')
  assert.strictEqual(seen[0].info.event, 'click')
})

test('a failing row handler reaches the error bus', async () => {
  const restore = quiet()
  define('bus-row', {
    template: '<ul><li yq-for="item in items" yq-key="id"><button yq-on:click="explode">{{ item.id }}</button></li></ul>',
    style: '',
    script: () => ({
      state: { items: [{ id: 1 }] },
      explode: () => {
        throw new Error('row boom')
      }
    })
  })
  const host = mount('bus-row')
  await flush()
  const button = host.children[0].children[0].children[0].children[0]
  button.dispatch('click')
  restore()
  assert.strictEqual(seen.length, 1)
  assert.strictEqual(seen[0].error.message, 'row boom')
  assert.strictEqual(seen[0].info.phase, 'event')
  assert.strictEqual(seen[0].info.component, 'bus-row')
})

test('a failing $emit reaches the error bus', async () => {
  const restore = quiet()
  define('bus-emit', {
    template: '<button yq-on:click="$emit(\'pick\', boom)">go</button>',
    style: '',
    script: () => ({ state: { get boom() { throw new Error('emit boom') } } })
  })
  const host = mount('bus-emit')
  await flush()
  host.children[0].dispatch('click')
  restore()
  assert.strictEqual(seen.length, 1)
  assert.strictEqual(seen[0].info.phase, 'emit')
  assert.strictEqual(seen[0].info.event, 'pick')
  assert.strictEqual(seen[0].error.message, 'emit boom')
})

test('unsubscribing stops the delivery', async () => {
  const restore = quiet()
  unsubscribe()
  define('bus-unsubscribe', {
    template: '<div>{{ boom }}</div>',
    style: '',
    script: () => ({ state: { get boom() { throw new Error('silent') } } })
  })
  mount('bus-unsubscribe')
  await flush()
  restore()
  assert.strictEqual(seen.length, 0)
})

test('a throwing subscriber does not stop the others', async () => {
  const restore = quiet()
  const reached = []
  const stop = onError(() => {
    reached.push('first')
    throw new Error('subscriber boom')
  })
  onError(() => reached.push('second'))
  define('bus-subscriber', {
    template: '<div>{{ boom }}</div>',
    style: '',
    script: () => ({ state: { get boom() { throw new Error('mount boom') } } })
  })
  mount('bus-subscriber')
  await flush()
  stop()
  restore()
  assert.deepEqual(reached, ['first', 'second'])
  assert.strictEqual(seen.length, 1)
})

test('a component wrapped in an error boundary reports exactly once', async () => {
  const restore = quiet()
  const instance = createComponent({
    name: 'bus-boundary',
    template: '<div>{{ boom }}</div>',
    script: () => ({ state: { get boom() { throw new Error('boundary boom') } } })
  })
  withErrorBoundary('bus-boundary', () => 'fallback')(instance)
  mountComponent(instance)
  await flush()
  restore()
  assert.strictEqual(instance.hasError, true)
  assert.strictEqual(seen.length, 1)
  assert.strictEqual(seen[0].error.message, 'boundary boom')
})
