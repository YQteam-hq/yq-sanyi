import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToString, renderFragmentToString, version } from '../node/renderToString.mjs';

test('M2-3 renderToString: empty name throws', () => {
  assert.throws(() => renderToString(''), /non-empty/);
});

test('M2-3 renderToString: null definition throws', () => {
  assert.throws(() => renderToString('yq-x', null), /object/);
});

test('M2-3 renderToString: non-object props throws', () => {
  assert.throws(() => renderToString('yq-x', { template: '<i/>', style: '', script: () => ({}) }, 'string-not-allowed'), /object/);
});

test('M2-3 renderToString: returns structured pending result', () => {
  const r = renderToString('yq-smoke', { template: '<i>x</i>', style: '', script: () => ({}) }, { foo: 'bar' });
  assert.equal(r.ok, false, 'mount path currently disabled');
  assert.equal(r.hostTag, 'yq-smoke');
});

test('M2-3 renderFragmentToString: uses definition.name', () => {
  const r = renderFragmentToString({ name: 'yq-frag', template: '<i/>', style: '', script: () => ({}) });
  assert.equal(r.hostTag, 'yq-frag');
});

test('M2-3 version string exposes node skeleton marker', () => {
  assert.equal(version, '0.4.0-node-skeleton');
});
