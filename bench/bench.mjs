import {
  installEnv,
  mountHost,
  nextFrame,
  now,
  enableRenderOpCounting,
  resetRenderOps,
  readRenderOps,
  totalRenderOps,
  FRAME_MS
} from './env.mjs'
import { makeTasks, refreshTasks, defineBoard, findByClass, firstRowButton } from './app.mjs'
import { percentile, median, spread, round, rateFromCost, formatSeries } from './stats.mjs'

const FRAME_BUDGET_MS = 1000 / 60

const BOOT_ROWS = 3000
const BOOT_WARMUP = 2
const BOOT_RUNS = 10

const UPDATE_ROWS = 3000
const UPDATE_WARMUP = 10
const UPDATE_RUNS = 60

const SCROLL_ROWS = 2000
const SCROLL_VISIBLE = 200
const SCROLL_STEP = 4
const SCROLL_WARMUP = 20
const SCROLL_FRAMES = 120
const SCROLL_RUNS = 3

const BUDGETS = {
  'first-interactive': { unit: 'ms', limit: 1000, rule: 'max' },
  'update-latency': { unit: 'ms', limit: 200, rule: 'max' },
  'scroll-fps': { unit: 'fps', limit: 55, rule: 'min' },
  'scroll-frame-ops': { unit: 'ops/frame', limit: 900, rule: 'max' }
}

function write(line) {
  process.stdout.write(line + '\n')
}

async function waitForMarker(marker, expected) {
  const target = String(expected)
  for (let tick = 0; tick < 5000; tick++) {
    if (marker.textContent === target) {
      return
    }
    await Promise.resolve()
  }
  throw new Error(
    'bench: the render pipeline never applied update ' + target + ', the marker still reads ' + marker.textContent
  )
}

function teardown(host) {
  if (typeof host.disconnectedCallback === 'function') {
    host.disconnectedCallback()
  }
}

function budgetVerdict(result) {
  const budget = BUDGETS[result.name]
  return budget.rule === 'max' ? result.value <= budget.limit : result.value >= budget.limit
}

function report(result) {
  const budget = BUDGETS[result.name]
  const sign = budget.rule === 'max' ? '<=' : '>='
  const passed = budgetVerdict(result)
  write(
    'bench ' +
      result.name +
      ' target ' +
      sign +
      ' ' +
      budget.limit +
      ' ' +
      budget.unit +
      ' measured ' +
      round(result.value, 2) +
      ' ' +
      budget.unit +
      ' ' +
      result.detail +
      ' -> ' +
      (passed ? 'PASS' : 'FAIL')
  )
  return passed
}

async function measureFirstInteractive() {
  const samples = []
  for (let run = 0; run < BOOT_WARMUP + BOOT_RUNS; run++) {
    const name = 'yq-bench-boot-' + run
    const tasks = makeTasks(BOOT_ROWS, run * BOOT_ROWS)
    const start = now()
    defineBoard(name, tasks)
    const host = mountHost(name)
    await nextFrame()
    const marker = findByClass(host._yqInstance.root, 'rev')
    const picked = findByClass(host._yqInstance.root, 'picked')
    const button = firstRowButton(host._yqInstance.root)
    if (!marker || !picked || !button) {
      throw new Error('bench: the boot board did not render a marker or a row button')
    }
    button.dispatch('click')
    await waitForMarker(marker, 1)
    await waitForMarker(picked, run * BOOT_ROWS)
    const elapsed = now() - start
    if (marker.textContent !== '1' || picked.textContent !== String(run * BOOT_ROWS)) {
      throw new Error('bench: the boot board is not interactive, the click was not applied')
    }
    teardown(host)
    if (run >= BOOT_WARMUP) {
      samples.push(elapsed)
    }
  }
  return {
    name: 'first-interactive',
    unit: 'ms',
    value: median(samples),
    samples: samples,
    detail:
      'p95 ' +
      round(percentile(samples, 0.95), 2) +
      ' ms best ' +
      round(percentile(samples, 0), 2) +
      ' ms spread ' +
      round(spread(samples), 2) +
      'x runs ' +
      samples.length
  }
}

async function measureUpdateLatency() {
  const name = 'yq-bench-update'
  const tasks = makeTasks(UPDATE_ROWS, 0)
  defineBoard(name, tasks)
  const host = mountHost(name)
  await nextFrame()
  const marker = findByClass(host._yqInstance.root, 'rev')
  const samples = []
  for (let run = 1; run <= UPDATE_WARMUP + UPDATE_RUNS; run++) {
    const next = refreshTasks(tasks, run)
    const start = now()
    host._yqInstance.state.tasks = next
    host._yqInstance.state.revision = run
    await waitForMarker(marker, run)
    if (run > UPDATE_WARMUP) {
      samples.push(now() - start)
    }
  }
  teardown(host)
  return {
    name: 'update-latency',
    unit: 'ms',
    value: median(samples),
    samples: samples,
    detail:
      'p95 ' +
      round(percentile(samples, 0.95), 2) +
      ' ms best ' +
      round(percentile(samples, 0), 2) +
      ' ms spread ' +
      round(spread(samples), 2) +
      'x runs ' +
      samples.length
  }
}

function buildScrollWindows() {
  const tasks = makeTasks(SCROLL_ROWS, 0)
  const windows = []
  for (let frame = 0; frame < SCROLL_WARMUP + SCROLL_FRAMES; frame++) {
    const offset = frame * SCROLL_STEP
    windows.push(tasks.slice(offset, offset + SCROLL_VISIBLE))
  }
  return windows
}

function mountScrollBoard(name, windows) {
  defineBoard(name, windows[0])
  return mountHost(name)
}

async function driveScrollFrame(host, marker, visible, frame, collectOps) {
  if (collectOps) {
    resetRenderOps()
  }
  const start = now()
  host._yqInstance.state.tasks = visible
  host._yqInstance.state.revision = frame
  await waitForMarker(marker, frame)
  const elapsed = now() - start
  return { elapsed: elapsed, ops: collectOps ? totalRenderOps(readRenderOps()) : null }
}

async function measureScrollRun(run) {
  const windows = buildScrollWindows()
  const host = mountScrollBoard('yq-bench-scroll-' + run, windows)
  await nextFrame()
  const marker = findByClass(host._yqInstance.root, 'rev')
  const costs = []
  for (let frame = 1; frame < SCROLL_WARMUP + SCROLL_FRAMES; frame++) {
    const sample = await driveScrollFrame(host, marker, windows[frame], frame, false)
    if (frame > SCROLL_WARMUP) {
      costs.push(sample.elapsed)
    }
  }
  teardown(host)
  return percentile(costs, 0.5)
}

async function measureScrollFrameOps() {
  const windows = buildScrollWindows()
  const host = mountScrollBoard('yq-bench-scroll-ops', windows)
  await nextFrame()
  const marker = findByClass(host._yqInstance.root, 'rev')
  enableRenderOpCounting(true)
  const ops = []
  let breakdown = null
  for (let frame = 1; frame < SCROLL_WARMUP + SCROLL_FRAMES; frame++) {
    const sample = await driveScrollFrame(host, marker, windows[frame], frame, true)
    if (frame > SCROLL_WARMUP) {
      ops.push(sample.ops)
    }
    breakdown = readRenderOps()
  }
  teardown(host)
  enableRenderOpCounting(false)
  return { ops: ops, breakdown: breakdown }
}

async function measureScroll() {
  const runP50 = []
  for (let run = 0; run < SCROLL_RUNS; run++) {
    runP50.push(await measureScrollRun(run))
  }
  const frameP50 = median(runP50)
  const measured = await measureScrollFrameOps()
  return [
    {
      name: 'scroll-fps',
      unit: 'fps',
      value: rateFromCost(frameP50),
      detail:
        'frame p50 ' +
        round(frameP50, 3) +
        ' ms worst run p50 ' +
        round(percentile(runP50, 1), 3) +
        ' ms run p50 ' +
        formatSeries(runP50, 3) +
        ' ms runs ' +
        runP50.length
    },
    {
      name: 'scroll-frame-ops',
      unit: 'ops/frame',
      value: percentile(measured.ops, 0.95),
      detail:
        'p50 ' +
        percentile(measured.ops, 0.5) +
        ' distinct ' +
        new Set(measured.ops).size +
        ' frames ' +
        measured.ops.length +
        ' visible rows ' +
        SCROLL_VISIBLE +
        ' created ' +
        measured.breakdown.created +
        ' inserted ' +
        measured.breakdown.inserted +
        ' removed ' +
        measured.breakdown.removed +
        ' text ' +
        measured.breakdown.text +
        ' attribute ' +
        measured.breakdown.attribute +
        ' listener ' +
        measured.breakdown.listener
    }
  ]
}

async function main() {
  installEnv()
  write(
    'bench harness headless-dom ' +
      process.version +
      ' frame ' +
      FRAME_MS +
      ' ms budget ' +
      round(FRAME_BUDGET_MS, 2) +
      ' ms rows boot ' +
      BOOT_ROWS +
      ' update ' +
      UPDATE_ROWS +
      ' scroll ' +
      SCROLL_ROWS +
      '/' +
      SCROLL_VISIBLE +
      ' step ' +
      SCROLL_STEP
  )
  write(
    'bench method wall-clock gates assert the typical p50 sample, the p95 tail and the spread stay visible as diagnostics, scroll fps is derived from the p50 frame cost and is not capped at the display rate, scroll-frame-ops counts dom mutations and is independent of machine load'
  )
  const results = []
  results.push(await measureFirstInteractive())
  results.push(await measureUpdateLatency())
  const scroll = await measureScroll()
  for (const result of scroll) {
    results.push(result)
  }
  let failed = 0
  for (const result of results) {
    if (!report(result)) {
      failed++
    }
  }
  if (failed > 0) {
    write('bench FAILED - ' + failed + ' of ' + results.length + ' performance budgets missed')
    process.exitCode = 1
    return
  }
  write('bench ok - all ' + results.length + ' performance budgets met')
}

main().catch(function (error) {
  write('bench ERROR - ' + (error && error.message ? error.message : String(error)))
  process.exitCode = 1
})
