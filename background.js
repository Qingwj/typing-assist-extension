// 点击扩展工具栏图标 → 通知当前标签页的内容脚本切换面板显示。
// 在未注入内容脚本的页面（chrome:// 等）点击时静默忽略。
chrome.action.onClicked.addListener(function (tab) {
  if (!tab || tab.id == null) return;
  chrome.tabs.sendMessage(tab.id, { type: "typing-assist:toggle" }).catch(function () {
    /* 页面无内容脚本，忽略 */
  });
});
