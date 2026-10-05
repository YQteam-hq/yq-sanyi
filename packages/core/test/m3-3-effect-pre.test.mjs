import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effectPre, effectScope } from '../dist/core.mjs'

test('effectPre runs synchronously and returns cleanup', () => {
  let ran = 0, cleaned = 0
  const stop = effectPre(() => {
    ran++
    return () => { cleaned++ }
  })
  assert.equal(ran, 1)
  assert.equal(cleaned, 0)
  stop()
  assert.equal(cleaned, 1)
})

test('effectPre cleanup optional', () => {
  let ran = 0
  const stop = effectPre(() => { ran++ })
  assert.equal(ran, 1)
  assert.equal(typeof stop, 'function')
  stop()
})

test('effectScope.run executes the function while active', () => {
  const scope = effectScope()
  let ran = 0
  scope.run(() => { ran++ })
  assert.equal(ran, 1)
})

test('effectScope.run is a no-op after stop', () => {
  const scope = effectScope()
  let ran = 0
  scope.stop()
  scope.run(() => { ran++ })
  assert.equal(ran, 0)
})

test('effectScope.stop is idempotent', () => {
  const scope = effectScope()
  scope.stop()
  scope.stop()
})
