import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signal } from '../dist/core.mjs'

test('signal get/set/peek basics', () => {
  const s = signal(0)
  assert.equal(s.get(), 0)
  s.set(5)
  assert.equal(s.get(), 5)
  assert.equal(s.peek(), 5)
})

test('signal holds complex values', () => {
  const s = signal({ count: 0, name: 'a' })
  assert.equal(s.get().count, 0)
  s.set({ count: 1, name: 'b' })
  assert.equal(s.get().count, 1)
})

test('signal subscribers are notified on value change', () => {
  const s = signal('a')
  const received = []
  const unsub = s.subscribe(() => received.push(s.peek()))
  s.set('b')
  s.set('c')
  unsub()
  s.set('d')
  assert.deepEqual(received, ['b', 'c'])
})

test('signal does not notify when set to same value', () => {
  const s = signal(1)
  let count = 0
  s.subscribe(() => count++)
  s.set(1)
  s.set(1)
  assert.equal(count, 0)
})

test('signal unsubscribe works correctly', () => {
  const s = signal(0)
  let count = 0
  const unsub = s.subscribe(() => count++)
  s.set(1)
  assert.equal(count, 1)
  unsub()
  s.set(2)
  assert.equal(count, 1)
})

test('multiple subscribers all fire', () => {
  const s = signal(0)
  let a = 0, b = 0, c = 0
  s.subscribe(() => a++)
  s.subscribe(() => b++)
  s.subscribe(() => c++)
  s.set(1)
  assert.equal(a, 1)
  assert.equal(b, 1)
  assert.equal(c, 1)
})
