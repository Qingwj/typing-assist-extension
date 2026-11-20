(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.TypingAssistPanel = factory(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const HOST_ID = "__typing_assist_host";

  const STYLE = `
    :host {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483647;
    }
    .panel {
      width: 300px;
      font: 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #1f2328;
      background: #ffffff;
      border: 1px solid #d0d7de;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      background: #f6f8fa;
      cursor: move;
      user-select: none;
      font-weight: 600;
    }
    .header .collapse {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 6px;
      line-height: 1;
    }
    .body {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .body.collapsed {
      display: none;
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      min-height: 96px;
      resize: vertical;
      padding: 6px;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      font: inherit;
    }
    .row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .row label {
      color: #57606a;
    }
    select {
      padding: 4px 6px;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      font: inherit;
    }
    button.primary {
      flex: 1;
      padding: 6px 10px;
      border: none;
      border-radius: 6px;
      background: #1f883d;
      color: #ffffff;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    button.primary[data-running="1"] {
      background: #cf222e;
    }
    .status {
      font-size: 12px;
      color: #57606a;
      min-height: 16px;
      word-break: break-all;
    }
  `;

  function mountPanel(doc, handlers, options) {
    const callbacks = handlers || {};
    const opts = options || {};
    const host = doc.createElement("div");
    host.id = HOST_ID;
    if (opts.initiallyHidden) host.style.display = "none";
    const shadow = host.attachShadow({ mode: "open" });

    const style = doc.createElement("style");
    style.textContent = STYLE;
    shadow.appendChild(style);

    const panel = doc.createElement("div");
    panel.className = "panel";

    const header = doc.createElement("div");
    header.className = "header";
    const title = doc.createElement("span");
    title.textContent = "模拟键入";
    const collapseBtn = doc.createElement("button");
    collapseBtn.className = "collapse";
    collapseBtn.type = "button";
    collapseBtn.title = "折叠";
    collapseBtn.textContent = "−";
    header.appendChild(title);
    header.appendChild(collapseBtn);

    const body = doc.createElement("div");
    body.className = "body";

    const textarea = doc.createElement("textarea");
    textarea.placeholder = "在这里填写要输入的内容";

    const row = doc.createElement("div");
    row.className = "row";
    const label = doc.createElement("label");
    label.textContent = "速度";
    const select = doc.createElement("select");
    [
      ["slow", "慢"],
      ["normal", "正常"],
      ["fast", "快"],
      ["ultrafast", "极快"],
    ].forEach(function (pair) {
      const opt = doc.createElement("option");
      opt.value = pair[0];
      opt.textContent = pair[1];
      select.appendChild(opt);
    });
    select.value = "normal";
    row.appendChild(label);
    row.appendChild(select);

    const button = doc.createElement("button");
    button.className = "primary";
    button.type = "button";
    button.dataset.running = "0";
    button.textContent = "开始输入";

    const status = doc.createElement("div");
    status.className = "status";
    status.textContent = "就绪";

    body.appendChild(textarea);
    body.appendChild(row);
    body.appendChild(button);
    body.appendChild(status);
    panel.appendChild(header);
    panel.appendChild(body);
    shadow.appendChild(panel);
    (doc.body || doc.documentElement).appendChild(host);

    button.addEventListener("click", function () {
      if (button.dataset.running === "1") {
        if (typeof callbacks.onStop === "function") callbacks.onStop();
      } else if (typeof callbacks.onStart === "function") {
        callbacks.onStart({ text: textarea.value, speed: select.value });
      }
    });

    collapseBtn.addEventListener("click", function () {
      body.classList.toggle("collapsed");
    });

    let drag = null;

    function onPointerDown(ev) {
      const rect = host.getBoundingClientRect();
      host.style.left = rect.left + "px";
      host.style.top = rect.top + "px";
      host.style.right = "auto";
      drag = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      ev.preventDefault();
    }

    function onPointerMove(ev) {
      if (!drag) return;
      host.style.left = Math.max(0, ev.clientX - drag.x) + "px";
      host.style.top = Math.max(0, ev.clientY - drag.y) + "px";
    }

    function onPointerUp() {
      drag = null;
    }

    header.addEventListener("pointerdown", onPointerDown);
    doc.addEventListener("pointermove", onPointerMove);
    doc.addEventListener("pointerup", onPointerUp);

    return {
      host: host,
      isPanelNode: function (node) {
        return node === host || shadow.contains(node);
      },
      getText: function () {
        return textarea.value;
      },
      getSpeed: function () {
        return select.value;
      },
      setStatus: function (text) {
        status.textContent = text;
      },
      setRunning: function (running) {
        button.dataset.running = running ? "1" : "0";
        button.textContent = running ? "停止" : "开始输入";
      },
      toggle: function () {
        host.style.display = host.style.display === "none" ? "" : "none";
      },
      destroy: function () {
        header.removeEventListener("pointerdown", onPointerDown);
        doc.removeEventListener("pointermove", onPointerMove);
        doc.removeEventListener("pointerup", onPointerUp);
        host.remove();
      },
    };
  }

  return { mountPanel };
});
