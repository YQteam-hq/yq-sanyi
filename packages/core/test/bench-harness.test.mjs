import { test } from 'node:test'
import assert from 'node:assert/strict'
import { percentile, median, spread, round, rateFromCost, formatSeries } from '../../../bench/stats.mjs'
import { installEnv, enableRenderOpCounting, resetRenderOps, readRenderOps, totalRenderOps } from '../../../bench/env.mjs'

const EMPTY_OPS = {
  created: 0,
  attribute: 0,
  attributeRemoved: 0,
  inserted: 0,
  removed: 0,
  text: 0,
  listener: 0
}

test('percentile returns zero for a missing or empty series', () => {
  assert.equal(percentile([], 0.5), 0)
  assert.equal(percentile(null, 0.5), 0)
  assert.equal(percentile(undefined, 0.95), 0)
  assert.equal(percentile('nope', 0.95), 0)
})

test('percentile selects the nearest rank without mutating the input', () => {
  const series = [5, 1, 4, 2, 3]
  assert.equal(percentile(series, 0), 1)
  assert.equal(percentile(series, 0.5), 3)
  assert.equal(percentile(series, 0.95), 5)
  assert.equal(percentile(series, 1), 5)
  assert.deepEqual(series, [5, 1, 4, 2, 3])
})

test('percentile clamps a ratio outside the unit interval', () => {
  const series = [40, 10, 30, 20]
  assert.equal(percentile(series, -3), 10)
  assert.equal(percentile(series, 7), 40)
})

test('median reports the p50 of the series', () => {
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([9, 1, 5, 3]), 3)
  assert.equal(median([]), 0)
})

test('spread reports the high over low ratio and never divides by zero', () => {
  assert.equal(spread([2, 4, 8]), 4)
  assert.equal(spread([7, 7, 7]), 1)
  assert.equal(spread([0, 0, 0]), 1)
  assert.equal(spread([0, 0, 256]), Infinity)
  assert.equal(spread([]), 1)
})

test('round keeps the requested number of digits', () => {
  assert.equal(round(1.23456, 2), 1.23)
  assert.equal(round(2.3456, 2), 2.35)
  assert.equal(round(3.14159, 0), 3)
  assert.equal(round(1.005, 2), 1)
})

test('rateFromCost converts a frame cost into a rate and guards a non positive cost', () => {
  assert.equal(rateFromCost(0), 0)
  assert.equal(rateFromCost(-4), 0)
  assert.equal(rateFromCost(Number.NaN), 0)
  assert.equal(round(rateFromCost(1000 / 60), 2), 60)
  assert.equal(round(rateFromCost(4), 2), 250)
})

test('formatSeries joins rounded values', () => {
  assert.equal(formatSeries([1.2345, 2.3456], 2), '1.23/2.35')
  assert.equal(formatSeries([3], 3), '3')
  assert.equal(formatSeries([], 2), '')
})

test('render operation counting stays off until it is enabled', () => {
  installEnv()
  enableRenderOpCounting(false)
  const element = globalThis.document.createElement('div')
  element.setAttribute('class', 'row')
  element.textContent = 'idle'
  element.addEventListener('click', function () {})
  assert.equal(totalRenderOps(), 0)
  assert.deepEqual(readRenderOps(), EMPTY_OPS)
})

test('render operation counting records every dom mutation while it is enabled', () => {
  installEnv()
  enableRenderOpCounting(true)
  const row = globalThis.document.createElement('div')
  row.setAttribute('class', 'row')
  row.textContent = 'task 1'
  row.addEventListener('click', function () {})
  const list = globalThis.document.createElement('section')
  list.appendChild(row)
  row.removeAttribute('class')
  list.removeChild(row)
  assert.deepEqual(readRenderOps(), {
    created: 2,
    attribute: 1,
    attributeRemoved: 1,
    inserted: 1,
    removed: 1,
    text: 1,
    listener: 1
  })
  assert.equal(totalRenderOps(), 8)
})

test('render operation counting ignores a removal that changes nothing', () => {
  installEnv()
  enableRenderOpCounting(true)
  const row = globalThis.document.createElement('div')
  row.removeAttribute('class')
  const list = globalThis.document.createElement('section')
  list.removeChild(row)
  assert.equal(readRenderOps().attributeRemoved, 0)
  assert.equal(readRenderOps().removed, 0)
})

test('enabling and resetting the counter clears an earlier measurement', () => {
  installEnv()
  enableRenderOpCounting(true)
  globalThis.document.createElement('div')
  assert.equal(readRenderOps().created, 1)
  enableRenderOpCounting(true)
  assert.equal(readRenderOps().created, 0)
  globalThis.document.createElement('div')
  resetRenderOps()
  assert.deepEqual(readRenderOps(), EMPTY_OPS)
  enableRenderOpCounting(false)
  globalThis.document.createElement('div')
  assert.equal(totalRenderOps(), 0)
})

test('readRenderOps hands back a detached snapshot', () => {
  installEnv()
  enableRenderOpCounting(true)
  globalThis.document.createElement('div')
  const snapshot = readRenderOps()
  snapshot.created = 999
  assert.equal(readRenderOps().created, 1)
})

test('the same render sequence always reports identical counts', () => {
  installEnv()
  const sequence = function () {
    enableRenderOpCounting(true)
    const host = globalThis.document.createElement('div')
    for (let index = 0; index < 5; index++) {
      const row = globalThis.document.createElement('span')
      row.setAttribute('data-index', String(index))
      row.textContent = 'row ' + index
      host.appendChild(row)
    }
    return readRenderOps()
  }
  const first = sequence()
  const second = sequence()
  assert.deepEqual(first, second)
  assert.equal(totalRenderOps(first), 21)
})
