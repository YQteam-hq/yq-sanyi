import { test } from 'node:test'
import assert from 'node:assert'
import { ComponentComposition, CompositionUtils } from '../src/component-composition.js'

// Mock ComponentDefinition
const createMockComponent = (name, template = '', script = null, style = '') => ({
  template,
  script,
  style,
  options: { name }
})

// Test ComponentComposition
test('ComponentComposition - Component registration', () => {
  const component = createMockComponent('test-component')
  ComponentComposition.registerComponent('test-component', component)
  
  const retrievedComponent = ComponentComposition.getComponent('test-component')
  assert.strictEqual(retrievedComponent.template, component.template)
  assert.strictEqual(retrievedComponent.script, component.script)
  assert.strictEqual(retrievedComponent.style, component.style)
})

test('ComponentComposition - Component composition', () => {
  const component1 = createMockComponent('header', '<header>Header</header>')
  const component2 = createMockComponent('content', '<main>Content</main>')
  
  const composedComponent = ComponentComposition.compose(
    'composed-component',
    [component1, component2]
  )
  
  assert.strictEqual(composedComponent.template, '<header>Header</header>\n<main>Content</main>')
  assert.strictEqual(composedComponent.options.name, 'composed-component')
  assert.strictEqual(composedComponent.options.components.length, 2)
})

test('ComponentComposition - Component composition with options', () => {
  const component1 = createMockComponent('header', '<header>Header</header>')
  const component2 = createMockComponent('content', '<main>Content</main>')
  
  const composedComponent = ComponentComposition.compose(
    'composed-component',
    [component1, component2],
    { inheritAttrs: true, scoped: true }
  )
  
  assert.strictEqual(composedComponent.options.inheritAttrs, true)
  assert.strictEqual(composedComponent.options.scoped, true)
  assert.strictEqual(composedComponent.options.name, 'composed-component')
})

test('ComponentComposition - Component composition with slots', () => {
  const component1 = createMockComponent('layout', '<div><slot name="header"></slot><slot name="content"></slot></div>')
  const component2 = createMockComponent('header', '<header>Header</header>')
  const component3 = createMockComponent('content', '<main>Content</main>')
  
  const composedComponent = ComponentComposition.compose(
    'layout-component',
    [component1],
    {
      slots: {
        header: component2.template,
        content: component3.template
      }
    }
  )
  
  assert.strictEqual(composedComponent.template, '<div><header>Header</header><main>Content</main></div>')
})

test('ComponentComposition - Component inheritance', () => {
  const baseComponent = createMockComponent('base', '<div>Base</div>', { state: { base: true } })
  const extension = {
    template: '<div>Extended</div>',
    script: { state: { extended: true } }
  }
  
  const extendedComponent = ComponentComposition.extend(baseComponent, extension)
  
  assert.strictEqual(extendedComponent.template, '<div>Extended</div>')
  assert.strictEqual(extendedComponent.script.state.base, true)
  assert.strictEqual(extendedComponent.script.state.extended, true)
  assert.strictEqual(extendedComponent.options.extends, 'base')
})

test('ComponentComposition - Component inheritance with method override', () => {
  const baseComponent = createMockComponent('base', '<div>Base</div>', {
    methods: { method: () => 'base' }
  })
  
  const extension = {
    script: {
      methods: { method: () => 'extended' }
    }
  }
  
  const extendedComponent = ComponentComposition.extend(baseComponent, extension)
  
  assert.strictEqual(extendedComponent.script.methods.method(), 'extended')
  assert.strictEqual(extendedComponent.script.methods.super_method(), 'base')
})

test('ComponentComposition - Component hooks', () => {
  const hook = {
    name: 'test-hook',
    fn: (context) => { console.log('Hook called') }
  }
  
  ComponentComposition.addHook('test-component', hook)
  
  const hooks = ComponentComposition.getHooks('test-component')
  assert.strictEqual(hooks.length, 1)
  assert.strictEqual(hooks[0].name, 'test-hook')
  assert.strictEqual(hooks[0].fn, hook.fn)
})

test('ComponentComposition - Component hooks removal', () => {
  const hook1 = { name: 'hook1', fn: () => {} }
  const hook2 = { name: 'hook2', fn: () => {} }
  
  ComponentComposition.addHook('test-component', hook1)
  ComponentComposition.addHook('test-component', hook2)
  
  ComponentComposition.removeHook('test-component', 'hook1')
  
  const hooks = ComponentComposition.getHooks('test-component')
  assert.strictEqual(hooks.length, 1)
  assert.strictEqual(hooks[0].name, 'hook2')
})

test('ComponentComposition - Component directives', () => {
  const directive = {
    name: 'test-directive',
    handler: (element, value, context) => { console.log('Directive called') }
  }
  
  ComponentComposition.addDirective('test-directive', directive)
  
  const retrievedDirective = ComponentComposition.getDirective('test-directive')
  assert.strictEqual(retrievedDirective.name, 'test-directive')
  assert.strictEqual(retrievedDirective.handler, directive.handler)
})

test('ComponentComposition - Component context', () => {
  ComponentComposition.provideContext('test-context', { value: 'test' })
  
  const context = ComponentComposition.injectContext('test-context')
  assert.strictEqual(context.value, 'test')
})

test('ComponentComposition - Component metadata', () => {
  const metadata = {
    name: 'test-component',
    version: '1.0.0',
    description: 'Test component',
    dependencies: ['dependency1']
  }
  
  ComponentComposition.registerMetadata(metadata)
  
  const retrievedMetadata = ComponentComposition.getMetadata('test-component')
  assert.strictEqual(retrievedMetadata.name, 'test-component')
  assert.strictEqual(retrievedMetadata.version, '1.0.0')
  assert.strictEqual(retrievedMetadata.description, 'Test component')
  assert.strictEqual(retrievedMetadata.dependencies.length, 1)
})

test('ComponentComposition - Higher order component', () => {
  const baseComponent = createMockComponent('base', '<div>Base</div>')
  
  const hocFn = (component) => ({
    ...component,
    template: `<wrapper>${component.template}</wrapper>`,
    options: { ...component.options, hoc: true }
  })
  
  const hocComponent = ComponentComposition.createHigherOrderComponent(baseComponent, hocFn)
  
  assert.strictEqual(hocComponent.template, '<wrapper><div>Base</div></wrapper>')
  assert.strictEqual(hocComponent.options.hoc, true)
})

test('ComponentComposition - Conditional component', () => {
  const trueComponent = createMockComponent('true', '<div>True</div>')
  const falseComponent = createMockComponent('false', '<div>False</div>')
  
  const condition = () => true
  const conditionalComponent = ComponentComposition.createConditionalComponent(
    condition,
    trueComponent,
    falseComponent
  )
  
  assert.strictEqual(conditionalComponent.template, '<div>True</div>')
  assert.strictEqual(conditionalComponent.options.condition, condition)
})

test('ComponentComposition - Error boundary', () => {
  const fallback = createMockComponent('fallback', '<div>Fallback</div>')
  
  const errorBoundary = ComponentComposition.createErrorBoundary(fallback)
  
  assert.strictEqual(errorBoundary.template, '<div>Fallback</div>')
  assert.strictEqual(errorBoundary.options.errorBoundary, true)
  assert.strictEqual(errorBoundary.options.fallback, 'fallback')
})

test('ComponentComposition - Layout component', () => {
  const header = createMockComponent('header', '<header>Header</header>')
  const main = createMockComponent('main', '<main>Main</main>')
  const footer = createMockComponent('footer', '<footer>Footer</footer>')
  
  const layoutComponent = ComponentComposition.createLayoutComponent(
    [header, main, footer],
    'stack'
  )
  
  assert.strictEqual(layoutComponent.template.includes('header'), true)
  assert.strictEqual(layoutComponent.template.includes('main'), true)
  assert.strictEqual(layoutComponent.template.includes('footer'), true)
  assert.strictEqual(layoutComponent.options.layout, 'stack')
})

test('ComponentComposition - Lifecycle management', () => {
  const component1 = createMockComponent('component1')
  const component2 = createMockComponent('component2')
  
  const lifecycle = ComponentComposition.createLifecycleManager([component1, component2])
  
  assert.strictEqual(typeof lifecycle.mount, 'function')
  assert.strictEqual(typeof lifecycle.unmount, 'function')
  assert.strictEqual(typeof lifecycle.update, 'function')
})

// Test CompositionUtils
test('CompositionUtils - Create component with props', () => {
  const component = CompositionUtils.createComponentWithProps(
    'test-component',
    '<div>{{ prop }}</div>',
    { prop: 'value' }
  )
  
  assert.strictEqual(component.template, '<div>{{ prop }}</div>')
  assert.strictEqual(component.script.state.prop, 'value')
  assert.strictEqual(component.options.name, 'test-component')
})

test('CompositionUtils - Create component with slots', () => {
  const header = createMockComponent('header', '<header>Header</header>')
  const content = createMockComponent('content', '<main>Content</main>')
  
  const component = CompositionUtils.createComponentWithSlots(
    'layout-component',
    '<div><slot name="header"></slot><slot name="content"></slot></div>',
    { header, content }
  )
  
  assert.strictEqual(component.template, '<div><slot name="header"></slot><slot name="content"></slot></div>')
  assert.strictEqual(component.options.name, 'layout-component')
  assert.strictEqual(component.options.slots.length, 2)
})

test('CompositionUtils - Create reusable component', () => {
  const factory = (props) => createMockComponent('reusable', `<div>${props.text}</div>`, { state: props })
  
  const createReusable = CompositionUtils.createReusableComponent('reusable-component', factory)
  const component = createReusable({ text: 'Hello' })
  
  assert.strictEqual(component.template, '<div>Hello</div>')
  assert.strictEqual(component.script.state.text, 'Hello')
  assert.strictEqual(component.options.name, 'reusable-component')
  assert.strictEqual(component.options.reusable, true)
})

test('CompositionUtils - Create component provider', () => {
  const content = createMockComponent('content', '<div>Content</div>')
  
  const provider = CompositionUtils.createComponentProvider(
    'test-provider',
    { value: 'test' },
    content
  )
  
  assert.strictEqual(provider.template, '<div>Content</div>')
  assert.strictEqual(provider.script.state.providerValue, { value: 'test' })
  assert.strictEqual(provider.options.name, 'test-provider')
  assert.strictEqual(provider.options.provider, true)
})

// Integration tests
test('Integration - Component composition with state management', () => {
  // This test would require a DOM environment
  console.log('Integration tests should be run in browser environment')
})

test('Integration - Component composition with event handling', () => {
  // This test would require a DOM environment
  console.log('Integration tests should be run in browser environment')
})

// Edge cases
test('Edge cases - Component composition with empty components', () => {
  const composedComponent = ComponentComposition.compose(
    'empty-component',
    []
  )
  
  assert.strictEqual(composedComponent.template, '')
  assert.strictEqual(composedComponent.options.name, 'empty-component')
})

test('Edge cases - Component composition with undefined options', () => {
  const component = createMockComponent('test', '<div>Test</div>')
  const composedComponent = ComponentComposition.compose(
    'composed-component',
    [component],
    undefined
  )
  
  assert.strictEqual(composedComponent.options.name, 'composed-component')
  assert.strictEqual(composedComponent.options.components.length, 1)
})

test('Edge cases - Component composition with invalid component', () => {
  const invalidComponent = { template: null, script: null, style: null }
  const composedComponent = ComponentComposition.compose(
    'composed-component',
    [invalidComponent]
  )
  
  assert.strictEqual(composedComponent.template, '')
  assert.strictEqual(composedComponent.script, null)
  assert.strictEqual(composedComponent.style, '')
})

test('Edge cases - Component composition with duplicate hooks', () => {
  const hook1 = { name: 'hook', fn: () => {} }
  const hook2 = { name: 'hook', fn: () => {} }
  
  ComponentComposition.addHook('test-component', hook1)
  ComponentComposition.addHook('test-component', hook2)
  
  const hooks = ComponentComposition.getHooks('test-component')
  assert.strictEqual(hooks.length, 2)
  assert.strictEqual(hooks[0].name, 'hook')
  assert.strictEqual(hooks[1].name, 'hook')
})

test('Edge cases - Component composition with non-existent component', () => {
  const component = ComponentComposition.getComponent('non-existent')
  assert.strictEqual(component, undefined)
})

test('Edge cases - Component composition cleanup', () => {
  ComponentComposition.registerComponent('test-component', createMockComponent('test'))
  ComponentComposition.addHook('test-component', { name: 'hook', fn: () => {} })
  ComponentComposition.addDirective('test-directive', { name: 'directive', handler: () => {} })
  ComponentComposition.provideContext('test-context', { value: 'test' })
  ComponentComposition.registerMetadata({ name: 'test', version: '1.0.0' })
  
  ComponentComposition.cleanup()
  
  assert.strictEqual(ComponentComposition.getComponent('test-component'), undefined)
  assert.strictEqual(ComponentComposition.getHooks('test-component').length, 0)
  assert.strictEqual(ComponentComposition.getDirective('test-directive'), undefined)
  assert.strictEqual(ComponentComposition.injectContext('test-context'), undefined)
  assert.strictEqual(ComponentComposition.getMetadata('test'), undefined)
})