// A message's words for Copy (js/words.js), on stand-in elements: one reading for the desktop's Copy (msgx.js) and the
// phone's long-press Copy (gestures.js), so neither takes what the app adds around the words: a code block's label and
// its Copy, buttons, icons (Launchpad grader on 28d9587, S170: the long-press Copy began "js Copy" from innerText).
//   node tests/words.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ── stand-ins: text and elements, white-space by tag (a pre keeps its lines), matches() for the selectors used ──
class Text { constructor(v) { this.nodeType = 3; this.nodeValue = v; } }
class El {
  constructor(tag, attrs = {}, kids = []) { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = attrs; this.childNodes = kids.map((k) => (typeof k === "string" ? new Text(k) : k)); this.ws = attrs.ws || (this.tagName === "PRE" ? "pre" : "normal"); }
  matches(list) {
    return list.split(",").map((s) => s.trim()).some((s) => {
      if (s.startsWith(".")) return (this.attrs.class || "").split(" ").includes(s.slice(1));
      const a = /^\[([\w-]+)='([^']*)'\]$/.exec(s); if (a) return this.attrs[a[1]] === a[2];
      return s.toUpperCase() === this.tagName;
    });
  }
}
globalThis.getComputedStyle = (el) => ({ whiteSpace: el.ws });
const h = (tag, attrs, ...kids) => new El(tag, attrs || {}, kids);

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + (e.stack || e)); process.exitCode = 1; } };

let wordsOf;
await t("js/words.js gives one reading of a message's words (both Copy paths import it)", async () => {
  ({ wordsOf } = await import("../js/words.js"));
  assert.equal(typeof wordsOf, "function");
});
await t("a code block's label and Copy aren't its words: the long-press Copy and the desktop's give the paragraph, then the code as written", () => {
  const prose = h("div", { class: "prose" },
    h("p", null, "Run this:"),
    h("div", { class: "md-code" },
      h("div", { class: "md-code-head" }, h("span", null, "js"), h("button", { class: "md-copy" }, "Copy")),
      h("pre", null, h("code", null, "const a = 1;\n  return a;"))),
    h("p", null, "Then ", h("svg", { "aria-hidden": "true" }, "icon"), "check it."));
  assert.equal(wordsOf(prose), "Run this:\n\nconst a = 1;\n  return a;\n\nThen check it.");
});
await t("the phone's long-press Copy reads the message through the same extraction, never its innerText", () => {
  const g = readFileSync(new URL("../js/gestures.js", import.meta.url), "utf8"), m = readFileSync(new URL("../js/msgx.js", import.meta.url), "utf8");
  assert.match(g, /import \{ wordsOf \} from "\.\/words\.js"/, "gestures.js imports the shared extraction");
  assert.match(g, /dataset\.lp === "copy"\) \{ copyText\(wordsOf\(el\)\)/, "its Copy copies wordsOf(el)");
  assert.doesNotMatch(g, /copyText\(\(el\.innerText/, "not innerText");
  assert.match(m, /import \{ wordsOf \} from "\.\/words\.js"/, "msgx.js (the desktop's Copy) imports the same");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
