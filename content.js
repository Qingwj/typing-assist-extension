(function () {
  "use strict";

  const doc = document;
  if (doc.documentElement.dataset.typingAssist === "1") return;
  doc.documentElement.dataset.typingAssist = "1";

  const core = globalThis.TypingAssistCore;
  const TA = globalThis.TypingAssist;
  const Panel = globalThis.TypingAssistPanel;
  const Controller = globalThis.TypingAssistController;
  if (!core || !TA || !Panel || !Controller) return;

  const panel = Panel.mountPanel(
    doc,
    {
      onStart: function (v) {
        controller.start(v);
      },
      onStop: function () {
        controller.requestStop();
      },
    },
    { initiallyHidden: true }
  );

  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.type === "typing-assist:toggle") panel.toggle();
    });
  }

  const tracker = TA.createFocusTracker(doc, function (node) {
    return panel.isPanelNode(node);
  });

  const controller = Controller.createController({
    panel: panel,
    typeText: TA.typeText,
    getTarget: function () {
      return tracker.getTarget();
    },
    countCodePoints: function (text) {
      return core.splitCodePoints(text).length;
    },
  });

  doc.addEventListener(
    "keydown",
    function (ev) {
      if (ev.altKey && ev.shiftKey && ev.code === "KeyI") {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        panel.toggle();
      }
    },
    true
  );
})();
