import { test } from 'node:test'
import assert from 'node:assert'
import { AdvancedStateManagement, StateUtils } from '../src/advanced-state.js'

// Test AdvancedStateManagement
test('AdvancedStateManagement - State persistence', () => {
  // Mock localStorage
  const mockLocalStorage = {
    storage: {},
    getItem: function(key) { return this.storage[key] },
    setItem: function(key, value) { this.storage[key] = value },
    removeItem: function(key) { delete this.storage[key] }
  }
  
  // Mock State class
  const MockState = function(initialValue) {
    this.value = initialValue
    this.subscribers = new Set()
    this.subscribe = function(fn) {
      this.subscribers.add(fn)
      return () => this.subscribers.delete(fn)
    }
  }
  
  const state = new MockState('initial')
  
  // Test persistence
  AdvancedStateManagement.persist(state, {
    key: 'test-key',
    storage: mockLocalStorage,
    serialize: (value) => JSON.stringify(value),
    deserialize: (value) => JSON.parse(value)
  })
  
  // Check if value was persisted
  assert.strictEqual(mockLocalStorage.storage['test-key'], '{"value":"initial","timestamp":')
  
  // Update state and check persistence
  state.value = 'updated'
  assert.strictEqual(mockLocalStorage.storage['test-key'].includes('"value":"updated"'), true)
})

test('AdvancedStateManagement - State history', () => {
  // Mock State class
  const MockState = function(initialValue) {
    this.value = initialValue
    this.subscribers = new Set()
    this.subscribe = function(fn) {
      this.subscribers.add(fn)
      return () => this.subscribers.delete(fn)
    }
  }
  
  const state = new MockState('initial')
  
  // Enable history
  AdvancedStateManagement.enableHistory(state, { maxSize: 5 })
  
  // Update state multiple times
  state.value = 'first'
  state.value = 'second'
  state.value = 'third'
  
  const history = AdvancedStateManagement.getStateHistory(state)
  assert.strictEqual(history.length, 3)
  assert.strictEqual(history[0].value, 'initial')
  assert.strictEqual(history[1].value, 'first')
  assert.strictEqual(history[2].value, 'third')
})

test('AdvancedStateManagement - State validation', () => {
  // Mock State class
  const MockState = function(initialValue) {
    this.value = initialValue
    this.subscribers = new Set()
    this.subscribe = function(fn) {
      this.subscribers.add(fn)
      return () => this.subscribers.delete(fn)
    }
  }
  
  const state = new MockState('test')
  
  // Add validation rule
  const validationRule = {
    validate: (value) => value.length > 3,
    message: 'Value must be longer than 3 characters'
  }
  
  AdvancedStateManagement.addValidation(state, validationRule, 'validation-test')
  
  // Test validation
  assert.strictEqual(AdvancedStateManagement.validateState(state, 'validation-test'), true)
  
  // Update to invalid value
  state.value = 'no'
  assert.strictEqual(AdvancedStateManagement.validateState(state, 'validation-test'), false)
})

test('AdvancedStateManagement - Form field management', () => {
  const field = AdvancedStateManagement.createFormField('initial')
  
  assert.strictEqual(field.value, 'initial')
  assert.strictEqual(field.touched, false)
  assert.strictEqual(field.dirty, false)
  assert.strictEqual(field.validating, false)
  
  // Update field
  const updatedField = AdvancedStateManagement.updateFormField(field, 'new value')
  
  assert.strictEqual(updatedField.value, 'new value')
  assert.strictEqual(updatedField.touched, true)
  assert.strictEqual(updatedField.dirty, true)
  
  // Validate field
  const validationRules = [
    { validate: (value) => value.length > 3, message: 'Too short' }
  ]
  
  const validatedField = AdvancedStateManagement.validateFormField(updatedField, validationRules)
  assert.strictEqual(validatedField.error, undefined)
  
  // Test invalid validation
  const invalidField = AdvancedStateManagement.updateFormField(field, 'no')
  const invalidValidatedField = AdvancedStateManagement.validateFormField(invalidField, validationRules)
  assert.strictEqual(invalidValidatedField.error, 'Too short')
})

test('AdvancedStateManagement - Async state management', () => {
  const asyncState = AdvancedStateManagement.createAsyncState<string>()
  
  assert.strictEqual(asyncState.data, null)
  assert.strictEqual(asyncState.loading, false)
  assert.strictEqual(asyncState.error, null)
  assert.strictEqual(asyncState.lastUpdated, null)
  
  // Mock async function
  const mockAsyncFn = () => Promise.resolve('success')
  
  // Execute async function
  AdvancedStateManagement.executeAsync(asyncState, mockAsyncFn)
  
  // Check state after execution
  assert.strictEqual(asyncState.loading, true)
  
  // Wait for async operation to complete
  setTimeout(() => {
    assert.strictEqual(asyncState.data, 'success')
    assert.strictEqual(asyncState.loading, false)
    assert.strictEqual(asyncState.error, null)
    assert.strictEqual(asyncState.lastUpdated, not null)
  }, 100)
})

test('AdvancedStateManagement - State selectors', () => {
  // Mock State and Derived classes
  const MockState = function(initialValue) {
    this.value = initialValue
    this.subscribers = new Set()
    this.subscribe = function(fn) {
      this.subscribers.add(fn)
      return () => this.subscribers.delete(fn)
    }
  }
  
  const MockDerived = function(computeFn) {
    this.compute = computeFn
    this.value = computeFn()
    this.subscribers = new Set()
    this.subscribe = function(fn) {
      this.subscribers.add(fn)
      return () => this.subscribers.delete(fn)
    }
  }
  
  const state = new MockState({ user: { name: 'John', age: 30 } })
  
  // Create selector
  const selector = {
    fn: (state) => state.user.name,
    equality: (a, b) => a === b
  }
  
  const selectedState = AdvancedStateManagement.createSelector(state, selector)
  
  assert.strictEqual(selectedState.value, 'John')
  
  // Update state and check selector
  state.value = { user: { name: 'Jane', age: 25 } }
  assert.strictEqual(selectedState.value, 'Jane')
})

test('AdvancedStateManagement - State middleware', () => {
  const actions = []
  const middleware = (action, next) => {
    actions.push(`before-${action.type}`)
    next(action)
    actions.push(`after-${action.type}`)
  }
  
  AdvancedStateManagement.addMiddleware(middleware)
  
  const reducer = (state, action) => {
    return { ...state, ...action.payload }
  }
  
  const initialState = { count: 0 }
  const action = { type: 'INCREMENT', payload: { count: 1 } }
  
  const newState = AdvancedStateManagement.dispatch(action, reducer, initialState)
  
  assert.strictEqual(newState.count, 1)
  assert.strictEqual(actions.length, 2)
  assert.strictEqual(actions[0], 'before-INCREMENT')
  assert.strictEqual(actions[1], 'after-INCREMENT')
})

// Test StateUtils
test('StateUtils - Local storage state', () => {
  const mockLocalStorage = {
    storage: {},
    getItem: function(key) { return this.storage[key] },
    setItem: function(key, value) { this.storage[key] = value }
  }
  
  const state = StateUtils.localStorageState('test-key', 'initial')
  
  assert.strictEqual(state.value, 'initial')
  
  // Update state
  state.value = 'updated'
  assert.strictEqual(mockLocalStorage.storage['test-key'].includes('"value":"updated"'), true)
})

test('StateUtils - Debounced state', () => {
  const MockState = function(initialValue) {
    this.value = initialValue
    this.subscribers = new Set()
    this.subscribe = function(fn) {
      this.subscribers.add(fn)
      return () => this.subscribers.delete(fn)
    }
  }
  
  const state = new MockState('initial')
  const debouncedState = StateUtils.debouncedState(state, 100)
  
  assert.strictEqual(debouncedState.value, 'initial')
  
  // Update state rapidly
  debouncedState.value = 'first'
  debouncedState.value = 'second'
  debouncedState.value = 'third'
  
  // Value should not have changed immediately
  assert.strictEqual(debouncedState.value, 'initial')
  
  // Wait for debounce timeout
  setTimeout(() => {
    assert.strictEqual(debouncedState.value, 'third')
  }, 150)
})

test('StateUtils - Throttled state', () => {
  const MockState = function(initialValue) {
    this.value = initialValue
    this.subscribers = new Set()
    this.subscribe = function(fn) {
      this.subscribers.add(fn)
      return () => this.subscribers.delete(fn)
    }
  }
  
  const state = new MockState('initial')
  const throttledState = StateUtils.throttledState(state, 100)
  
  assert.strictEqual(throttledState.value, 'initial')
  
  // Update state rapidly
  throttledState.value = 'first'
  throttledState.value = 'second'
  throttledState.value = 'third'
  
  // Value should have changed only once
  assert.strictEqual(throttledState.value, 'first')
  
  // Wait for throttle timeout
  setTimeout(() => {
    throttledState.value = 'fourth'
    assert.strictEqual(throttledState.value, 'fourth')
  }, 150)
})

test('StateUtils - Computed state', () => {
  const MockState = function(initialValue) {
    this.value = initialValue
    this.subscribers = new Set()
    this.subscribe = function(fn) {
      this.subscribers.add(fn)
      return () => this.subscribers.delete(fn)
    }
  }
  
  const state1 = new MockState(10)
  const state2 = new MockState(20)
  
  const computedState = StateUtils.computedState(
    [state1, state2],
    (values) => values.reduce((sum, val) => sum + val, 0)
  )
  
  assert.strictEqual(computedState.value, 30)
  
  // Update states
  state1.value = 15
  state2.value = 25
  
  assert.strictEqual(computedState.value, 40)
})

test('StateUtils - Undo/redo state', () => {
  const undoRedoState = StateUtils.createUndoRedoState('initial')
  
  assert.strictEqual(undoRedoState.state.value, 'initial')
  assert.strictEqual(undoRedoState.canUndo, false)
  assert.strictEqual(undoRedoState.canRedo, false)
  
  // Make changes
  undoRedoState.state.value = 'first'
  undoRedoState.state.value = 'second'
  
  assert.strictEqual(undoRedoState.state.value, 'second')
  assert.strictEqual(undoRedoState.canUndo, true)
  assert.strictEqual(undoRedoState.canRedo, false)
  
  // Undo
  undoRedoState.undo()
  assert.strictEqual(undoRedoState.state.value, 'first')
  assert.strictEqual(undoRedoState.canUndo, true)
  assert.strictEqual(undoRedoState.canRedo, true)
  
  // Redo
  undoRedoState.redo()
  assert.strictEqual(undoRedoState.state.value, 'second')
  assert.strictEqual(undoRedoState.canUndo, true)
  assert.strictEqual(undoRedoState.canRedo, false)
})

// Integration tests
test('Integration - State management with component system', () => {
  // This test would require a DOM environment
  console.log('Integration tests should be run in browser environment')
})

test('Integration - Performance impact of state management', () => {
  // This test would require performance benchmarking
  console.log('Performance tests should be run with proper benchmarking tools')
})