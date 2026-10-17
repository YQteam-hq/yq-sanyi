import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTemplate } from '../dist/core.mjs'

function root(template) {
  return parseTemplate('probe', template).root
}

describe('unquoted attribute values', () => {
  test('an unquoted attribute value becomes the value of the attribute', () => {
    const node = root('<input value=hello>')
    assert.equal(node.tag, 'input')
    assert.equal(node.staticAttrs.value, 'hello')
    assert.equal(node.staticAttrs.valuehello, undefined)
  })

  test('several unquoted attributes keep their own names and values', () => {
    const node = root('<div class=box id=main>x</div>')
    assert.equal(node.tag, 'div')
    assert.equal(node.staticAttrs.class, 'box')
    assert.equal(node.staticAttrs.id, 'main')
    assert.equal(Object.keys(node.staticAttrs).length, 2)
  })

  test('quoted and unquoted attributes can be mixed in one tag', () => {
    const node = root('<a href=/about title="About us">link</a>')
    assert.equal(node.tag, 'a')
    assert.equal(node.staticAttrs.href, '/about')
    assert.equal(node.staticAttrs.title, 'About us')
  })

  test('an unquoted value does not swallow the rest of the tag', () => {
    const node = root('<img src=a.png alt=hi>')
    assert.equal(node.tag, 'img')
    assert.equal(node.staticAttrs.src, 'a.png')
    assert.equal(node.staticAttrs.alt, 'hi')
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

  test('an unquoted value that binds an expression is treated as a binding', () => {
    const node = root('<input value={{count}}>')
    assert.equal(node.staticAttrs.value, undefined)
    assert.deepEqual(node.dynAttrs.value, [{ path: ['count'] }])
  })

})

describe('unquoted values in bindings and directives', () => {
  test('an unquoted yq-on value registers the handler', () => {
    const parsed = parseTemplate('probe', '<div><button yq-on:click=inc>go</button></div>')
    const event = parsed.slots.find((slot) => slot.kind === 'event')
    assert.ok(event, 'the handler must be registered')
    assert.equal(event.event, 'click')
    assert.equal(event.handler, 'inc')
  })

  test('an unquoted value keeps the characters that HTML allows in one', () => {
    assert.equal(root('<div data-eq=a=b>x</div>').staticAttrs['data-eq'], 'a=b')
    assert.equal(root('<img src=/img/logo.png>').staticAttrs.src, '/img/logo.png')
    assert.equal(root('<div data-json={"a":1}>x</div>').staticAttrs['data-json'], '{"a":1}')
  })

  test('an unquoted value decodes the entities it contains', () => {
    const node = root('<div title=a&amp;b>x</div>')
    assert.deepEqual(node.dynAttrs.title, [{ static: 'a&b' }])
  })

  test('an unquoted value next to a single quoted one keeps both', () => {
    const node = root("<div a='1' b=2>x</div>")
    assert.equal(node.staticAttrs.a, '1')
    assert.equal(node.staticAttrs.b, '2')
  })

  test('an unquoted yq-for value still builds the list spec', () => {
    const parsed = parseTemplate('probe', '<ul><li yq-for="item in items">{{ item }}</li></ul>')
    const list = parsed.slots.find((slot) => slot.kind === 'list')
    assert.deepEqual(list.itemsPath, ['items'])
    assert.equal(list.itemVar, 'item')
  })
})
