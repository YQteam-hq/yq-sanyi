import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
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
        settle({ status: res.statusCode, type: String(res.headers['content-type'] || ''), body: chunks.join('') });
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

  it('answers 404 for a missing file', async () => {
    const res = await fetchRaw(port, '/missing.txt');
    assert.equal(res.status, 404);
  });

  it('refuses to leave the served directory', async () => {
    const res = await fetchRaw(port, '/..%2f..%2fpackage.json');
    assert.equal(res.status, 403);
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
