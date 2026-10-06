## [0.4.2] - 2026-10-07

### Added

- feat(define): make script optional (PR #26). Many minimal components only ship a template+style and never use script; `define()` now accepts an omitted / `undefined` / empty-object script and normalizes it to `null` at registration time. `ComponentDefinition.script` is typed as the new `ComponentScript` alias (`(() => unknown) | string | null | undefined`) so the optional contract is reflected in the type signature. A script value of `{}` round-trips unchanged and still resolves to a `null` `scriptFactory` (so it is harmless to provide).

### Changed

- chore: tighten linkedom range, extend check-deps to dist (PR #25)

## Unreleased

# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2026-10-06

### Fixed

- The gzipped core bundle is back under a sensible budget: core.mjs 11.71 KB gz / core.global.js 11.90 KB gz (down from 12.6 KB / 12.8 KB in v0.4.0). scripts/check-gzip.mjs ceiling lowered from 13 KB to 12 KB.

### Changed

- Debug instrumentation moved out of packages/core and into packages/devtools. The debug panel, debug manager and singleton (formerly packages/core/src/debug-*.ts) now live under packages/devtools/src/ and are re-exported from packages/devtools/src/index.ts. Core no longer imports them.
- attachDevtools() and the DevtoolsHandle interface are restored in packages/devtools/src/index.ts, wrapping the new DebugManager + DebugPanel from the local files so external consumers of devtools keep working.
- The orphan packages/core/src/debug-*.ts files were emptied to 1-byte placeholders (esbuild does not bundle them; the prior files were kept as cosmetic stand-ins after Git Data API physical-deletion attempts produced empty commits). Removable at any time with a follow-up commit.

### Removed

- The "Known gap: M4-7" section in the README.
- The "Known issues" entry in the v0.4.0 changelog block.
- The temporary _noopDebug stub that briefly lived in packages/core/src/index.ts in v0.4.0 (since then stripped: no debug calls remain in core; production bundle is fully clean).

## [0.4.0] - 2026-10-05

### Added

- T1 structural: nested yq-for at any depth, accessibility hooks
  (yq-on:keydown / focus / blur / paste / wheel plus aria-* bindings that only
  render when the bound path is non-empty), defineAlias(displayName, realName)
  shadow mapping, <template id="x"> static fragments expanded at parse time, and
  withErrorBoundary recovery via onRecover(state, err) + yq.onError(fn).
- T2 SSR: parseTemplateDSD(src) recognising <template shadowrootmode="open|closed">,
  the client hydration entry yq.hydrate(elementOrSelector, definition?), and an
  optional Node renderer entry at packages/core/node/renderToString.mjs
  (linkedom as an optional peer, so the core package keeps zero runtime deps).
- T3 reactive: yq.signal(initial) with .get() / .set() / .peek() / .subscribe(),
  derived auto-detecting signal and state dependencies, effectPre (synchronous)
  and effectScope for grouped invalidation, plus batch observability through
  setLifecycleHooks(..., { onBatchStart, onBatchEnd }).
- T4 ecosystem: Chrome / Firefox DevTools extension (manifest v3) under
  packages/devtools/extension/, React 19 and Vue 3 type wrappers in
  packages/wrappers (yq-sanyi-wrappers), a zero-dependency Playground example,
  new examples (nested-list / ssr-hydrate / a11y-form), and a "What's new in
  v0.4.0" tutorial section.

### Changed

- packages/core, packages/cli, packages/devtools, packages/scoper and
  packages/wrappers all report 0.4.0, matching the root manifest.
- The version constants in packages/core/src/version.ts and
  packages/core/src/index.ts report 0.4.0.

### Fixed

- packages/core/src/renderer.ts: the keyed nested-row lookup referenced an
  undefined rowIds; it now uses the in-scope containerIds set.
- packages/core/node/renderToString.mjs: hostTag now reports the lowercase
  host.localName instead of the resolved tagName.
- scripts/check-deps.mjs: declared optional and peer modules (linkedom,
  react, vue) and .d.ts type declarations are no longer flagged as third-party
  runtime dependencies.

## [0.3.0] - 2026-09-22

### Added

- Nested yq-for. A keyed row may now contain another yq-for; the parser accepts
  list nodes at any depth and the renderer mounts, updates and disposes inner rows
  recursively. yq-key stability and the {{ $index }} row index keep working at
  every level.
- CHANGELOG.md, plus scripts/check-changelog.mjs wired into npm run check:all
  so the changelog and the root manifest can never drift apart again.
- SECURITY.md with the supported version matrix and the vulnerability report path.
- .github/dependabot.yml, watching npm and github-actions weekly.

### Changed

- packages/core, packages/devtools and packages/scoper all report 0.3.0,
  matching the root manifest.
- Every organisation reference in the English and Chinese READMEs points at the
  canonical repository.

### Removed

- The "Nested yq-for" entry under Known limitations, now that the feature ships.

## [0.2.1] - 2026-09-07

### Fixed

- Dynamic attr="{{ path }}" bindings on void elements now apply on mount and on
  every update. Previously setAttribute was skipped for tags such as input,
  img and br, so bindings like value="{{ form.name }}" and
  data-id="{{ item.id }}" were silently dropped.

### Changed

- The parser emits a single slot shape for attr and bool bindings, each
  carrying its resolved path, so the renderer dispatches them consistently.

### Tests

- 133 passing, including four new attr-binding.test.mjs cases covering value
  mount, value update, boolean attributes and void-element attributes.

## [0.2.0] - 2026-09-06

### Added

- Browser bundle distribution through GitHub Releases: core.global.js (IIFE,
  attaches yq to window), core.mjs (ESM) and devtools.mjs.

### Changed

- The English and Chinese tutorials were rewritten around the declarative API.

### Tests

- The smoke suites were hardened into real node --test assertions.

### Removed

- Internal prototype pages under examples/prototypes/ and tests/*.html.

[0.4.2]: https://github.com/YQteam-hq/yq-sanyi/releases/tag/v0.4.2
[0.4.1]: https://github.com/YQteam-hq/yq-sanyi/releases/tag/v0.4.1
[0.4.0]: https://github.com/YQteam-hq/yq-sanyi/releases/tag/v0.4.0
[0.3.0]: https://github.com/YQteam-hq/yq-sanyi/releases/tag/v0.3.0
[0.2.1]: https://github.com/YQteam-hq/yq-sanyi/releases/tag/v0.2.1
[0.2.0]: https://github.com/YQteam-hq/yq-sanyi/releases/tag/v0.2.0
