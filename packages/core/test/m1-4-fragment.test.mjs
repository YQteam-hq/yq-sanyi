import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fragment, parseTemplate } from '../dist/core.mjs'

test('fragment id validation rejects bad identifiers', () => {
  assert.throws(() => fragment('Bad', '<div></div>'), /valid identifier/)
  assert.throws(() => fragment('no_underscore', '<div></div>'), /valid identifier/)
  assert.throws(() => fragment('1-bad', '<div></div>'), /valid identifier/)
})

test('fragment() registers a reusable template', () => {
  fragment('frag-card', '<span class="card">card content</span>')
})

test('parser expands <template id="x"> references at parse time', () => {
  fragment('frag-button', '<button>click</button>')
  const r = parseTemplate('test', '<div><template id="frag-button"></template></div>')
  const tags = r.nodes.map((n) => n.tag)
  assert.ok(tags.includes('button'), 'fragment should be inlined; tags=' + tags.join(','))
})

test('parser throws on unregistered fragment id', () => {
  assert.throws(() => parseTemplate('test', '<div><template id="frag-unknown"></template></div>'), /fragment not registered/)
})

test('nested fragment references expand recursively', () => {
  fragment('frag-outer', '<template id="frag-inner"></template>')
  fragment('frag-inner', '<i>in</i>')
  const r = parseTemplate('test', '<div><template id="frag-outer"></template></div>')
  const tags = r.nodes.map((n) => n.tag)
  assert.ok(tags.includes('i'), 'recursive expansion should reach inner; tags=' + tags.join(','))
})
