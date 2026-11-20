(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.TypingAssistController = factory(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createController(deps) {
    const panel = deps.panel;
    const typeText = deps.typeText;
    const getTarget = deps.getTarget;
    const countCodePoints = deps.countCodePoints;

    let stopRequested = false;
    let running = false;
    let statusForwarder = null; // 可选：把状态文本转发出去（iframe→主 frame）

    function setStatus(text) {
      panel.setStatus(text);
      if (typeof statusForwarder === "function") statusForwarder(text);
    }

    // 由宿主调用：注入状态转发函数
    function setStatusBridge(fn) {
      statusForwarder = fn;
    }

    function requestStop() {
      stopRequested = true;
    }

    async function start(request) {
      if (running) return { started: false };
      const text = request && request.text ? request.text : "";
      const speed = (request && request.speed) || "normal";
      if (!text) {
        setStatus("先把要输入的内容填进文本框");
        return { started: false };
      }
      const target = getTarget();
      if (!target || !target.el || !target.el.isConnected) {
        setStatus("请先点击网页上的目标输入框");
        return { started: false };
      }
      running = true;
      stopRequested = false;
      panel.setRunning(true);
      setStatus("正在输入…");
      let result;
      try {
        result = await typeText(target.el, text, {
          speed: speed,
          caret: target.caret,
          shouldStop: function () {
            return stopRequested;
          },
          onProgress: function (i, total) {
            setStatus("正在输入 " + i + "/" + total);
          },
        });
      } catch (err) {
        setStatus("输入中断：" + (err && err.message ? err.message : err));
        return { started: true, error: err };
      } finally {
        running = false;
        panel.setRunning(false);
      }
      if (result && result.cancelled) {
        setStatus("已停止（" + result.typed + "/" + countCodePoints(text) + "）");
      } else {
        setStatus("完成");
      }
      return { started: true, result: result };
    }

    return {
      start: start,
      requestStop: requestStop,
      setStatusBridge: setStatusBridge,
      isRunning: function () {
        return running;
      },
    };
  }

  return { createController };
});
