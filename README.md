# 模拟键入助手

一个 Chrome/Edge 浏览器扩展：在网页右上角的悬浮面板里预填内容，把光标点进目标输入框，点「开始输入」，扩展就把文本**逐字符模拟键入**进去——适用于禁止粘贴（拦截 `paste` / Ctrl+V）的网页。

## 安装

1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）
2. 打开「开发者模式」
3. 点「加载已解压的扩展程序」，选择本目录（`typing-assist`）
4. 如果要在本地 `file://` 测试页上使用：进入扩展详情，打开「允许访问文件网址」

## 使用

1. 面板默认隐藏。点击浏览器工具栏上的扩展图标，在当前页面显示面板（再点一次隐藏；也可用快捷键 **Alt+Shift+I**）。面板可拖动标题栏移动，「−」折叠
2. 在面板文本框里填好要输入的内容，选择速度档（慢 / 正常 / 快 / 极快）
3. 用鼠标把光标点进网页的目标输入框（`input`、`textarea` 或 `contenteditable` 均可）
4. 点「开始输入」——扩展会先回到你刚才记录的光标位置，再逐字键入
5. 输入过程中按钮变为「停止」，可随时中止（已输入的内容保留）

在未注入内容脚本的页面（`chrome://` 设置页、Chrome 商店等）点击图标不会有反应，属正常现象。

## 测试

```bash
npm install
npm test
```

手动验收：

- `test/manual/paste-block.html` — 拦截所有粘贴操作，页面上有单行输入、多行文本域、富文本三个目标，每个目标显示 keydown 计数和最近一次 input 内容
- `test/manual/ueditor-mimic.html` — 用与 UEditor 相同的方式（`iframe` + `javascript:` URL + `document.write`，文档地址为 `about:blank`）创建富文本编辑器，用于验证 iframe 型编辑器场景（需通过本地 HTTP 服务打开，例如 `python -m http.server`，因为扩展默认不注入 `file://`）

## 已知限制

- 派发的键盘事件带 `isTrusted: false` 标记。绝大多数禁止粘贴的网页只拦截 `paste`/Ctrl+V，不受影响；若目标网站专门检测该标记（少见），此版本会失效。后续方案：通过 `chrome.debugger` 派发 DevTools 协议级键盘事件（需要调试权限，尚未实现）
- 不模拟输入法的组合过程（IME composition），中文按字符直接插入
- 不持久化文本与设置，刷新页面后重置
- 富文本编辑器常在 `about:blank` 的 iframe 里（UEditor 等）：扩展靠 `match_about_blank` / `match_origin_as_fallback` 注入，并且每 250ms 巡检一次——因为这类编辑器会用 `document.open()` 重写文档，把已注入的监听器清空
- 目标编辑器需要**用户先点击一次**把光标放进去；扩展据此判断往哪个 iframe 里输入
- 若页面在 iframe 里再套一层 iframe（多层嵌套），暂不自动转发
