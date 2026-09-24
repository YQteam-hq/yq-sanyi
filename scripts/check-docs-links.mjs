import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const DOCS = [
  'README.md',
  'CONTRIBUTING.md',
  'docs/tutorial.md',
  'docs/i18n/zh-CN/tutorial.md'
]

const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i

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

const problems = []

for (const doc of DOCS) {
  const abs = join(root, doc)
  if (!existsSync(abs)) {
    problems.push(doc + ' is missing from the working tree')
    continue
  }
  const text = readFileSync(abs, 'utf8')
  LINK.lastIndex = 0
  let match
  while ((match = LINK.exec(text)) !== null) {
    const target = match[1]
    if (EXTERNAL.test(target)) continue
    const clean = target.split('#')[0]
    if (!clean) continue
    if (!existsSync(resolve(dirname(abs), decode(clean)))) {
      problems.push(doc + ':' + lineOf(text, match.index) + ' links to a path that does not exist: ' + clean)
    }
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    write('check-docs-links: ' + problem)
  }
  process.exitCode = 1
} else {
  write('check-docs-links: ok - every relative link in the user-facing docs resolves')
}
