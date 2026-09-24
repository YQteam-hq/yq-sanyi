import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const changelogPath = join(root, 'CHANGELOG.md');
const manifestPath = join(root, 'package.json');

const VERSION_HEADING = /^##\s+\[?v?(\d+\.\d+\.\d+)\]?\s*(?:-\s*(\d{4}-\d{2}-\d{2}))?\s*$/;

function readChangelog() {
  let text;
  try {
    text = readFileSync(changelogPath, 'utf8');
  } catch (error) {
    return { error: 'CHANGELOG.md is missing, run a release note before tagging' };
  }
  const entries = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = VERSION_HEADING.exec(lines[i]);
    if (!match) continue;
    entries.push({ version: match[1], date: match[2] || null, line: i + 1 });
  }
  if (entries.length === 0) {
    return { error: 'CHANGELOG.md has no version heading in the form "## [0.3.0] - 2026-09-22"' };
  }
  return { entries };
}

function readManifestVersion() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
    return { error: 'root package.json has no version field' };
  }
  return { version: manifest.version };
}

const changelog = readChangelog();
const manifest = readManifestVersion();
const errors = [];

if (changelog.error) {
  errors.push(changelog.error);
}
if (manifest.error) {
  errors.push(manifest.error);
}

if (errors.length === 0) {
  const latest = changelog.entries[0];
  if (latest.version !== manifest.version) {
    errors.push(
      'CHANGELOG.md top entry is ' +
        latest.version +
        ' but package.json declares ' +
        manifest.version +
        ', add a changelog section before releasing'
    );
  }
  if (!latest.date) {
    errors.push('CHANGELOG.md entry ' + latest.version + ' has no release date');
  }
  const seen = new Set();
  for (const entry of changelog.entries) {
    if (seen.has(entry.version)) {
      errors.push('CHANGELOG.md repeats version ' + entry.version + ' on line ' + entry.line);
    }
    seen.add(entry.version);
  }
  console.log('check-changelog: latest entry ' + latest.version + ' (' + latest.date + ') matches package.json');
}

if (errors.length > 0) {
  for (const message of errors) {
    console.log('check-changelog: ' + message);
  }
  process.exit(1);
}
console.log('check-changelog: ok');
