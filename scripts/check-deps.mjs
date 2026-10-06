import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const skipDirs = new Set(['node_modules', '.git']);
const allowedRootDev = new Set(['typescript', 'esbuild']);
const errors = [];

function collectPeerModules() {
  const allowed = new Set();
  const packagesDir = join(root, 'packages');
  for (const name of readdirSync(packagesDir)) {
    const dir = join(packagesDir, name);
    if (!statSync(dir).isDirectory()) {
      continue;
    }
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    } catch (error) {
      continue;
    }
    for (const field of ['optionalDependencies', 'peerDependencies']) {
      for (const dep of Object.keys(pkg[field] || {})) {
        allowed.add(dep);
      }
    }
  }
  return allowed;
}

const allowedPeers = collectPeerModules();

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) {
      continue;
    }
    const file = join(dir, name);
    const st = statSync(file);
    if (st.isDirectory()) {
      walk(file, out);
    } else {
      out.push(file);
    }
  }
}

function collectSpecifiers(text) {
  const seen = new Set();
  const out = [];
  const patterns = [
    /\b(?:import|export)\b[\s\S]*?\bfrom\s*(['"])([^'"]+)\1/g,
    /\bimport\s*(['"])([^'"]+)\1/g,
    /\b(?:import|require)\s*\(\s*(['"])([^'"]+)\1/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const spec = match[2];
      if (!seen.has(spec)) {
        seen.add(spec);
        out.push(spec);
      }
    }
  }
  return out;
}

const srcRule = (spec) => spec.startsWith('./') || spec.startsWith('../');
const jsRule = (spec) => spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('node:');
const distRule = (spec) => spec.startsWith('./') || spec.startsWith('../');

function checkFile(file) {
  const rel = relative(root, file);
  const ext = extname(file);
  const text = readFileSync(file, 'utf8');
  const inDist = /(?:^|[\\/])packages(?:[\\/][^\\/]+)?[\\/]dist(?:[\\/]|$)/.test(file);
  if (ext === '.ts') {
    if (file.endsWith('.d.ts')) {
      return;
    }
    for (const spec of collectSpecifiers(text)) {
      if (!srcRule(spec)) {
        errors.push(rel + ' imports disallowed specifier: ' + spec);
      }
    }
    return;
  }
  if (ext === '.mjs' || ext === '.js' || ext === '.cjs') {
    const rule = inDist ? distRule : jsRule;
    for (const spec of collectSpecifiers(text)) {
      const isDeclaredPeer = !inDist && allowedPeers.has(spec);
      if (!rule(spec) && !isDeclaredPeer) {
        errors.push(rel + ' imports disallowed specifier: ' + spec);
      }
    }
    return;
  }
  if (ext === '.html') {
    const scriptRe = /<script\b[^>]*\bsrc\s*=\s*(['"])([^'"]+)\1/g;
    let match;
    while ((match = scriptRe.exec(text)) !== null) {
      const src = match[2];
      if (!srcRule(src)) {
        errors.push(rel + ' loads disallowed script src: ' + src);
      }
    }
  }
}

function checkManifests() {
  const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (rootPkg.dependencies && Object.keys(rootPkg.dependencies).length > 0) {
    errors.push('root package.json dependencies must be empty');
  }
  if (rootPkg.devDependencies) {
    for (const name of Object.keys(rootPkg.devDependencies)) {
      if (!allowedRootDev.has(name)) {
        errors.push('root devDependency not allowed: ' + name);
      }
    }
  }
  const packagesDir = join(root, 'packages');
  for (const name of readdirSync(packagesDir)) {
    const dir = join(packagesDir, name);
    if (!statSync(dir).isDirectory()) {
      continue;
    }
    const pkgFile = join(dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
    if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
      errors.push('packages/' + name + ' dependencies must be empty');
    }
    if (pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0) {
      errors.push('packages/' + name + ' devDependencies must be empty');
    }
  }
}

checkManifests();
const files = [];
walk(root, files);
for (const file of files) {
  checkFile(file);
}

if (errors.length > 0) {
  for (const err of errors) {
    console.log('check-deps: ' + err);
  }
  process.exit(1);
}
console.log('check-deps: ok - dependency graph keeps zero third-party runtime packages');
