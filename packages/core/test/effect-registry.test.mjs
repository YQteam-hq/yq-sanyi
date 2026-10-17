import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { state, effect, resetReactiveState, dumpReactiveState } from '../dist/core.mjs'

function runPendingEffectJobs() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('effect registry', () => {
  test('a re-run keeps every other effect in the registry', async () => {
    resetReactiveState()
    const first = state(0)
    const second = state(0)
    let firstRuns = 0
    let secondRuns = 0
    effect(() => {
      firstRuns++
      first.value
    })
    effect(() => {
      secondRuns++
      second.value
    })
    assert.equal(firstRuns, 1)
    assert.equal(secondRuns, 1)
    first.value = 1
    await runPendingEffectJobs()
    assert.equal(firstRuns, 2)
    second.value = 1
    await runPendingEffectJobs()
    assert.equal(secondRuns, 2, 'the second effect must still be registered after the first one re-ran')
    second.value = 2
    await runPendingEffectJobs()
    assert.equal(secondRuns, 3)
  })

  test('an effect registered last survives a re-run of the effect registered first', async () => {
    resetReactiveState()
    const early = state(0)
    const late = state(0)
    let lateRuns = 0
    effect(() => {
      early.value
    })
    effect(() => {
      lateRuns++
      late.value
    })
    early.value = 1
    await runPendingEffectJobs()
    late.value = 1
    await runPendingEffectJobs()
    assert.equal(lateRuns, 2, 'the later effect must not be evicted by the earlier re-run')
  })

  test('disposing an effect removes it from the registry', async () => {
    resetReactiveState()
    const count = state(0)
    let runs = 0
    const stop = effect(() => {
      runs++
      count.value
    })
    assert.equal(dumpReactiveState().effects.length, 1)
    stop()
    count.value = 1
    await runPendingEffectJobs()
    assert.equal(runs, 1, 'a disposed effect must stop reacting')
    assert.equal(dumpReactiveState().effects.length, 0)
  })

})

describe('effect disposal', () => {
  test('a failing child cleanup does not strand its siblings or the parent', () => {
    resetReactiveState()
    const order = []
    const stop = effect(() => {
      effect(() => () => {
        order.push('first')
        throw new Error('child cleanup failed')
      })
      effect(() => () => {
        order.push('second')
      })
      return () => {
        order.push('parent')
      }
    })
    assert.throws(() => stop(), /child cleanup failed/)
    assert.deepEqual(order, ['first', 'second', 'parent'], 'disposal must reach every cleanup')
  })

  test('disposing twice runs the cleanup once', async () => {
    resetReactiveState()
    const count = state(0)
    let cleanups = 0
    const stop = effect(() => {
      count.value
      return () => {
        cleanups++
      }
    })
    stop()
    stop()
    count.value = 1
    await runPendingEffectJobs()
    assert.equal(cleanups, 1)
  })

  test('an effect re-run releases the effects created on the previous run', async () => {
    resetReactiveState()
    const toggle = state(true)
    const inner = state(0)
    let innerRuns = 0
    let cleanups = 0
    effect(() => {
      toggle.value
      effect(() => {
        innerRuns++
        inner.value
        return () => {
          cleanups++
        }
      })
    })
    assert.equal(innerRuns, 1)
    inner.value = 1
    await runPendingEffectJobs()
    assert.equal(innerRuns, 2)
    toggle.value = false
    await runPendingEffectJobs()
    assert.equal(cleanups, 1, 'the inner effect of the previous run must be released')
    assert.equal(innerRuns, 3)
    inner.value = 2
    await runPendingEffectJobs()
    assert.equal(innerRuns, 4, 'only the inner effect of the latest run may react, a leaked one would make this 5')
  })

  test('a disposed parent effect releases the effects it created', async () => {
    resetReactiveState()
    const count = state(0)
    let innerRuns = 0
    let cleanups = 0
    const stop = effect(() => {
      count.value
      effect(() => {
        innerRuns++
        return () => {
          cleanups++
        }
      })
    })
    assert.equal(innerRuns, 1)
    stop()
    assert.equal(cleanups, 1, 'disposing the parent must clean up its child effect')
    count.value = 1
    await runPendingEffectJobs()
    assert.equal(innerRuns, 1)
  })
})
