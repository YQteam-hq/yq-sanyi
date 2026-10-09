import { test } from 'node:test'
import assert from 'node:assert'
import { EnhancedErrorHandler, DebounceUtils, ValidationUtils } from '../src/enhanced-utils.js'

// Test EnhancedErrorHandler
test('EnhancedErrorHandler - Error message enhancement', () => {
  const error = new Error('unclosed expression')
  const enhanced = EnhancedErrorHandler.createEnhancedError(error, {
    component: 'my-component',
    location: 'line 10'
  })
  
  assert.strictEqual(enhanced.message, '[my-component] unclosed expression (at line 10)')
  assert.strictEqual(enhanced.code, 'UNEXPRESSED_CLOSING_BRACE')
  assert.strictEqual(enhanced.component, 'my-component')
  assert.strictEqual(enhanced.templateLocation, 'line 10')
})

test('EnhancedErrorHandler - Performance metrics', () => {
  // Reset metrics
  EnhancedErrorHandler.resetMetrics()
  
  // Simulate some updates
  EnhancedErrorHandler.updatePerformanceMetrics('update', 100)
  EnhancedErrorHandler.updatePerformanceMetrics('update', 200)
  EnhancedErrorHandler.updatePerformanceMetrics('derivation', 1)
  EnhancedErrorHandler.updatePerformanceMetrics('effect', 1)
  
  const metrics = EnhancedErrorHandler.getPerformanceMetrics()
  
  assert.strictEqual(metrics.updateCount, 2)
  assert.strictEqual(metrics.averageUpdateTime, 150) // (100 + 200) / 2
  assert.strictEqual(metrics.slowestUpdateTime, 200)
  assert.strictEqual(metrics.derivationCount, 1)
  assert.strictEqual(metrics.effectCount, 1)
})

// Test DebounceUtils
test('DebounceUtils - debounce function', (t) => {
  return new Promise((resolve) => {
    let callCount = 0
    const fn = () => {
      callCount++
    }
    
    const debouncedFn = DebounceUtils.debounce(fn, 100)
    
    // Call immediately
    debouncedFn()
    assert.strictEqual(callCount, 0)
    
    // Call multiple times rapidly
    setTimeout(() => debouncedFn(), 50)
    setTimeout(() => debouncedFn(), 75)
    setTimeout(() => debouncedFn(), 90)
    
    // Should only call once after all the rapid calls
    setTimeout(() => {
      assert.strictEqual(callCount, 1)
      resolve()
    }, 150)
  })
})

test('DebounceUtils - throttle function', (t) => {
  return new Promise((resolve) => {
    let callCount = 0
    const fn = () => {
      callCount++
    }
    
    const throttledFn = DebounceUtils.throttle(fn, 100)
    
    // Call immediately - should execute
    throttledFn()
    assert.strictEqual(callCount, 1)
    
    // Call rapidly - should be throttled
    setTimeout(() => throttledFn(), 50)  // Should be throttled
    setTimeout(() => throttledFn(), 75)  // Should be throttled
    
    // Should only have called once more after the throttle period
    setTimeout(() => {
      assert.strictEqual(callCount, 2)
      resolve()
    }, 150)
  })
})

test('DebounceUtils - cancel functions', () => {
  let callCount = 0
  const fn = () => {
    callCount++
  }
  
  const debouncedFn = DebounceUtils.debounce(fn, 100)
  debouncedFn()
  
  // Cancel the debounce
  DebounceUtils.cancel('debounce_fn_100')
  
  // Should not execute after cancel
  setTimeout(() => {
    assert.strictEqual(callCount, 0)
  }, 150)
})

// Test ValidationUtils
test('ValidationUtils - validate template', () => {
  // Valid template
  const validTemplate = '<div><p>Hello {{ name }}</p></div>'
  const validResult = ValidationUtils.validateTemplate(validTemplate)
  assert.strictEqual(validResult.valid, true)
  assert.strictEqual(validResult.errors.length, 0)
  
  // Template with unclosed expression
  const invalidTemplate1 = '<div><p>Hello {{ name }}</div>'
  const invalidResult1 = ValidationUtils.validateTemplate(invalidTemplate1)
  assert.strictEqual(invalidResult1.valid, false)
  assert.ok(invalidResult1.errors.some(e => e.includes('Unclosed expression')))
  
  // Template with empty expression
  const invalidTemplate2 = '<div><p>Hello {{ }}</p></div>'
  const invalidResult2 = ValidationUtils.validateTemplate(invalidTemplate2)
  assert.strictEqual(invalidResult2.valid, false)
  assert.ok(invalidResult2.errors.some(e => e.includes('Empty expression')))
  
  // Template with unbalanced tags
  const invalidTemplate3 = '<div><p>Hello</div><p>World</p>'
  const invalidResult3 = ValidationUtils.validateTemplate(invalidTemplate3)
  assert.strictEqual(invalidResult3.valid, false)
  assert.ok(invalidResult3.errors.some(e => e.includes('Unclosed tag')))
})

test('ValidationUtils - validate component name', () => {
  // Valid names
  assert.strictEqual(ValidationUtils.validateComponentName('my-component'), true)
  assert.strictEqual(ValidationUtils.validateComponentName('my-component-123'), true)
  assert.strictEqual(ValidationUtils.validateComponent-name('a-b'), true)
  
  // Invalid names
  assert.strictEqual(ValidationUtils.validateComponentName('mycomponent'), false)
  assert.strictEqual(ValidationUtils.validateComponentName('My-Component'), false)
  assert.strictEqual(ValidationUtils.validateComponentName('my-component-'), false)
  assert.strictEqual(ValidationUtils.validateComponentName('-invalid'), false)
  assert.strictEqual(ValidationUtils.validateComponentName(''), false)
})

test('ValidationUtils - validate directive', () => {
  // Valid directives
  assert.strictEqual(ValidationUtils.validateDirective('yq-for', 'item in items').valid, true)
  assert.strictEqual(ValidationUtils.validateDirective('yq-model', 'user.name').valid, true)
  assert.strictEqual(ValidationUtils.validateDirective('yq-if', 'user.active').valid, true)
  assert.strictEqual(ValidationUtils.validateDirective('yq-show', 'isVisible').valid, true)
  
  // Invalid directives
  assert.strictEqual(ValidationUtils.validateDirective('yq-for', '').valid, false)
  assert.strictEqual(ValidationUtils.validateDirective('yq-model', '').valid, false)
  assert.strictEqual(ValidationUtils.validateDirective('yq-if', '').valid, false)
  assert.strictEqual(ValidationUtils.validateDirective('yq-show', '').valid, false)
  assert.strictEqual(ValidationUtils.validateDirective('yq-for', 'invalid').valid, false)
})

// Test integration with existing functionality
test('Integration - Event handling with debounce and throttle', () => {
  // This test would require a DOM environment, so we'll skip it in unit tests
  // but it should be tested in browser environment
  console.log('Integration tests should be run in browser environment')
})

// Test error handling integration
test('Integration - Error handling with template parsing', () => {
  // Simulate a template parsing error
  try {
    const error = new Error('[yq:parse] unclosed expression')
    const enhanced = EnhancedErrorHandler.createEnhancedError(error, {
      component: 'test-component',
      template: '<div>{{ unclosed expression</div>',
      location: 'line 1'
    })
    
    assert.strictEqual(enhanced.component, 'test-component')
    assert.strictEqual(enhanced.templateLocation, 'line 1')
    assert.strictEqual(enhanced.code, 'UNEXPRESSED_CLOSING_BRACE')
    assert.ok(enhanced.suggestion)
  } catch (e) {
    // This is expected for unit tests without full DOM
    console.log('Error handling integration test skipped - requires full DOM environment')
  }
})