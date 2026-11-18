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

    function requestStop() {
      stopRequested = true;
    }

    async function start(request) {
      if (running) return { started: false };
      const text = request && request.text ? request.text : "";
      const speed = (request && request.speed) || "normal";
      if (!text) {
        panel.setStatus("先把要输入的内容填进文本框");
        return { started: false };
      }
      const target = getTarget();
      if (!target || !target.el || !target.el.isConnected) {
        panel.setStatus("请先点击网页上的目标输入框");
        return { started: false };
      }
      running = true;
      stopRequested = false;
      panel.setRunning(true);
      panel.setStatus("正在输入…");
      let result;
      try {
        result = await typeText(target.el, text, {
          speed: speed,
          caret: target.caret,
          shouldStop: function () {
            return stopRequested;
          },
          onProgress: function (i, total) {
            panel.setStatus("正在输入 " + i + "/" + total);
          },
        });
      } catch (err) {
        panel.setStatus("输入中断：" + (err && err.message ? err.message : err));
        return { started: true, error: err };
      } finally {
        running = false;
        panel.setRunning(false);
      }
      if (result && result.cancelled) {
        panel.setStatus("已停止（" + result.typed + "/" + countCodePoints(text) + "）");
      } else {
        panel.setStatus("完成");
      }
      return { started: true, result: result };
    }

    return {
      start: start,
      requestStop: requestStop,
      isRunning: function () {
        return running;
      },
    };
  }

  return { createController };
});
