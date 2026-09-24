import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { DebugPanel } from '../../devtools/dist/devtools.mjs'
import { installPanelDom, findByRole, findTab } from './helpers/panel-dom.mjs'

const dom = installPanelDom()

after(() => {
  dom.restore()
})

function dump(root) {
  const parts = [root.textContent || '', root.innerHTML || '']
  for (const child of root.children || []) {
    parts.push(dump(child))
  }
  return parts.join('\n')
}

function rendered(panel) {
  return dump(findByRole(panel.element, 'tab-content'))
}

function sampleInfo(overrides = {}) {
  return {
    componentTree: {
      'yq-counter': { name: 'yq-counter', lifecycleState: 'mounted', children: [], hasError: false }
    },
    updateLogs: [
      { timestamp: Date.now(), type: 'mount', path: 'mount' },
      { timestamp: Date.now(), type: 'update', path: 'count' }
    ],
    stateSnapshot: { 'yq-counter': { state: { count: 1 } } },
    performanceMetrics: {
      updateCount: 1,
      effectCount: 2,
      memoryUsage: 4,
      uptime: 1500,
      fps: null,
      lastUpdateInterval: 1.5,
      averageUpdateInterval: 1.5,
      maxUpdateInterval: 1.5
    },
    errors: [],
    warnings: [],
    ...overrides
  }
}

function pressKey(overrides = {}) {
  dom.dispatchDocument('keydown', {
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    metaKey: false,
    key: 'y',
    target: { tagName: 'DIV' },
    preventDefault() {},
    ...overrides
  })
}

test('debug panel mounts hidden and toggles visibility', () => {
  const panel = new DebugPanel()

  assert.equal(panel.isVisible, false)
  assert.equal(dom.body.children.includes(panel.element), true)

  const panelNode = findByRole(panel.element, 'panel')
  assert.equal(panelNode.style.display, 'none')

  panel.show()
  assert.equal(panel.isVisible, true)
  assert.equal(panelNode.style.display, 'flex')

  panel.toggle()
  assert.equal(panel.isVisible, false)

  findByRole(panel.element, 'minimize').onclick()
  assert.equal(panel.isVisible, true)

  findByRole(panel.element, 'close').onclick()
  assert.equal(panel.isVisible, false)

  panel.destroy()
})

test('debug panel renders five tabs with the first one active', () => {
  const panel = new DebugPanel()
  const tabs = findByRole(panel.element, 'tabs')

  assert.equal(tabs.children.length, 5)
  assert.deepEqual(
    tabs.children.map((tab) => tab.textContent),
    ['Components', 'State', 'Logs', 'Performance', 'Errors']
  )
  assert.equal(panel.activeTabKey, 'components')
  assert.equal(findTab(panel.element, 'components').style.borderBottomColor, '#3b82f6')
  assert.equal(findTab(panel.element, 'state').style.borderBottomColor, 'transparent')

  panel.destroy()
})

test('debug panel renders only the selected tab', () => {
  const panel = new DebugPanel()
  panel.updateDebugInfo(sampleInfo())

  findTab(panel.element, 'state').onclick()
  assert.equal(panel.activeTabKey, 'state')
  assert.match(rendered(panel), /State Information/)
  assert.doesNotMatch(rendered(panel), /Component Tree/)

  findTab(panel.element, 'performance').onclick()
  assert.match(rendered(panel), /Performance Metrics/)

  findTab(panel.element, 'components').onclick()
  assert.match(rendered(panel), /Component Tree/)

  panel.destroy()
})

test('debug panel escapes state values so markup cannot break it', () => {
  const panel = new DebugPanel()
  panel.updateDebugInfo(
    sampleInfo({ stateSnapshot: { 'yq-x': { state: { label: '<img src=x onerror="alert(1)">' } } } })
  )
  panel.showTab('state')

  const html = rendered(panel)
  assert.match(html, /&lt;img src=x/)
  assert.match(html, /&quot;/)
  assert.doesNotMatch(html, /<img src=x/)

  panel.destroy()
})

test('debug panel escapes log paths, error messages and warnings', () => {
  const panel = new DebugPanel()
  panel.updateDebugInfo(
    sampleInfo({
      updateLogs: [{ timestamp: Date.now(), type: 'update', path: '<b>path</b>', componentName: 'yq-row' }],
      errors: [{ message: '<script>alert(1)</script>', timestamp: Date.now() }],
      warnings: [{ message: 'careful <b>', timestamp: Date.now() }]
    })
  )

  panel.showTab('logs')
  const logs = rendered(panel)
  assert.match(logs, /&lt;b&gt;path&lt;\/b&gt;/)
  assert.doesNotMatch(logs, /<b>path<\/b>/)

  panel.showTab('errors')
  const errors = rendered(panel)
  assert.match(errors, /ERROR/)
  assert.match(errors, /WARNING/)
  assert.match(errors, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.doesNotMatch(errors, /<script>/)

  panel.destroy()
})

test('debug panel renders circular state without throwing', () => {
  const circular = { name: 'root' }
  circular.self = circular

  const panel = new DebugPanel()
  panel.updateDebugInfo(sampleInfo({ stateSnapshot: { 'yq-x': { state: circular } } }))
  panel.showTab('state')

  assert.match(rendered(panel), /\[circular\]/)

  panel.destroy()
})

test('debug panel keeps two mounted panels independent', () => {
  const first = new DebugPanel()
  const second = new DebugPanel()

  first.updateDebugInfo(sampleInfo({ stateSnapshot: { alpha: { state: { value: 'A' } } } }))
  second.updateDebugInfo(sampleInfo({ stateSnapshot: { beta: { state: { value: 'B' } } } }))

  first.showTab('state')
  second.showTab('state')

  const firstHtml = rendered(first)
  const secondHtml = rendered(second)

  assert.match(firstHtml, /alpha/)
  assert.doesNotMatch(firstHtml, /beta/)
  assert.match(secondHtml, /beta/)
  assert.doesNotMatch(secondHtml, /alpha/)

  first.destroy()
  second.destroy()
})

test('debug panel re-renders the active tab on new debug info', () => {
  const panel = new DebugPanel()
  panel.showTab('logs')
  panel.updateDebugInfo(sampleInfo())

  assert.equal(panel.activeTabKey, 'logs')
  assert.match(rendered(panel), /Update Logs/)
  assert.doesNotMatch(rendered(panel), /Component Tree/)

  panel.destroy()
})

test('debug panel filters update logs by type and path', () => {
  const panel = new DebugPanel()
  panel.updateDebugInfo(
    sampleInfo({
      updateLogs: [
        { timestamp: Date.now(), type: 'mount', path: 'mount' },
        { timestamp: Date.now(), type: 'update', path: 'count' },
        { timestamp: Date.now(), type: 'update', path: 'label' }
      ]
    })
  )
  panel.showTab('logs')

  const input = findByRole(panel.element, 'log-filter')

  input.value = 'count'
  input.oninput()
  assert.match(rendered(panel), /showing all 1 matching logs/)
  assert.doesNotMatch(rendered(panel), /Path: label/)

  input.value = 'nothing-here'
  input.oninput()
  assert.match(rendered(panel), /No logs match &quot;nothing-here&quot;/)

  input.value = ''
  input.oninput()
  assert.match(rendered(panel), /showing all 3 matching logs/)

  panel.destroy()
})

test('debug panel caps rendered log rows at maxLogs', () => {
  const panel = new DebugPanel({ maxLogs: 2 })
  const logs = Array.from({ length: 5 }, (_value, index) => ({
    timestamp: Date.now(),
    type: 'update',
    path: 'row-' + index
  }))
  panel.updateDebugInfo(sampleInfo({ updateLogs: logs }))
  panel.showTab('logs')

  const html = rendered(panel)
  assert.match(html, /showing the last 2 of 5 matching logs/)
  assert.equal(html.split('Type:').length - 1, 2)
  assert.match(html, /Path: row-4/)
  assert.doesNotMatch(html, /Path: row-0/)

  panel.destroy()
})

test('debug panel toggles by keyboard and ignores text entry', () => {
  const panel = new DebugPanel()

  assert.equal(panel.isVisible, false)
  pressKey()
  assert.equal(panel.isVisible, true)

  pressKey({ target: { tagName: 'INPUT' } })
  assert.equal(panel.isVisible, true)

  pressKey({ key: 'u' })
  assert.equal(panel.isVisible, true)

  pressKey({ ctrlKey: false })
  assert.equal(panel.isVisible, true)

  pressKey()
  assert.equal(panel.isVisible, false)

  panel.destroy()
})

test('debug panel supports a custom shortcut and can disable it', () => {
  const custom = new DebugPanel({ shortcut: 'ctrl+alt+k' })
  dom.dispatchDocument('keydown', {
    ctrlKey: true,
    altKey: true,
    shiftKey: false,
    metaKey: false,
    key: 'K',
    target: { tagName: 'DIV' }
  })
  assert.equal(custom.isVisible, true)

  const listenersBefore = dom.listenerCount('keydown')
  custom.destroy()
  assert.equal(dom.listenerCount('keydown'), listenersBefore - 1)

  const disabled = new DebugPanel({ shortcut: false })
  pressKey()
  assert.equal(disabled.isVisible, false)
  disabled.destroy()
})

test('debug panel drags the container and clamps it to the viewport', () => {
  const mousemovesBefore = dom.listenerCount('mousemove')
  const mouseupsBefore = dom.listenerCount('mouseup')
  const panel = new DebugPanel()
  const header = findByRole(panel.element, 'header')

  assert.equal(dom.listenerCount('mousemove'), mousemovesBefore + 1)

  panel.element.rect = { left: 900, top: 30 }
  header.dispatch('mousedown', { clientX: 900, clientY: 30, preventDefault() {} })
  dom.dispatchDocument('mousemove', { clientX: 880, clientY: 60 })

  assert.equal(panel.element.style.left, '880px')
  assert.equal(panel.element.style.top, '60px')
  assert.equal(panel.element.style.right, 'auto')
  assert.equal(panel.element.style.bottom, 'auto')

  dom.dispatchDocument('mousemove', { clientX: -500, clientY: -500 })
  assert.equal(panel.element.style.left, '0px')
  assert.equal(panel.element.style.top, '0px')

  dom.dispatchDocument('mouseup', {})
  dom.dispatchDocument('mousemove', { clientX: 100, clientY: 100 })
  assert.equal(panel.element.style.left, '0px')

  panel.destroy()
  assert.equal(dom.listenerCount('mousemove'), mousemovesBefore)
  assert.equal(dom.listenerCount('mouseup'), mouseupsBefore)
})

test('debug panel auto shows on first update or on errors', () => {
  const first = new DebugPanel({ showOnMount: true, showOnError: false })
  first.updateDebugInfo(sampleInfo())
  assert.equal(first.isVisible, true)
  first.destroy()

  const quiet = new DebugPanel({ showOnMount: false, showOnError: false })
  quiet.updateDebugInfo(sampleInfo())
  assert.equal(quiet.isVisible, false)
  quiet.destroy()

  const onError = new DebugPanel({ showOnMount: false, showOnError: true })
  onError.updateDebugInfo(sampleInfo({ errors: [{ message: 'boom', timestamp: Date.now() }] }))
  assert.equal(onError.isVisible, true)
  onError.destroy()
})

test('debug panel reports missing metrics as not measured', () => {
  const panel = new DebugPanel()
  panel.updateDebugInfo(
    sampleInfo({ performanceMetrics: { updateCount: 3, effectCount: 1, memoryUsage: 2 } })
  )
  panel.showTab('performance')

  const html = rendered(panel)
  assert.match(html, /Last update interval:<\/strong> not measured/)
  assert.match(html, /FPS:<\/strong> not measured/)
  assert.match(html, /Update count:<\/strong> 3/)
  assert.match(html, /Uptime:<\/strong> not measured/)

  panel.destroy()
})

test('debug panel renders measured metrics when they are available', () => {
  const panel = new DebugPanel()
  panel.updateDebugInfo(sampleInfo())
  panel.showTab('performance')

  const html = rendered(panel)
  assert.match(html, /Last update interval:<\/strong> 1\.50 ms/)
  assert.match(html, /Max update interval:<\/strong> 1\.50 ms/)
  assert.match(html, /Uptime:<\/strong> 1\.5 s/)
  assert.match(html, /Memory usage:<\/strong> 4 MB/)

  panel.destroy()
})

test('debug panel renders the message of a captured error and warning event', () => {
  const panel = new DebugPanel()
  panel.updateDebugInfo(
    sampleInfo({
      errors: [
        { timestamp: Date.now(), type: 'error', componentName: 'Console', error: new Error('console failure') }
      ],
      warnings: [{ timestamp: Date.now(), type: 'warning', componentName: 'Console', data: { message: 'console warning' } }]
    })
  )
  panel.showTab('errors')

  const html = rendered(panel)
  assert.match(html, /console failure/)
  assert.match(html, /console warning/)
  assert.doesNotMatch(html, /&gt;\{\}&lt;/)

  panel.destroy()
})

test('debug panel auto update re-renders the active tab and stops on destroy', () => {
  const panel = new DebugPanel()
  panel.updateDebugInfo(sampleInfo())
  panel.showTab('state')
  panel.startAutoUpdate(50)

  const ids = Array.from(dom.intervals.keys())
  const timer = dom.intervals.get(ids[ids.length - 1])
  assert.equal(timer.ms, 50)

  timer.fn()
  assert.equal(panel.activeTabKey, 'state')
  assert.match(rendered(panel), /State Information/)

  panel.destroy()
  assert.equal(dom.intervals.has(ids[ids.length - 1]), false)
  assert.equal(panel.isVisible, false)

  panel.show()
  assert.equal(panel.isVisible, false)
})
