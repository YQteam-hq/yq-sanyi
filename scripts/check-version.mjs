import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function write(line) {
  process.stdout.write(line + '\n');
}

function readManifest(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

const errors = [];
const rootVersion = readManifest(join(root, 'package.json')).version;

if (typeof rootVersion !== 'string' || rootVersion.length === 0) {
  errors.push('root package.json has no version field');
}

const packagesDir = join(root, 'packages');
for (const name of readdirSync(packagesDir)) {
  const dir = join(packagesDir, name);
  if (!statSync(dir).isDirectory()) {
    continue;
  }
  const manifest = readManifest(join(dir, 'package.json'));
  if (manifest.version !== rootVersion) {
    errors.push('packages/' + name + '/package.json declares ' + manifest.version + ' but the monorepo is at ' + rootVersion);
  }
}

const versionSource = join(root, 'packages', 'core', 'src', 'version.ts');
const versionText = readFileSync(versionSource, 'utf8');
if (!versionText.includes("'" + rootVersion + "'")) {
  errors.push('packages/core/src/version.ts does not declare ' + rootVersion + ', it is the single source of the runtime version');
}

const entrySource = join(root, 'packages', 'core', 'src', 'index.ts');
const entryText = readFileSync(entrySource, 'utf8');
if (/export\s+const\s+version\s*=/.test(entryText)) {
  errors.push('packages/core/src/index.ts declares its own version, re-export the value from ./version.js instead');
}

const nodeEntry = join(root, 'packages', 'core', 'node', 'renderToString.mjs');
const nodeText = readFileSync(nodeEntry, 'utf8');
if (/export\s+const\s+version\s*=\s*['"]/.test(nodeText)) {
  errors.push('packages/core/node/renderToString.mjs hardcodes a version, read it from the package manifest instead');
}

if (errors.length > 0) {
  for (const message of errors) {
    write('check-version: ' + message);
  }
  process.exit(1);
}
write('check-version: ok - ' + rootVersion + ' is declared once and shared by every package and runtime entry');
