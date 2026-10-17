import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInThisContext } from 'node:vm';
import * as core from '../../core/dist/core.mjs';
import { installGlobals, flush, mount } from '../../core/test/helpers/dom-mock.mjs';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const bin = join(packageRoot, 'bin', 'yq.mjs');
const version = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version;
const roots = [];

function tempDir(label) {
  const dir = mkdtempSync(join(tmpdir(), 'yq-cli-' + label + '-'));
  roots.push(dir);
  return dir;
}

function run(args) {
  return execFileSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
}

function runIn(args, cwd) {
  return execFileSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });
}

function runFailure(args, cwd) {
  try {
    execFileSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    return { status: error.status, stdout: String(error.stdout || ''), stderr: String(error.stderr || '') };
  }
  throw new Error('expected the command to fail: ' + args.join(' '));
}

function hasPlaceholder(text) {
  return text.includes('{{#') || text.includes('{{/') || text.includes('{{core}}') || text.includes('{{project}}');
}

function findByTag(node, tag, out) {
  const hits = out || [];
  if (node && node.tagName && String(node.tagName).toLowerCase() === tag) {
    hits.push(node);
  }
  for (const child of (node && node.children) || []) {
    findByTag(child, tag, hits);
  }
  return hits;
}

function fetchRaw(port, path) {
  return new Promise((settle, fail) => {
    const req = request({ host: '127.0.0.1', port, path }, (res) => {
      const chunks = [];
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      res.on('end', () => {
        settle({ status: res.statusCode, type: String(res.headers['content-type'] || ''), headers: res.headers, body: chunks.join('') });
      });
    });
    req.on('error', fail);
    req.end();
  });
}

function readEventStream(port, path, onOpen) {
  return new Promise((settle) => {
    let timer = null;
    let done = false;
    const finish = (text) => {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timer);
      settle(text);
    };
    const req = request({ host: '127.0.0.1', port, path }, (res) => {
      let collected = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        collected += chunk;
        if (collected.includes('data: reload')) {
          req.destroy();
          finish(collected);
        }
      });
    });
    req.on('error', () => {});
    req.end();
    timer = setTimeout(() => {
      req.destroy();
      finish('');
    }, 8000);
    onOpen();
  });
}

after(() => {
  for (const dir of roots) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      continue;
    }
  }
});

describe('yq cli', () => {
  it('prints the usage for --help', () => {
    const out = run(['--help']);
    assert.ok(out.includes('usage: yq <command>'), out);
    assert.ok(out.includes('init <name>'), out);
    assert.ok(out.includes('dev'), out);
  });

  it('documents every init option in its usage', () => {
    const out = run(['init', '--help']);
    assert.ok(out.includes('usage: yq init'), out);
    assert.ok(out.includes('--yes'), out);
    assert.ok(out.includes('--no-example'), out);
    assert.ok(out.includes('--quiet'), out);
  });

  it('prints the cli version for --version', () => {
    assert.equal(run(['--version']).trim(), version);
  });

  it('rejects an unknown command', () => {
    const result = runFailure(['nope']);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('unknown command: nope'), result.stderr);
    assert.ok(result.stdout.includes('usage: yq <command>'), result.stdout);
  });

  it('scaffolds a project', () => {
    const dir = tempDir('init');
    const out = runIn(['init', 'demo-app', '--yes'], dir);
    const target = join(dir, 'demo-app');
    for (const name of ['index.html', 'app.js', 'yq.config.mjs', 'README.md', '.gitignore', join('vendor', 'core.global.js')]) {
      assert.ok(existsSync(join(target, name)), 'missing ' + name);
    }
    const html = readFileSync(join(target, 'index.html'), 'utf8');
    assert.ok(html.includes('<title>demo-app</title>'), html);
    assert.ok(html.includes('<script src="./vendor/core.global.js"></script>'), html);
    assert.ok(html.includes('<yq-counter></yq-counter>'), html);
    assert.ok(!hasPlaceholder(html), html);
    const app = readFileSync(join(target, 'app.js'), 'utf8');
    assert.ok(app.includes("yq.define('yq-counter'"), app);
    assert.ok(app.includes('yq.version'), app);
    assert.ok(app.includes('{{ count }}'), app);
    assert.ok(!hasPlaceholder(app), app);
    assert.ok(readFileSync(join(target, '.gitignore'), 'utf8').includes('node_modules/'));
    assert.ok(readFileSync(join(target, 'yq.config.mjs'), 'utf8').includes("name: 'demo-app'"));
    assert.ok(readFileSync(join(target, 'README.md'), 'utf8').includes('# demo-app'));
    assert.ok(readFileSync(join(target, 'vendor', 'core.global.js'), 'utf8').length > 0);
    assert.ok(out.includes('yq init: created'), out);
  });

  it('leaves the example out for --no-example', () => {
    const dir = tempDir('plain');
    runIn(['init', 'plain-app', '--yes', '--no-example'], dir);
    const target = join(dir, 'plain-app');
    const html = readFileSync(join(target, 'index.html'), 'utf8');
    assert.ok(!html.includes('yq-counter'), html);
    assert.ok(!hasPlaceholder(html), html);
    const app = readFileSync(join(target, 'app.js'), 'utf8');
    assert.ok(!app.includes('yq-counter'), app);
    assert.ok(app.includes("document.getElementById('version')"), app);
    assert.ok(!hasPlaceholder(app), app);
  });

  it('refuses to write into a non empty directory', () => {
    const dir = tempDir('busy');
    mkdirSync(join(dir, 'busy-app'), { recursive: true });
    writeFileSync(join(dir, 'busy-app', 'keep.txt'), 'keep\n');
    const result = runFailure(['init', 'busy-app', '--yes'], dir);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('not empty'), result.stderr);
    assert.ok(!existsSync(join(dir, 'busy-app', 'index.html')));
  });

  it('requires a project name when stdin is not a terminal', () => {
    const result = runFailure(['init', '--yes'], tempDir('noname'));
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('project name is required'), result.stderr);
  });

  it('rejects a project name with path segments', () => {
    const result = runFailure(['init', '../escape', '--yes'], tempDir('bad'));
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('invalid project name'), result.stderr);
  });

  it('rejects an unknown option for init', () => {
    const dir = tempDir('init-unknown-option');
    const result = runFailure(['init', 'demo-app', '--forse'], dir);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('unknown option --forse'), result.stderr);
    assert.ok(result.stdout.includes('usage: yq init'), result.stdout);
    assert.ok(!existsSync(join(dir, 'demo-app')), 'the scaffold must not be written');
  });

  it('reports every unknown option for init at once', () => {
    const dir = tempDir('init-unknown-options');
    const result = runFailure(['init', 'demo-app', '--forse', '--vervose'], dir);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('unknown option --forse'), result.stderr);
    assert.ok(result.stderr.includes('unknown option --vervose'), result.stderr);
    assert.ok(!existsSync(join(dir, 'demo-app')), 'the scaffold must not be written');
  });
});

describe('yq dev', () => {
  let dir;
  let child;
  let port;
  const output = [];

  before(async () => {
    dir = tempDir('dev');
    writeFileSync(join(dir, 'index.html'), '<!DOCTYPE html>\n<html><body><h1>dev</h1></body></html>\n');
    writeFileSync(join(dir, 'style.css'), 'h1 { color: #111; }\n');
    child = spawn(process.execPath, [bin, 'dev', '--port', '0'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      output.push(chunk);
    });
    await new Promise((settle, fail) => {
      const timer = setTimeout(() => {
        fail(new Error('the dev server did not report a url: ' + output.join('')));
      }, 20000);
      child.stdout.on('data', () => {
        const text = output.join('');
        const marker = 'http://127.0.0.1:';
        const at = text.indexOf(marker);
        if (at === -1) {
          return;
        }
        let digits = '';
        for (const char of text.slice(at + marker.length)) {
          if (char >= '0' && char <= '9') {
            digits += char;
          } else {
            break;
          }
        }
        if (digits.length === 0) {
          return;
        }
        port = Number(digits);
        clearTimeout(timer);
        settle();
      });
    });
  });

  after(async () => {
    if (!child || child.exitCode !== null) {
      return;
    }
    const exited = new Promise((settle) => {
      child.once('exit', () => {
        settle();
      });
    });
    child.kill();
    await exited;
  });

  it('prints its usage for --help', () => {
    const out = run(['dev', '--help']);
    assert.ok(out.includes('usage: yq dev'), out);
    assert.ok(out.includes('--port'), out);
    assert.ok(out.includes('--quiet'), out);
  });

  it('rejects an unknown option for dev', () => {
    const dir = tempDir('dev-unknown-option');
    writeFileSync(join(dir, 'index.html'), '<!DOCTYPE html>\n<html><body><h1>dev</h1></body></html>\n');
    const result = runFailure(['dev', '--dirr', dir], dir);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('unknown option --dirr'), result.stderr);
    assert.ok(result.stdout.includes('usage: yq dev'), result.stdout);
  });

  it('reports every unknown option for dev at once', () => {
    const dir = tempDir('dev-unknown-options');
    writeFileSync(join(dir, 'index.html'), '<!DOCTYPE html>\n<html><body><h1>dev</h1></body></html>\n');
    const result = runFailure(['dev', '--dirr', dir, '--por', '8080'], dir);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('unknown option --dirr'), result.stderr);
    assert.ok(result.stderr.includes('unknown option --por'), result.stderr);
    assert.ok(result.stdout.includes('usage: yq dev'), result.stdout);
  });

  it('serves the entry document and injects the reload client', async () => {
    const res = await fetchRaw(port, '/');
    assert.equal(res.status, 200);
    assert.ok(res.type.includes('text/html'), res.type);
    assert.ok(res.body.includes('<h1>dev</h1>'), res.body);
    assert.ok(res.body.includes('/__yq/reload'), res.body);
    assert.ok(res.body.indexOf('/__yq/reload') < res.body.indexOf('</body>'), res.body);
  });

  it('serves a static asset with its content type', async () => {
    const res = await fetchRaw(port, '/style.css');
    assert.equal(res.status, 200);
    assert.ok(res.type.includes('text/css'), res.type);
    assert.ok(res.body.includes('color: #111'), res.body);
  });

  it('serves every response with no-store so edits are never cached', async () => {
    const entry = await fetchRaw(port, '/');
    assert.equal(entry.status, 200);
    assert.equal(entry.headers['cache-control'], 'no-store');
    const asset = await fetchRaw(port, '/style.css');
    assert.equal(asset.status, 200);
    assert.equal(asset.headers['cache-control'], 'no-store');
  });

  it('answers 404 for a missing file', async () => {
    const res = await fetchRaw(port, '/missing.txt');
    assert.equal(res.status, 404);
  });

  it('refuses to leave the served directory', async () => {
    const res = await fetchRaw(port, '/..%2f..%2fpackage.json');
    assert.equal(res.status, 403);
  });

  it('answers 400 for a malformed percent-encoded path', async () => {
    const res = await fetchRaw(port, '/%');
    assert.equal(res.status, 400);
    assert.ok(res.type.includes('text/plain'), res.type);
  });

  it('answers 400 for a truncated escape sequence', async () => {
    const res = await fetchRaw(port, '/%E0%A4%A');
    assert.equal(res.status, 400);
    assert.ok(res.type.includes('text/plain'), res.type);
  });

  it('answers 400 for a malformed path that carries a query string', async () => {
    const res = await fetchRaw(port, '/%?from=bookmark');
    assert.equal(res.status, 400);
    assert.ok(res.type.includes('text/plain'), res.type);
    assert.equal(res.body, 'bad request');
  });

  it('still decodes a valid percent-encoded path', async () => {
    const res = await fetchRaw(port, '/styl%65.css');
    assert.equal(res.status, 200);
    assert.ok(res.type.includes('text/css'), res.type);
    assert.ok(res.body.includes('color: #111'), res.body);
  });

  it('keeps serving after a malformed percent-encoded path', async () => {
    const bad = await fetchRaw(port, '/%');
    assert.equal(bad.status, 400);
    const res = await fetchRaw(port, '/style.css');
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('color: #111'), res.body);
  });

  it('pushes a reload event after a watched file changes', async () => {
    const events = await readEventStream(port, '/__yq/reload', () => {
      setTimeout(() => {
        writeFileSync(join(dir, 'note.txt'), 'changed\n');
      }, 150);
    });
    assert.ok(events.includes('data: reload'), 'no reload event received: ' + events);
  });
});

describe('yq dev --port validation', () => {
  it('rejects a non-numeric port and exits non-zero', () => {
    const dir = tempDir('dev-port-bad');
    const result = runFailure(['dev', '--port', 'abc'], dir);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('invalid --port'), result.stderr);
  });

  it('rejects an out-of-range port and exits non-zero', () => {
    const dir = tempDir('dev-port-range');
    const result = runFailure(['dev', '--port', '70000'], dir);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('invalid --port'), result.stderr);
  });

  it('silences the port warning with --quiet', () => {
    const dir = tempDir('dev-port-quiet');
    const result = runFailure(['dev', '--port', 'abc', '--quiet'], dir);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, '');
  });

  it('exits non-zero when the port is already in use', async () => {
    const dir = tempDir('dev-port-busy');
    writeFileSync(join(dir, 'index.html'), '<!DOCTYPE html>\n<html><body><h1>busy</h1></body></html>\n');
    const blocker = createServer();
    await new Promise((settle) => blocker.listen(0, '127.0.0.1', settle));
    const busy = blocker.address().port;
    const child = spawn(process.execPath, [bin, 'dev', '--port', String(busy)], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const status = await new Promise((settle, fail) => {
      const timer = setTimeout(() => {
        fail(new Error('yq dev hung instead of exiting, stderr: ' + stderr));
      }, 20000);
      child.once('exit', (code) => {
        clearTimeout(timer);
        settle(code);
      });
    });
    blocker.close();
    assert.equal(status, 1);
    assert.ok(stderr.includes('already in use'), stderr);
  });
});

describe('scaffolded project', () => {
  it('registers its component and reacts to a click', async () => {
    const dir = tempDir('runtime');
    runIn(['init', 'runtime-app', '--yes'], dir);
    const app = readFileSync(join(dir, 'runtime-app', 'app.js'), 'utf8');
    installGlobals();
    globalThis.document.getElementById = () => ({ textContent: '' });
    globalThis.yq = core;
    runInThisContext(app, { filename: 'app.js' });
    assert.ok(globalThis.customElements.get('yq-counter'), 'the component was not registered');
    const host = mount('yq-counter');
    const root = host._yqInstance && host._yqInstance.root;
    assert.ok(root, 'the component did not mount');
    const counter = findByTag(root, 'b')[0];
    const buttons = findByTag(root, 'button');
    assert.ok(counter, 'the counter element is missing');
    assert.equal(counter.textContent, '0');
    assert.equal(buttons.length, 2);
    buttons[0].dispatch('click');
    await flush();
    assert.equal(counter.textContent, '1');
    buttons[1].dispatch('click');
    await flush();
    assert.equal(counter.textContent, '0');
    host.disconnectedCallback();
  });
});

describe('yq cli --quiet', () => {
  it('keeps the normal output with --quiet', () => {
    const dir = tempDir('init-quiet-ok');
    const out = runIn(['init', 'quiet-app', '--yes', '--quiet'], dir);
    assert.ok(out.includes('yq init: created'), out);
    assert.ok(existsSync(join(dir, 'quiet-app', 'index.html')));
  });

  it('suppresses the warning for a missing name with --quiet', () => {
    const result = runFailure(['init', '--yes', '--quiet'], tempDir('init-quiet'));
    assert.equal(result.status, 1);
    assert.equal(result.stderr, '');
  });

  it('documents --quiet in the usage', () => {
    const out = run(['--help']);
    assert.ok(out.includes('--quiet'), out);
  });

  it('suppresses the unknown command warning with --quiet', () => {
    const result = runFailure(['--quiet', 'nope']);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, '');
    assert.ok(result.stdout.includes('usage: yq <command>'), result.stdout);
  });

  it('still prints the version with --quiet', () => {
    assert.equal(run(['--quiet', '--version']).trim(), version);
  });
});
