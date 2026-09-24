# yq-sanyi

**组件只定义一次，然后作为真正的 HTML 标签随处使用。无需构建。**

yq-sanyi（三一，"三位一体"）是一个从零自研的零依赖 Web 组件框架。一个组件把模板、行为与作用域样式封装在一次定义里——三段共享同一个作用域、同一份响应式状态与同一个生命周期——注册后成为可直接放进任意页面的浏览器原生 HTML 元素。

[English](../../../README.md) · [English tutorial](../../tutorial.md) · [中文教程](./tutorial.md)

![license](https://img.shields.io/badge/license-Apache%202.0-blue)
![version](https://img.shields.io/badge/version-v0.3.0-2ea44f)
![repository](https://img.shields.io/badge/github-YQteam--dyq%2Fyq--sanyi-2ea44f)
![dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen)
![size](https://img.shields.io/badge/core-11.3%20kB%20gzipped-2ea44f)

## 为什么选择 yq-sanyi

- **天生声明式。** 用 `yq.define(...)` 定义一次，之后把 `<yq-counter>` 直接写进普通 HTML——标签自动挂载、渲染、自我清理。每个使用处都不需要挂载代码，页面也不需要框架标签。
- **改 state，视图自动更新。** 在事件处理函数里修改 state 对象，对应部分就地更新；把标签从页面移除，所有订阅、监听器与样式随之释放。
- **零依赖、用户零构建。** 核心只有一个约 8.5 kB（gzip）的 bundle，仅依赖 Web 标准 API——无 JSX、无虚拟 DOM、无框架运行时、无编译器。
- **样式隔离不泄漏。** 组件内声明的样式只作用于该组件内部；主题变量与全局样式由框架显式管理；同一组件的多个实例共享一份样式。
- **失败隔离。** 出错的组件渲染为错误占位并输出结构化告警，页面其余部分照常工作。
- **单一事实来源。** 模板、行为、样式放在同一个单元里——组件易读、易复用、易审计。

## 组件如何定义

```js
yq.define('yq-counter', {
  template: '<button yq-on:click="inc">计数 {{ count }}</button>',
  style: 'button { font-size: 18px; padding: 8px 18px; }',
  script: function () {
    return {
      state: { count: 0 },
      inc: function (state) {
        state.count = state.count + 1
      }
    }
  }
})
```

模板是标准 HTML、样式是标准 CSS、脚本是标准 JS。`script` 函数返回组件状态与事件处理函数；处理函数拿到响应式 state 对象，对其修改会被自动侦测并重渲染。已注册的自定义元素可以在其它组件的模板里像普通标签一样嵌套。

## 快速开始

克隆仓库，先构建一次 bundle，之后写普通 HTML 即可：

```bash
git clone https://github.com/YQteam-hq/yq-sanyi.git
cd yq-sanyi
npm install
npm run build
```

把下面内容保存为 `index.html`，用浏览器打开：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>yq-sanyi 快速开始</title>
</head>
<body>
  <yq-counter></yq-counter>

  <script src="./packages/core/dist/core.global.js"></script>
  <script>
    yq.define('yq-counter', {
      template: '<button yq-on:click="inc">计数 {{ count }}</button>',
      style: 'button { font-size: 18px; padding: 8px 18px; }',
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

页面上的每个 `<yq-counter>` 都是一个可用的计数器。在 module 脚本里可用 `./packages/core/dist/core.mjs` 获得同一套 API；另有命令式 API（`createComponent`、`mountComponent` 等）供编程式使用。

可运行的完整示例见 [examples/full-demo.html](./examples/full-demo.html)。

## 组件标签命名

组件标签就是原生自定义元素，必须遵守 HTML 自定义元素规则：

- 以小写字母开头，
- 必须包含连字符（`-`），
- 其后只能使用小写字母 `a-z`、数字、`.`、`_` 与 `-`。

| 可以这样用 | 这样不行 | 原因 |
| --- | --- | --- |
| `<yq-counter>` | `<counter>` | 没有连字符——浏览器只会当作普通未知元素 |
| `<x-666>` | `<666>` | 纯数字不能作为元素名；请加连字符（`x-666`） |
| `<yq-todo-item>` | `<Todo-Item>` | 自定义元素名必须小写 |

`define` 阶段会对非法名称直接报错，拼写错误不会在页面里悄悄失效。

## v0.3.0 现有能力

- **声明式组件。** `define` 注册原生自定义元素；标签自动挂载、自动更新、自动清理。
- **模板。** 文本绑定 `{{ 路径 }}`、整值属性绑定、布尔属性、带稳定 `yq-key` 的列表渲染 `yq-for`、行内可继续嵌套 `yq-for`、事件绑定 `yq-on:事件="处理函数"`（含列表行内）、条件渲染 `yq-if` / `yq-else-if` / `yq-else` / `yq-show`、表单双向绑定 `yq-model` 与 `.trim` / `.number` / `.lazy` 修饰符。
- **组件模型。** 通过标签属性向子组件传 Props（静态或绑定、保留类型）；默认与具名 `<slot>` 插槽做内容分发；子组件 `$emit('事件', 载荷)` 配合父组件 `yq-on:` 监听实现子传父；`<yq-component yq-is="name">` 由状态驱动的动态组件。
- **声明式生命周期。** `script` 返回的 `onMount` / `onUpdate` / `onUnmount` 在对应阶段以响应式 state 被调用，与命令式 `setLifecycleHooks` 并存。
- **状态与处理函数。** `script` 函数返回 `{ state, ...handlers }`；同一同步任务内的多次写入会批量合并为一次刷新。
- **响应式原语。** `state`、`derived`、`effect`——derived 在依赖不变时直接返回缓存；effect 可返回清理函数并随组件卸载一并释放。
- **渲染。** 静态骨架只克隆一次，更新只写绑定槽——不重建子树、无虚拟 DOM。
- **作用域样式。** 选择器改写式隔离，不要求 Shadow DOM；CSS 变量主题；同一组件样式只注入一次；全局样式注册表。
- **生命周期。** 有序的挂载 / 更新 / 卸载，释放无泄漏；宿主移除时嵌套组件随之清理。
- **调试钩子。** 组件树、状态快照与更新日志经生命周期钩子可读；另附独立 devtools 包。

## API 速览

| API | 用途 |
| --- | --- |
| `yq.define(name, { template, style, script })` | 注册组件为自定义元素；`script` 可同时返回 `onMount` / `onUpdate` / `onUnmount` 钩子 |
| 模板指令 | `yq-if` / `yq-else-if` / `yq-else` / `yq-show`、`yq-for` + `yq-key`、`yq-on:事件`、`yq-model[.trim/.number/.lazy]`、`<slot>` / `slot="name"`、`<yq-component yq-is>`、`$emit('事件', 路径)` |
| `yq.lookup(name)` | 按名解析已注册定义 |
| `state(初始值)` / `derived(fn)` / `effect(fn)` | 带依赖追踪的响应式原语 |
| `createComponent`、`mountComponent`、`updateComponent`、`unmountComponent` | 命令式生命周期控制 |
| `setLifecycleHooks`、`getComponentTree`、`getUpdateLogs`、`getStateSnapshot` | 生命周期钩子与调试读取 |
| `withErrorBoundary`、`resetErrorBoundary` | 组件级错误边界 |
| `yq.scoper` | 作用域样式、主题与全局样式注册表 |

ESM 入口为 `packages/core/dist/core.mjs`；全局构建为 `packages/core/dist/core.global.js`（暴露为 `window.yq`）。

## 示例

| 示例 | 内容 |
| --- | --- |
| [basic.html](./examples/basic.html) | 最小声明式组件，单条 script 引入 |
| [full-demo.html](./examples/full-demo.html) | 声明式标签、事件、列表与状态同页展示 |
| [parse-demo.html](./examples/parse-demo.html) | 模板解析过程演示 |
| [reactive-demo.html](./examples/reactive-demo.html) | `state` / `derived` / `effect` 原语 |
| [csp-test.html](./examples/csp-test.html) | 严格 CSP 下行为段脚本执行 |
| [nested-for.html](./examples/nested-for.html) | 用嵌套 `yq-for` 行搭建的可展开折叠树形菜单 |

## 已知限制

- **Shadow DOM 为可选。** 默认用作用域改写做样式隔离；需要强封装时 `createScopedElement` 可开启 `useShadowDOM`。
- **v0.3.0 仅限浏览器运行时。** 无 SSR、无 CLI、无非浏览器端目标——均为本版明确不做范围。

## 文档

| 文档 | 内容 |
| --- | --- |
| [English tutorial](./docs/tutorial.md) | Template syntax, state, effects and lifecycle from zero |
| [中文教程](./tutorial.md) | 模板语法、状态、副作用与生命周期 |

## 仓库结构

```
packages/core/src      core 运行时：registry、parser、reactive、render、scoper、lifecycle
packages/core/dist     构建产物（core.mjs、core.global.js）
packages/core/test     node:test 断言测试套件
packages/devtools      可选调试面板（独立 bundle）
examples/              可运行 HTML 示例
docs/                  教程
scripts/               仓库门禁：依赖图与包体积检查
```

## 开发

```bash
npm run build
npm run test
npm run bench
npm run check:all
```

- `npm run build` — 打包 `dist/core.mjs` 与 `dist/core.global.js`
- `npm run test` — 运行核心测试套件
- `npm run bench` — 对照 §7.4 预算运行性能基准
- `npm run check:all` — 依赖图与包体积门禁

## 支持我们

yq-sanyi 由我们在业余时间开发与维护。如果它帮你节省了时间，欢迎支持项目：

- 爱发电：[https://afdian.com/a/yqteam?utm_source=copylink&utm_medium=link](https://afdian.com/a/yqteam?utm_source=copylink&utm_medium=link)

你的支持将帮助框架保持免费、开源与零依赖。

## 许可证

Apache License 2.0。Copyright 2026 YQteam-hq。详见 [LICENSE](./LICENSE)。
