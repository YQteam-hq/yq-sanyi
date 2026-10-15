import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoper } from '../dist/core.mjs'

const { generateScopedCSS } = scoper

const ATTR = '[data-yq-scope="s"]'

function scoped(css) {
  return generateScopedCSS(css, 's')
}

test('every selector of a comma separated list receives the scope attribute', () => {
  const out = scoped('h1, h2, h3 { color: red }')
  assert.ok(out.includes('h1' + ATTR))
  assert.ok(out.includes('h2' + ATTR))
  assert.ok(out.includes('h3' + ATTR))
})

test('a pseudo-class is scoped on the compound it extends', () => {
  const out = scoped('button:hover { color: red }')
  assert.ok(out.includes('button' + ATTR + ':hover'))
})

test('a pseudo-element is scoped on the compound it extends', () => {
  const out = scoped('a::after { content: "x" }')
  assert.ok(out.includes('a' + ATTR + '::after'))
})

test('a pseudo-class on a descendant scopes the last compound only', () => {
  const out = scoped('.panel:hover .title, .card .body:focus { color: red }')
  assert.ok(out.includes('.panel:hover .title' + ATTR))
  assert.ok(out.includes('.card .body' + ATTR + ':focus'))
})

test('a pseudo-class inside a functional selector keeps its argument untouched', () => {
  const out = scoped('input:not([disabled]) { color: red }')
  assert.ok(out.includes('input' + ATTR + ':not([disabled])'))
})

test('the scope attribute lands on the subject compound of a combinator chain', () => {
  const out = scoped('ul > li:hover + li::before { color: red }')
  assert.ok(out.includes('ul > li:hover + li' + ATTR + '::before'))
})

test('an unspaced combinator is handled like a spaced one', () => {
  const out = scoped('ul>li:hover { color: red } li+.item { color: blue }')
  assert.ok(out.includes('ul>li' + ATTR + ':hover'))
  assert.ok(out.includes('li+.item' + ATTR))
})

test('keyframes are left verbatim', () => {
  const css = '@keyframes spin { from { opacity: 0 } to { opacity: 1 } }'
  assert.strictEqual(scoped(css), css)
})

test('font-face is left verbatim', () => {
  const css = '@font-face { font-family: X; src: url(x.woff2); }'
  assert.strictEqual(scoped(css), css)
})

test('rules inside a media query are scoped', () => {
  const out = scoped('@media (min-width: 600px) { .box { color: red } .box:hover { color: blue } }')
  assert.ok(out.includes('@media (min-width: 600px)'))
  assert.ok(out.includes('.box' + ATTR + '{'))
  assert.ok(out.includes('.box' + ATTR + ':hover'))
})

test('nested conditional groups keep scoping at every depth', () => {
  const out = scoped('@media screen { @supports (display: grid) { .grid { display: grid } } }')
  assert.ok(out.includes('.grid' + ATTR))
})

test('a star selector is never scoped', () => {
  const out = scoped('* { margin: 0 } .local { padding: 0 }')
  assert.ok(out.includes('* { margin: 0 }'))
  assert.ok(out.includes('.local' + ATTR))
})

test('declaration values are untouched', () => {
  const out = scoped('.x { transition: color .2s, opacity .2s; font-family: a, b }')
  assert.ok(out.includes('transition: color .2s, opacity .2s'))
  assert.ok(out.includes('font-family: a, b'))
})

test('an unterminated block preserves the trailing text', () => {
  const out = scoped('.a { color: red')
  assert.ok(out.includes('.a' + ATTR + '{ color: red'))
})

test('empty and whitespace-only style strings stay empty', () => {
  assert.strictEqual(scoped(''), '')
  assert.strictEqual(scoped('   \n  '), '')
})

test('the scope attribute survives a real component style', () => {
  const out = scoped('.panel { border: 1px solid } .panel:hover { border-color: red } .panel .hint::before { content: "!" }')
  assert.ok(out.includes('.panel' + ATTR))
  assert.ok(out.includes('.panel' + ATTR + ':hover'))
  assert.ok(out.includes('.hint' + ATTR + '::before'))
})
