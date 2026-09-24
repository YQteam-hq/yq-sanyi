# yq-sanyi 教程

从零开始学会 yq-sanyi：声明式标签、模板语法、状态与处理函数、组件嵌套、样式与生命周期。文中所有示例都是可以直接保存并打开的普通 HTML 文件。

> English: [English tutorial](../../tutorial.md)

## 目录

1. [你将构建什么](#你将构建什么)
2. [环境准备](#环境准备)
3. [第一个组件](#第一个组件)
4. [随处使用标签](#随处使用标签)
5. [模板语法](#模板语法)
6. [状态与处理函数](#状态与处理函数)
7. [组件嵌套](#组件嵌套)
8. [样式与主题](#样式与主题)
9. [响应式原语](#响应式原语)
10. [生命周期与清理](#生命周期与清理)
11. [命令式 API](#命令式-api)
12. [问题排查](#问题排查)
13. [下一步](#下一步)

## 你将构建什么

一个计数器、一个用户列表、一个小型主题面板。它们覆盖了全部核心概念：一次定义、作为原生标签复用；响应式状态与自动更新；带稳定 key 的列表；组件嵌套；作用域样式与主题变量。

## 环境准备

核心运行时位于 `packages/core/dist/core.mjs`（ES module）与 `packages/core/dist/core.global.js`（IIFE 全局构建）。dist 目录在本地生成：

```bash
npm install
npm run build
```

启动本地服务并在浏览器里打开示例：

```bash
npm run serve
```

你也可以新建独立的 HTML 文件，从仓库相对路径引入运行时。按文件所在位置调整路径：`examples/` 里的文件使用 `../packages/core/dist/core.global.js`。

## 第一个组件

定义一次组件，然后把它当标签用。保存为 `counter.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>yq-sanyi 计数器</title>
</head>
<body>
  <yq-counter></yq-counter>

  <script src="./packages/core/dist/core.global.js"></script>
  <script>
    yq.define('yq-counter', {
      template: '<button yq-on:click="inc">计数 {{ count }}</button>',
      style: 'button { font-size: 18px; padding: 8px 18px; cursor: pointer; }',
      script: function () {
        return {
          state: { count: 0 },
          inc: function (state) {
            state.count = state.count + 1
          }
        }
      }
    })
  </script>
</body>
</html>
```

一次定义包含三个部分：

- `template` 是标准 HTML，含 `{{ path }}` 占位符与 `yq-on:*` 事件绑定。
- `style` 是标准 CSS，且已做作用域隔离：只作用于该组件内部的元素。
- `script` 是一个普通函数，返回初始 `state` 与事件处理函数（如 `inc`）。

点击按钮：`inc` 拿到响应式 state，修改它，标签就地重渲染。整个过程无需手动操作 DOM。

## 随处使用标签

注册之后，标签就是一个普通自定义元素。同页可以放任意多个实例，也可以放进其它组件或后续动态注入的 HTML 里——每个实例自动挂载、渲染、自我清理：

```html
<body>
  <yq-counter></yq-counter>
  <yq-counter></yq-counter>

  <script src="./packages/core/dist/core.global.js"></script>
  <script>
    yq.define('yq-counter', {
      template: '<button yq-on:click="inc">计数 {{ count }}</button>',
      script: function () {
        return {
          state: { count: 0 },
          inc: function (state) {
            state.count = state.count + 1
          }
        }
      }
    })
  </script>
</body>
```

标签名须遵守自定义元素规则：以小写字母开头、包含连字符、整体小写。`yq-counter` 合法；`counter` 与 `Counter` 不合法，`define` 会对非法名称直接报错。

## 模板语法

### 文本绑定

`{{ path }}` 写入状态值。路径用点分隔：`{{ user.name }}`。

```html
<div>{{ greeting }}，{{ user.name }}</div>
```

### 属性绑定

整个值恰好是一个占位符的属性会绑定到状态，并在每次更新时写回。

```html
<input value="{{ inputValue }}" placeholder="{{ placeholder }}">
```

### 列表渲染

在容器元素上加 `yq-for="item in items"`。框架为每个条目渲染一份副本，并让行与列表保持同步。

```html
<ul>
  <li yq-for="user in users" yq-key="id">{{ user.name }} - {{ user.role }}</li>
</ul>
```

`yq-key` 指定条目的稳定字段。行按 key 匹配并复用而非重建，能保留行内状态并最小化 DOM 写入。带 key 的行内可以再嵌一层 `yq-for`：内层列表按每个外层行各渲染一次，每一层都有自己的条目与下标，内层行既能读到自己持有的条目，也能读到包住它的那一行的条目。[examples/nested-for.html](../../../examples/nested-for.html) 就是用这种方式实现的树形菜单。

### 条件渲染

`yq-if="path"` 只在状态路径为真时渲染元素。`yq-else-if` 与 `yq-else` 直接写在后续兄弟元素上构成分支链；`yq-show` 则把元素保留在 DOM 中，仅切换其 `hidden` 属性。与所有绑定一致，条件是状态路径——更复杂的判断请用处理函数或 `derived` 值算好再绑定。

```html
<nav>
  <a yq-if="user.isAdmin" href="/admin">管理</a>
  <a yq-else-if="user.isGuest" href="/login">登录</a>
  <a yq-else href="/profile">个人中心</a>
  <span yq-show="isLoading">加载中...</span>
</nav>
```

条件为假的分支会被移出 DOM：元素由运行时持有、不携带监听器，条件重新为真时按原位置插回。空数组视为假，因此 `yq-if="items"` 可以直接当作"有无条目"来判断。

### 表单双向绑定

`yq-model="path"` 把表单元素与状态双向绑定：状态写入会更新元素，用户输入会在每次 `input` 事件时写回状态。

```html
<script>
  yq.define('yq-signup', {
    template: `
      <input yq-model.trim="name" type="text">
      <input yq-model.number="age" type="number">
      <input yq-model="agreed" type="checkbox">
      <button yq-on:click="submit" yq-show="name && age">下一步</button>
    `,
    script: function () {
      return {
        state: { name: '', age: 0, agreed: false },
        submit: function (state) {
          state.submitted = true
        }
      }
    }
  })
</script>
```

修饰符定制写回行为：`yq-model.trim` 去除文本首尾空白；`yq-model.number` 用 `Number` 转换取值（无法转换时保留原字符串）；`yq-model.lazy` 改为在 `change` 事件时同步而非每次击键。复选框绑定布尔值，单选框在选中时绑定其 `value`，文本输入、textarea 与 select 以字符串绑定其取值。

### 事件绑定

`yq-on:event="handler"` 把元素事件绑定到 `script` 返回的处理函数上。

```html
<button yq-on:click="save">保存</button>
```

```html
<script>
  yq.define('yq-form', {
    template: '<button yq-on:click="save">保存</button><span>{{ status }}</span>',
    script: function () {
      return {
        state: { status: 'idle' },
        save: function (state, event) {
          state.status = 'saved'
        }
      }
    }
  })
</script>
```

处理函数接收响应式 state 与原生事件对象。更新有批处理机制：一个处理函数内的多次状态写入只渲染一次。

## 状态与处理函数

`script` 返回 `{ state, ...handlers }`。`state` 是模板读取的响应式数据；其余每个函数都是可被 `yq-on:*` 调用的处理函数。

```html
<script>
  yq.define('yq-todo', {
    template: `
      <input value="{{ draft }}">
      <button yq-on:click="add">添加</button>
      <ul>
        <li yq-for="todo in todos" yq-key="id">{{ todo.text }}</li>
      </ul>
    `,
    script: function () {
      return {
        state: { draft: '', todos: [] },
        add: function (state) {
          if (state.draft.trim().length === 0) return
          state.todos.push({ id: state.todos.length + 1, text: state.draft })
          state.draft = ''
        }
      }
    }
  })
</script>
```

任意页面放一个 `<yq-todo></yq-todo>` 即可。向 `todos` push 只重渲染列表；清空 `draft` 清掉输入框。`add` 里的所有写入在同一个同步渲染中一次性刷新。

## 组件嵌套

已注册的标签可以直接写进另一个组件的模板。父组件渲染时子组件自动挂载；父组件元素从页面移除时，子组件一并卸载并释放监听器。

```html
<script>
  yq.define('yq-list-item', {
    template: '<li>{{ label }}</li>',
    script: function () {
      return { state: { label: 'item' } }
    }
  })

  yq.define('yq-list', {
    template: '<ul><yq-list-item></yq-list-item></ul>',
    script: function () {
      return { state: {} }
    }
  })
</script>
```

### Props

写在子组件标签上的属性会作为 props 传给子组件。静态属性以字符串传入；整值绑定 `{{ path }}` 会把父组件的实时值连同类型一起传入，父值变化时子组件随之重渲染。

```html
<script>
  yq.define('yq-list-item', {
    template: '<li>{{ label }}</li>',
    script: function () {
      return { state: { label: 'item' } }
    }
  })

  yq.define('yq-list', {
    template: `
      <ul>
        <li yq-for="item in items" yq-key="id">
          <yq-list-item label="{{ item.text }}"></yq-list-item>
        </li>
      </ul>
    `,
    script: function () {
      return { state: { items: [{ id: 1, text: 'first' }] } }
    }
  })
</script>
```

在子组件内部，props 会遮蔽同名 state 键而不修改它：读取时先解析 prop，找不到再回落到子组件 state，因此 `state.label` 反映父组件传入的值，子组件仍保留自己的默认值。对 prop 键赋值会写入子组件本地值并解除该键的遮蔽。

### 插槽

子组件模板可以用 `<slot>` 元素标记占位位置，父组件写在子组件标签之间的内容会被分发到这些占位符。`<slot name="title"></slot>` 声明具名位置，传入的元素用 `slot="title"` 标记归属；不带 `slot` 属性的子元素进入无名的默认插槽。分发的内容以父组件的数据渲染，并处于子组件的作用域内。

```html
<script>
  yq.define('yq-modal', {
    template: `
      <div class="modal">
        <header><slot name="title"></slot></header>
        <div class="body"><slot></slot></div>
      </div>
    `,
    style: '.modal { border: 1px solid #ddd; }',
    script: function () {
      return { state: {} }
    }
  })
</script>
```

```html
<yq-modal>
  <h3 slot="title">确认</h3>
  <p>要保存修改吗？</p>
  <button yq-on:click="save">保存</button>
</yq-modal>
```

### 子传父事件

子组件可以在任意元素上用 `$emit('事件名', 载荷路径)` 处理函数发出自定义事件。父组件在子组件标签上用 `yq-on:事件名="处理函数"` 监听，并从 `event.detail` 读取载荷。载荷路径按子组件状态解析，因此列表行可以发出自己的条目。

```html
<script>
  yq.define('yq-row', {
    template: '<button yq-on:click="$emit(\'select\', item.id)">{{ item.text }}</button>',
    script: function () {
      return { state: { item: { id: 1, text: 'one' } } }
    }
  })

  yq.define('yq-rows', {
    template: '<yq-row yq-on:select="onSelect"></yq-row>',
    script: function () {
      return {
        state: { selected: null },
        onSelect: function (state, event) {
          state.selected = event.detail
        }
      }
    }
  })
</script>
```

### 动态组件

`<yq-component yq-is="name">` 渲染名字解析到的已注册组件。用整值绑定绑定组件名即可由状态驱动切换，适合标签页与分步向导等场景。未知名字不渲染任何内容；切换时会干净地卸载上一个组件。

```html
<script>
  yq.define('yq-tabs', {
    template: `
      <div>
        <yq-component yq-is="{{ current }}"></yq-component>
        <button yq-on:click="showB">切换</button>
      </div>
    `,
    script: function () {
      return {
        state: { current: 'yq-view-a' },
        showB: function (state) {
          state.current = 'yq-view-b'
        }
      }
    }
  })
</script>
```

## 样式与主题

`style` 字段会被改写，使其选择器只匹配该组件自身子树内的元素。同一组件的多个实例只注入一份样式；最后一个实例卸载时这份样式随之移除。

```html
<script>
  yq.define('yq-panel', {
    template: '<div class="panel"><h3>{{ title }}</h3><p class="hint">{{ hint }}</p></div>',
    style: `
      .panel { border: 1px solid var(--yq-border-color, #ddd); border-radius: 8px; padding: 16px; }
      .hint { color: var(--yq-text-muted, #666); }
    `,
    script: function () {
      return {
        state: { title: 'panel', hint: 'theme-aware hint' }
      }
    }
  })
</script>
```

### 作用域是怎么加上的

`define` 会为每个组件定义分配一个 scope id，`style` 字符串在进入页面之前就被改写：每个选择器都会附加作用域属性，`.panel` 变成 `.panel[data-yq-scope="..."]`，因此只能匹配框架标注了同一作用域的节点。有三条规则值得记住：

- 以 `*` 开头的选择器原样保留，组件无法在无意间给整页加一条全局重置。
- 伪类与伪元素仍附着在它们所修饰的选择器上，`.panel:hover` 变成 `.panel[data-yq-scope="..."]:hover`。
- 改写后的规则集对每个定义只注入一次。第二个实例只是把引用计数加一，计数归零时 `<style>` 元素被移除——也就是最后一个实例卸载的时候。

改写本身是纯函数，不挂载任何东西也能查看结果：

```js
const scoped = yq.scoper.generateScopedCSS('.panel { color: red; }', 'my-scope')
```

此时 `scoped` 的内容是 `.panel[data-yq-scope="my-scope"] { color: red; }`。`yq.scoper.injectStyle` 与 `yq.scoper.removeStyle` 暴露了运行时内部使用的注入生命周期，`injectStyle` 返回的记录会报告当前有多少实例持有这份样式。

### 页面级样式

只有定义里的 `style` 字段会被改写。需要作用于整页的规则要显式注册，并原样插入：

```js
yq.scoper.addGlobalStyle('.demo-note { padding: 12px; }', 'demo-note')
yq.scoper.getGlobalStyles()
yq.scoper.removeGlobalStyle('demo-note')
yq.scoper.clearGlobalStyles()
```

id 可以省略，省略时注册表会用 `global-<timestamp>` 生成一个。`getGlobalStyles()` 返回注册表的副本，改动返回值不会影响页面。

### 主题变量

组件通过带 CSS 兜底的主题变量读取主题，因此在任何主题应用之前也能正常绘制。`updateTheme` 会把每一项写到 document 元素上的 `--yq-<key>` 自定义属性：

```js
yq.scoper.updateTheme({
  'border-color': '#2563eb',
  'text-muted': '#1e40af'
})
```

读取这些变量的组件会一次全部重绘，无需改动任何组件代码。`getThemeVariables()` 返回当前的映射；`resetTheme()` 会清掉你设置的内容并应用内置调色板：

| 变量 | 默认值 |
| --- | --- |
| `--yq-primary-color` | `#3b82f6` |
| `--yq-secondary-color` | `#6b7280` |
| `--yq-background-color` | `#ffffff` |
| `--yq-text-color` | `#1f2937` |
| `--yq-border-color` | `#e5e7eb` |
| `--yq-shadow-color` | `rgba(0, 0, 0, 0.1)` |

### 作用域改写与 Shadow DOM 的取舍

默认采用作用域改写，CSS 变量与继承行为保持不变，运行时也不额外付出代价。需要强封装时，`createScopedElement(element, scopeId, { useShadowDOM: true })` 会挂上 shadow root、把副本移入其中，并给每个节点标上作用域属性。当组件不应被页面级选择器触达时选它；更看重主题与继承时保持默认即可。

[examples/scoped-theme.html](../../../examples/scoped-theme.html) 把上面这些都串了起来：同一组件的两个实例共用一份样式注入，切换器通过 `updateTheme` 让两者一起重绘，页面级规则也可以注册后再移除。

## 响应式原语

组件自己管理状态。当需要在组件之外共享状态时，核心同样导出带依赖追踪的 `state`、`derived`、`effect` 原语：

```html
<script>
  const count = yq.state(0)
  const doubled = yq.derived(function () { return count.value * 2 })

  yq.effect(function () {
    document.getElementById('double').textContent = doubled.value
  })

  yq.define('yq-bump', {
    template: '<button yq-on:click="bump">+1</button>',
    script: function () {
      return {
        state: {},
        bump: function () {
          count.value = count.value + 1
        }
      }
    }
  })
</script>
```

`state(x)` 返回一个盒子，通过 `.value` 读写。`derived` 只在依赖变化时重算。`effect` 在依赖变化时重跑，且可返回清理函数：下一次运行前与 effect 被释放时都会先执行清理。

## 生命周期与清理

组件元素的生命周期由运行时完整管理：

- 把标签挂到已连接的文档上即完成挂载：构建骨架、填充插槽、绑定处理函数。
- 修改状态只刷新绑定的部分。
- 移除标签即卸载：监听器与订阅被释放，最后一个实例卸载时共享样式一并移除。

移除组件元素，它的状态、DOM 与监听器随之消失：

```html
<script>
  const list = document.getElementById('board')
  const panel = document.createElement('yq-panel')
  list.appendChild(panel)
  panel.remove()
</script>
```

`panel.remove()` 会走该实例的卸载路径——无需额外代码，也没有按使用处的清理工作。用命令式 API 创建的组件，可以把 effect 清理注册到实例上，卸载时自动执行（见下一节）。

`panel.remove()` 会走该实例的卸载路径——无需额外代码，也没有按使用处的清理工作。用命令式 API 创建的组件，可以把 effect 清理注册到实例上，卸载时自动执行（见下一节）。

### 声明式生命周期钩子

`script` 函数可以在 state 与处理函数之外返回 `onMount`、`onUpdate`、`onUnmount` 三个函数。它们会在对应阶段以响应式 state 为参数被调用——首次渲染后挂载、每次刷新后更新、卸载前清理——挂载时发请求、卸载时清定时器这类需求不再需要命令式 API。

```html
<script>
  yq.define('yq-clock', {
    template: '<span>{{ now }}</span>',
    script: function () {
      return {
        state: { now: '', timer: null },
        onMount: function (state) {
          state.now = new Date().toLocaleTimeString()
          state.timer = setInterval(function () {
            state.now = new Date().toLocaleTimeString()
          }, 1000)
        },
        onUnmount: function (state) {
          clearInterval(state.timer)
        }
      }
    }
  })
</script>
```

钩子名是保留名：它们不会成为事件处理函数，因此无法在 `yq-on:*` 上绑定名为 `onMount` 的处理器。

## 命令式 API

声明式是主路径，但运行时同样导出命令式 API 供编程式挂载：`createComponent`、`mountComponent`、`updateComponent`、`unmountComponent`，配合 `effect` 与 `setLifecycleHooks` 管理副作用与观察生命周期：

```html
<script type="module">
  import { createComponent, mountComponent, effect, setLifecycleHooks, unmountComponent } from './packages/core/dist/core.mjs';

  const widget = createComponent({
    name: 'yq-widget',
    template: '<b>{{ label }}</b>',
    script: function () {
      return { state: { label: 'hello from code' } }
    }
  });

  setLifecycleHooks(widget, {
    onMount: function () { console.log('mounted') },
    onUnmount: function () { console.log('unmounted') }
  });

  effect(function () {
    const timer = setInterval(() => { console.log('tick') }, 1000);
    return function () { clearInterval(timer) };
  });

  mountComponent(widget);
  unmountComponent(widget);
</script>
```

`setLifecycleHooks` 观察有序的挂载 / 更新 / 卸载阶段。`effect` 返回清理函数；`unmountComponent` 在拆除组件前会执行所有已注册的清理，因此反复的创建 / 移除循环不会留下残留。

## 问题排查

| 现象 | 原因与解决办法 |
| --- | --- |
| 什么都没渲染 | 运行时路径不对，或 HTML 里的标签名与传给 `define` 的名字不一致。请使用同一个全小写含连字符的名字。 |
| `{{ count }}` 这类占位符仍然可见 | 状态路径与 `script` 返回的键不匹配。路径用点分隔：`{{ user.name }}`。 |
| 点击按钮没反应 | `yq-on:click` 里的处理函数名不是 `script` 返回的函数之一，或拼写有误。 |
| 列表行不更新 | 行按 `yq-key` 匹配；请给每个条目稳定的唯一 id。行内处理函数通过行作用域读取条目（`state.item`）。 |
| 条件块一直不出现 | `yq-if` / `yq-show` 读取的是状态路径而非表达式。请先在处理函数或 `derived` 值中算好布尔结果，再绑定该路径。 |
| 样式泄漏或不生效 | 写在组件 `style` 字段里的样式自动做作用域隔离；页面级规则必须用 `yq.scoper.addGlobalStyle` 显式注册。 |
| 组件崩溃 | 错误边界渲染占位符并输出结构化告警，页面其它组件照常工作。 |
| 多次写入只更新了一次 | 这是设计如此。同一同步任务内的写入会批量合并为一次刷新。 |

## 下一步

- 查看 [功能与 API 总览](./README.md)。
- 打开 `examples/full-demo.html`：一页演示标签、事件、列表与状态。
- 打开 [examples/nested-for.html](../../../examples/nested-for.html)：用嵌套 `yq-for` 行搭建的可展开折叠树形菜单。
- 打开 [examples/scoped-theme.html](../../../examples/scoped-theme.html)：作用域样式、主题变量与页面级样式注册表。
- 阅读本教程的英文版：[English tutorial](../../tutorial.md)。
