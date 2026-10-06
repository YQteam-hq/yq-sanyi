import { test } from 'node:test';
import assert from 'node:assert/strict';
import { define, lookup } from '../dist/core.mjs';

const minimalMarkup = (label) => ({
  name: label,
  template: '<section><h1 class="ping">' + label + '</h1></section>',
  style: ''
});

test('define(component) with no script field mounts and renders markup', () => {
  const def = minimalMarkup('only-no-script');
  const returned = define('only-no-script', def);
  assert.ok(returned);
  assert.equal(returned.script, null, 'omitted script must normalize to null');

  const result = lookup('only-no-script');
  assert.ok(result);
  assert.equal(result.name, 'only-no-script');
  assert.equal(result.cdo.scriptFactory, null);
  assert.equal(result.cdo.root.tag, 'section');
  const heading = result.cdo.nodes.find((n) => n.tag === 'h1');
  assert.ok(heading);
  assert.equal(heading.staticAttrs.class, 'ping');
});

test('define(component) with script: undefined is equivalent to omitting it', () => {
  const def = Object.assign(minimalMarkup('only-undef'), { script: undefined });
  const returned = define('only-undef', def);
  assert.equal(returned.script, null);
  const result = lookup('only-undef');
  assert.ok(result);
  assert.equal(result.cdo.scriptFactory, null);
});

test('define(component) with script: {} is equivalent to omitting it', () => {
  const def = Object.assign(minimalMarkup('only-empty'), { script: {} });
  const returned = define('only-empty', def);
  assert.equal(returned.script, null, 'empty-object script must normalize to null per the optional-script contract');
  const result = lookup('only-empty');
  assert.ok(result);
  assert.equal(result.cdo.scriptFactory, null, 'createScriptFactory must yield null for empty-object script');
});

test('define(component) with function script still works (regression)', () => {
  const def = {
    name: 'with-state',
    template: '<section><span class="x">{{ x }}</span></section>',
    style: '',
    script: () => ({ state: { x: 1 } })
  };
  const returned = define('with-state', def);
  assert.equal(typeof returned.script, 'function');
  const result = lookup('with-state');
  assert.ok(result);
  assert.equal(typeof result.cdo.scriptFactory, 'function');
  const fn = result.cdo.scriptFactory();
  assert.equal(typeof fn, 'function');
  const out = fn();
  assert.equal(out.state.x, 1);
});

test('define(component) with string script still works (regression)', () => {
  const def = {
    name: 'with-string-script',
    template: '<section><span class="x">{{ x }}</span></section>',
    style: '',
    script: '({ state: { x: 7 } })'
  };
  const returned = define('with-string-script', def);
  assert.equal(typeof returned.script, 'string');
  const result = lookup('with-string-script');
  assert.ok(result);
  assert.equal(typeof result.cdo.scriptFactory, 'function');
  const evaluated = result.cdo.scriptFactory();
  assert.equal(typeof evaluated, 'object');
  assert.equal(evaluated.state.x, 7);
});

test('define(component) still rejects clearly invalid script values', () => {
  assert.throws(
    () => define('bad-script-number', Object.assign(minimalMarkup('bad-script-number'), { script: 42 })),
    /script must be function/
  );
  assert.throws(
    () => define('bad-script-bool', Object.assign(minimalMarkup('bad-script-bool'), { script: true })),
    /script must be function/
  );
});

