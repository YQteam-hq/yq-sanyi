// packages/core/node/renderToString.mjs
//
// M2-3 Node-side SSR entry (skeleton).
//
// Exports a renderToString API surface so downstream consumers can wire
// their SSR pipeline against the eventual signature; the current core
// bundle has two blockers under esbuild --minify that prevent full Node
// SSR from working end-to-end:
//   1. core's hydrate() references an internal helper findParentInstance
//      whose definition was inlined away. hydrate() therefore throws a
//      ReferenceError when called outside the browser.
//   2. core's createComponent + mountComponent path assumes the global
//      document / HTMLElement symbols (the bundle emits globalThis.document
//      directly). linkedom supplies these when assigned to globalThis,
//      but mountComponent's downstream pipeline does a string.replace that
//      throws TypeError on a bound _yqInstance.props mapping.
//
// Both blockers are in core/dist/core.mjs and require core-side refactor
// to fix (export the helpers, route document lookups through a swappable
// module, or skip the offending string ops when there is no parentInstance).
// Until then this module validates inputs and shapes the API; full SSR
// execution will throw with the same ReferenceError/TypeError that this
// PR documents. Track the recovery in the v0.4.1 plan.
//
// linkedom is declared as optionalDependency in packages/core/package.json
// so installing yq-sanyi-core does not force linkedom on browser users.

import { parseHTML } from 'linkedom';

function buildShell() {
  const dom = parseHTML('<!DOCTYPE html><html><head></head><body></body></html>');
  return { document: dom.document, body: dom.document.body, window: dom.window };
}

function checkInputs(name, definition, props) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('[yq:renderToString] component name must be a non-empty string');
  }
  if (definition !== undefined && (typeof definition !== 'object' || definition === null)) {
    throw new Error('[yq:renderToString] definition must be an object when provided');
  }
  if (props !== undefined && (typeof props !== 'object' || props === null)) {
    throw new Error('[yq:renderToString] props must be an object when provided');
  }
}

export function renderToString(name, definition, props) {
  checkInputs(name, definition, props);
  const { document, body, window } = buildShell();
  const host = document.createElement(name);
  body.appendChild(host);
  return {
    ok: false,
    reason: 'core bundle not yet Node-SSR-ready; see header comment in renderToString.mjs',
    hostTag: host.tagName,
    windowAvailable: typeof window !== 'undefined',
  };
}

export function renderFragmentToString(definition, props) {
  const name = definition && definition.name ? definition.name : 'yq-fragment';
  return renderToString(name, definition, props);
}

export const version = '0.4.0-node-skeleton';
