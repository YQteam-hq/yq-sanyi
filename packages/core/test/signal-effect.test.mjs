import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signal, derived, effect, resetReactiveState } from '../dist/core.mjs'

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

test('an effect that reads a signal re-runs when the signal is set', async () => {
  resetReactiveState()
  const count = signal(0)
  let runs = 0
  let seen = -1
  effect(() => {
    runs++
    seen = count.get()
  })
  assert.equal(runs, 1)
  assert.equal(seen, 0)
  count.set(3)
  await flush()
  assert.equal(runs, 2, 'the effect must re-run after the signal changes')
  assert.equal(seen, 3)
})

test('setting a signal to the same value does not re-run the effect', async () => {
  resetReactiveState()
  const name = signal('ada')
  let runs = 0
  effect(() => {
    runs++
    name.get()
  })
  name.set('ada')
  await flush()
  assert.equal(runs, 1, 'an unchanged signal must not invalidate the effect')
  name.set('grace')
  await flush()
  assert.equal(runs, 2)
})

test('a derived value built on a signal invalidates the effect that reads it', async () => {
  resetReactiveState()
  const price = signal(10)
  const total = derived(() => price.get() * 2)
  let runs = 0
  let seen = -1
  effect(() => {
    runs++
    seen = total.value
  })
  assert.equal(seen, 20)
  price.set(15)
  await flush()
  assert.equal(runs, 2, 'signal -> derived -> effect must propagate')
  assert.equal(seen, 30)
})

test('peek reads the value without tracking it', async () => {
  resetReactiveState()
  const count = signal(1)
  let runs = 0
  effect(() => {
    runs++
    count.peek()
  })
  count.set(2)
  await flush()
  assert.equal(runs, 1, 'peek must not register a dependency')
})

test('a signal state and a signal can both drive one effect', async () => {
  resetReactiveState()
  const count = signal(1)
  const label = signal('a')
  let seen = ''
  effect(() => {
    seen = label.get() + count.get()
  })
  assert.equal(seen, 'a1')
  count.set(2)
  await flush()
  assert.equal(seen, 'a2')
  label.set('b')
  await flush()
  assert.equal(seen, 'b2')
})

test('subscribers still fire once per distinct change', () => {
  const count = signal(1)
  let calls = 0
  const stop = count.subscribe(() => calls++)
  count.set(1)
  count.set(2)
  count.set(2)
  assert.equal(calls, 1)
  stop()
  count.set(3)
  assert.equal(calls, 1)
})
