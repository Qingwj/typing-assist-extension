# 模拟键入助手

一个 Chrome/Edge 浏览器扩展：在网页右上角的悬浮面板里预填内容，把光标点进目标输入框，点「开始输入」，扩展就把文本**逐字符模拟键入**进去——适用于禁止粘贴（拦截 `paste` / Ctrl+V）的网页。

## 安装

1. 下载本仓库（`Code → Download ZIP` 并解压，或 `git clone`）
2. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）
3. 打开「开发者模式」
4. 点「加载已解压的扩展程序」，选择仓库目录
5. 如果要在本地 `file://` 页面使用：进入扩展详情，打开「允许访问文件网址」

## 使用

1. 面板默认隐藏。点击浏览器工具栏上的扩展图标，在当前页面显示面板（再点一次隐藏；也可用快捷键 **Alt+Shift+I**）。面板可拖动标题栏移动，「−」折叠
2. 在面板文本框里填好要输入的内容，选择速度档（慢 / 正常 / 快 / 极快）
3. 用鼠标把光标点进网页的目标输入框（`input`、`textarea` 或 `contenteditable` 均可）
4. 点「开始输入」——扩展会先回到你刚才记录的光标位置，再逐字键入
5. 输入过程中按钮变为「停止」，可随时中止（已输入的内容保留）

在未注入内容脚本的页面（`chrome://` 设置页、Chrome 商店等）点击图标不会有反应，属正常现象。

## 原理简述

- 内容脚本在每个页面注入一个 Shadow DOM 悬浮面板，记录最后获得焦点的可编辑元素及其光标位置
- 点「开始输入」后，逐字符派发 `keydown` → 插入文本 → 触发 `input` → `keyup`
- `input`/`textarea` 通过原生原型 value setter 写入，兼容 React/Vue 受控组件；`contenteditable` 使用 `execCommand('insertText')`（带 Range 回退）
- 每字符间隔随机（2–250ms，依速度档而定），模拟人工手速

## 已知限制

- 派发的键盘事件带 `isTrusted: false` 标记。绝大多数禁止粘贴的网页只拦截 `paste`/Ctrl+V，不受影响；若目标网站专门检测该标记（少见），此版本会失效
- 不模拟输入法的组合过程（IME composition），中文按字符直接插入
- 不持久化文本与设置，刷新页面后重置
- 仅在当前页面主框架生效（不注入 iframe）

## 目录结构

```
manifest.json        扩展清单（Manifest V3）
background.js        工具栏图标点击 → 切换面板显示
content.js           内容脚本入口：接线、快捷键
src/core.js          码点切分、速度档、按键映射
src/typing.js        文本插入、打字引擎、焦点跟踪
src/panel.js         Shadow DOM 悬浮面板
src/controller.js    启动/停止控制（异常安全）
```
