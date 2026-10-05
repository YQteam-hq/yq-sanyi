import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ErrorBoundary, onError, _resetErrorHandlers } from '../dist/core.mjs'

test('scenario 1: ErrorBoundary componentDidCatch records error and calls onError', () => {
  _resetErrorHandlers()
  const seen = []
  const eb = new ErrorBoundary({
    onError: (err, info) => seen.push({ err, info })
  })
  const err = new Error('boom')
  eb.componentDidCatch(err, { source: 'render' })
  assert.equal(eb.hasError(), true)
  assert.equal(eb.getErrorCount(), 1)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].err.message, 'boom')
})

test('scenario 2: yq.onError subscribers receive errors', () => {
  _resetErrorHandlers()
  const received = []
  onError((err, info) => received.push(err.message))
  const eb = new ErrorBoundary({})
  eb.componentDidCatch(new Error('via-bus-1'), {})
  eb.componentDidCatch(new Error('via-bus-2'), {})
  assert.deepEqual(received, ['via-bus-1', 'via-bus-2'])
})

test('scenario 3: reset() invokes onRecover(state, err) when boundary recovers', () => {
  const eb = new ErrorBoundary({
    onRecover: (state, err) => {
      assert.ok(state)
      assert.ok(err instanceof Error)
      assert.equal(err.message, 'recovered-from')
    }
  })
  eb.componentDidCatch(new Error('recovered-from'), {})
  eb.reset()
  assert.equal(eb.hasError(), false)
})

test('scenario 4: onError handler that throws does not break other subscribers', () => {
  _resetErrorHandlers()
  const received = []
  onError(() => { throw new Error('handler-bug') })
  onError((err) => received.push(err.message))
  const eb = new ErrorBoundary({})
  assert.doesNotThrow(() => eb.componentDidCatch(new Error('still-works'), {}))
  assert.deepEqual(received, ['still-works'])
})

test('scenario 5: onError returns unsubscribe function', () => {
  _resetErrorHandlers()
  const received = []
  const unsub = onError((err) => received.push(err.message))
  const eb = new ErrorBoundary({})
  eb.componentDidCatch(new Error('before'), {})
  unsub()
  eb.componentDidCatch(new Error('after'), {})
  assert.deepEqual(received, ['before'])
})
