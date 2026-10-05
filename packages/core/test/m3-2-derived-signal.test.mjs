import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signal, derived, state, effectPre } from '../dist/core.mjs'

test('derived re-runs when a read signal changes', () => {
  const s = signal(10)
  let computeCount = 0
  const d = derived(() => { computeCount++; return s.get() * 2 })
  assert.equal(d.value, 20, 'first read computes')
  assert.equal(computeCount, 1)
  assert.equal(d.value, 20, 'second read is cached')
  assert.equal(computeCount, 1, 'no recompute when dirty=false')
  s.set(15)
  assert.equal(d.value, 30, 'recomputed after signal change')
  assert.equal(computeCount, 2)
})

test('derived does NOT re-run when an unread signal changes', () => {
  const read = signal(1)
  const unread = signal(100)
  let computeCount = 0
  const d = derived(() => { computeCount++; return read.get() + 1 })
  assert.equal(d.value, 2)
  assert.equal(computeCount, 1)
  unread.set(200)
  assert.equal(d.value, 2, 'unread signal change must not invalidate')
  assert.equal(computeCount, 1)
  read.set(5)
  assert.equal(d.value, 6)
  assert.equal(computeCount, 2)
})

test('derived mixes signal and state dependencies', () => {
  const sig = signal(10)
  const st = state(20)
  let computeCount = 0
  const d = derived(() => { computeCount++; return sig.get() + st.value })
  assert.equal(d.value, 30)
  sig.set(100)
  assert.equal(d.value, 120, 'signal change invalidates')
  st.value = 5
  assert.equal(d.value, 105)
  assert.ok(computeCount >= 2, 'recomputed at least twice')
})

test('derived disposing clears signal subscriptions', () => {
  const s = signal(1)
  let fired = false
  const d = derived(() => { s.get(); return 0 })
  d.value
  d.dispose()
  s.set(2)
  assert.equal(fired, false, 'no subscriber fired after dispose')
})

test('derived picks up NEW signal reads after recomputation', () => {
  let useSecond = false
  const a = signal(1)
  const b = signal(2)
  const trigger = state(0)
  const d = derived(() => useSecond ? b.get() + 100 + trigger.value : a.get() + trigger.value)
  assert.equal(d.value, 1, 'first compute: useSecond=false -> a+trigger')
  useSecond = true
  trigger.value = 999
  assert.equal(d.value, 100 + 2 + 999, 'recompute: useSecond=true -> b+trigger; b not yet tracked')
  b.set(50)
  assert.equal(d.value, 100 + 50 + 999, 'b change must invalidate (now tracked)')
})

test('signal() still works standalone (no derived context)', () => {
  const s = signal(7)
  assert.equal(s.get(), 7)
  s.set(9)
  assert.equal(s.get(), 9)
  assert.equal(s.peek(), 9)
})