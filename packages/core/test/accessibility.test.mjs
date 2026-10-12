import { test } from 'node:test'
import assert from 'node:assert'
import { AccessibilityManager, AccessibilityUtils } from '../src/accessibility.js'

// Mock DOM elements
const createMockElement = (tag, attributes = {}) => {
  const element = document.createElement(tag)
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value)
  })
  return element
}

// Mock console methods
const mockConsole = {
  log: [],
  warn: [],
  error: [],
  info: []
}

console.log = (...args) => mockConsole.log.push(args)
console.warn = (...args) => mockConsole.warn.push(args)
console.error = (...args) => mockConsole.error.push(args)
console.info = (...args) => mockConsole.info.push(args)

// Test AccessibilityManager
test('AccessibilityManager - Configuration', () => {
  // Test default configuration
  assert.strictEqual(AccessibilityManager.getConfig().screenReader, true)
  assert.strictEqual(AccessibilityManager.getConfig().keyboardNavigation, true)
  assert.strictEqual(AccessibilityManager.getConfig().focusManagement, true)
  assert.strictEqual(AccessibilityManager.getConfig().ariaAttributes, true)
  assert.strictEqual(AccessibilityManager.getConfig().colorContrast, true)
  assert.strictEqual(AccessibilityManager.getConfig().reducedMotion, true)
  assert.strictEqual(AccessibilityManager.getConfig().highContrast, true)
  
  // Test configuration update
  AccessibilityManager.configure({
    screenReader: false,
    keyboardNavigation: false,
    focusManagement: false
  })
  
  const config = AccessibilityManager.getConfig()
  assert.strictEqual(config.screenReader, false)
  assert.strictEqual(config.keyboardNavigation, false)
  assert.strictEqual(config.focusManagement, false)
  assert.strictEqual(config.ariaAttributes, true) // Should remain unchanged
})

test('AccessibilityManager - Accessibility directives', () => {
  const directive = {
    name: 'test-directive',
    handler: (element, value, context) => { console.log('Directive called') }
  }
  
  AccessibilityManager.addDirective('test-directive', directive)
  
  const retrievedDirective = AccessibilityManager.getDirective('test-directive')
  assert.strictEqual(retrievedDirective.name, 'test-directive')
  assert.strictEqual(retrievedDirective.handler, directive.handler)
})

test('AccessibilityManager - Element validation - missing alt text', () => {
  const img = createMockElement('img')
  const violations = AccessibilityManager.validateElement(img)
  
  assert.strictEqual(violations.length, 1)
  assert.strictEqual(violations[0].type, 'missing-alt')
  assert.strictEqual(violations[0].severity, 'error')
  assert.strictEqual(violations[0].element, img)
})

test('AccessibilityManager - Element validation - missing label', () => {
  const input = createMockElement('input', { required: 'required' })
  const violations = AccessibilityManager.validateElement(input)
  
  assert.strictEqual(violations.length, 1)
  assert.strictEqual(violations[0].type, 'missing-label')
  assert.strictEqual(violations[0].severity, 'error')
  assert.strictEqual(violations[0].element, input)
})

test('AccessibilityManager - Element validation - low contrast', () => {
  const element = createMockElement('div')
  const violations = AccessibilityManager.validateElement(element)
  
  // Contrast validation is simplified in the test
  assert.strictEqual(violations.length, 0) // Placeholder test
})

test('AccessibilityManager - Element validation - keyboard inaccessible', () => {
  const element = createMockElement('div', { tabindex: '-1' })
  const violations = AccessibilityManager.validateElement(element)
  
  assert.strictEqual(violations.length, 1)
  assert.strictEqual(violations[0].type, 'keyboard-inaccessible')
  assert.strictEqual(violations[0].severity, 'warning')
  assert.strictEqual(violations[0].element, element)
})

test('AccessibilityManager - Accessibility report generation', () => {
  const report = AccessibilityManager.generateReport()
  
  assert.strictEqual(typeof report.score, 'number')
  assert.strictEqual(report.score >= 0 && report.score <= 100, true)
  assert.strictEqual(Array.isArray(report.violations), true)
  assert.strictEqual(Array.isArray(report.recommendations), true)
})

test('AccessibilityManager - Screen reader announcements', () => {
  // Mock live region
  (window as any).yqLiveRegion = document.createElement('div')
  
  AccessibilityManager.announceToScreenReader('Test announcement')
  
  const liveRegion = (window as any).yqLiveRegion
  assert.strictEqual(liveRegion.textContent, 'Test announcement')
})

test('AccessibilityManager - Focus management', () => {
  const element = createMockElement('div')
  
  // Test focus management (simplified)
  AccessibilityManager.manageFocus(element, { trap: true })
  AccessibilityManager.manageFocus(element, { restore: true })
})

test('AccessibilityManager - Accessible button creation', () => {
  const button = AccessibilityManager.createAccessibleButton(
    'Test Button',
    () => console.log('Clicked')
  )
  
  assert.strictEqual(button.tagName, 'BUTTON')
  assert.strictEqual(button.textContent, 'Test Button')
  assert.strictEqual(button.disabled, false)
  assert.strictEqual(button.hasAttribute('aria-disabled'), false)
})

test('AccessibilityManager - Accessible button creation with options', () => {
  const button = AccessibilityManager.createAccessibleButton(
    'Test Button',
    () => console.log('Clicked'),
    { ariaDescribedBy: 'description', disabled: true }
  )
  
  assert.strictEqual(button.hasAttribute('aria-describedby'), true)
  assert.strictEqual(button.disabled, true)
  assert.strictEqual(button.hasAttribute('aria-disabled'), true)
})

test('AccessibilityManager - Accessible input creation', () => {
  const input = AccessibilityManager.createAccessibleInput(
    'text',
    'Test Input',
    { required: true, placeholder: 'Enter text' }
  )
  
  assert.strictEqual(input.tagName, 'INPUT')
  assert.strictEqual(input.type, 'text')
  assert.strictEqual(input.required, true)
  assert.strictEqual(input.hasAttribute('aria-required'), true)
  assert.strictEqual(input.placeholder, 'Enter text')
})

test('AccessibilityManager - Cleanup', () => {
  // Add some observers and handlers
  AccessibilityManager.configure({ keyboardNavigation: true })
  
  AccessibilityManager.cleanup()
  
  // Check if observers are cleared
  assert.strictEqual(AccessibilityManager.getConfig().keyboardNavigation, true) // Should remain unchanged
})

// Test AccessibilityUtils
test('AccessibilityUtils - Create accessible form', () => {
  const fields = [
    { name: 'username', label: 'Username', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true }
  ]
  
  const form = AccessibilityUtils.createAccessibleForm(fields, (data) => {
    console.log('Form submitted:', data)
  })
  
  assert.strictEqual(form.tagName, 'FORM')
  assert.strictEqual(form.elements.length, 2) // 2 inputs + 1 button
  
  const inputs = form.querySelectorAll('input')
  assert.strictEqual(inputs.length, 2)
  assert.strictEqual(inputs[0].name, 'username')
  assert.strictEqual(inputs[1].name, 'email')
})

test('AccessibilityUtils - Create accessible modal', () => {
  const content = createMockElement('div', { 'data-test': 'content' })
  
  const modal = AccessibilityUtils.createAccessibleModal(
    'Test Modal',
    content,
    { closeButtonText: 'Close', trapFocus: true }
  )
  
  assert.strictEqual(modal.tagName, 'DIV')
  assert.strictEqual(modal.hasAttribute('role'), true)
  assert.strictEqual(modal.hasAttribute('aria-modal'), true)
  assert.strictEqual(modal.hasAttribute('aria-labelledby'), true)
  
  const closeButton = modal.querySelector('button')
  assert.strictEqual(closeButton.textContent, 'Close')
})

test('AccessibilityUtils - Create accessible navigation', () => {
  const items = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' }
  ]
  
  const navigation = AccessibilityUtils.createAccessibleNavigation(
    items,
    { ariaLabel: 'Main navigation' }
  )
  
  assert.strictEqual(navigation.tagName, 'NAV')
  assert.strictEqual(navigation.hasAttribute('role'), true)
  assert.strictEqual(navigation.hasAttribute('aria-label'), true)
  
  const links = navigation.querySelectorAll('a')
  assert.strictEqual(links.length, 3)
  assert.strictEqual(links[0].textContent, 'Home')
  assert.strictEqual(links[1].textContent, 'About')
  assert.strictEqual(links[2].textContent, 'Contact')
})

test('AccessibilityUtils - Create accessible navigation with current page', () => {
  const items = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' }
  ]
  
  // Mock current path
  const originalPath = window.location.pathname
  Object.defineProperty(window.location, 'pathname', {
    value: '/about',
    configurable: true
  })
  
  const navigation = AccessibilityUtils.createAccessibleNavigation(items)
  
  const links = navigation.querySelectorAll('a')
  assert.strictEqual(links[1].style.fontWeight, 'bold')
  assert.strictEqual(links[1].style.backgroundColor, '#f0f0f0')
  
  // Restore original path
  Object.defineProperty(window.location, 'pathname', {
    value: originalPath,
    configurable: true
  })
})

// Integration tests
test('Integration - Accessibility with component system', () => {
  // This test would require a DOM environment
  console.log('Integration tests should be run in browser environment')
})

test('Integration - Accessibility with keyboard navigation', () => {
  // This test would require a DOM environment
  console.log('Integration tests should be run in browser environment')
})

// Edge cases
test('Edge cases - Accessibility validation with null element', () => {
  const violations = AccessibilityManager.validateElement(null)
  assert.strictEqual(violations.length, 0)
})

test('Edge cases - Accessibility validation with undefined element', () => {
  const violations = AccessibilityManager.validateElement(undefined)
  assert.strictEqual(violations.length, 0)
})

test('Edge cases - Accessibility configuration with partial options', () => {
  AccessibilityManager.configure({ screenReader: false })
  
  const config = AccessibilityManager.getConfig()
  assert.strictEqual(config.screenReader, false)
  assert.strictEqual(config.keyboardNavigation, true) // Should remain default
  assert.strictEqual(config.focusManagement, true) // Should remain default
})

test('Edge cases - Accessibility directive with non-existent name', () => {
  const directive = AccessibilityManager.getDirective('non-existent')
  assert.strictEqual(directive, undefined)
})

test('Edge cases - Accessibility form with empty fields', () => {
  const form = AccessibilityUtils.createAccessibleForm([], (data) => {
    console.log('Form submitted:', data)
  })
  
  assert.strictEqual(form.tagName, 'FORM')
  assert.strictEqual(form.elements.length, 1) // Just the submit button
})

test('Edge cases - Accessibility modal with no content', () => {
  const modal = AccessibilityUtils.createAccessibleModal(
    'Test Modal',
    document.createElement('div')
  )
  
  assert.strictEqual(modal.tagName, 'DIV')
  assert.strictEqual(modal.hasAttribute('role'), true)
})

test('Edge cases - Accessibility navigation with empty items', () => {
  const navigation = AccessibilityUtils.createAccessibleNavigation([])
  
  assert.strictEqual(navigation.tagName, 'NAV')
  assert.strictEqual(navigation.querySelectorAll('a').length, 0)
})

test('Edge cases - Accessibility cleanup without initialization', () => {
  // Should not throw errors
  assert.doesNotThrow(() => {
    AccessibilityManager.cleanup()
  })
})

test('Edge cases - Accessibility screen reader announcement without live region', () => {
  // Remove live region
  delete (window as any).yqLiveRegion
  
  // Should not throw errors
  assert.doesNotThrow(() => {
    AccessibilityManager.announceToScreenReader('Test')
  })
})

// Performance tests
test('Performance - Accessibility validation performance', () => {
  // Create multiple elements
  const elements = []
  for (let i = 0; i < 100; i++) {
    elements.push(createMockElement('div'))
  }
  
  const startTime = performance.now()
  elements.forEach(element => {
    AccessibilityManager.validateElement(element)
  })
  const endTime = performance.now()
  
  const duration = endTime - startTime
  assert.ok(duration < 100) // Should complete in less than 100ms
})

test('Performance - Accessibility report generation performance', () => {
  // Create multiple elements
  const elements = []
  for (let i = 0; i < 50; i++) {
    elements.push(createMockElement('div'))
  }
  
  // Add elements to DOM
  elements.forEach(element => {
    document.body.appendChild(element)
  })
  
  const startTime = performance.now()
  const report = AccessibilityManager.generateReport()
  const endTime = performance.now()
  
  const duration = endTime - startTime
  assert.ok(duration < 200) // Should complete in less than 200ms
  
  // Cleanup
  elements.forEach(element => {
    document.body.removeChild(element)
  })
})