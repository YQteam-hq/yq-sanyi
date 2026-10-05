# Devtools panel

`yq-sanyi-devtools` ships a floating panel with the component tree, the state snapshot,
the update log, the performance metrics and the captured errors of a running app.
It is a development tool: keep it out of production bundles.

The panel renders into `document.body`, so it needs a DOM. Import the workspace build
directly from a page that already loaded the runtime:

```js
import { attachDevtools } from '../packages/devtools/dist/devtools.mjs'

const devtools = attachDevtools({ panel: { theme: 'dark', maxLogs: 50 } })
```

`attachDevtools(root, options)` accepts the manager options plus a `panel` object with the
panel options below, and returns a handle.

## Handle

| Member | Description |
| --- | --- |
| `attached` | Always `true` once the manager exists |
| `panel` | The `DebugPanel` instance, or `null` after `destroy()` |
| `registerComponent(instance)` | Adds a component instance to the tree, the state snapshot and the render metrics |
| `show()` / `hide()` / `toggle()` / `isVisible()` | Panel visibility |
| `clearLogs()` | Drops the buffered events and resets the counters |
| `exportSnapshot()` | Serializes the debug info and the buffered events as JSON text |
| `destroy()` | Tears down the shared manager: removes the panel, the listeners and the console capture |

The manager is a singleton, so `destroy()` releases the instance for the whole page.

## Registering components

The panel only knows what it is told. Register the instances you want to inspect, and the
Components tab, the State tab and the render metrics fill in:

```js
const element = document.querySelector('yq-todo')
if (element && element._yqInstance) {
  devtools.registerComponent(element._yqInstance)
}
```

Registration installs the manager's own `onMount`, `onUpdate` and `onUnmount` hooks when the
component has none, so any registered component reports updates and update intervals without
extra wiring. Registering the same instance twice is a no-op, and components that are never
registered never contribute a sample.

## Panel options

| Option | Default | Description |
| --- | --- | --- |
| `position` | `'top-right'` | One of `top-right`, `top-left`, `bottom-right`, `bottom-left` |
| `theme` | `'dark'` | `dark` or `light` |
| `title` | `'🔍 yq-sanyi Debug Panel'` | Header text |
| `autoShow` | `false` | Show the panel as soon as it is created |
| `showOnMount` | `true` | Show the panel on the first `updateDebugInfo` call |
| `showOnError` | `true` | Show the panel as soon as an error is captured |
| `shortcut` | `'ctrl+shift+y'` | Toggle shortcut, or `false` to disable it |
| `maxLogs` | `200` | Maximum number of log rows rendered in the Logs tab |

The default shortcut is ignored while the focus sits in an input, a textarea, a select or a
contenteditable element, so typing `y` in a form never toggles the panel.

## Interaction

Drag the panel by its header. The header moves the fixed container and clamps it to the
viewport, so the panel cannot be dragged off screen.

The Logs tab renders a filter box. Matching is a case-insensitive substring test over the
event type, the path, the component name and the event message. Rendering is capped at
`maxLogs` rows and the summary line always states how many rows match and how many are shown.

## Metrics

The Performance tab renders what was actually measured and prints `not measured` for
everything else. No metric is synthesized.

| Metric | Source |
| --- | --- |
| Last, Average, Max update interval | Time between consecutive `onUpdate` calls of a registered component, starting from its `onMount` |
| Update count | `onUpdate` calls seen by the manager |
| Effect count | `trackEffect` calls seen by the manager |
| Memory usage | `performance.memory`, Chromium only |
| Uptime | Time since the manager was created |
| FPS | `requestAnimationFrame` sampling, `not measured` when the host has no animation frames |

Earlier versions printed a `renderTime` built from `Math.random()`. The panel no longer
invents numbers: the framework times a render internally and does not expose the duration,
so the panel reports the update interval it can actually observe and prints `not measured`
for everything else.

## Rendering safety

Every value that reaches the panel is HTML escaped, including the pretty-printed state
snapshot, the log paths and the error messages. Application state that contains markup is
displayed as text instead of being injected into the panel. Circular references are rendered
as `[circular]`, `Error` objects and captured events are rendered with their message, and
BigInt values as plain digits, so a snapshot always renders.

## Teardown

`destroy()` removes the panel node, the header drag listeners, the keyboard shortcut and the
auto-update interval, and it restores the `console.error`, `console.warn` and `console.log`
methods that the manager captured. Calling it twice is safe.

```js
window.addEventListener('beforeunload', function () {
  devtools.destroy()
})
```

A runnable page lives in `examples/devtools-panel.html`.
