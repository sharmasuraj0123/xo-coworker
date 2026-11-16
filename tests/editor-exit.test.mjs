// The keyboard can always leave the code editor (the controls grader on d79d37e, all four cells: after Created the
// editor opens; Tab indents and Escape only eases the selection, so Created's Undo couldn't be reached by keyboard).
// js/diffview.js exitKeys runs here on stand-in key events: Tab alone is the editor's (it indents); Escape, then Tab
// or Shift+Tab, is the browser's (focus moves on). The walk in a browser is the flows case EDITOR-exit.
//   node tests/editor-exit.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
let D = {};
try { D = await import("../js/diffview.js"); } catch (e) { console.error("  (js/diffview.js didn't load: " + e.message + ")"); }
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const key = (k, o = {}) => { const e = { type: "keydown", key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, stopped: false, prevented: false, ...o }; e.stopPropagation = () => (e.stopped = true); e.preventDefault = () => (e.prevented = true); return e; };
const within = { contains: (n) => n === "inside" };

t("Tab alone is the editor's: it indents", () => {
  assert.equal(typeof D.exitKeys, "function", "js/diffview.js exitKeys(within)");
  const h = D.exitKeys(within), e = key("Tab");
  h(e);
  assert.equal(e.stopped, false, "the editor sees it");
});
t("Escape, then Tab (or Shift+Tab): the browser's; focus moves on, the editor never sees it, nothing is prevented", () => {
  assert.equal(typeof D.exitKeys, "function");
  for (const shiftKey of [false, true]) {
    const h = D.exitKeys(within);
    h(key("Escape"));
    h(key("Shift", { shiftKey })); // holding Shift for Shift+Tab doesn't end it
    const e = key("Tab", { shiftKey });
    h(e);
    assert.deepEqual([e.stopped, e.prevented], [true, false], shiftKey ? "Shift+Tab" : "Tab");
    const again = key("Tab");
    h(again);
    assert.equal(again.stopped, false, "once: the next Tab is the editor's again");
  }
});
t("what ends it: another key after Escape, focus leaving the editor, a Ctrl/Cmd/Alt Tab, typing in an IME", () => {
  assert.equal(typeof D.exitKeys, "function");
  let h = D.exitKeys(within); h(key("Escape")); h(key("a")); let e = key("Tab"); h(e); assert.equal(e.stopped, false, "a key between");
  h = D.exitKeys(within); h(key("Escape")); h({ type: "focusout", relatedTarget: "outside" }); e = key("Tab"); h(e); assert.equal(e.stopped, false, "focus left and came back");
  h = D.exitKeys(within); h(key("Escape")); h({ type: "focusout", relatedTarget: "inside" }); e = key("Tab"); h(e); assert.equal(e.stopped, true, "focus moving inside the editor (its find bar) keeps it");
  h = D.exitKeys(within); h(key("Escape")); e = key("Tab", { ctrlKey: true }); h(e); assert.equal(e.stopped, false, "Ctrl+Tab isn't it");
  h = D.exitKeys(within); h(key("Escape", { isComposing: true })); e = key("Tab"); h(e); assert.equal(e.stopped, false, "an IME's Escape isn't it");
});
const src = readFileSync(new URL("../js/diffview.js", import.meta.url), "utf8");
t("every editor is wired with it, in capture, before the editor's own, and let go with it", () => {
  assert.equal((src.match(/new E\.Editor\(/g) || []).length, 1, "one editor in the app (diffview's file().edit)");
  assert.ok(/const leave = exitKeys\(host\);/.test(src), "the editor's element");
  assert.ok(/\["keydown", leave, true\], \["focusout", leave, true\]/.test(src), "in capture");
  assert.equal((src.match(/\["keydown", leave, true\], \["focusout", leave, true\]/g) || []).length, 2, "added and removed");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
