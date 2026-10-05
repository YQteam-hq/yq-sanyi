import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const limitKb = 13;
const targets = ['packages/core/dist/core.mjs', 'packages/core/dist/core.global.js'];
let failed = false;

for (const rel of targets) {
  const file = join(root, rel);
  if (!existsSync(file)) {
    console.log('check-gzip: FAIL - missing ' + rel + ', run npm run build first');
    failed = true;
    continue;
  }
  const raw = readFileSync(file);
  const gzipKb = gzipSync(raw).length / 1024;
  const rawKb = raw.length / 1024;
  const verdict = gzipKb > limitKb ? 'OVER BUDGET' : 'ok';
  console.log('check-gzip: ' + rel + ' raw ' + rawKb.toFixed(2) + ' KB gzip ' + gzipKb.toFixed(2) + ' KB limit ' + limitKb + ' KB -> ' + verdict);
  if (gzipKb > limitKb) {
    failed = true;
  }
}

if (failed) {
  console.error('check-gzip: FAIL - core gzip exceeds ' + limitKb + ' KB budget, manual size review required before merge');
  process.exit(1);
}
console.log('check-gzip: ok');
