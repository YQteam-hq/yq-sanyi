import { test } from 'node:test'
import assert from 'node:assert'
import { DebugTools, DebugUtils } from '../src/debugging-tools.js'

// Mock console methods
const mockConsole = {
  log: [],
  warn: [],
  error: [],
  info: [],
  debug: [],
  time: [],
  timeEnd: []
}

console.log = (...args) => mockConsole.log.push(args)
console.warn = (...args) => mockConsole.warn.push(args)
console.error = (...args) => mockConsole.error.push(args)
console.info = (...args) => mockConsole.info.push(args)
console.debug = (...args) => mockConsole.debug.push(args)
console.time = (label) => mockConsole.time.push(label)
console.timeEnd = (label) => mockConsole.timeEnd.push(label)

// Test DebugTools
test('DebugTools - Configuration', () => {
  // Test default configuration
  assert.strictEqual(DebugTools.getConfig().enabled, false)
  assert.strictEqual(DebugTools.getConfig().logLevel, 'info')
  assert.strictEqual(DebugTools.getConfig().performance, true)
  assert.strictEqual(DebugTools.getConfig().stateChanges, true)
  assert.strictEqual(DebugTools.getConfig().renderTraces, true)
  assert.strictEqual(DebugTools.getConfig().componentTree, true)
  assert.strictEqual(DebugTools.getConfig().timeTravel, false)
  
  // Test configuration update
  DebugTools.configure({
    enabled: true,
    logLevel: 'debug',
    performance: false
  })
  
  const config = DebugTools.getConfig()
  assert.strictEqual(config.enabled, true)
  assert.strictEqual(config.logLevel, 'debug')
  assert.strictEqual(config.performance, false)
  assert.strictEqual(config.stateChanges, true) // Should remain unchanged
})

test('DebugTools - Component registration', () => {
  DebugTools.registerComponent('test-component', 'TestComponent', { count: 0 }, {})
  
  const components = DebugTools.getComponentTree()
  assert.strictEqual(components.length, 1)
  assert.strictEqual(components[0].id, 'test-component')
  assert.strictEqual(components[0].name, 'TestComponent')
  assert.strictEqual(components[0].state.count, 0)
})

test('DebugTools - Component state updates', () => {
  DebugTools.registerComponent('test-component', 'TestComponent', { count: 0 }, {})
  
  DebugTools.updateComponentState('test-component', { count: 1 })
  
  const components = DebugTools.getComponentTree()
  assert.strictEqual(components[0].state.count, 1)
})

test('DebugTools - Component render tracking', () => {
  DebugTools.registerComponent('test-component', 'TestComponent', { count: 0 }, {})
  
  DebugTools.recordComponentRender('test-component', 16.5)
  
  const components = DebugTools.getComponentTree()
  assert.strictEqual(components[0].renderCount, 1)
  assert.strictEqual(components[0].lastRenderTime, 16.5)
})

test('DebugTools - Component error tracking', () => {
  const testError = new Error('Test error')
  
  DebugTools.registerComponent('test-component', 'TestComponent', { count: 0 }, {})
  DebugTools.addComponentError('test-component', testError)
  
  const components = DebugTools.getComponentTree()
  assert.strictEqual(components[0].errors.length, 1)
  assert.strictEqual(components[0].errors[0].message, 'Test error')
})

test('DebugTools - State change tracking', () => {
  DebugTools.configure({ enabled: true, stateChanges: true })
  
  DebugTools.trackStateChange('counter', 0, 1, 'test-component')
  
  const stateHistory = DebugTools.exportDebugData().stateHistory
  assert.strictEqual(stateHistory.length, 1)
  assert.strictEqual(stateHistory[0].path, 'counter')
  assert.strictEqual(stateHistory[0].oldValue, 0)
  assert.strictEqual(stateHistory[0].newValue, 1)
  assert.strictEqual(stateHistory[0].componentId, 'test-component')
})

test('DebugTools - Logging system', () => {
  DebugTools.configure({ enabled: true, logLevel: 'debug' })
  
  DebugTools.log('info', 'Test message')
  DebugTools.log('warn', 'Warning message')
  DebugTools.log('error', 'Error message')
  DebugTools.log('debug', 'Debug message')
  
  assert.strictEqual(mockConsole.info.length, 1)
  assert.strictEqual(mockConsole.warn.length, 1)
  assert.strictEqual(mockConsole.error.length, 1)
  assert.strictEqual(mockConsole.debug.length, 1)
  
  // Test log level filtering
  DebugTools.configure({ enabled: true, logLevel: 'error' })
  
  DebugTools.log('info', 'This should not appear')
  DebugTools.log('error', 'This should appear')
  
  assert.strictEqual(mockConsole.info.length, 1) // No change
  assert.strictEqual(mockConsole.error.length, 2) // Increased by 1
})

test('DebugTools - Time travel', () => {
  DebugTools.configure({ enabled: true, timeTravel: true })
  
  // Add some state history
  DebugTools.trackStateChange('counter', 0, 1)
  DebugTools.trackStateChange('counter', 1, 2)
  DebugTools.trackStateChange('counter', 2, 3)
  
  DebugTools.startTimeTravel()
  
  assert.strictEqual(DebugTools.exportDebugData().stateHistory.length, 3)
  
  // Test undo/redo functionality (simplified)
  DebugTools.undo()
  DebugTools.redo()
})

test('DebugTools - Debug panel creation', () => {
  const panel = DebugTools.createDebugPanel()
  
  assert.strictEqual(panel.tagName, 'DIV')
  assert.strictEqual(panel.style.position, 'fixed')
  assert.strictEqual(panel.style.top, '0')
  assert.strictEqual(panel.style.right, '0')
  assert.strictEqual(panel.style.width, '400px')
  assert.strictEqual(panel.style.height, '100vh')
  
  // Check if toggle button exists
  const toggleButton = panel.querySelector('button')
  assert.strictEqual(toggleButton.textContent, 'Toggle Debug')
  
  // Check if component tree exists
  const componentTree = panel.querySelector('h4')
  assert.strictEqual(componentTree.textContent, 'Component Tree')
})

test('DebugTools - Debug data export', () => {
  DebugTools.registerComponent('test-component', 'TestComponent', { count: 0 }, {})
  DebugTools.trackStateChange('counter', 0, 1)
  
  const exportedData = DebugTools.exportDebugData()
  
  assert.strictEqual(exportedData.components.length, 1)
  assert.strictEqual(exportedData.stateHistory.length, 1)
  assert.strictEqual(exportedData.config.enabled, false) // Default is false
})

test('DebugTools - Cleanup', () => {
  DebugTools.registerComponent('test-component', 'TestComponent', { count: 0 }, {})
  DebugTools.trackStateChange('counter', 0, 1)
  
  DebugTools.cleanup()
  
  const components = DebugTools.getComponentTree()
  assert.strictEqual(components.length, 0)
  
  const stateHistory = DebugTools.exportDebugData().stateHistory
  assert.strictEqual(stateHistory.length, 0)
})

// Test DebugUtils
test('DebugUtils - Debug component', () => {
  const MockState = function(initialValue) {
    this.value = initialValue
    this.subscribers = new Set()
    this.subscribe = function(fn) {
      this.subscribers.add(fn)
      return () => this.subscribers.delete(fn)
    }
  }
  
  const state = new MockState('initial')
  const debugUpdate = DebugUtils.debugComponent('test-component', 'TestComponent', state, {})
  
  assert.strictEqual(state.value, 'initial')
  
  debugUpdate('updated')
  assert.strictEqual(state.value, 'updated')
})

test('DebugUtils - Debug state', () => {
  const MockState = function(initialValue) {
    this.value = initialValue
    this.subscribers = new Set()
    this.subscribe = function(fn) {
      this.subscribers.add(fn)
      return () => this.subscribers.delete(fn)
    }
  }
  
  const state = new MockState('initial')
  const unsubscribe = DebugUtils.debugState(state, 'test-state')
  
  assert.strictEqual(mockConsole.debug.length, 1)
  
  // Update state
  state.value = 'updated'
  
  assert.strictEqual(mockConsole.debug.length, 2)
  
  // Cleanup
  unsubscribe()
})

test('DebugUtils - Performance profiling', () => {
  const mockFn = () => {
    // Simulate work
    let sum = 0
    for (let i = 0; i < 1000; i++) {
      sum += i
    }
    return sum
  }
  
  DebugUtils.profile('test-profile', mockFn)
  
  assert.strictEqual(mockConsole.info.length, 1)
  assert.strictEqual(mockConsole.info[0][0].includes('Profile: test-profile took'), true)
})

test('DebugUtils - Memory profiling', () => {
  // Mock performance.memory
  const originalMemory = (performance as any).memory
  (performance as any).memory = {
    usedJSHeapSize: 1024,
    totalJSHeapSize: 2048,
    jsHeapSizeLimit: 4096
  }
  
  DebugUtils.memoryProfile()
  
  assert.strictEqual(mockConsole.info.length, 1)
  assert.strictEqual(mockConsole.info[0][0].includes('Memory usage:'), true)
  
  // Restore original memory
  (performance as any).memory = originalMemory
})

// Integration tests
test('Integration - Debug tools with component system', () => {
  // This test would require a DOM environment
  console.log('Integration tests should be run in browser environment')
})

test('Integration - Performance impact of debug tools', () => {
  // This test would require performance benchmarking
  console.log('Performance tests should be run with proper benchmarking tools')
})

// Edge cases
test('Edge cases - Debug tools error handling', () => {
  // Test with invalid component ID
  DebugTools.updateComponentState('non-existent', { count: 1 })
  DebugTools.addComponentError('non-existent', new Error('Test error'))
  
  // Should not throw errors
  assert(true)
})

test('Edge cases - Debug tools configuration', () => {
  // Test with partial configuration
  DebugTools.configure({ enabled: true })
  
  const config = DebugTools.getConfig()
  assert.strictEqual(config.enabled, true)
  assert.strictEqual(config.logLevel, 'info') // Should remain default
  assert.strictEqual(config.performance, true) // Should remain default
})