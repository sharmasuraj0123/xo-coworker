// On a phone the panel covers the page: a place opened from it is shown, so the panel goes, before focus is placed
// there (grader B on 5f52deb and 7137115, S193: Launchpad's asked-thread row, Enter, Space or a tap at 390, and focus
// was on BODY once the thread showed: the panel stayed over the thread, the page under it inert, so go()'s focus on the
// conversation didn't take, and the row pressed went hidden with Launchpad's section for a thread). The trace on
// 7137115: focus() on #scroller left it on the row; 14 ms later the row lost it to nothing, the panel still shown.
// The browser check is grader B's r36 contract (gradeB.test.cjs S193), in four cells.
//   node tests/phone-panel-go.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sourcePaths, readSource } from "./lib/sources.mjs";
import { dom } from "./lib/dom.mjs";
import { createNavigation } from "../shell/navigation.js";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const app = read("js/app.js"), lp = sourcePaths(".js").filter((p) => p.startsWith("modules/launchpad/")).map(readSource).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

const { document } = await dom('<div id="panel"></div><div id="column"><div id="scroller" tabindex="-1"></div><textarea id="say"></textarea></div><div id="tdock"></div>');
for (const focus of [true, false]) {
  t(`navigation closes the phone panel before focusing the ${focus ? "composer" : "scroller"}`, () => {
    const say = document.querySelector("#say"), scroller = document.querySelector("#scroller");
    const calls = [];
    const target = focus ? say : scroller;
    const onFocus = () => calls.push("focus");
    target.addEventListener("focus", onFocus, { once: true });
    const { go } = createNavigation({
      S: { view: "home", tEdit: null, tMenu: null, retrace: false, trail: [], parent: {}, backTo: {}, scroll: {} },
      VW: { editing: false, leave() {} },
      STAGE: { isOpen: true, leave() {}, close(options) { calls.push(options); } },
      IQ: { close() {} }, PHONE: { matches: true }, REC: { leave() {} },
      TD: { key: null }, tdock: document.querySelector("#tdock"), say, scroller,
      closeSettings() {}, setDrawer() {}, saveScroll() {}, saveDraft() {}, follow() {},
      pageEl: () => null, loadDraft() {}, render() {}, returnPill() {}, convThread: () => null,
    });
    go("ws", { panel: true, focus });
    assert.deepEqual(calls, [{ restore: false, quiet: true }, "focus"]);
    assert.ok(document.activeElement === target, "focus reaches the requested destination");
  });
}
t("Back uses a thread’s recorded parent and leaves the place trail untouched", () => {
  const S = { view: "t:thread", tEdit: null, tMenu: null, retrace: false, trail: ["home"], parent: { "t:thread": "ws" }, backTo: {}, scroll: {} };
  const { back } = createNavigation({ S, VW: { editing: false, leave() {} }, STAGE: { isOpen: false, leave() {}, close() {} },
    IQ: { close() {} }, PHONE: { matches: false }, REC: { leave() {} }, TD: { key: null }, tdock: document.querySelector("#tdock"),
    say: document.querySelector("#say"), scroller: document.querySelector("#scroller"), closeSettings() {}, setDrawer() {}, saveScroll() {},
    saveDraft() {}, follow() {}, pageEl: () => null, loadDraft() {}, render() {}, returnPill() {}, convThread: () => ({ project: "project" }),
  });
  back();
  assert.equal(S.view, "ws");
  assert.deepEqual(S.trail, ["home"]);
  assert.equal(S.retrace, false);
});
t("only a place opened from the panel: the Map and the panel's own links pass panel; a place changed from elsewhere leaves it covering (lpshell LP21)", () => {
  for (const m of ["const MAP = createMap(", "const STAGE = createStage("]) {
    const i = app.indexOf(m); assert.ok(i >= 0, m);
    // (the panel's own rows open a thread as its Thread page beside a chat, else navigate as the panel: openFromPanel)
    assert.match(app.slice(i, app.indexOf("\n", i)), /go: \(v(, e)?\) => (go\(v, \{ panel: true \}\)|openFromPanel\(v, e\))/, `${m} navigates as the panel`);
  }
  assert.match(read("shell/navigation.js"), /function go\(v, \{ from, row = null, focus = false, carry = false, panel = false, still = false \} = \{\}\) \{/);
});
t("Launchpad's asked-thread row opens the thread and leaves focus to go(): no wait of its own for the conversation", () => {
  assert.match(lp, /case "thread": go && go\(el\.dataset\.go\); return;/);
  assert.doesNotMatch(lp, /requestAnimationFrame\(land\)/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);

// openFromPanel: what isn't a thread page beside a chat still goes as the panel's own link
{ const f = read("modules/threads/open-panel-thread.js");
  if (!/go\(v, \{ panel: true \}\);/.test(f)) { console.error("  FAIL openFromPanel passes panel"); process.exitCode = 1; } }
