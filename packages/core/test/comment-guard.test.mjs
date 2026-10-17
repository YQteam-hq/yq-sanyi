import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { maskStrings, tokenHits, violations } from '../../../scripts/check-no-comments.mjs'

const metaUrl = import.meta.url

function lineComments(source) {
  return tokenHits(maskStrings(source), false).filter((hit) => hit.kind.indexOf('line') === 0)
}

function hasLineComment(source) {
  return lineComments(source).length > 0
}

test('maskStrings keeps one masked character per source character', () => {
  const source = 'const re = /["a-z]+/\nconst value = "http://host"\n'
  assert.strictEqual(maskStrings(source).length, source.length)
})

test('maskStrings does not let a quote inside a regex literal swallow the rest of the file', () => {
  const source = 'const pattern = /["a-z]+/\n// note after an unbalanced regex quote\nconst next = 1\n'
  const masked = maskStrings(source)
  assert.ok(masked.indexOf('const next = 1') > -1, 'code after the regex must stay visible')
  assert.ok(masked.indexOf('// note after an unbalanced regex quote') > -1)
  assert.ok(hasLineComment(source))
})

test('maskStrings still hides comment tokens written inside strings', () => {
  assert.ok(!hasLineComment('const url = "http://host"'))
  assert.ok(!hasLineComment("const url = 'http://host'"))
  assert.ok(!hasLineComment('const url = `http://host`'))
})

test('maskStrings hides comment tokens inside a multiline template literal', () => {
  const source = 'const html = `\n<div>\n<!-- not a real comment -->\n</div>\n`\nconst next = 1\n'
  assert.ok(!hasLineComment(source))
})

test('maskStrings keeps real code after a template interpolation visible', () => {
  const source = 'const label = `value ${items.join("/")}`\n// note after a template\n'
  assert.ok(hasLineComment(source))
})

test('maskStrings treats a slash after an identifier as division, not a regex', () => {
  const source = 'const ratio = total / count\n// note after a division\n'
  assert.ok(hasLineComment(source))
})

test('the guard reports no comment anywhere in the repository', () => {
  assert.deepEqual(violations, [])
})

test('maskStrings follows a template literal nested inside an interpolation', () => {
  const source = 'const label = `a ${ `b ${deep}` } c`\n// note after nested templates\n'
  const masked = maskStrings(source)
  assert.strictEqual(masked.length, source.length)
  assert.ok(masked.indexOf('// note after nested templates') > -1)
  assert.ok(hasLineComment(source))
})

test('maskStrings closes navigation across an interpolation holding an object literal', () => {
  const source = 'const text = `${value}`\nconst other = x / y\n// note after both\n'
  assert.ok(hasLineComment(source))
  assert.ok(!hasLineComment('const text = `${value}`'))
})

test('maskStrings leaves most of a real source file readable', () => {
  const source = readFileSync(new URL('../src/index.ts', metaUrl), 'utf8')
  const masked = maskStrings(source)
  const blanked = masked.split('').filter((c) => c === ' ').length / masked.length
  assert.ok(blanked < 0.5, 'a source file should not be mostly masked, got ' + (blanked * 100).toFixed(1) + '%')
})

test('maskStrings replaces each masked character with a space of equal length', () => {
  const source = 'const a = "xyz"'
  const masked = maskStrings(source)
  assert.strictEqual(masked.length, source.length)
  assert.strictEqual(masked, 'const a = "   "')
  assert.strictEqual(masked.indexOf('xyz'), -1, 'the string body should be blanked')
})
