// Create's progress row (the clone's Stop) never takes focus away with it (S144: H20). After a refused Stop, focus
// stays on Stop (aria-disabled, never disabled) to try again. If the clone then fails, or is stopped elsewhere, or
// finishes, setBusy(false) hides the progress row. Before, nothing handed focus on while Stop had it: the failure
// path asks "is focus in the dialog?" and a hidden Stop still is, so no one moved it, and the browser dropped it to
// the page. setBusy itself now hands focus that was in the row to Create (what starts it again) before hiding it.
//   node tests/lp-create-stop-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/create.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const setBusy = (() => { const i = src.indexOf("function setBusy(on, repoOf) {"); assert.ok(i > 0, "setBusy found"); return src.slice(i, src.indexOf("\n  }\n", i)); })();

t("Stop lives in the progress row, so hiding the row hides Stop", () => {
  const prog = html.indexOf('id="cp-prog"'), stop = html.indexOf('id="cp-stop"');
  assert.ok(prog > 0 && stop > prog, "#cp-stop comes after #cp-prog opens");
  const between = html.slice(prog, stop);
  const open = (between.match(/<div\b/g) || []).length + 1, closed = (between.match(/<\/div>/g) || []).length; // +1: #cp-prog itself
  assert.ok(open > closed, "#cp-prog is still open where #cp-stop is: Stop is inside it");
});
t("setBusy(false) notes whether focus is in the progress row before it hides it", () => {
  const note = setBusy.indexOf('const fromProg = !on && $("#cp-prog").contains(document.activeElement);');
  const hide = setBusy.indexOf('$("#cp-prog").hidden = !(on && mode === "clone");');
  assert.ok(note > 0, "it looks before hiding");
  assert.ok(hide > note, "and hides after looking");
});
t("and then hands that focus to Create, the control that starts it again", () => {
  const hide = setBusy.indexOf('$("#cp-prog").hidden = !(on && mode === "clone");');
  const hand = setBusy.indexOf("if (fromProg) submit.focus({ preventScroll: true });");
  assert.ok(hand > hide, "focus is handed on once the row is hidden, in the same call");
});
t("Stop never goes disabled while it asks (aria-disabled keeps its focus for Stop again)", () => {
  const stop = src.slice(src.indexOf("async function stop() {"), src.indexOf("async function stop() {") + 1600);
  assert.match(stop, /st\.setAttribute\("aria-disabled", "true"\); st\.setAttribute\("aria-busy", "true"\);/);
  assert.doesNotMatch(stop, /st\.disabled = true/);
});
console.log(`${passed} passed${process.exitCode ? ", some failed" : ""}`);
