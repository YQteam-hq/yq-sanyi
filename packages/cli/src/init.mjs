import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { line, warn } from './log.mjs';
import { optionText } from './args.mjs';

const templateDir = fileURLToPath(new URL('../templates/init/', import.meta.url));
const coreFallback = fileURLToPath(new URL('../../core/dist/core.global.js', import.meta.url));
const coreTarget = 'vendor/core.global.js';
const namePattern = /^[a-z0-9][a-z0-9._-]*$/i;
const files = [
  { from: 'index.html', to: 'index.html' },
  { from: 'app.js', to: 'app.js' },
  { from: 'yq.config.mjs', to: 'yq.config.mjs' },
  { from: 'README.md', to: 'README.md' },
  { from: 'gitignore', to: '.gitignore' }
];

export const INIT_USAGE = [
  'usage: yq init <name> [options]',
  '',
  'scaffold a yq-sanyi project in a new directory',
  '',
  'options:',
  '  --dir <path>   parent directory of the project, defaults to the current directory',
  '  --yes, -y      accept the defaults and skip the prompts',
  '  --no-example   leave out the counter component',
  '  -h, --help     show this help'
].join('\n');

function unwrap(text, name) {
  return text
    .split('{{#' + name + '}}\n').join('')
    .split('{{/' + name + '}}\n').join('')
    .split('{{#' + name + '}}').join('')
    .split('{{/' + name + '}}').join('');
}

function strip(text, name) {
  const open = '{{#' + name + '}}';
  const close = '{{/' + name + '}}';
  let out = text;
  for (let i = 0; i < 64; i++) {
    const from = out.indexOf(open);
    if (from === -1) {
      return out;
    }
    const to = out.indexOf(close, from);
    if (to === -1) {
      return out;
    }
    const rest = out.slice(to + close.length);
    out = out.slice(0, from) + (rest.startsWith('\n') ? rest.slice(1) : rest);
  }
  return out;
}

function render(text, values, keep, drop) {
  let out = text;
  for (const name of drop) {
    out = strip(out, name);
  }
  for (const name of keep) {
    out = unwrap(out, name);
  }
  for (const key of Object.keys(values)) {
    out = out.split('{{' + key + '}}').join(values[key]);
  }
  return out;
}

function finish(text) {
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n+$/, '\n');
}

function findCore() {
  const candidates = [];
  try {
    candidates.push(createRequire(import.meta.url).resolve('yq-sanyi-core/global'));
  } catch (error) {
    candidates.push(null);
  }
  candidates.push(coreFallback);
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export async function runInit(options) {
  if (options.help) {
    line(INIT_USAGE);
    return 0;
  }
  let name = options._[1];
  let example = options['no-example'] !== true;
  const interactive = options.yes !== true && process.stdin.isTTY === true;
  let prompt = null;
  if (interactive) {
    prompt = createInterface({ input: process.stdin, output: process.stdout });
    if (!name) {
      name = (await prompt.question('project name: ')).trim();
    }
    if (name && options['no-example'] !== true) {
      const answer = (await prompt.question('include the counter example? [Y/n] ')).trim().toLowerCase();
      if (answer === 'n' || answer === 'no') {
        example = false;
      }
    }
  }
  if (prompt) {
    prompt.close();
  }
  if (!name) {
    warn('a project name is required, run "yq init <name>"');
    return 1;
  }
  if (!namePattern.test(name)) {
    warn('invalid project name: ' + name);
    return 1;
  }
  const parent = resolve(process.cwd(), optionText(options, 'dir', '.'));
  const target = join(parent, name);
  if (existsSync(target) && readdirSync(target).length > 0) {
    warn('target directory is not empty: ' + target);
    return 1;
  }
  mkdirSync(target, { recursive: true });
  const core = findCore();
  const keep = ['core'];
  const drop = [];
  if (!core) {
    keep.length = 0;
    drop.push('core');
  }
  if (example && core) {
    keep.push('example');
  } else {
    drop.push('example');
  }
  const values = { project: name, core: coreTarget };
  const written = [];
  for (const entry of files) {
    const source = readFileSync(join(templateDir, entry.from), 'utf8');
    writeFileSync(join(target, entry.to), finish(render(source, values, keep, drop)));
    written.push(entry.to);
  }
  if (core) {
    mkdirSync(join(target, 'vendor'), { recursive: true });
    cpSync(core, join(target, 'vendor', 'core.global.js'));
    written.push('vendor/core.global.js');
  }
  line('yq init: created ' + target);
  for (const file of written) {
    line('  ' + file);
  }
  if (!core) {
    warn('the yq-sanyi runtime bundle was not found, run "npm run build" in the monorepo and copy packages/core/dist/core.global.js into vendor/');
  }
  line('');
  line('next steps:');
  line('  cd ' + name + ' && yq dev');
  return 0;
}
