# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-09-22

### Added

- Nested `yq-for`. A keyed row may now contain another `yq-for`; the parser accepts
  list nodes at any depth and the renderer mounts, updates and disposes inner rows
  recursively. `yq-key` stability and the `{{ $index }}` row index keep working at
  every level.
- `CHANGELOG.md`, plus `scripts/check-changelog.mjs` wired into `npm run check:all`
  so the changelog and the root manifest can never drift apart again.
- `SECURITY.md` with the supported version matrix and the vulnerability report path.
- `.github/dependabot.yml`, watching npm and github-actions weekly.

### Changed

- `packages/core`, `packages/devtools` and `packages/scoper` all report `0.3.0`,
  matching the root manifest.
- Every organisation reference in the English and Chinese READMEs points at the
  canonical repository.

### Removed

- The "Nested `yq-for`" entry under Known limitations, now that the feature ships.

## [0.2.1] - 2026-09-07

### Fixed

- Dynamic `attr="{{ path }}"` bindings on void elements now apply on mount and on
  every update. Previously `setAttribute` was skipped for tags such as `input`,
  `img` and `br`, so bindings like `value="{{ form.name }}"` and
  `data-id="{{ item.id }}"` were silently dropped.

### Changed

- The parser emits a single slot shape for `attr` and `bool` bindings, each
  carrying its resolved `path`, so the renderer dispatches them consistently.

### Tests

- 133 passing, including four new `attr-binding.test.mjs` cases covering `value`
  mount, `value` update, boolean attributes and void-element attributes.

## [0.2.0] - 2026-09-06

### Added

- Browser bundle distribution through GitHub Releases: `core.global.js` (IIFE,
  attaches `yq` to `window`), `core.mjs` (ESM) and `devtools.mjs`.

### Changed

- The English and Chinese tutorials were rewritten around the declarative API.

### Tests

- The smoke suites were hardened into real `node --test` assertions.

### Removed

- Internal prototype pages under `examples/prototypes/` and `tests/*.html`.

[0.3.0]: https://github.com/YQteam-hq/yq-sanyi/releases/tag/v0.3.0
[0.2.1]: https://github.com/YQteam-hq/yq-sanyi/releases/tag/v0.2.1
[0.2.0]: https://github.com/YQteam-hq/yq-sanyi/releases/tag/v0.2.0
