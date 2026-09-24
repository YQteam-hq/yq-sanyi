# {{project}}

A yq-sanyi project scaffolded by `yq-sanyi-cli`.

## Requirements

- Node.js 18.17 or newer, only for the local development server.
- The yq-sanyi runtime, vendored at `vendor/core.global.js` so the page runs with no build step.

## Commands

```bash
yq dev
```

Serves this directory on `http://127.0.0.1:8080`, watches every file and reloads the
browser tab after a change. Override the defaults on the command line or in
`yq.config.mjs`:

```bash
yq dev --port 5000 --dir .
```

## Files

```text
index.html        entry document, loads the runtime and app.js
app.js            your component definitions
yq.config.mjs     defaults for the dev server
vendor/           the vendored yq-sanyi runtime
```

## Runtime

`vendor/core.global.js` is a copy of the built yq-sanyi core bundle and exposes the
global `yq` object. To refresh it, rebuild the yq-sanyi monorepo and copy
`packages/core/dist/core.global.js` over this file.

## Docs

The framework reference lives in the yq-sanyi repository: `README.md` for the API
surface and `docs/tutorial.md` for a guided tour.
