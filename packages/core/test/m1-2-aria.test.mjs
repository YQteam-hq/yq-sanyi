import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTemplate } from '../dist/core.mjs'

test('aria-label with bound path produces an attr slot', () => {
  const r = parseTemplate('test', '<button aria-label="{{ name }}">x</button>')
  const attrSlot = r.slots.find((s) => s.kind === 'attr')
  assert.ok(attrSlot, 'aria-label should be a dynamic attr slot')
  assert.equal(attrSlot.attr, 'aria-label')
})

test('multiple aria-* attrs each produce their own slot', () => {
  const r = parseTemplate('test', '<div aria-label="{{ name }}" aria-hidden="{{ hidden }}"></div>')
  const attrSlots = r.slots.filter((s) => s.kind === 'attr')
  assert.equal(attrSlots.length, 2)
  const names = attrSlots.map((s) => s.attr).sort()
  assert.deepEqual(names, ['aria-hidden', 'aria-label'])
})

test('static aria-* value parses cleanly', () => {
  const r = parseTemplate('test', '<div aria-label="close"></div>')
  assert.equal(r.root.staticAttrs['aria-label'], 'close')
})
