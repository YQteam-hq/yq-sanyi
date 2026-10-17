import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist'])

const INLINE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const DEFINITION = /^ {0,3}\[[^\]^][^\]]*\]:[ \t]*(?:<([^>]*)>|(\S+))/gm
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

function lineOf(text, index) {
  let line = 1
  for (let i = 0; i < index; i++) {
    if (text.charCodeAt(i) === 10) line++
  }
  return line
}

function withoutFences(text) {
  const out = []
  let fenced = false
  for (const lineText of text.split('\n')) {
    if (FENCE.test(lineText)) {
      fenced = !fenced
      out.push('')
      continue
    }
    out.push(fenced ? '' : lineText)
  }
  return out.join('\n')
}

export function collectLinks(text) {
  const body = withoutFences(text)
  const links = []
  INLINE.lastIndex = 0
  let match
  while ((match = INLINE.exec(body)) !== null) {
    links.push({ target: match[1], line: lineOf(body, match.index) })
  }
  DEFINITION.lastIndex = 0
  while ((match = DEFINITION.exec(body)) !== null) {
    const target = match[1] === undefined ? match[2] : match[1]
    links.push({ target, line: lineOf(body, match.index) })
  }
  return links
}

function check() {
  const docs = readdirSync(root)
    .filter((name) => name.endsWith('.md'))
    .concat(listMarkdown(join(root, 'docs')).map((rel) => 'docs/' + rel))
    .sort()
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
