import { installEnv, mountHost, nextFrame, now, FRAME_MS } from './env.mjs'
import { makeTasks, refreshTasks, defineBoard, findByClass, firstRowButton } from './app.mjs'

const FRAME_BUDGET_MS = 1000 / 60
const DISPLAY_HZ = 60

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

const BUDGETS = {
  'first-interactive': { unit: 'ms', limit: 800, rule: 'max' },
  'update-latency': { unit: 'ms', limit: 150, rule: 'max' },
  'scroll-fps': { unit: 'fps', limit: 58, rule: 'min' }
}

function write(line) {
  process.stdout.write(line + '\n')
}

function percentile(values, ratio) {
  const sorted = values.slice().sort(function (a, b) {
    return a - b
  })
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1))
  return sorted[index]
}

function round(value, digits) {
  const factor = Math.pow(10, digits)
  return Math.round(value * factor) / factor
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
    value: percentile(samples, 0.95),
    median: percentile(samples, 0.5),
    best: percentile(samples, 0),
    runs: samples.length
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
    value: percentile(samples, 0.95),
    median: percentile(samples, 0.5),
    best: percentile(samples, 0),
    runs: samples.length
  }
}

async function measureScrollFps() {
  const name = 'yq-bench-scroll'
  const tasks = makeTasks(SCROLL_ROWS, 0)
  const windows = []
  for (let frame = 0; frame < SCROLL_WARMUP + SCROLL_FRAMES; frame++) {
    const offset = frame * SCROLL_STEP
    windows.push(tasks.slice(offset, offset + SCROLL_VISIBLE))
  }
  defineBoard(name, windows[0])
  const host = mountHost(name)
  await nextFrame()
  const marker = findByClass(host._yqInstance.root, 'rev')
  const costs = []
  for (let frame = 1; frame < SCROLL_WARMUP + SCROLL_FRAMES; frame++) {
    const visible = windows[frame]
    const start = now()
    host._yqInstance.state.tasks = visible
    host._yqInstance.state.revision = frame
    await waitForMarker(marker, frame)
    if (frame > SCROLL_WARMUP) {
      costs.push(now() - start)
    }
  }
  teardown(host)
  const p95 = percentile(costs, 0.95)
  const fps = p95 <= FRAME_BUDGET_MS ? DISPLAY_HZ : 1000 / p95
  return {
    name: 'scroll-fps',
    unit: 'fps',
    value: fps,
    frameMedian: percentile(costs, 0.5),
    frameP95: p95,
    runs: costs.length
  }
}

function report(result) {
  const budget = BUDGETS[result.name]
  const passed = budget.rule === 'max' ? result.value <= budget.limit : result.value >= budget.limit
  const sign = budget.rule === 'max' ? '<=' : '>='
  const detail =
    result.name === 'scroll-fps'
      ? ' frame p50 ' + round(result.frameMedian, 3) + ' ms p95 ' + round(result.frameP95, 3) + ' ms frames ' + result.runs
      : ' p50 ' + round(result.median, 2) + ' ms best ' + round(result.best, 2) + ' ms runs ' + result.runs
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
      detail +
      ' -> ' +
      (passed ? 'PASS' : 'FAIL')
  )
  return passed
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
  const results = [await measureFirstInteractive(), await measureUpdateLatency(), await measureScrollFps()]
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
