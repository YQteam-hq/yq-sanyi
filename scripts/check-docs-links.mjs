import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist'])

const INLINE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const DEFINITION = /^ {0,3}\[([^\]]+)\]:[ \t]*(.*)$/gm
const FENCE = /^ {0,3}(```|~~~)/
const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i

function listMarkdown(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) {
      if (SKIP_DIRS.has(name)) continue
      for (const nested of listMarkdown(abs)) out.push(name + '/' + nested)
      continue
    }
    if (name.endsWith('.md')) out.push(name)
  }
  return out
}

function write(line) {
  process.stdout.write(line + '\n')
}

function decode(target) {
  try {
    return decodeURIComponent(target)
  } catch (error) {
    return target
  }
}

function lineStarts(text) {
  const starts = [0]
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1)
  }
  return starts
}

function lineOf(starts, index) {
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (starts[mid] <= index) {
      low = mid
      continue
    }
    high = mid - 1
  }
  return low + 1
}

function fencedRanges(text) {
  const ranges = []
  let open = -1
  let offset = 0
  for (const lineText of text.split('\n')) {
    const next = offset + lineText.length + 1
    if (FENCE.test(lineText)) {
      if (open === -1) {
        open = offset
      } else {
        ranges.push([open, next])
        open = -1
      }
    }
    offset = next
  }
  if (open !== -1) ranges.push([open, text.length])
  return ranges
}

function inside(ranges, index) {
  return ranges.some(([from, to]) => index >= from && index < to)
}

function definitionTarget(rest) {
  const text = rest.trim()
  if (text.startsWith('<')) {
    const end = text.indexOf('>')
    return end === -1 ? text.slice(1) : text.slice(1, end)
  }
  const cut = text.search(/\s/)
  return cut === -1 ? text : text.slice(0, cut)
}

function scan(pattern, text, pick) {
  const found = []
  pattern.lastIndex = 0
  let match
  while ((match = pattern.exec(text)) !== null) {
    const target = pick(match)
    if (target !== null) found.push({ index: match.index, target })
  }
  return found
}

function matches(text) {
  const inline = scan(INLINE, text, (match) => match[1])
  const definitions = scan(DEFINITION, text, (match) =>
    match[1].startsWith('^') ? null : definitionTarget(match[2])
  )
  return inline.concat(definitions).sort((left, right) => left.index - right.index)
}

export function collectLinks(text) {
  const starts = lineStarts(text)
  const fenced = fencedRanges(text)
  const links = []
  for (const match of matches(text)) {
    if (match.target.length === 0 || inside(fenced, match.index)) continue
    links.push({ target: match.target, line: lineOf(starts, match.index) })
  }
  return links
}

function collectProblems(docs) {
  const problems = []
  for (const doc of docs) {
    const abs = join(root, doc)
    if (!existsSync(abs)) {
      problems.push(doc + ' is missing from the working tree')
      continue
    }
    for (const link of collectLinks(readFileSync(abs, 'utf8'))) {
      if (EXTERNAL.test(link.target)) continue
      const clean = link.target.split('#')[0]
      if (!clean) continue
      if (!existsSync(resolve(dirname(abs), decode(clean)))) {
        problems.push(doc + ':' + link.line + ' links to a path that does not exist: ' + clean)
      }
    }
  }
  return problems
}

function check() {
  const docs = readdirSync(root)
    .filter((name) => name.endsWith('.md'))
    .concat(listMarkdown(join(root, 'docs')).map((rel) => 'docs/' + rel))
    .sort()
  const problems = collectProblems(docs)
  if (problems.length > 0) {
    for (const problem of problems) {
      write('check-docs-links: ' + problem)
    }
    process.exitCode = 1
    return
  }
  write('check-docs-links: ok - every relative link in the ' + docs.length + ' user-facing docs resolves')
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  check()
}
