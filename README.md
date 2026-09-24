# yq-sanyi

**Define a component once. Use it as a real HTML tag, anywhere. No build step.**

yq-sanyi ("trinity") is a zero-dependency web component framework written from scratch. A component carries its template, behavior and scoped style in one definition — the three parts share one scope, one reactive state and one lifecycle — and becomes a native HTML element you drop straight into any page.

[Chinese README](./docs/i18n/zh-CN/README.md) · [English tutorial](./docs/tutorial.md) · [Chinese tutorial](./docs/i18n/zh-CN/tutorial.md)

![license](https://img.shields.io/badge/license-Apache%202.0-blue)
![version](https://img.shields.io/badge/version-v0.3.0-2ea44f)
![repository](https://img.shields.io/badge/github-YQteam--dyq%2Fyq--sanyi-2ea44f)
![dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen)
![size](https://img.shields.io/badge/core-11.3%20kB%20gzipped-2ea44f)

## Why yq-sanyi

- **Declarative by design.** Call `yq.define(...)` once, then write `<yq-counter>` in plain HTML — the tag mounts, renders and cleans itself up. No mounting code per usage, no framework tag.
- **State changes re-render automatically.** Mutate the state object inside a handler and the affected parts update in place; remove the tag from the page and every subscription, listener and style is released.
- **Zero dependencies, zero build for users.** The core is a single ~8.5 kB (gzipped) bundle. It runs on Web-standard APIs only — no JSX, no virtual DOM, no framework runtime, no compiler.
- **Scoped styles with no leaks.** Styles declared in a component only apply inside that component. Theme variables and global styles are managed explicitly, and one style is shared by all instances of the same component.
- **Failure isolation.** A broken component renders an error placeholder and a structured warning while the rest of the page keeps working.
- **One source of truth.** Template, behavior and style live in one unit — a component is easy to read, easy to reuse and easy to audit.

## How a component is defined

```js
yq.define('yq-counter', {
  template: '<button yq-on:click="inc">count {{ count }}</button>',
  style: 'button { font-size: 18px; padding: 8px 18px; }',
  script: function () {
    return {
      state: { count: 0 },
      inc: function (state) {
        state.count = state.count + 1
      }
    }
  }
})
```

The template is standard HTML, the style is standard CSS, the script is standard JS. The `script` function returns the component state plus event handlers; handlers receive the reactive state object, so a mutation is observed and re-rendered for you. Custom elements already registered this way can be nested inside other templates like any other tag.

## Quick start

Clone the repository, build the bundle once, then open or write plain HTML files:

```bash
git clone https://github.com/YQteam-hq/yq-sanyi.git
cd yq-sanyi
npm install
npm run build
```

Save this as `index.html` and open it in a browser:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>yq-sanyi quick start</title>
</head>
<body>
  <yq-counter></yq-counter>

  <script src="./packages/core/dist/core.global.js"></script>
  <script>
    yq.define('yq-counter', {
      template: '<button yq-on:click="inc">count {{ count }}</button>',
      style: 'button { font-size: 18px; padding: 8px 18px; }',
      script: function () {
        return {
          state: { count: 0 },
          inc: function (state) {
            state.count = state.count + 1
          }
        }
      }
    })
  </script>
</body>
</html>
```

Every `<yq-counter>` on the page becomes a live counter. In a module script the same API is available from `./packages/core/dist/core.mjs`; an imperative API (`createComponent`, `mountComponent`, ...) is exported for programmatic use.

A runnable showcase is in [examples/full-demo.html](./examples/full-demo.html).

## Component tag names

Component tags are native custom elements, so they follow the HTML custom element rules:

- start with a lowercase letter,
- contain a hyphen (`-`),
- use lowercase `a-z`, digits, `.`, `_` and `-` afterwards.

| Use this | This does not work | Why |
| --- | --- | --- |
| `<yq-counter>` | `<counter>` | no hyphen — the browser treats it as a plain unknown element |
| `<x-666>` | `<666>` | digits-only names cannot be elements; hyphenate it (`x-666`) |
| `<yq-todo-item>` | `<Todo-Item>` | custom element names must be lowercase |

`define` rejects invalid names with a clear error, so a typo never fails silently in the page.

## What is in v0.3.0

- **Declarative components.** `define` registers a native custom element; tags auto-mount, auto-update and auto-cleanup.
- **Template.** Text binding `{{ path }}`, whole-value attribute binding, boolean attributes, list rendering `yq-for` with stable `yq-key` and an optional row index, nested `yq-for` inside a keyed row, event binding `yq-on:event="handler"` on static parts and inside list rows, conditional rendering with `yq-if` / `yq-else-if` / `yq-else` / `yq-show`, and two-way form binding with `yq-model` plus `.trim` / `.number` / `.lazy` modifiers.
- **Component model.** Parent-to-child props via tag attributes (static or bound, type-preserving), content distribution through default and named `<slot>` placeholders, child-to-parent `$emit('event', payload)` with `yq-on:` listeners on the child tag, and `<yq-component yq-is="name">` dynamic components driven by state.
- **Declarative lifecycle.** `onMount` / `onUpdate` / `onUnmount` returned from `script` run at the matching phase with the reactive state, alongside the imperative `setLifecycleHooks`.
- **State and handlers.** The `script` function returns `{ state, ...handlers }`; writes inside one synchronous task are batched into a single refresh.
- **Reactive primitives.** `state`, `derived`, `effect` — derived values cache until their dependencies change, effects may return a cleanup function and are disposed with the component.
- **Rendering.** Static skeleton is cloned once and updates write only the bound slots — no subtree rebuilds, no virtual DOM.
- **Scoped styles.** Scope rewriting with no Shadow DOM required, CSS variable theming, shared single injection per component, global style registry.
- **Lifecycle.** Ordered mount / update / unmount with leak-free disposal; nested components clean up when their host is removed.
- **Debug hooks.** Component tree, state snapshots and update logs are readable through lifecycle hooks; a separate devtools package is available.

## API at a glance

| API | Purpose |
| --- | --- |
| `yq.define(name, { template, style, script })` | register a component as a custom element; `script` may also return `onMount` / `onUpdate` / `onUnmount` hooks |
| template directives | `yq-if` / `yq-else-if` / `yq-else` / `yq-show`, `yq-for` + `yq-key`, `yq-on:event`, `yq-model[.trim/.number/.lazy]`, `<slot>` / `slot="name"`, `<yq-component yq-is>`, `$emit('name', path)` |
| `yq.lookup(name)` | resolve a registered definition |
| `state(initial)` / `derived(fn)` / `effect(fn)` | reactive primitives with dependency tracking |
| `createComponent`, `mountComponent`, `updateComponent`, `unmountComponent` | imperative lifecycle control |
| `setLifecycleHooks`, `getComponentTree`, `getUpdateLogs`, `getStateSnapshot` | lifecycle hooks and debug reads |
| `withErrorBoundary`, `resetErrorBoundary` | per-component error boundaries |
| `yq.scoper` | scoped styles, theming and global style registry |

The ESM entry is `packages/core/dist/core.mjs`; the global build is `packages/core/dist/core.global.js` (exposed as `window.yq`).

## Examples

| Example | Shows |
| --- | --- |
| [basic.html](./examples/basic.html) | smallest declarative component, single script tag |
| [full-demo.html](./examples/full-demo.html) | declarative tags, events, lists and state on one page |
| [parse-demo.html](./examples/parse-demo.html) | template parsing walk-through |
| [reactive-demo.html](./examples/reactive-demo.html) | `state` / `derived` / `effect` primitives |
| [list-row-events.html](./examples/list-row-events.html) | handlers and indexes bound inside `yq-for` rows |
| [nested-for.html](./examples/nested-for.html) | a tree menu built from nested `yq-for` rows that expand and collapse |
| [csp-test.html](./examples/csp-test.html) | behavior-script execution under a strict CSP |

## Known limitations

- **Shadow DOM is opt-in.** Style isolation uses scope rewriting by default; `createScopedElement` accepts `useShadowDOM` when strong encapsulation is needed.
- **v0.3.0 is browser-runtime only.** No SSR, no CLI, no non-browser targets. All are deliberate non-goals for this release.

## Documentation

| Document | Description |
| --- | --- |
| [English tutorial](./docs/tutorial.md) | Template syntax, state, effects and lifecycle from zero |
| [Chinese tutorial](./docs/i18n/zh-CN/tutorial.md) | Template syntax, state, effects and lifecycle |

## Repository layout

```
packages/core/src      core runtime: registry, parser, reactive, render, scoper, lifecycle
packages/core/dist     built bundles (core.mjs, core.global.js)
packages/core/test     node:test assertion suite
packages/devtools      optional debug panel (separate bundle)
bench/                 performance harness: first-interactive, update-latency, scroll-fps
examples/              runnable HTML demos
docs/                  tutorials
scripts/               repo gates: dependency graph and bundle-size checks
```

## Development

```bash
npm run build
npm run test
npm run bench
npm run check:all
```

- `npm run build` — bundle `dist/core.mjs` and `dist/core.global.js`
- `npm run test` — run the core test suite
- `npm run bench` — measure the performance budgets and fail when one is missed
- `npm run check:all` — dependency graph, bundle-size and performance gates

## Performance gate

`npm run bench` measures three budgets and exits non-zero as soon as one of them is missed, so a merge cannot land a rendering regression. CI runs it as part of `npm run check:all`, which is the `Repo gates` step of the required `Build / Typecheck / Test` check.

| Metric | Budget | What is measured |
| --- | --- | --- |
| `first-interactive` | `<= 1000 ms` | Cold boot of a 3000-row board: `define` plus template parsing, mounting, the first animation frame, and a click that has to reach the DOM. Reported as the p95 of 10 runs, after 2 warm-up runs. |
| `update-latency` | `<= 200 ms` | Time from a state write that replaces all 3000 rows to the moment the DOM shows the new revision. Reported as the p95 of 60 updates, after 10 warm-up updates. |
| `scroll-fps` | `>= 55 fps` | Scroll frames over a 2000-row list with a 200-row window that advances 4 rows per frame. The p95 main-thread cost of one frame is converted into the frame rate a 60 Hz display sustains (`1000 / p95`, capped at 60). |

Three things are worth knowing about the harness:

- It is pure Node and keeps the zero-dependency rule. It installs a small headless DOM, then drives the real render pipeline and reads the real DOM back, so a browser is never required.
- `scroll-fps` is derived from the measured main-thread cost instead of a wall-clock frame loop. A busy CI runner can therefore not turn timer jitter into a false failure, and the reported `frame p50` / `frame p95` values stay comparable between machines against the 16.67 ms budget of one 60 Hz frame.
- The workloads are sized to leave roughly 3x to 6x headroom on a normal runner, so the gate reacts to real regressions rather than to noise.

## Support

yq-sanyi is built and maintained in our free time. If it saves you time, consider supporting the project:

- 爱发电 (Afdian): <https://afdian.com/a/yqteam?utm_source=copylink&utm_medium=link>

Your support helps keep the framework free, open and zero-dependency.

## License

Apache License 2.0. Copyright 2026 YQteam-hq. See [LICENSE](./LICENSE).
