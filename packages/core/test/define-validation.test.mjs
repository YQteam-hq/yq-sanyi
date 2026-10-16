import { test } from 'node:test'
import assert from 'node:assert/strict'
import { define, lookup } from '../dist/core.mjs'

function placeholderDef(name) {
  return { name, template: '<div></div>', style: '', script: null }
}

test('define rejects an uppercase tag name', () => {
  assert.throws(
    () => define('MyComponent', placeholderDef('MyComponent')),
    /valid custom element tag name/,
    'uppercase names are not valid custom element tags'
  )
})

test('define rejects a tag name without a hyphen', () => {
  assert.throws(
    () => define('plainname', placeholderDef('plainname')),
    /valid custom element tag name/,
    'custom element names must contain a hyphen'
  )
})

test('define rejects a reserved custom element name', () => {
  assert.throws(
    () => define('font-face', placeholderDef('font-face')),
    /valid custom element tag name/,
    'reserved element names must be rejected'
  )
})

test('define accepts a valid lowercase hyphenated name', () => {
  define('valid-comp-xyz', placeholderDef('valid-comp-xyz'))
  const result = lookup('valid-comp-xyz')
  assert.ok(result, 'valid name is registered')
  assert.equal(result.name, 'valid-comp-xyz')
})
