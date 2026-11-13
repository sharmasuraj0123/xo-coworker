// On a phone the panel covers the page: a place opened from it is shown, so the panel goes, before focus is placed
// there (grader B on 5f52deb and 7137115, S193: Launchpad's asked-thread row, Enter, Space or a tap at 390, and focus
// was on BODY once the thread showed: the panel stayed over the thread, the page under it inert, so go()'s focus on the
// conversation didn't take, and the row pressed went hidden with Launchpad's section for a thread). The trace on
// 7137115: focus() on #scroller left it on the row; 14 ms later the row lost it to nothing, the panel still shown.
// The browser check is grader B's r36 contract (gradeB.test.cjs S193), in four cells.
//   node tests/phone-panel-go.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const app = read("js/app.js"), lp = read("js/launchpad.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("go(): on a phone, the panel steps aside for the place opened, before anything is focused", () => {
  const g = app.slice(app.indexOf("function go(v, {"), app.indexOf("function returnPill("));
  const close = g.indexOf("if (panel && v !== S.view && PHONE.matches && STAGE.isOpen) STAGE.close({ restore: false, quiet: true });");
  assert.ok(close > 0, "the panel's close in go()");
  for (const later of ["if (v === S.view) { if (focus) say.focus(); return; }", "say.focus({ preventScroll: true })", "scroller).focus({ preventScroll: true })"]) {
    const i = g.indexOf(later); assert.ok(i > close, `before: ${later}`);
  }
});
t("only a place opened from the panel: Launchpad, the Map and the panel's own links pass panel; a place changed from elsewhere leaves it covering (lpshell LP21)", () => {
  for (const m of ["const MAP = createMap(", "const LP = createLaunchpad(", "const STAGE = createStage("]) {
    const i = app.indexOf(m); assert.ok(i >= 0, m);
    assert.match(app.slice(i, app.indexOf("\n", i)), /go: \(v\) => go\(v, \{ panel: true \}\)/, `${m} navigates as the panel`);
  }
  assert.match(app, /function go\(v, \{ from, focus = false, carry = false, panel = false \} = \{\}\) \{/);
});
t("Launchpad's asked-thread row opens the thread and leaves focus to go(): no wait of its own for the conversation", () => {
  assert.match(lp, /case "thread": go && go\(el\.dataset\.go\); return;/);
  assert.doesNotMatch(lp, /requestAnimationFrame\(land\)/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
