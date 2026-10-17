import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const skipDirs = new Set(['node_modules', '.git', 'dist']);
const codeExts = new Set(['.ts', '.js', '.mjs', '.cjs', '.html', '.css']);
const violations = [];

function isRootResidual(name) {
  return (
    name === 'GETTING-STARTED.md' ||
    name === 'PROJECT-SUMMARY.md' ||
    name === 'build.js' ||
    name === 'final-test.html' ||
    /^debug-.*\.mjs$/.test(name) ||
    /^test-.*\.mjs$/.test(name) ||
    /^test-.*\.cjs$/.test(name)
  );
}

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

const REGEX_PRECEDERS = /(?:\breturn\b|\btypeof\b|\binstanceof\b|\bnew\b|\bdelete\b|\bvoid\b|\bcase\b|\bin\b|\bof\b|\bdo\b|\belse\b|\byield\b|\bawait\b|\bthrow\b)$/
const DIVISION_PRECEDERS = /[A-Za-z0-9_$)\]]$/
const IDENTIFIER_START = /[A-Za-z_$]/

function endsWithDivisionContext(before) {
  const trimmed = before.replace(/\s+$/, '')
  if (trimmed.length === 0) return false
  if (REGEX_PRECEDERS.test(trimmed)) return false
  if (DIVISION_PRECEDERS.test(trimmed)) return true
  if (IDENTIFIER_START.test(trimmed[trimmed.length - 1])) return true
  return false
}

function scanRegexLiteral(text, start) {
  let index = start + 1
  let inClass = false
  while (index < text.length) {
    const char = text[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (char === '\n') return -1
    if (char === '[') {
      inClass = true
      index++
      continue
    }
    if (char === ']') {
      inClass = false
      index++
      continue
    }
    if (char === '/' && !inClass) {
      return index + 1
    }
    index++
  }
  return -1
}

const TEMPLATE = 'template'
const INTERPOLATION = 'interpolation'

function pad(out, length) {
  return out + ' '.repeat(length)
}

function readEscapedPair(text, start, out) {
  const pair = text.slice(start, start + 2)
  return { next: start + pair.length, out: out + pair }
}

function readTemplateStep(text, start, stack, out) {
  const char = text[start]
  if (char === '\\') return readEscapedPair(text, start, out)
  const opensInterpolation = char === '$' && text[start + 1] === '{'
  if (opensInterpolation) {
    stack.push({ kind: INTERPOLATION, braces: 0 })
    return { next: start + 2, out: pad(out, 2) }
  }
  if (char === '`') {
    stack.pop()
    return { next: start + 1, out: out + char }
  }
  if (char === '\n') return { next: start + 1, out: out + '\n' }
  return { next: start + 1, out: pad(out, 1) }
}

function isInterpolationBoundary(char) {
  return char === '{' || char === '}'
}

function readInterpolationStep(char, frame, stack, out) {
  if (char === '{') {
    frame.braces++
    return { out: out + char }
  }
  const closesInterpolation = frame.braces === 0
  if (closesInterpolation) {
    stack.pop()
  } else {
    frame.braces--
  }
  return { out: out + char }
}

function maskStrings(text) {
  let out = ''
  let i = 0
  const n = text.length
  const stack = []

  while (i < n) {
    const ch = text[i]
    const top = stack.length > 0 ? stack[stack.length - 1] : null

    if (top && top.kind === TEMPLATE) {
      const step = readTemplateStep(text, i, stack, out)
      out = step.out
      i = step.next
      continue
    }

    const atInterpolationBoundary = top && top.kind === INTERPOLATION && isInterpolationBoundary(ch)
    if (atInterpolationBoundary) {
      const step = readInterpolationStep(ch, top, stack, out)
      out = step.out
      i++
      continue
    }

    if (ch === '/' && !endsWithDivisionContext(out)) {
      const end = scanRegexLiteral(text, i)
      if (end > -1) {
        out = pad(out + '/', end - i - 2)
        out += '/'
        i = end
        continue
      }
    }

    if (ch === "'" || ch === '"') {
      let j = i + 1
      let closed = false
      while (j < n) {
        const c = text[j]
        if (c === '\\') {
          j += 2
          continue
        }
        if (c === '\n') break
        if (c === ch) {
          closed = true
          break
        }
        j++
      }
      if (closed) {
        out = pad(out + ch, j - i - 1)
        out += ch
        i = j + 1
        continue
      }
      out += ch
      i++
      continue
    }

    if (ch === '`') {
      stack.push({ kind: TEMPLATE })
      out += ch
      i++
      continue
    }

    out += ch
    i++
  }
  return out
}

function tokenHits(masked, cssOnly) {
  const hits = [];
  let i = 0;
  const n = masked.length;
  while (i < n) {
    if (!cssOnly && masked.startsWith('//', i)) {
      hits.push({ index: i, kind: 'line comment //' });
      const nl = masked.indexOf('\n', i);
      i = nl === -1 ? n : nl + 1;
      continue;
    }
    if (masked.startsWith('/*', i)) {
      hits.push({ index: i, kind: 'block comment /*' });
      const end = masked.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (masked.startsWith('<!--', i)) {
      hits.push({ index: i, kind: 'html comment <!--' });
      const end = masked.indexOf('-->', i + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    i++;
  }
  return hits;
}

function locate(text, index) {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < index; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: index - lineStart + 1 };
}

function extractFences(md) {
  const fences = [];
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length) {
    const match = /^```(\w*)/.exec(lines[i]);
    if (match) {
      const lang = match[1];
      const lineOffset = i + 1;
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        i++;
      }
      fences.push({ lang, text: buf.join('\n'), lineOffset });
      continue;
    }
    i++;
  }
  return fences;
}

function fenceScanType(lang) {
  if (lang === 'js' || lang === 'ts' || lang === 'mjs' || lang === 'javascript' || lang === 'typescript') {
    return 'js';
  }
  if (lang === 'html') {
    return 'html';
  }
  if (lang === 'css') {
    return 'css';
  }
  return null;
}

function addViolation(rel, absLine, column, kind) {
  violations.push(rel + ':' + absLine + ':' + column + ' contains ' + kind);
}

const files = [];
walk(root, files);
for (const file of files) {
  const rel = relative(root, file);
  if (!rel.includes('/') && isRootResidual(rel)) {
    continue;
  }
  const ext = extname(file);
  const text = readFileSync(file, 'utf8');
  if (ext === '.md') {
    for (const fence of extractFences(text)) {
      const scanType = fenceScanType(fence.lang);
      if (!scanType) {
        continue;
      }
      const masked = maskStrings(fence.text);
      for (const hit of tokenHits(masked, scanType === 'css')) {
        const loc = locate(fence.text, hit.index);
        addViolation(rel, fence.lineOffset + loc.line - 1, loc.column, hit.kind + ' in ' + fence.lang + ' code fence');
      }
    }
    continue;
  }
  if (!codeExts.has(ext)) {
    continue;
  }
  const masked = maskStrings(text);
  for (const hit of tokenHits(masked, ext === '.css')) {
    const loc = locate(text, hit.index);
    addViolation(rel, loc.line, loc.column, hit.kind);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (violations.length > 0) {
    for (const violation of violations) {
      console.log('check-no-comments: ' + violation);
    }
    process.exit(1);
  }
  console.log('check-no-comments: ok - source, examples and docs code fences contain no comments');
}

export { maskStrings, tokenHits, violations };
