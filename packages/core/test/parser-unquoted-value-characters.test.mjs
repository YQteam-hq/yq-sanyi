import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTemplate } from '../dist/core.mjs'

function root(template) {
  return parseTemplate('probe', template).root
}

describe('characters HTML allows inside an unquoted value', () => {
  test('a slash stays in the value', () => {
    const node = root('<img src=/img/logo.png alt=hi>')
    assert.equal(node.tag, 'img')
    assert.equal(node.staticAttrs.src, '/img/logo.png')
    assert.equal(node.staticAttrs.alt, 'hi')
  })

  test('an equals sign stays in the value', () => {
    assert.equal(root('<div data-eq=a=b>x</div>').staticAttrs['data-eq'], 'a=b')
  })

  test('a colon and quotes stay in the value', () => {
    assert.equal(root('<div data-json={"a":1}>x</div>').staticAttrs['data-json'], '{"a":1}')
  })

  test('a slash right before the closing angle bracket closes the tag instead', () => {
    assert.equal(root('<input value=x/>').staticAttrs.value, 'x')
  })

  test('an entity in the value is decoded', () => {
    const node = root('<div title=a&amp;b>x</div>')
    assert.deepEqual(node.dynAttrs.title, [{ static: 'a&b' }])
  })
})

describe('unquoted and quoted attributes in one tag', () => {
  test('a quoted attribute after an unquoted one keeps both', () => {
    const node = root('<a href=/about title="About us">link</a>')
    assert.equal(node.tag, 'a')
    assert.equal(node.staticAttrs.href, '/about')
    assert.equal(node.staticAttrs.title, 'About us')
  })

  test('a single quoted attribute next to an unquoted one keeps both', () => {
    const node = root("<div a='1' b=2>x</div>")
    assert.equal(node.staticAttrs.a, '1')
    assert.equal(node.staticAttrs.b, '2')
  })

  test('an unquoted attribute before a quoted one on a void element', () => {
    const node = root('<img src=a.png alt="a b">')
    assert.equal(node.staticAttrs.src, 'a.png')
    assert.equal(node.staticAttrs.alt, 'a b')
  })
})

describe('unquoted values on their own', () => {
  test('one unquoted value becomes the value of the attribute', () => {
    assert.equal(root('<input value=hello>').staticAttrs.value, 'hello')
  })

  test('several unquoted attributes keep their own names and values', () => {
    const node = root('<div class=box id=main>x</div>')
    assert.equal(node.staticAttrs.class, 'box')
    assert.equal(node.staticAttrs.id, 'main')
    assert.equal(Object.keys(node.staticAttrs).length, 2)
  })

  test('a valueless attribute is still recognised', () => {
    const node = root('<input type=checkbox checked>')
    assert.equal(node.staticAttrs.type, 'checkbox')
    assert.equal(node.staticAttrs.checked, '')
  })

  test('an unquoted value stops at the closing angle bracket', () => {
    const node = root('<div a=1 b=2 c=3></div>')
    assert.deepEqual(node.staticAttrs, { a: '1', b: '2', c: '3' })
    assert.equal(node.children.length, 0)
  })
})

describe('unquoted values in bindings and directives', () => {
  test('an unquoted binding is treated as a binding', () => {
    const node = root('<input value={{count}}>')
    assert.equal(node.staticAttrs.value, undefined)
    assert.deepEqual(node.dynAttrs.value, [{ path: ['count'] }])
  })

  test('an unquoted yq-on value registers the handler', () => {
    const parsed = parseTemplate('probe', '<div><button yq-on:click=inc>go</button></div>')
    const event = parsed.slots.find((slot) => slot.kind === 'event')
    assert.ok(event, 'the handler must be registered')
    assert.equal(event.event, 'click')
    assert.equal(event.handler, 'inc')
  })

  test('an unquoted yq-for value builds the list spec', () => {
    const parsed = parseTemplate('probe', '<ul><li yq-for="item in items">{{ item }}</li></ul>')
    const list = parsed.slots.find((slot) => slot.kind === 'list')
    assert.deepEqual(list.itemsPath, ['items'])
    assert.equal(list.itemVar, 'item')
  })
})
