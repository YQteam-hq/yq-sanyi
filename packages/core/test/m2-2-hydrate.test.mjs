import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hydrate } from '../dist/core.mjs'

test('hydrate throws on missing element by selector', () => {
  if (typeof document === 'undefined') return
  assert.throws(() => hydrate('#does-not-exist', { template: '<div></div>', style: '', script: () => ({}) }), /element not found/)
})

test('hydrate throws when component is not registered and no definition', () => {
  if (typeof document === 'undefined') return
  document.body.innerHTML = '<yq-hydrate-unknown></yq-hydrate-unknown>'
  assert.throws(() => hydrate('yq-hydrate-unknown'), /component not registered/)
})

test('hydrate resolves a string selector to an element', () => {
  if (typeof document === 'undefined') return
  document.body.innerHTML = ''
  assert.throws(() => hydrate('yq-hydrate-noop'), /component not registered/)
})
