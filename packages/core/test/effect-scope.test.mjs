import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, effect, state, effectPre, resetReactiveState } from '../dist/core.mjs'

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

test('stop releases the disposer returned by the run callback', () => {
  resetReactiveState()
  let cleaned = 0
  const scope = effectScope()
  scope.run(() => () => {
    cleaned++
  })
  assert.equal(cleaned, 0)
  scope.stop()
  assert.equal(cleaned, 1, 'stop must run the cleanup collected by run')
})

test('stop releases every effect created inside the scope', async () => {
  resetReactiveState()
  const count = state(0)
  let runs = 0
  let cleaned = 0
  const scope = effectScope()
  scope.run(() => effect(() => {
    runs++
    count.value
    return () => {
      cleaned++
    }
  }))
  count.value = 1
  await flush()
  assert.equal(runs, 2)
  scope.stop()
  assert.equal(cleaned, 1)
  count.value = 2
  await flush()
  assert.equal(runs, 2, 'an effect released by stop must stop reacting')
})

test('stop releases effectPre cleanups created inside the scope', () => {
  let cleaned = 0
  const scope = effectScope()
  scope.run(() => effectPre(() => () => {
    cleaned++
  }))
  scope.stop()
  assert.equal(cleaned, 1)
})

test('stop is idempotent and run stays a no-op afterwards', () => {
  resetReactiveState()
  let cleaned = 0
  let ran = 0
  const scope = effectScope()
  scope.run(() => () => {
    cleaned++
  })
  scope.stop()
  scope.stop()
  assert.equal(cleaned, 1, 'the second stop must not run the cleanups again')
  scope.run(() => {
    ran++
    return () => {
      cleaned++
    }
  })
  assert.equal(ran, 0)
  assert.equal(cleaned, 1)
})

test('run returns the value produced by the callback', () => {
  const scope = effectScope()
  assert.equal(scope.run(() => 42), 42)
  assert.equal(scope.run(() => 'yq'), 'yq')
  scope.stop()
})

test('a callback that throws still leaves the earlier cleanups releasable', () => {
  resetReactiveState()
  let cleaned = 0
  const scope = effectScope()
  scope.run(() => () => {
    cleaned++
  })
  assert.throws(() => {
    scope.run(() => {
      throw new Error('callback failed')
    })
  }, /callback failed/)
  assert.equal(cleaned, 0, 'the error must propagate and must not release the scope early')
  scope.stop()
  assert.equal(cleaned, 1, 'cleanups collected before the failure are still released')
})

test('a cleanup that throws does not strand the cleanups after it', () => {
  resetReactiveState()
  const order = []
  const scope = effectScope()
  scope.run(() => () => {
    order.push('first')
    throw new Error('cleanup failed')
  })
  scope.run(() => () => {
    order.push('second')
  })
  assert.throws(() => scope.stop(), /cleanup failed/)
  assert.deepEqual(order, ['first', 'second'], 'every cleanup must run even when one throws')
  assert.equal(scope.run(() => 'ignored'), undefined)
})

test('independent scopes do not share their cleanups', () => {
  resetReactiveState()
  let firstCleaned = 0
  let secondCleaned = 0
  const first = effectScope()
  const second = effectScope()
  first.run(() => () => {
    firstCleaned++
  })
  second.run(() => () => {
    secondCleaned++
  })
  first.stop()
  assert.equal(firstCleaned, 1)
  assert.equal(secondCleaned, 0)
  second.stop()
  assert.equal(secondCleaned, 1)
})
