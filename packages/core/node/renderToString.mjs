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
    reason: 'core bundle not yet Node-SSR-ready',
    hostTag: host.localName,
    windowAvailable: typeof window !== 'undefined',
  };
}

export function renderFragmentToString(definition, props) {
  const name = definition && definition.name ? definition.name : 'yq-fragment';
  return renderToString(name, definition, props);
}

export const version = '0.4.0-node-skeleton';
