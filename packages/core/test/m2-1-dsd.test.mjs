import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTemplateDSD } from '../dist/core.mjs'

test('parseTemplateDSD detects open mode and extracts content', () => {
  const r = parseTemplateDSD('<template shadowrootmode="open"><div class="shadow">shadow content</div></template>')
  assert.equal(r.mode, 'open')
  assert.ok(r.content.includes('shadow content'))
  assert.ok(r.content.includes('class="shadow"'))
})

test('parseTemplateDSD detects closed mode', () => {
  const r = parseTemplateDSD('<template shadowrootmode="closed"><span>x</span></template>')
  assert.equal(r.mode, 'closed')
  assert.ok(r.content.includes('<span>x</span>'))
})

test('parseTemplateDSD returns null mode when no template element', () => {
  const r = parseTemplateDSD('<div>regular content</div>')
  assert.equal(r.mode, null)
  assert.equal(r.content, '')
})

test('parseTemplateDSD returns null mode when template lacks shadowrootmode', () => {
  const r = parseTemplateDSD('<template><div>no mode</div></template>')
  assert.equal(r.mode, null)
})

test('parseTemplateDSD rejects invalid mode values', () => {
  const r = parseTemplateDSD('<template shadowrootmode="invalid"><div>x</div></template>')
  assert.equal(r.mode, null)
})
