import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { DebugManager, attachDevtools } from '../../devtools/dist/devtools.mjs'
import { installPanelDom, findByRole } from './helpers/panel-dom.mjs'

const dom = installPanelDom()
const originalConsole = { error: console.error, warn: console.warn, log: console.log }

after(() => {
  dom.restore()
  console.error = originalConsole.error
  console.warn = originalConsole.warn
  console.log = originalConsole.log
})

function makeInstance(name, hooks = {}) {
  return {
    name,
    state: {},
    props: {},
    derivedStates: {},
    effects: [],
    context: {},
    cdo: {},
    container: {},
    root: {},
    lifecycleHooks: hooks,
    lifecycleState: 'mounted',
    children: [],
    parent: null,
    updateLogs: [],
    errorInfo: null,
    errorBoundary: null,
    hasError: false,
    errorCount: 0,
    lastErrorTime: null,
    autoSync: true,
    requestUpdate() {}
  }
}

function busyWait(ms) {
  const until = performance.now() + ms
  while (performance.now() < until) {}
}

test('debug manager captures console output and restores it on destroy', () => {
  const manager = new DebugManager({ autoShow: false })

  assert.notEqual(console.error, originalConsole.error)
  assert.notEqual(console.warn, originalConsole.warn)

  console.error(new Error('first failure'))
  console.error('second', 'failure')
  console.warn('careful')

  const info = manager.getDebugInfo()
  assert.equal(info.errors.length, 2)
  assert.equal(info.errors[0].error.message, 'first failure')
  assert.equal(info.errors[1].error.message, 'second failure')
  assert.equal(info.warnings.length, 1)
  assert.equal(info.warnings[0].data.message, 'careful')

  manager.destroy()

  assert.equal(console.error, originalConsole.error)
  assert.equal(console.warn, originalConsole.warn)
  assert.equal(console.log, originalConsole.log)
})

test('debug manager reports not measured metrics instead of random values', () => {
  const manager = new DebugManager({ autoShow: false })
  const metrics = manager.getDebugInfo().performanceMetrics

  assert.equal(metrics.lastUpdateInterval, null)
  assert.equal(metrics.averageUpdateInterval, null)
  assert.equal(metrics.maxUpdateInterval, null)
  assert.equal(metrics.fps, null)
  assert.equal(metrics.memoryUsage, 0)
  assert.ok(metrics.uptime >= 0)

  manager.destroy()
})

test('debug manager measures the interval between updates', () => {
  const manager = new DebugManager({ autoShow: false })
  const instance = makeInstance('yq-interval')
  manager.registerComponent(instance)

  assert.equal(manager.getDebugInfo().performanceMetrics.lastUpdateInterval, null)

  instance.lifecycleHooks.onMount()
  assert.equal(manager.getDebugInfo().performanceMetrics.lastUpdateInterval, null)

  busyWait(4)
  instance.lifecycleHooks.onUpdate()

  const metrics = manager.getDebugInfo().performanceMetrics
  assert.ok(metrics.lastUpdateInterval >= 1, String(metrics.lastUpdateInterval))
  assert.equal(metrics.averageUpdateInterval, metrics.lastUpdateInterval)
  assert.ok(metrics.maxUpdateInterval >= metrics.lastUpdateInterval)
  assert.equal(metrics.updateCount, 1)

  instance.lifecycleHooks.onUpdate()

  const next = manager.getDebugInfo().performanceMetrics
  assert.ok(next.maxUpdateInterval >= next.lastUpdateInterval)
  assert.ok(next.averageUpdateInterval <= next.maxUpdateInterval)
  assert.equal(next.updateCount, 2)

  manager.destroy()
})

test('debug manager installs the hooks it needs on registered components', () => {
  const manager = new DebugManager({ autoShow: false })
  const instance = makeInstance('yq-count')

  assert.equal(instance.lifecycleHooks.onUpdate, undefined)

  manager.registerComponent(instance)
  assert.equal(typeof instance.lifecycleHooks.onUpdate, 'function')
  assert.equal(typeof instance.lifecycleHooks.onMount, 'function')
  assert.equal(typeof instance.lifecycleHooks.onUnmount, 'function')

  manager.registerComponent(instance)
  instance.lifecycleHooks.onMount()
  instance.lifecycleHooks.onUpdate()
  instance.lifecycleHooks.onUpdate()
  manager.trackEffect('yq-count')

  const metrics = manager.getDebugInfo().performanceMetrics
  assert.equal(metrics.updateCount, 2)
  assert.equal(metrics.effectCount, 1)
  assert.equal(manager.getDebugInfo().updateLogs.length, 3)

  manager.destroy()
})

test('debug manager estimates fps from animation frames when the host provides them', () => {
  const pending = []
  let nextId = 1
  global.requestAnimationFrame = (fn) => {
    const id = nextId
    nextId += 1
    pending.push(fn)
    return id
  }
  global.cancelAnimationFrame = () => {}

  const manager = new DebugManager({ autoShow: false })
  const runFrames = () => {
    const batch = pending.splice(0, pending.length)
    for (const fn of batch) {
      fn(0)
    }
  }

  runFrames()
  runFrames()
  busyWait(4)

  const fps = manager.getDebugInfo().performanceMetrics.fps
  assert.equal(typeof fps, 'number')
  assert.ok(fps > 0 && fps <= 240, String(fps))

  manager.destroy()
  assert.equal(manager.getDebugInfo().performanceMetrics.fps, null)

  delete global.requestAnimationFrame
  delete global.cancelAnimationFrame
})

test('debug manager clears logs and exports a serializable snapshot', () => {
  const manager = new DebugManager({ autoShow: false })
  const instance = makeInstance('yq-logs', { onMount() {} })
  manager.registerComponent(instance)
  instance.lifecycleHooks.onMount()

  assert.ok(manager.getDebugInfo().updateLogs.length >= 1)

  const snapshot = JSON.parse(manager.exportDebugData())
  assert.equal(typeof snapshot.timestamp, 'number')
  assert.equal(typeof snapshot.uptime, 'number')
  assert.ok(snapshot.debugInfo)
  assert.ok(Array.isArray(snapshot.events))

  manager.clearLogs()
  assert.equal(manager.getDebugInfo().updateLogs.length, 0)

  manager.destroy()
})

test('debug manager forwards panel options to the mounted panel', () => {
  const manager = new DebugManager({
    autoShow: false,
    panel: { title: 'custom title', theme: 'light', maxLogs: 2, shortcut: false, showOnMount: false }
  })

  const panel = manager.getPanel()
  assert.ok(panel)
  assert.equal(findByRole(panel.element, 'header').children[0].textContent, 'custom title')
  assert.equal(manager.isPanelVisible(), false)

  manager.showPanel()
  assert.equal(manager.isPanelVisible(), true)

  manager.togglePanel()
  assert.equal(manager.isPanelVisible(), false)

  manager.destroy()
  assert.equal(manager.getPanel(), null)
})

test('debug manager destroy is idempotent', () => {
  const manager = new DebugManager({ autoShow: false })
  manager.destroy()
  manager.destroy()

  assert.equal(JSON.parse(manager.exportDebugData()).events.length, 0)
  assert.equal(manager.getPanel(), null)
  assert.equal(manager.isPanelVisible(), false)
  assert.equal(console.error, originalConsole.error)
})

test('attachDevtools returns a handle that controls the shared panel', () => {
  const handle = attachDevtools({})

  assert.equal(handle.attached, true)
  assert.ok(handle.panel)
  assert.equal(handle.isVisible(), true)

  handle.hide()
  assert.equal(handle.isVisible(), false)

  handle.toggle()
  assert.equal(handle.isVisible(), true)

  handle.clearLogs()
  const snapshot = JSON.parse(handle.exportSnapshot())
  assert.equal(typeof snapshot.timestamp, 'number')
  assert.ok(snapshot.debugInfo)

  handle.destroy()
  assert.equal(handle.panel, null)
  assert.equal(handle.isVisible(), false)
  assert.equal(console.error, originalConsole.error)
})
