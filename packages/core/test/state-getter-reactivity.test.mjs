import { test } from 'node:test'
import assert from 'node:assert/strict'
import { define, createStateProxy } from '../dist/core.mjs'
import { installGlobals, flush, mount } from './helpers/dom-mock.mjs'

installGlobals()

test('getter-derived state recomputes after underlying array push and triggers re-render', async () => {
  let evaluations = 0
  define('yq-getter-push', {
    name: 'yq-getter-push',
    template: '<div><h1>{{pendingCount}} left</h1></div>',
    style: '',
    script: () => {
      const items = []
      return {
        state: {
          items,
          get pendingCount() {
            evaluations++;
            return items.length;
          }
        }
      };
    }
  });
  const host = mount('yq-getter-push');
  const h1 = host._yqInstance.root.children[0];
  assert.equal(h1.textContent, '0 left');
  assert.ok(evaluations >= 1, 'initial render should evaluate getter at least once');
  const evalsBefore = evaluations;
  host._yqInstance.state.items.push({ id: 1 });
  await flush();
  assert.equal(h1.textContent, '1 left', 'push should reflect new length');
  assert.equal(host._yqInstance.state.items.length, 1);
  assert.ok(evaluations > evalsBefore, 'push should re-evaluate getter (was ' + evalsBefore + ', now ' + evaluations + ')');
  host.disconnectedCallback();
});

test('getter-derived state on multiple pushes responds each time', async () => {
  define('yq-getter-multi-push', {
    name: 'yq-getter-multi-push',
    template: '<div><span>{{pendingCount}}</span></div>',
    style: '',
    script: () => {
      const items = []
      return {
        state: {
          items,
          get pendingCount() { return items.length; }
        }
      };
    }
  });
  const host = mount('yq-getter-multi-push');
  const span = host._yqInstance.root.children[0];
  assert.equal(span.textContent, '0');
  host._yqInstance.state.items.push({ id: 1 });
  await flush();
  assert.equal(span.textContent, '1');
  host._yqInstance.state.items.push({ id: 2 });
  host._yqInstance.state.items.push({ id: 3 });
  await flush();
  assert.equal(span.textContent, '3');
  host.disconnectedCallback();
});

test('after plain state property change getter still returns new value', async () => {
  define('yq-getter-this', {
    name: 'yq-getter-this',
    template: '<div><span>{{total}}</span></div>',
    style: '',
    script: () => ({
      state: {
        a: 2,
        b: 3,
        get total() { return this.a + this.b; }
      }
    })
  });
  const host = mount('yq-getter-this');
  const span = host._yqInstance.root.children[0];
  assert.equal(span.textContent, '5');
  host._yqInstance.state.a = 10;
  await flush();
  assert.equal(span.textContent, '13', 'modify a should re-evaluate getter');
  host._yqInstance.state.b = 20;
  await flush();
  assert.equal(span.textContent, '30', 'modify b should re-evaluate getter');
  host.disconnectedCallback();
});

test('createStateProxy getter read reflects latest value (unit-level)', () => {
  const target = { count: 0, get doubled() { return this.count * 2; } };
  let changeCount = 0;
  const proxy = createStateProxy(target, () => { changeCount++; });
  assert.equal(proxy.doubled, 0);
  proxy.count = 5;
  assert.equal(proxy.doubled, 10, 'write should be visible through getter');
  proxy.count = 7;
  assert.equal(proxy.doubled, 14);
  assert.equal(changeCount, 2);
});

test('createStateProxy: closure variable getter returns new value after push', () => {
  const items = [];
  const target = {
    items,
    get count() { return items.length; }
  };
  const proxy = createStateProxy(target, () => {});
  assert.equal(proxy.count, 0);
  proxy.items.push(1);
  assert.equal(proxy.count, 1, 'push should be reflected through getter');
  proxy.items.push(2);
  assert.equal(proxy.count, 2);
});

test('createStateProxy: plain set also triggers onChange and getter re-read', () => {
  const target = { value: 1, get next() { return this.value + 1; } };
  let changeCount = 0;
  const proxy = createStateProxy(target, () => { changeCount++; });
  assert.equal(proxy.next, 2);
  proxy.value = 100;
  assert.equal(proxy.next, 101, 'set should be visible through getter');
  assert.equal(changeCount, 1);
});
