import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTemplate } from '../dist/core.mjs'

test('an unquoted attribute value is parsed', () => {
  const result = parseTemplate('test', '<input value=hello>')
  assert.deepEqual(result.root.staticAttrs, { value: 'hello' })
})

test('several unquoted attributes on one tag are parsed', () => {
  const result = parseTemplate('test', '<div class=card data-x=1 id=main></div>')
  assert.deepEqual(result.root.staticAttrs, { class: 'card', 'data-x': '1', id: 'main' })
})

test('an unquoted value stops at the end of the tag', () => {
  const result = parseTemplate('test', '<a href=/list?page=2&sort=asc>next</a>')
  assert.deepEqual(result.root.staticAttrs, { href: '/list?page=2&sort=asc' })
  assert.deepEqual(result.root.text, [{ static: 'next' }])
})

test('a quoted value is still parsed the same way', () => {
  const double = parseTemplate('test', '<input value="hello">')
  const single = parseTemplate('test', "<input value='hello'>")
  assert.deepEqual(double.root.staticAttrs, { value: 'hello' })
  assert.deepEqual(single.root.staticAttrs, { value: 'hello' })
})

test('an unquoted directive value is bound', () => {
  const result = parseTemplate('test', '<button yq-on:click=inc>go</button>')
  assert.deepEqual(result.slots, [{ kind: 'event', nodeId: 0, event: 'click', handler: 'inc' }])
})

test('a boolean attribute keeps working next to an unquoted one', () => {
  const result = parseTemplate('test', '<input type=checkbox checked>')
  assert.deepEqual(result.root.staticAttrs, { type: 'checkbox', checked: '' })
})

test('an unquoted bound attribute without spaces is bound to the state path', () => {
  const result = parseTemplate('test', '<img src={{cover}}>')
  assert.deepEqual(result.slots, [{ kind: 'attr', nodeId: 0, attr: 'src', path: ['cover'] }])
  assert.deepEqual(result.root.staticAttrs, {})
})

test('a quoted bound attribute with spaces is bound to the state path', () => {
  const result = parseTemplate('test', '<img src="{{ cover }}">')
  assert.deepEqual(result.slots, [{ kind: 'attr', nodeId: 0, attr: 'src', path: ['cover'] }])
  assert.deepEqual(result.root.staticAttrs, {})
})

test('yq-key before yq-for sets the key of the row', () => {
  const result = parseTemplate('test', '<ul><li yq-key="id" yq-for="item in items">{{ item.name }}</li></ul>')
  assert.deepEqual(result.root.children[0].list, { itemVar: 'item', indexVar: null, itemsPath: ['items'], keyProp: 'id' })
})

test('yq-key after yq-for sets the key of the row', () => {
  const result = parseTemplate('test', '<ul><li yq-for="item in items" yq-key="id">{{ item.name }}</li></ul>')
  assert.deepEqual(result.root.children[0].list, { itemVar: 'item', indexVar: null, itemsPath: ['items'], keyProp: 'id' })
})

test('an unquoted yq-key works in any position', () => {
  const result = parseTemplate('test', '<ul><li yq-key=id yq-for="item in items">x</li></ul>')
  assert.deepEqual(result.root.children[0].list, { itemVar: 'item', indexVar: null, itemsPath: ['items'], keyProp: 'id' })
})

test('yq-key never leaks into the rendered attributes', () => {
  const result = parseTemplate('test', '<ul><li yq-key="id" yq-for="item in items">x</li></ul>')
  assert.deepEqual(result.root.children[0].staticAttrs, {})
})

test('a yq-key without yq-for is still rejected', () => {
  assert.throws(() => parseTemplate('test', '<ul><li yq-key="id">x</li></ul>'), {
    message: '[yq:parse] test: yq-key without yq-for'
  })
})
