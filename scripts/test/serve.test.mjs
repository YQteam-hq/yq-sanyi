import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { makeHandler, resolveWithin } from '../serve.mjs';

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'yq-serve-'));
  writeFileSync(join(root, 'index.html'), '<h1>root</h1>');
  mkdirSync(join(root, 'examples'));
  writeFileSync(join(root, 'examples', 'basic.html'), '<h1>demo</h1>');
  writeFileSync(join(root, 'notes.txt'), 'plain');
  return root;
}

async function withServer(run) {
  const root = fixtureRoot();
  const server = createServer(makeHandler(root));
  await new Promise((settle) => server.listen(0, '127.0.0.1', settle));
  try {
    await run(server.address().port);
  } finally {
    await new Promise((settle) => server.close(settle));
    rmSync(root, { recursive: true, force: true });
  }
}

function get(port, path) {
  return fetch('http://127.0.0.1:' + port + path).then(async (res) => {
    const body = await res.text();
    return { status: res.status, type: res.headers.get('content-type'), body };
  });
}

describe('resolveWithin', () => {
  it('keeps a document that sits inside the root', () => {
    const root = fixtureRoot();
    try {
      assert.equal(resolveWithin(root, '/index.html'), join(root, 'index.html'));
      assert.equal(resolveWithin(root, '/examples/basic.html'), join(root, 'examples', 'basic.html'));
      assert.equal(resolveWithin(root, '/examples/../notes.txt'), join(root, 'notes.txt'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects parent dot segments that leave the root', () => {
    const root = fixtureRoot();
    try {
      assert.equal(resolveWithin(root, '/..'), null);
      assert.equal(resolveWithin(root, '/../notes.txt'), null);
      assert.equal(resolveWithin(root, '/a/../../notes.txt'), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a sibling directory that shares the root name as a prefix', () => {
    const root = fixtureRoot();
    try {
      const sibling = root + '-secret';
      mkdirSync(sibling);
      writeFileSync(join(sibling, 'token.txt'), 'secret');
      const target = '/../' + basename(sibling) + '/token.txt';
      assert.equal(resolveWithin(root, target), null);
      rmSync(sibling, { recursive: true, force: true });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('serve handler', () => {
  it('serves the default document for the root path', async () => {
    await withServer(async (port) => {
      const res = await get(port, '/');
      assert.equal(res.status, 200);
      assert.equal(res.type, 'text/html; charset=utf-8');
      assert.match(res.body, /demo/);
    });
  });

  it('serves a plain document with its content type', async () => {
    await withServer(async (port) => {
      const res = await get(port, '/notes.txt');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'plain');
    });
  });

  it('serves a document whose name is percent-encoded', async () => {
    await withServer(async (port) => {
      const res = await get(port, '/note%73.txt');
      assert.equal(res.status, 200);
      assert.equal(res.body, 'plain');
    });
  });

  it('answers 404 for a missing document', async () => {
    await withServer(async (port) => {
      const res = await get(port, '/missing.txt');
      assert.equal(res.status, 404);
      assert.equal(res.body, 'not found');
    });
  });

  it('answers 403 for a percent-encoded parent traversal attempt', async () => {
    await withServer(async (port) => {
      const res = await get(port, '/%2e%2e%2fnotes.txt');
      assert.equal(res.status, 403);
      assert.equal(res.body, 'forbidden');
    });
  });

  it('answers 400 for a malformed percent-encoded path', async () => {
    await withServer(async (port) => {
      const res = await get(port, '/%zz');
      assert.equal(res.status, 400);
      assert.equal(res.body, 'bad request');
    });
  });
});
