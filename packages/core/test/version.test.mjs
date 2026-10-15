import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { version } from '../dist/core.mjs'

const manifest = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'))

test('the runtime version matches the monorepo version', () => {
  assert.strictEqual(version, manifest.version)
})

test('the runtime version is a semantic version', () => {
  assert.match(version, /^\d+\.\d+\.\d+$/)
})

test('every package declares the monorepo version', () => {
  const names = ['cli', 'core', 'devtools', 'scoper', 'wrappers']
  for (const name of names) {
    const pkg = JSON.parse(readFileSync(new URL('../../../packages/' + name + '/package.json', import.meta.url), 'utf8'))
    assert.strictEqual(pkg.version, manifest.version, 'packages/' + name + ' is out of sync')
  }
})
