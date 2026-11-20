(function () {
  "use strict";

  const core = globalThis.TypingAssistCore;
  const TA = globalThis.TypingAssist;
  const Panel = globalThis.TypingAssistPanel;
  const Controller = globalThis.TypingAssistController;
  if (!core || !TA || !Panel || !Controller) return;

  // 面板只挂主文档；iframe 里只注入打字逻辑，不挂面板
  const isMainFrame = window === window.top;

  // 当前生效的实例。文档可能被 document.open() 重写（UEditor 等编辑器），
  // 届时监听器和面板都会失效，需要在新文档上重新初始化。
  const state = { doc: null, tracker: null, controller: null, panel: null };
  let messagingBound = false;

  // 主框架记录"用户最近点进去的是哪个 iframe"，用于把开始指令定向发给它。
  // 子框架里 document.activeElement 会变成 IFRAME 元素，但不会触发 focusin。
  let frameHint = null;
  let mainFocusAt = 0;

  function currentTarget() {
    return state.tracker ? state.tracker.getTarget() : null;
  }

  function sendToBackground(msg) {
    if (typeof chrome === "undefined" || !chrome.runtime) return;
    chrome.runtime.sendMessage(msg, function () {
      void chrome.runtime.lastError;
    });
  }

  function postToFrame(el, msg) {
    try {
      if (el && el.contentWindow) el.contentWindow.postMessage(msg, "*");
    } catch (e) {
      /* 框架可能已被移除 */
    }
  }

  // 跨 frame 消息只需绑定一次（绑定后始终经由 state 取当前实例）
  function bindMessaging() {
    if (messagingBound) return;
    messagingBound = true;

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(function (msg) {
        if (!msg) return;
        if (msg.type === "typing-assist:toggle") {
          if (state.panel) state.panel.toggle();
          return;
        }
        if (msg.type === "typing-assist:progress" && isMainFrame) {
          if (state.panel) state.panel.setStatus(msg.text);
        }
      });
    }

    if (!isMainFrame) {
      // 主框架通过 postMessage 定向发送开始/停止（不依赖 background 转发）
      window.addEventListener("message", function (ev) {
        if (ev.source !== window.parent) return;
        const data = ev.data;
        if (!data || typeof data !== "object" || data.from !== "typing-assist-top") return;
        if (data.type === "typing-assist:start") {
          if (state.controller) state.controller.start(data.payload);
        } else if (data.type === "typing-assist:stop") {
          if (state.controller) state.controller.requestStop();
        }
      });
    }
  }

  function disposeCurrent() {
    if (state.panel) {
      try {
        state.panel.destroy();
      } catch (e) {
        /* 文档可能已被重写，忽略 */
      }
      state.panel = null;
    }
    if (state.tracker) {
      try {
        state.tracker.dispose();
      } catch (e) {
        /* 同上 */
      }
      state.tracker = null;
    }
    state.controller = null;
  }

  // 在给定文档上建立追踪与打字能力；成功返回 true
  function init(doc) {
    if (!doc || !doc.documentElement || !doc.body) return false;
    if (doc.documentElement.dataset.typingAssist === "1") return true;
    doc.documentElement.dataset.typingAssist = "1";

    disposeCurrent();
    state.doc = doc;

    state.tracker = TA.createFocusTracker(doc, function (node) {
      return !!(state.panel && state.panel.isPanelNode(node));
    });

    state.controller = Controller.createController({
      panel: {
        setStatus: function (text) {
          if (state.panel) state.panel.setStatus(text);
        },
        setRunning: function (r) {
          if (state.panel) state.panel.setRunning(r);
        },
      },
      typeText: TA.typeText,
      getTarget: currentTarget,
      countCodePoints: function (text) {
        return core.splitCodePoints(text).length;
      },
    });

    if (isMainFrame) {
      doc.addEventListener(
        "focusin",
        function (ev) {
          const node = ev.target;
          if (!node || node.tagName === "IFRAME") return;
          // 点面板本身不算"改在主文档里打字"
          if (state.panel && state.panel.isPanelNode(node)) return;
          mainFocusAt = Date.now();
        },
        true
      );

      state.panel = Panel.mountPanel(
        doc,
        {
          onStart: function (v) {
            const t = currentTarget();
            const inFrame =
              frameHint && frameHint.el && frameHint.el.isConnected && frameHint.ts > mainFocusAt;
            if (inFrame) {
              // 用户最近点进的是 iframe 里的编辑器（UEditor 等），定向发给它
              state.panel.setStatus("正在输入…");
              postToFrame(frameHint.el, {
                from: "typing-assist-top",
                type: "typing-assist:start",
                payload: v,
              });
              return;
            }
            if (t && t.el.isConnected) {
              state.controller.start(v);
              return;
            }
            state.panel.setStatus("请先点击网页上的目标输入框");
          },
          onStop: function () {
            if (state.controller) state.controller.requestStop();
            // 停止广播给所有子框架：各框架幂等，不会重复输入
            const frames = doc.querySelectorAll("iframe");
            for (let i = 0; i < frames.length; i++) {
              postToFrame(frames[i], { from: "typing-assist-top", type: "typing-assist:stop" });
            }
          },
        },
        { initiallyHidden: true }
      );
    } else if (state.controller.setStatusBridge) {
      // 把打字进度经 background 回报给主 frame 面板
      state.controller.setStatusBridge(function (text) {
        sendToBackground({ type: "typing-assist:progress", text: text });
      });
    }

    bindMessaging();
    return true;
  }

  init(document);

  // 看门狗：document.open() 重写文档会清掉标记、监听器和面板，
  // 但本脚本所在的隔离世界上下文仍然存活，因此可以重建。
  // 同时顺带记录主框架最近聚焦的 iframe。
  setInterval(function () {
    try {
      const doc = document;
      if (!doc || !doc.documentElement) return;
      if (doc.documentElement.dataset.typingAssist !== "1") init(doc);
      if (isMainFrame) {
        const ae = doc.activeElement;
        if (ae && ae.tagName === "IFRAME") frameHint = { el: ae, ts: Date.now() };
      }
    } catch (e) {
      /* 文档重写中，下一轮再试 */
    }
  }, 250);

  // 快捷键绑定在 window 上：window 在文档重写后依然存在，无需重复绑定
  window.addEventListener(
    "keydown",
    function (ev) {
      if (ev.altKey && ev.shiftKey && ev.code === "KeyI" && isMainFrame) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (state.panel) state.panel.toggle();
      }
    },
    true
  );
})();
