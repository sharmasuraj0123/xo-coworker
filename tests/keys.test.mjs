// The global keys' typing guard (js/keys.js typing): a key typed into a field never reaches the app's own
// shortcuts ("/" writes in the chat, "?" opens the keys sheet), even when the field is inside a shadow root.
// Astra, 5 Nov: in Files › Edit, "/" moved focus to the chat composer and the rest of the line went there.
//   node tests/keys.test.mjs
import assert from "node:assert/strict";

const { typing } = await import("../js/keys.js");

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

// an element that answers matches() for the selectors the guard asks about
const el = (tag, attrs = {}) => ({
  tag, attrs,
  matches(sel) {
    return sel.split(",").map((x) => x.trim()).some((one) => {
      if (one === "input" || one === "textarea") return tag === one;
      if (one.startsWith("[contenteditable]")) return "contenteditable" in attrs && !(one.includes(':not([contenteditable="false"])') && attrs.contenteditable === "false");
      return false;
    });
  },
});
const key = (path) => ({ key: "/", target: path[0], composedPath: () => path }); // target as a listener on window sees it
const doc = { tag: "#document" }, win = { tag: "window" };

t("a field in the page: typing", () => {
  assert.equal(typing(key([el("textarea"), el("form"), el("body"), doc, win])), true);
  assert.equal(typing(key([el("input"), doc, win])), true);
});
t("Pierre's editor: the event's target is the shadow host, its path holds the editable line: typing", () => {
  const host = el("diffs-container"), line = el("div", { contenteditable: "true" });
  const e = { key: "/", target: host, composedPath: () => [line, el("pre"), el("#shadow-root"), host, el("div"), el("body"), doc, win] };
  assert.equal(e.target.matches("input, textarea, [contenteditable]"), false, "the old guard read the host, so it let / through");
  assert.equal(typing(e), true);
});
t("not typing: a button, a file being read (the shadow host with nothing editable in its path)", () => {
  assert.equal(typing(key([el("button"), el("body"), doc, win])), false);
  assert.equal(typing(key([el("div"), el("#shadow-root"), el("diffs-container"), el("body"), doc, win])), false);
});
t('contenteditable="false" (a widget inside an editor) is not a field', () => {
  assert.equal(typing(key([el("span"), el("div", { contenteditable: "false" }), el("body"), doc, win])), false);
});
t("an event without composedPath reads its target", () => {
  assert.equal(typing({ key: "/", target: el("textarea") }), true);
  assert.equal(typing({ key: "/", target: el("button") }), false);
  assert.equal(typing({ key: "/", target: null }), false);
});
console.log(`${passed} passed${process.exitCode ? ", with failures" : ""}`);
