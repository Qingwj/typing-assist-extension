(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.TypingAssist = factory(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const core =
    typeof module === "object" && module.exports
      ? require("./core.js")
      : root.TypingAssistCore;

  const INPUT_TYPES = new Set(["text", "search", "url", "tel", "email", "password"]);

  function textFieldKind(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.tagName === "TEXTAREA") return "text";
    if (el.tagName === "INPUT") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      return INPUT_TYPES.has(type) ? "text" : null;
    }
    if (el.isContentEditable === true) return "contenteditable";
    const attr = typeof el.getAttribute === "function" ? el.getAttribute("contenteditable") : null;
    if (attr !== null && String(attr).toLowerCase() !== "false") return "contenteditable";
    return null;
  }

  function isEditable(el) {
    return textFieldKind(el) !== null;
  }

  function nativeValueSetter(el) {
    const win = el.ownerDocument.defaultView;
    const proto = el.tagName === "TEXTAREA" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    return Object.getOwnPropertyDescriptor(proto, "value").set;
  }

  function insertIntoTextField(el, ch) {
    const setter = nativeValueSetter(el);
    const current = el.value;
    const start = el.selectionStart == null ? current.length : el.selectionStart;
    const end = el.selectionEnd == null ? start : el.selectionEnd;
    const next = current.slice(0, start) + ch + current.slice(end);
    setter.call(el, next);
    const caret = start + ch.length;
    try {
      el.setSelectionRange(caret, caret);
    } catch (e) {
      /* ignore */
    }
    const win = el.ownerDocument.defaultView;
    el.dispatchEvent(
      new win.InputEvent("input", {
        bubbles: true,
        composed: true,
        inputType: "insertText",
        data: ch,
      })
    );
  }

  function focusQuietly(el) {
    try {
      el.focus();
    } catch (e) {
      /* ignore */
    }
  }

  function insertIntoContentEditable(el, ch) {
    const doc = el.ownerDocument;
    const win = doc.defaultView;
    if (typeof doc.execCommand === "function") {
      try {
        if (doc.execCommand("insertText", false, ch)) return;
      } catch (e) {
        /* fall through to Range insertion */
      }
    }
    const sel = typeof win.getSelection === "function" ? win.getSelection() : null;
    let inserted = false;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = doc.createTextNode(ch);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      inserted = true;
    }
    if (!inserted) {
      el.appendChild(doc.createTextNode(ch));
    }
    el.dispatchEvent(
      new win.InputEvent("input", {
        bubbles: true,
        composed: true,
        inputType: "insertText",
        data: ch,
      })
    );
  }

  function dispatchKey(el, type, ch) {
    const win = el.ownerDocument.defaultView;
    const ev = new win.KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      key: ch === "\n" ? "Enter" : ch,
      code: core.codeForChar(ch),
    });
    const legacyCode = core.keyCodeForChar(ch);
    Object.defineProperty(ev, "keyCode", {
      get: function () {
        return legacyCode;
      },
    });
    Object.defineProperty(ev, "which", {
      get: function () {
        return legacyCode;
      },
    });
    el.dispatchEvent(ev);
  }

  function restoreCaret(el, caret) {
    if (!caret) return;
    if (typeof caret.start === "number") {
      try {
        el.setSelectionRange(caret.start, caret.end == null ? caret.start : caret.end);
      } catch (e) {
        /* ignore */
      }
      return;
    }
    try {
      const win = el.ownerDocument.defaultView;
      const sel = win.getSelection();
      sel.removeAllRanges();
      sel.addRange(typeof caret.cloneRange === "function" ? caret.cloneRange() : caret);
    } catch (e) {
      /* ignore */
    }
  }

  async function typeText(el, text, opts) {
    const options = opts || {};
    const speed = options.speed || "normal";
    const sleep = options.sleep || core.sleep;
    const rng = options.rng || Math.random;
    const shouldStop = options.shouldStop || function () { return false; };
    const onProgress = options.onProgress || function () {};
    focusQuietly(el);
    restoreCaret(el, options.caret);
    const chars = core.splitCodePoints(text);
    let typed = 0;
    for (let i = 0; i < chars.length; i++) {
      if (shouldStop()) return { typed, cancelled: true };
      const ch = chars[i];
      dispatchKey(el, "keydown", ch);
      if (textFieldKind(el) === "contenteditable") insertIntoContentEditable(el, ch);
      else insertIntoTextField(el, ch);
      dispatchKey(el, "keyup", ch);
      typed++;
      onProgress(typed, chars.length);
      if (i < chars.length - 1) await sleep(core.delayFor(speed, rng));
    }
    return { typed, cancelled: false };
  }

  function getCaret(el) {
    const kind = textFieldKind(el);
    if (kind === "text") {
      try {
        if (el.selectionStart == null) return null;
        return {
          start: el.selectionStart,
          end: el.selectionEnd == null ? el.selectionStart : el.selectionEnd,
        };
      } catch (e) {
        return null;
      }
    }
    if (kind === "contenteditable") {
      try {
        const win = el.ownerDocument.defaultView;
        const sel = win.getSelection();
        if (sel && sel.rangeCount > 0) return sel.getRangeAt(0).cloneRange();
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function createFocusTracker(doc, isIgnored, win) {
    const ignored = typeof isIgnored === "function" ? isIgnored : function () { return false; };
    let saved = null;

    function nodeOf(ev) {
      if (typeof ev.composedPath === "function") {
        const path = ev.composedPath();
        if (path && path.length) return path[0];
      }
      return ev.target;
    }

    function refresh(el) {
      const caret = getCaret(el);
      if (caret == null) return;
      saved = { el: el, caret: caret };
    }

    function onFocusIn(ev) {
      const node = nodeOf(ev);
      if (!node || ignored(node) || ignored(ev.target)) return;
      if (!isEditable(node)) return;
      refresh(node);
    }

    function onSelectionChange() {
      const active = doc.activeElement;
      if (saved && active === saved.el) refresh(active);
    }

    function onFocusOut(ev) {
      const node = nodeOf(ev);
      if (saved && node === saved.el) refresh(node);
    }

    doc.addEventListener("focusin", onFocusIn, true);
    doc.addEventListener("selectionchange", onSelectionChange);
    doc.addEventListener("focusout", onFocusOut, true);

    return {
      getTarget() {
        return saved;
      },
      dispose() {
        doc.removeEventListener("focusin", onFocusIn, true);
        doc.removeEventListener("selectionchange", onSelectionChange);
        doc.removeEventListener("focusout", onFocusOut, true);
      },
    };
  }

  return {
    isEditable,
    textFieldKind,
    insertIntoTextField,
    insertIntoContentEditable,
    dispatchKey,
    typeText,
    getCaret,
    restoreCaret,
    createFocusTracker,
  };
});
