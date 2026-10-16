import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signal, derived, effect, state } from '../dist/core.mjs'

async function tick(times = 2) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve()
  }
}

test('signal -> derived -> effect: the effect re-runs when the signal changes', async () => {
  const seen = []
  const s = signal(1)
  const d = derived(() => s.get() * 2)
  effect(() => {
    seen.push(d.value)
  })
  assert.deepEqual(seen, [2], 'effect runs once on creation')
  s.set(5)
  await tick()
  assert.deepEqual(seen, [2, 10], 'effect re-runs after the signal the derived reads changes')
  assert.equal(d.value, 10)
})

test('signal read directly inside an effect tracks and re-runs the effect', async () => {
  const seen = []
  const s = signal(0)
  effect(() => {
    seen.push(s.get())
  })
  assert.deepEqual(seen, [0])
  s.set(3)
  await tick()
  assert.deepEqual(seen, [0, 3], 'effect re-runs when a directly-read signal changes')
})

test('effect depending on a derived that depends on a signal re-runs transitively', async () => {
  const seen = []
  const base = signal(2)
  const doubled = derived(() => base.get() + base.get())
  const quadrupled = derived(() => doubled.value * 2)
  effect(() => {
    seen.push(quadrupled.value)
  })
  assert.deepEqual(seen, [8])
  base.set(5)
  await tick()
  assert.deepEqual(seen, [8, 20], 'transitive derived chain invalidates the effect')
})

test('two effects that read the same signal both re-run', async () => {
  const a = []
  const b = []
  const s = signal('x')
  effect(() => a.push(s.get()))
  effect(() => b.push(s.get()))
  assert.deepEqual(a, ['x'])
  assert.deepEqual(b, ['x'])
  s.set('y')
  await tick()
  assert.deepEqual(a, ['x', 'y'])
  assert.deepEqual(b, ['x', 'y'])
})

test('effects still re-run from state changes (no regression)', async () => {
  const seen = []
  const st = state(1)
  const d = derived(() => st.value + 1)
  effect(() => {
    seen.push(d.value)
  })
  assert.deepEqual(seen, [2])
  st.value = 9
  await tick()
  assert.deepEqual(seen, [2, 10])
})

test('derived keeps its lazy cache while effects observe it', () => {
  let computeCount = 0
  const s = signal(10)
  const d = derived(() => {
    computeCount++
    return s.get() * 2
  })
  assert.equal(d.value, 20)
  assert.equal(computeCount, 1)
  assert.equal(d.value, 20, 'second read is cached while not dirty')
  assert.equal(computeCount, 1)
  s.set(15)
  assert.equal(d.value, 30, 'recomputed only after the signal changes')
  assert.equal(computeCount, 2)
})
