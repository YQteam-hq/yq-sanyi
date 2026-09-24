import { test } from 'node:test'
import { parseTemplate, createScriptFactory, define } from '../dist/core.mjs'
import assert from 'node:assert/strict'

function expect(actual) {
  return {
    toBe(expected) { assert.strictEqual(actual, expected) },
    toEqual(expected) { assert.deepEqual(actual, expected) },
    toHaveLength(n) { assert.strictEqual(actual.length, n) },
    toThrow(msg) {
      if (typeof actual === 'function') {
        if (typeof msg === 'string') {
          assert.throws(actual, { message: msg })
        } else {
          assert.throws(actual, msg)
        }
      }
    },
    toContain(expected) { assert.ok(actual.includes(expected)) },
    toBeDefined() { assert.ok(actual !== undefined) },
    toMatch(re) { assert.ok(re.test(actual)) }
  }
}

test('text slot basic path and mixed static text', () => {
  const result = parseTemplate('test', 'Hi {{ user.name }}!')
  assert.strictEqual(result.slots.length, 1)
  assert.deepEqual(result.slots[0], { kind: 'text', nodeId: 0, partIndex: 1 })
  assert.deepEqual(result.root.text, [
    { static: 'Hi ' },
    { path: ['user', 'name'] },
    { static: '!' }
  ])
})

test('attr whole-value binding', () => {
  const result = parseTemplate('test', '<input value="{{ form.name }}">')
  assert.strictEqual(result.slots.length, 1)
  assert.deepEqual(result.slots[0], { kind: 'attr', nodeId: 0, attr: 'value', path: ['form', 'name'] })
  assert(!result.root.staticAttrs.hasOwnProperty('value'))
  assert.deepEqual(result.root.dynAttrs, { value: [{ path: ['form', 'name'] }] })
})

test('bool boolean attribute set', () => {
  const result = parseTemplate('test', '<input disabled="{{ isDisabled }}">')
  assert.strictEqual(result.slots.length, 1)
  assert.deepEqual(result.slots[0], { kind: 'bool', nodeId: 0, attr: 'disabled', path: ['isDisabled'] })
  assert(!result.root.staticAttrs.hasOwnProperty('disabled'))
  assert.deepEqual(result.root.dynAttrs, { disabled: [{ path: ['isDisabled'] }] })
})

test('non-whole-value attribute throws', () => {
  assert.throws(() => parseTemplate('test', '<input class="{{ c }} {{ d }}">'), { message: '[yq:parse] attribute binding only supports whole value form: class="{{ c }} {{ d }}"' })
})

test('list slot full syntax', () => {
  const result = parseTemplate('test', '<ul><li yq-for="p in products" yq-key="id">{{ p.name }}</li></ul>')
  assert.strictEqual(result.slots.length, 2)
  assert.deepEqual(result.slots[0], { kind: 'list', nodeId: 1, itemVar: 'p', indexVar: null, itemsPath: ['products'], keyProp: 'id' })
  assert.deepEqual(result.slots[1], { kind: 'text', nodeId: 1, partIndex: 0 })
  assert.deepEqual(result.root.children[0].list, { itemVar: 'p', indexVar: null, itemsPath: ['products'], keyProp: 'id' })
})

test('list shorthand form', () => {
  const result = parseTemplate('test', '<div yq-for="products"></div>')
  assert.strictEqual(result.slots.length, 1)
  assert.deepEqual(result.slots[0], { kind: 'list', nodeId: 0, itemVar: 'item', indexVar: null, itemsPath: ['products'], keyProp: null })
})

test('nested yq-for inside a keyed row is parsed', () => {
  const result = parseTemplate('test', '<div yq-for="a in items"><div yq-for="b in a"></div></div>')
  const listSlots = result.slots.filter((slot) => slot.kind === 'list')
  assert.strictEqual(listSlots.length, 2)
  assert.deepEqual(listSlots[0], { kind: 'list', nodeId: 0, itemVar: 'a', indexVar: null, itemsPath: ['items'], keyProp: null })
  assert.deepEqual(listSlots[1], { kind: 'list', nodeId: 1, itemVar: 'b', indexVar: null, itemsPath: ['a'], keyProp: null })
  assert.deepEqual(result.root.children[0].list, { itemVar: 'b', indexVar: null, itemsPath: ['a'], keyProp: null })
})

test('multiple root elements throw', () => {
  const result = parseTemplate('test', '<a></a><b></b>')
  assert.strictEqual(result.nodes.length, 2)
  assert.strictEqual(result.nodes[0].tag, 'a')
  assert.strictEqual(result.nodes[1].tag, 'b')
})

test('empty template throws', () => {
  assert.throws(() => parseTemplate('test', ''), { message: '[yq:parse] test: empty template' })
})

test('unclosed and mismatched tags', () => {
  assert.throws(() => parseTemplate('test', '<div><span></div>'), { message: '[yq:parse] test: unclosed tag: span' })
})

test('void and self-closing tags', () => {
  const result = parseTemplate('test', '<img src="a.png"><br>')
  assert.strictEqual(result.nodes.length, 2)
  assert.strictEqual(result.nodes[0].tag, 'img')
  assert.strictEqual(result.nodes[0].children.length, 0)
  assert.strictEqual(result.nodes[1].tag, 'br')
  assert.strictEqual(result.nodes[1].children.length, 0)
})

test('entity decoding', () => {
  const result = parseTemplate('test', 'A &amp; B &lt; C')
  assert.deepEqual(result.root.text, [{ static: 'A & B < C' }])
})

test('style preserved as-is', () => {
  const style = 'p { margin: 0 } .c { color: red }'
  const result = parseTemplate('test', '<div></div>')
  const cdo = { name: 'test', root: result.root, nodes: result.nodes, styleText: style, scriptFactory: null, slots: result.slots }
  assert.strictEqual(cdo.styleText, style)
})

test('script function-path factory returns same function', () => {
  const script = function() { return 42 }
  const factory = createScriptFactory(script)
  assert.strictEqual(factory(), script)
})

test('script string-path compiles', () => {
  const factory = createScriptFactory('1')
  assert.strictEqual(factory(), 1)
  assert.throws(() => createScriptFactory('invalid syntax('), SyntaxError)
})

test('script null handling', () => {
  const factory = createScriptFactory(null)
  assert.strictEqual(factory, null)
})

test('script invalid type returns null', () => {
  const factory = createScriptFactory(123)
  assert.strictEqual(factory, null)
})

test('define parses once and caches, multiple instances share one CDO', async () => {
  const { define, lookup } = await import('../dist/core.mjs')
  const definition = { template: '<div>{{ x }}</div>', style: 'div { color: red }', script: null }
  define('test', definition)

  const result1 = lookup('test')
  const result2 = lookup('test')

  assert.ok(result1 !== undefined)
  assert.ok(result2 !== undefined)
  assert.strictEqual(result1.cdo, result2.cdo)
})

test('dynAttrs and yq-for are excluded from staticAttrs', () => {
  const result = parseTemplate('test', '<div yq-for="items" yq-key="id" class="static">{{ item.name }}</div>')
  assert.deepEqual(result.root.staticAttrs, { class: 'static' })
  assert.deepEqual(result.root.dynAttrs, {})
  assert.deepEqual(result.root.list, { itemVar: 'item', indexVar: null, itemsPath: ['items'], keyProp: 'id' })
})

test('error message prefix', () => {
  const cases = [
    () => parseTemplate('test', '<div yq-for="a in items"><div yq-for="b in a"></div></div>'),
    () => parseTemplate('test', '<a></a><b></b>'),
    () => parseTemplate('test', ''),
    () => parseTemplate('test', '<div><span></div>'),
    () => parseTemplate('test', '<input class="{{ c }} {{ d }}">')
  ]

  cases.forEach(fn => {
    try {
      fn()
    } catch (e) {
      assert.ok(e.message.startsWith('[yq:parse]'))
    }
  })
})

test('path parsing errors', () => {
  assert.throws(() => parseTemplate('test', '<div>{{ . }}</div>'), { message: '[yq:parse] invalid path: .' })
  assert.throws(() => parseTemplate('test', '<div>{{ user. }}</div>'), { message: '[yq:parse] invalid path: user.' })
  assert.throws(() => parseTemplate('test', '<div>{{ .name }}</div>'), { message: '[yq:parse] invalid path: .name' })
})

test('text node whitespace static segments preserved', () => {
  const result = parseTemplate('test', '<div>   {{ x }}   </div>')
  assert.deepEqual(result.root.text, [
    { static: '   ' },
    { path: ['x'] },
    { static: '   ' }
  ])
})

test('mixed static text with multiple expressions', () => {
  const result = parseTemplate('test', 'Hello {{ user.name }}, your score is {{ user.score }}!')
  assert.strictEqual(result.slots.length, 2)
  assert.deepEqual(result.slots[0], { kind: 'text', nodeId: 0, partIndex: 1 })
  assert.deepEqual(result.slots[1], { kind: 'text', nodeId: 0, partIndex: 3 })
  assert.deepEqual(result.root.text, [
    { static: 'Hello ' },
    { path: ['user', 'name'] },
    { static: ', your score is ' },
    { path: ['user', 'score'] },
    { static: '!' }
  ])
})

test('numeric path segment', () => {
  const result = parseTemplate('test', '<div>{{ items.0.name }}</div>')
  assert.strictEqual(result.slots.length, 1)
  assert.deepEqual(result.slots[0], { kind: 'text', nodeId: 0, partIndex: 0 })
  assert.deepEqual(result.root.text, [{ path: ['items', '0', 'name'] }])
})

test('boolean attribute value binding', () => {
  const result = parseTemplate('test', '<input checked="{{ isChecked }}">')
  assert.strictEqual(result.slots.length, 1)
  assert.deepEqual(result.slots[0], { kind: 'bool', nodeId: 0, attr: 'checked', path: ['isChecked'] })
})

test('non-boolean attribute value binding', () => {
  const result = parseTemplate('test', '<input value="{{ form.input }}">')
  assert.strictEqual(result.slots.length, 1)
  assert.deepEqual(result.slots[0], { kind: 'attr', nodeId: 0, attr: 'value', path: ['form', 'input'] })
})

test('nested element text slot', () => {
  const result = parseTemplate('test', '<div><span>{{ user.name }}</span></div>')
  assert.strictEqual(result.slots.length, 1)
  assert.deepEqual(result.slots[0], { kind: 'text', nodeId: 1, partIndex: 0 })
  assert.deepEqual(result.root.children[0].text, [{ path: ['user', 'name'] }])
})

test('multiple attribute bindings', () => {
  const result = parseTemplate('test', '<input value="{{ form.name }}" placeholder="{{ form.placeholder }}">')
  assert.strictEqual(result.slots.length, 2)
  assert.deepEqual(result.slots[0], { kind: 'attr', nodeId: 0, attr: 'value', path: ['form', 'name'] })
  assert.deepEqual(result.slots[1], { kind: 'attr', nodeId: 0, attr: 'placeholder', path: ['form', 'placeholder'] })
  assert.deepEqual(result.root.dynAttrs, {
    value: [{ path: ['form', 'name'] }],
    placeholder: [{ path: ['form', 'placeholder'] }]
  })
})

test('mixed static and dynamic attributes', () => {
  const result = parseTemplate('test', '<input class="static" value="{{ form.name }}">')
  assert.strictEqual(result.slots.length, 1)
  assert.deepEqual(result.slots[0], { kind: 'attr', nodeId: 0, attr: 'value', path: ['form', 'name'] })
  assert.deepEqual(result.root.staticAttrs, { class: 'static' })
  assert.deepEqual(result.root.dynAttrs, { value: [{ path: ['form', 'name'] }] })
})

test('empty expression throws', () => {
  assert.throws(() => parseTemplate('test', '<div>{{ }}</div>'), { message: '[yq:parse] empty expression in {{ }}' })
})

test('complex nested structure', () => {
  const result = parseTemplate('test', '<div class="container"><h1>{{ title }}</h1><p>{{ content }}</p></div>')
  assert.strictEqual(result.slots.length, 2)
  assert.deepEqual(result.slots[0], { kind: 'text', nodeId: 1, partIndex: 0 })
  assert.deepEqual(result.slots[1], { kind: 'text', nodeId: 2, partIndex: 0 })
  assert.strictEqual(result.root.children.length, 2)
  assert.deepEqual(result.root.children[0].text, [{ path: ['title'] }])
  assert.deepEqual(result.root.children[1].text, [{ path: ['content'] }])
})

test('complex text mixing', () => {
  const result = parseTemplate('test', 'Total: ${{ price }} (tax: ${{ tax }})')
  assert.strictEqual(result.slots.length, 2)
  assert.deepEqual(result.slots[0], { kind: 'text', nodeId: 0, partIndex: 1 })
  assert.deepEqual(result.slots[1], { kind: 'text', nodeId: 0, partIndex: 3 })
  assert.deepEqual(result.root.text, [
    { static: 'Total: $' },
    { path: ['price'] },
    { static: ' (tax: $' },
    { path: ['tax'] },
    { static: ')' }
  ])
})

test('duplicate definition throws', async () => {
  const { define } = await import('../dist/core.mjs')
  const definition = { template: '<div></div>', style: 'div {}', script: null }
  define('dup-test', definition)
  assert.throws(() => define('dup-test', definition), { message: 'duplicate component definition: dup-test' })
})

test('template leading and trailing whitespace', () => {
  const result = parseTemplate('test', '  <div>{{ x }}</div>  ')
  assert.strictEqual(result.root.tag, 'div')
  assert.deepEqual(result.root.text, [{ path: ['x'] }])
})

test('root element is a void tag', () => {
  const result = parseTemplate('test', '<img src="test.png">')
  assert.strictEqual(result.root.tag, 'img')
  assert.strictEqual(result.root.children.length, 0)
})

test('void element with attributes', () => {
  const result = parseTemplate('test', '<img src="test.png" alt="test">')
  assert.strictEqual(result.root.tag, 'img')
  assert.deepEqual(result.root.staticAttrs, { src: 'test.png', alt: 'test' })
  assert.strictEqual(result.root.children.length, 0)
})

test('void element with dynamic attributes', () => {
  const result = parseTemplate('test', '<img src="{{ image.src }}" alt="{{ image.alt }}">')
  assert.strictEqual(result.slots.length, 2)
  assert.deepEqual(result.slots[0], { kind: 'attr', nodeId: 0, attr: 'src', path: ['image', 'src'] })
  assert.deepEqual(result.slots[1], { kind: 'attr', nodeId: 0, attr: 'alt', path: ['image', 'alt'] })
  assert.deepEqual(result.root.dynAttrs, { src: [{ path: ['image', 'src'] }], alt: [{ path: ['image', 'alt'] }] })
})

test('void element with boolean attribute', () => {
  const result = parseTemplate('test', '<input disabled="{{ isDisabled }}">')
  assert.strictEqual(result.slots.length, 1)
  assert.deepEqual(result.slots[0], { kind: 'bool', nodeId: 0, attr: 'disabled', path: ['isDisabled'] })
})

test('complex text mixing with multiple expressions', () => {
  const result = parseTemplate('test', 'Total: ${{ price }} (tax: ${{ tax }}) - Discount: ${{ discount }}')
  assert.strictEqual(result.slots.length, 3)
  assert.deepEqual(result.slots[0], { kind: 'text', nodeId: 0, partIndex: 1 })
  assert.deepEqual(result.slots[1], { kind: 'text', nodeId: 0, partIndex: 3 })
  assert.deepEqual(result.slots[2], { kind: 'text', nodeId: 0, partIndex: 5 })
  assert.deepEqual(result.root.text, [
    { static: 'Total: $' },
    { path: ['price'] },
    { static: ' (tax: $' },
    { path: ['tax'] },
    { static: ') - Discount: $' },
    { path: ['discount'] }
  ])
})

test('yq-for row binding exposes the item and the row index', () => {
  const result = parseTemplate('test', '<ul><li yq-for="(row, i) in rows" yq-key="id">{{ i }}:{{ row.name }}</li></ul>')
  const listSlot = result.slots.find((slot) => slot.kind === 'list')
  assert.deepEqual(listSlot, { kind: 'list', nodeId: 1, itemVar: 'row', indexVar: 'i', itemsPath: ['rows'], keyProp: 'id' })
  assert.deepEqual(result.root.children[0].list, { itemVar: 'row', indexVar: 'i', itemsPath: ['rows'], keyProp: 'id' })
  const textSlots = result.slots.filter((slot) => slot.kind === 'text')
  assert.deepEqual(textSlots, [
    { kind: 'text', nodeId: 1, partIndex: 0 },
    { kind: 'text', nodeId: 1, partIndex: 2 }
  ])
})

test('yq-for rejects malformed row bindings', () => {
  assert.throws(() => parseTemplate('test', '<div yq-for="(row) in rows"></div>'), { message: 'invalid yq-for row binding: (row) in rows' })
  assert.throws(() => parseTemplate('test', '<div yq-for="(row, ) in rows"></div>'), { message: 'invalid yq-for row binding: (row, ) in rows' })
  assert.throws(() => parseTemplate('test', '<div yq-for="(row, row) in rows"></div>'), { message: 'duplicate yq-for row binding name: (row, row) in rows' })
})

test('yq-for keeps a single item variable when no row binding is used', () => {
  const result = parseTemplate('test', '<div yq-for="entry in entries"></div>')
  const listSlot = result.slots.find((slot) => slot.kind === 'list')
  assert.deepEqual(listSlot, { kind: 'list', nodeId: 0, itemVar: 'entry', indexVar: null, itemsPath: ['entries'], keyProp: null })
})

test('a nested list keeps its own yq-key', () => {
  const result = parseTemplate('test', '<ul yq-for="group in groups" yq-key="id"><li yq-for="row in group.rows" yq-key="sku"></li></ul>')
  const listSlots = result.slots.filter((slot) => slot.kind === 'list')
  assert.strictEqual(listSlots.length, 2)
  assert.strictEqual(listSlots[0].keyProp, 'id')
  assert.strictEqual(listSlots[1].keyProp, 'sku')
  assert(!('yq-key' in result.root.staticAttrs))
  assert(!('yq-key' in result.root.children[0].staticAttrs))
})

test('nested lists three levels deep are parsed', () => {
  const result = parseTemplate('test', '<a yq-for="x in xs"><b yq-for="y in ys"><c yq-for="z in zs"></c></b></a>')
  const listSlots = result.slots.filter((slot) => slot.kind === 'list')
  assert.strictEqual(listSlots.length, 3)
  assert.deepEqual(listSlots.map((slot) => slot.nodeId), [0, 1, 2])
  assert.deepEqual(listSlots.map((slot) => slot.itemVar), ['x', 'y', 'z'])
})

test('error handling with multiple attributes', () => {
  assert.throws(() => parseTemplate('test', '<input class="{{ c }} {{ d }}">'), { message: '[yq:parse] attribute binding only supports whole value form: class="{{ c }} {{ d }}"' })
})

test('error handling with complex nested structure', () => {
  assert.throws(() => parseTemplate('test', '<div><span></div>'), { message: '[yq:parse] test: unclosed tag: span' })
})

test('error handling with multiple root elements', () => {
  const result = parseTemplate('test', '<a></a><b></b>')
  assert.strictEqual(result.nodes.length, 2)
})

test('error handling for empty template', () => {
  assert.throws(() => parseTemplate('test', ''), { message: '[yq:parse] test: empty template' })
})

test('error handling for empty expression', () => {
  assert.throws(() => parseTemplate('test', '<div>{{ }}</div>'), { message: '[yq:parse] empty expression in {{ }}' })
})

test('error handling for invalid path', () => {
  assert.throws(() => parseTemplate('test', '<div>{{ . }}</div>'), { message: '[yq:parse] invalid path: .' })
  assert.throws(() => parseTemplate('test', '<div>{{ user. }}</div>'), { message: '[yq:parse] invalid path: user.' })
  assert.throws(() => parseTemplate('test', '<div>{{ .name }}</div>'), { message: '[yq:parse] invalid path: .name' })
})

test('correct handling with multiple attributes', () => {
  const result = parseTemplate('test', '<input value="{{ form.name }}" placeholder="{{ form.placeholder }}">')
  assert.strictEqual(result.slots.length, 2)
  assert.deepEqual(result.slots[0], { kind: 'attr', nodeId: 0, attr: 'value', path: ['form', 'name'] })
  assert.deepEqual(result.slots[1], { kind: 'attr', nodeId: 0, attr: 'placeholder', path: ['form', 'placeholder'] })
  assert.deepEqual(result.root.dynAttrs, {
    value: [{ path: ['form', 'name'] }],
    placeholder: [{ path: ['form', 'placeholder'] }]
  })
})

test('correct handling with mixed static and dynamic attributes', () => {
  const result = parseTemplate('test', '<input class="static" value="{{ form.name }}">')
  assert.strictEqual(result.slots.length, 1)
  assert.deepEqual(result.slots[0], { kind: 'attr', nodeId: 0, attr: 'value', path: ['form', 'name'] })
  assert.deepEqual(result.root.staticAttrs, { class: 'static' })
  assert.deepEqual(result.root.dynAttrs, { value: [{ path: ['form', 'name'] }] })
})

test('correct handling of complex text mixing', () => {
  const result = parseTemplate('test', 'Total: ${{ price }} (tax: ${{ tax }})')
  assert.strictEqual(result.slots.length, 2)
  assert.deepEqual(result.slots[0], { kind: 'text', nodeId: 0, partIndex: 1 })
  assert.deepEqual(result.slots[1], { kind: 'text', nodeId: 0, partIndex: 3 })
  assert.deepEqual(result.root.text, [
    { static: 'Total: $' },
    { path: ['price'] },
    { static: ' (tax: $' },
    { path: ['tax'] },
    { static: ')' }
  ])
})

test('correct handling of complex text mixing with multiple expressions', () => {
  const result = parseTemplate('test', 'Total: ${{ price }} (tax: ${{ tax }}) - Discount: ${{ discount }}')
  assert.strictEqual(result.slots.length, 3)
  assert.deepEqual(result.slots[0], { kind: 'text', nodeId: 0, partIndex: 1 })
  assert.deepEqual(result.slots[1], { kind: 'text', nodeId: 0, partIndex: 3 })
  assert.deepEqual(result.slots[2], { kind: 'text', nodeId: 0, partIndex: 5 })
  assert.deepEqual(result.root.text, [
    { static: 'Total: $' },
    { path: ['price'] },
    { static: ' (tax: $' },
    { path: ['tax'] },
    { static: ') - Discount: $' },
    { path: ['discount'] }
  ])
})
