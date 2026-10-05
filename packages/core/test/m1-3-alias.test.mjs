import { test } from 'node:test'
import assert from 'node:assert/strict'
import { define, defineAlias, lookup } from '../dist/core.mjs'

test('defineAlias resolves to real name on lookup', () => {
  define('yq-alias-target-1', { template: '<span>1</span>', style: '', script: () => ({}) })
  defineAlias('alias-tag-1', 'yq-alias-target-1')
  const entry = lookup('alias-tag-1')
  assert.ok(entry, 'lookup should resolve alias')
  assert.equal(entry.name, 'yq-alias-target-1')
})

test('defineAlias throws on invalid display name', () => {
  define('yq-alias-target-2', { template: '<span>2</span>', style: '', script: () => ({}) })
  assert.throws(() => defineAlias('BadName', 'yq-alias-target-2'), /valid custom element name/)
})

test('defineAlias throws on undefined real name', () => {
  assert.throws(() => defineAlias('good-name-x', 'yq-nonexistent-target'), /not defined/)
})

test('defineAlias throws on duplicate alias', () => {
  define('yq-alias-target-3', { template: '<span>3</span>', style: '', script: () => ({}) })
  defineAlias('alias-tag-3', 'yq-alias-target-3')
  assert.throws(() => defineAlias('alias-tag-3', 'yq-alias-target-3'), /already registered/)
})

test('non-aliased name still resolves directly', () => {
  define('yq-alias-target-4', { template: '<span>4</span>', style: '', script: () => ({}) })
  const entry = lookup('yq-alias-target-4')
  assert.ok(entry)
  assert.equal(entry.name, 'yq-alias-target-4')
})
