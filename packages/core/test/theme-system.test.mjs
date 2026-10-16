
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoper } from '../dist/core.mjs'

const cssVariableCalls = []
const removedVariables = []
const mockDocument = {
  createElement: (tagName) => ({
    tagName,
    textContent: '',
    setAttribute: (key, value) => {},
    remove: () => {}
  }),
  head: {
    appendChild: (element) => {}
  },
  documentElement: {
    style: {
      setProperty: (key, value) => {
        cssVariableCalls.push([key, value])
        const at = removedVariables.indexOf(key)
        if (at > -1) removedVariables.splice(at, 1)
      },
      removeProperty: (key) => {
        removedVariables.push(key)
      }
    }
  }
}

global.document = mockDocument

const customTheme = {
  'primary-color': '#ff6b6b',
  'secondary-color': '#4ecdc4',
  'background-color': '#f8f9fa'
}

const partialTheme = {
  'primary-color': '#45b7d1',
  'text-color': '#2d3436'
}

test('updateTheme 更新主题变量', () => {
  scoper.updateTheme(customTheme)
  assert.ok(cssVariableCalls.some(([key, value]) => key === '--yq-primary-color' && value === '#ff6b6b'))
  assert.ok(cssVariableCalls.some(([key, value]) => key === '--yq-secondary-color' && value === '#4ecdc4'))
})

test('getThemeVariables 返回当前主题变量', () => {
  const currentTheme = scoper.getThemeVariables()
  assert.strictEqual(currentTheme['primary-color'], '#ff6b6b')
  assert.strictEqual(currentTheme['secondary-color'], '#4ecdc4')
  assert.strictEqual(currentTheme['background-color'], '#f8f9fa')
})

test('resetTheme 恢复默认主题', () => {
  scoper.resetTheme()
  const defaultTheme = scoper.getThemeVariables()
  assert.strictEqual(defaultTheme['primary-color'], '#3b82f6')
  assert.strictEqual(defaultTheme['secondary-color'], '#6b7280')
})

test('updateTheme 部分更新保留其余变量', () => {
  scoper.updateTheme(partialTheme)
  const updatedTheme = scoper.getThemeVariables()
  assert.strictEqual(updatedTheme['primary-color'], '#45b7d1')
  assert.strictEqual(updatedTheme['text-color'], '#2d3436')
  assert.strictEqual(updatedTheme['secondary-color'], '#6b7280')
})

test('resetTheme clears a custom property the caller introduced', () => {
  scoper.updateTheme({ 'accent-tint': '#abcdef' })
  assert.ok(cssVariableCalls.some(([key, value]) => key === '--yq-accent-tint' && value === '#abcdef'))
  scoper.resetTheme()
  assert.ok(removedVariables.includes('--yq-accent-tint'), 'a custom property must leave the document root on reset')
  assert.strictEqual(scoper.getThemeVariables()['accent-tint'], undefined)
})

test('resetTheme keeps the built in properties on the document root', () => {
  scoper.resetTheme()
  assert.strictEqual(scoper.getThemeVariables()['primary-color'], '#3b82f6')
  assert.ok(cssVariableCalls.some(([key, value]) => key === '--yq-primary-color' && value === '#3b82f6'))
  assert.ok(!removedVariables.includes('--yq-primary-color'))
})

test('resetTheme leaves the registry and the document root in agreement', () => {
  scoper.updateTheme({ 'shadow-color': 'rgba(0, 0, 0, 0.5)', 'gap-scale': '1.5' })
  scoper.resetTheme()
  const registry = scoper.getThemeVariables()
  for (const key of Object.keys(registry)) {
    assert.ok(!removedVariables.includes('--yq-' + key), 'default ' + key + ' should still be on the root')
  }
  assert.ok(removedVariables.includes('--yq-gap-scale'))
})
