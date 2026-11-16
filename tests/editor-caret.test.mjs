// The editor's focus is done when the editor has its own caret, not only when the page's focus is in its text
// (EDITOR-exit, seen twice in the whole flows suite at 1440 light, then 1 in 20 on a probe: after Created, the first
// Tab was taken and indented nothing). Pierre runs Tab (indent) and its other commands on its selections; a focus that
// finds none (an "on the first line" asked before a new file's document had arrived returns without placing one, while
// the page's focus reaches the text anyway) leaves them unset until the browser reports a selection, and it reports
// none when the caret is already where it lands. The probe saw it: the same editor, focused, the key's target its
// text, preventDefault called, no change in its DOM, the text still empty.
//   node tests/editor-caret.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const dv = read("js/diffview.js"), pierre = read("js/vendor/pierre-diffs/edit.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the pinned editor's Tab indents only its selections, and its view state reports them (what the wrapper reads)", () => {
  assert.match(pierre, /case"indent":case"outdent":case"indentLess":case"indentMore":if\(this\.#i!==void 0\)/, "indent is a no-op with no selection");
  assert.match(pierre, /getViewState\(\)\{[^}]*let e=this\.#i\?\.map\(/, "getViewState() reads the selections");
});
t("our focus waits for both: the text has focus and the editor has its caret, else it places one on the first line shown", () => {
  const f = dv.slice(dv.indexOf("async focus(o) {"), dv.indexOf("stop() {", dv.indexOf("async focus(o) {")));
  assert.match(f, /const placed = \(\) => \{ try \{ const v = ed\.getViewState\(\); return !!\(v && v\.selections && v\.selections\.length\); \} catch \{ return false; \} \};/);
  assert.match(f, /const FIRST = "first-visible";\s*const at = o && o\.lineNumber != null \? o : \{ \.\.\.\(o \|\| \{\}\), lineNumber: FIRST \};/);
  assert.equal((f.match(/if \(caret\(\) && placed\(\)\) return;/g) || []).length, 2, "done only when both hold, before and after its frame");
  assert.doesNotMatch(f, /if \(caret\(\)\) return;/, "never on the page's focus alone");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
