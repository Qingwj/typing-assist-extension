(function () {
  "use strict";

  const doc = document;
  // 只在 html/body 存在的常规文档注入；iframe 里同样注入 tracker
  if (!doc.documentElement || !doc.body) return;
  if (doc.documentElement.dataset.typingAssist === "1") return;
  doc.documentElement.dataset.typingAssist = "1";

  const core = globalThis.TypingAssistCore;
  const TA = globalThis.TypingAssist;
  const Panel = globalThis.TypingAssistPanel;
  const Controller = globalThis.TypingAssistController;
  if (!core || !TA || !Panel || !Controller) return;

  // 面板只挂主文档；iframe 里只注入打字逻辑，不挂面板
  const isMainFrame = window === window.top;

  const tracker = TA.createFocusTracker(
    doc,
    function (node) {
      return !!(panel && panel.isPanelNode(node));
    }
  );

  const controller = Controller.createController({
    panel: {
      setStatus: function (text) {
        if (panel) panel.setStatus(text);
      },
      setRunning: function (r) {
        if (panel) panel.setRunning(r);
      },
    },
    typeText: TA.typeText,
    getTarget: function () {
      return tracker.getTarget();
    },
    countCodePoints: function (text) {
      return core.splitCodePoints(text).length;
    },
  });

  const panel = isMainFrame
    ? Panel.mountPanel(
        doc,
        {
          onStart: function (v) {
            // 先看主文档有没有目标；没有则广播给所有 frame（UEditor 型编辑器在 iframe 里）
            const t = tracker.getTarget();
            if (t && t.el.isConnected) {
              controller.start(v);
            } else if (chrome.runtime) {
              chrome.runtime.sendMessage({ type: "typing-assist:start", from: "top", payload: v }, function () {
                void chrome.runtime.lastError;
              });
            }
          },
          onStop: function () {
            controller.requestStop();
            if (chrome.runtime) {
              chrome.runtime.sendMessage({ type: "typing-assist:stop", from: "top" }, function () {
                void chrome.runtime.lastError;
              });
            }
          },
        },
        { initiallyHidden: true }
      )
    : null;

  if (panel && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.type === "typing-assist:toggle") panel.toggle();
    });
  }

  if (isMainFrame && chrome.runtime && chrome.runtime.onMessage) {
    // 接收 background 转发的 iframe 侧进度，更新面板状态
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.type === "typing-assist:progress" && panel) {
        panel.setStatus(msg.text);
      }
    });
  }

  // iframe 中：收到主文档经 background 转发的开始/停止请求时执行打字
  if (!isMainFrame) {
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        if (!msg) return;
        if (msg.type === "typing-assist:start" && msg.from === "top") {
          controller.start(msg.payload);
        }
        if (msg.type === "typing-assist:stop") {
          controller.requestStop();
        }
      });
    }
    // 把打字进度经 background 回报给主 frame 面板
    if (chrome.runtime && controller.setStatusBridge) {
      controller.setStatusBridge(function (text) {
        chrome.runtime.sendMessage({ type: "typing-assist:progress", text: text }, function () {
          void chrome.runtime.lastError;
        });
      });
    }
  }

  doc.addEventListener(
    "keydown",
    function (ev) {
      if (ev.altKey && ev.shiftKey && ev.code === "KeyI" && isMainFrame) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (panel) panel.toggle();
      }
    },
    true
  );
})();
