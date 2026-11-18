(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.TypingAssistCore = factory(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SPEEDS = {
    slow: { min: 120, max: 250 },
    normal: { min: 50, max: 120 },
    fast: { min: 10, max: 40 },
    ultrafast: { min: 2, max: 8 },
  };

  function splitCodePoints(text) {
    return Array.from(String(text));
  }

  function delayFor(speedName, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    const range = SPEEDS[speedName] || SPEEDS.normal;
    return range.min + Math.floor(random() * (range.max - range.min + 1));
  }

  function codeForChar(ch) {
    if (/^[a-zA-Z]$/.test(ch)) return "Key" + ch.toUpperCase();
    if (/^[0-9]$/.test(ch)) return "Digit" + ch;
    if (ch === " ") return "Space";
    if (ch === "\n") return "Enter";
    return "";
  }

  function keyCodeForChar(ch) {
    if (ch === "\n") return 13;
    if (ch === " ") return 32;
    if (/^[a-zA-Z0-9]$/.test(ch)) return ch.toUpperCase().charCodeAt(0);
    return 0;
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  return { splitCodePoints, SPEEDS, delayFor, codeForChar, keyCodeForChar, sleep };
});
