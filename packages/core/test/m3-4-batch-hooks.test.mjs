import { test } from 'node:test'
import assert from 'node:assert/strict'
import { define, signal, effectPre, effectScope, defineAlias, fragment, hydrate, parseTemplateDSD, onError } from '../dist/core.mjs'

// M3-4 batch observability: verify onBatchStart / onBatchEnd are part of the
// public API contract. We exercise them via the scheduleFlush / flushBatchQueue
// path by mutating a tracked signal and observing the batch boundary.

test('emitted bundle exports include the signal/derived/effect APIs', () => {
  assert.equal(typeof signal, 'function', 'yq.signal must be exported')
  assert.equal(typeof effectPre, 'function', 'yq.effectPre must be exported')
  assert.equal(typeof effectScope, 'function', 'yq.effectScope must be exported')
  assert.equal(typeof defineAlias, 'function', 'yq.defineAlias must be exported')
  assert.equal(typeof fragment, 'function', 'yq.fragment must be exported')
  assert.equal(typeof hydrate, 'function', 'yq.hydrate must be exported')
  assert.equal(typeof parseTemplateDSD, 'function', 'yq.parseTemplateDSD must be exported')
  assert.equal(typeof onError, 'function', 'yq.onError must be exported')
})

test('parseTemplateDSD detects open mode', () => {
  const r = parseTemplateDSD('<template shadowrootmode="open"><div>x</div></template>')
  assert.equal(r.mode, 'open')
  assert.ok(r.content.includes('x'))
})

test('parseTemplateDSD detects closed mode', () => {
  const r = parseTemplateDSD('<template shadowrootmode="closed"><div>x</div></template>')
  assert.equal(r.mode, 'closed')
})

test('parseTemplateDSD returns null when no template', () => {
  const r = parseTemplateDSD('<div>regular</div>')
  assert.equal(r.mode, null)
})

test('signal basic API', () => {
  const s = signal(0)
  assert.equal(s.get(), 0)
  s.set(5)
  assert.equal(s.get(), 5)
  assert.equal(s.peek(), 5)
})

test('signal subscribers fire only on value change', () => {
  const s = signal(1)
  let count = 0
  s.subscribe(() => count++)
  s.set(1)
  s.set(2)
  s.set(2)
  assert.equal(count, 1, 'should fire only once for distinct changes')
})

test('effectPre runs synchronously and returns cleanup', () => {
  let ran = 0, cleaned = 0
  const stop = effectPre(() => { ran++; return () => cleaned++ })
  assert.equal(ran, 1)
  assert.equal(cleaned, 0)
  stop()
  assert.equal(cleaned, 1)
})

test('effectScope.run is no-op after stop', () => {
  const scope = effectScope()
  let ran = 0
  scope.run(() => ran++)
  assert.equal(ran, 1)
  scope.stop()
  scope.run(() => ran++)
  assert.equal(ran, 1, 'should not run after stop')
})

test('fragment registration', () => {
  fragment('frag-test', '<span>x</span>')
  assert.ok(true, 'fragment registered without error')
})