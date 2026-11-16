// A menu item that opens something (a picker, a sheet, a field, a dialog) opens it first, in the same step, and only
// then does the menu go: never a menu closed, then what it opens a frame later, focus on the page between (the
// create-project grader on 8aa58d3, S012: the thread menu's "Continue on another runtime…" closed the menu, which
// removed the focused item, and opened the composer's picker in a requestAnimationFrame: BODY, then Codex). The same
// pattern was S240's Unfold. A redraw's own hand-off (redraw.js) can't catch it: the opener comes later.
// The census: in every script, no deferred opener (a requestAnimationFrame, a setTimeout) follows a menu being closed
// in the same handler. The browser check is grader B's S012 contract (gradeB.test.cjs) and every focus-drop record.
//   node tests/menu-successor.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const files = [...readdirSync(new URL("js/", ROOT)).filter((f) => f.endsWith(".js")).map((f) => `js/${f}`), ...readdirSync(new URL("js/shells/", ROOT)).filter((f) => f.endsWith(".js")).map((f) => `js/shells/${f}`)];
const read = (f) => readFileSync(new URL(f, ROOT), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

// a menu closed: its state set off, or its close called
const CLOSED = /\b(?:tMenu|[a-z]*Menu|menu)\s*=\s*(?:null|false)\b|\bclose(?:Thread)?Menu\(/;
// an opener deferred a frame or a tick: what a menu item leads to
const DEFERRED = /(?:requestAnimationFrame|setTimeout)\(\(\) => [^;\n]*?\b(?:[A-Za-z]+\.)?(?:open|openSheet|startThreadEdit|show|showModal)\(/g;

t("no menu is closed and then what it opens deferred: the successor opens in the same step", () => {
  const found = [];
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(DEFERRED)) {
      // the statements of the same handler before it: back to the start of its block or line group
      const before = src.slice(Math.max(0, m.index - 420), m.index);
      const block = before.slice(before.lastIndexOf("{") + 1);
      if (CLOSED.test(block)) found.push(`${f}:${src.slice(0, m.index).split("\n").length}: ${m[0].slice(0, 90)}`);
    }
  }
  assert.deepEqual(found, [], `a menu closed, then its successor a frame later:\n  ${found.join("\n  ")}`);
});
t("S012: Continue on another runtime opens the picker first, then the menu goes", () => {
  const app = read("js/app.js");
  const h = app.slice(app.indexOf('const tmv = t.closest("[data-tmove]");'), app.indexOf('const unf = t.closest("[data-unfreeze]");'));
  assert.match(h, /if \(to\) IQ\.open\(sid, \$\("#iq"\), \{ rt: to\.id \}\);\s*if \(to\) \{ S\.tMenu = null; \$\("#top-who"\)\._h = null; schedule\(\); \} else closeThreadMenu\(\);/);
  assert.doesNotMatch(h, /requestAnimationFrame/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
