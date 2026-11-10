// Launchpad's Stop and Unlink each have one notice, changed in place as the action goes on (the owner's choice B,
// C041's pattern). Grader B on 9c3a663 saw a refused stop's "Couldn't stop it" share the screen with "Stopping the
// deploy of xo-coworker · Undo" for up to ~200 ms. There were two clocks: Launchpad sent the stop at 3000 ms, and the
// notice lived its own 3200 ms. The notice's Undo stayed pressable after the stop had gone out, and pressing it did
// nothing. Now the notice is the action's: its Undo's deadline is the window's, the window's end changes it in place
// (no Undo), and its outcome changes it again ("Deploy of … stopped", or "Couldn't stop … · Stop again").
//
// The real js/herald.js and the real js/launchpad.js, on a hand-moved clock (node:test's mock timers). Only the
// section's DOM is a stand-in, and the adapter is app.js's own notice() (its source is read and checked below).
//   node tests/lp-stop-notice.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock } from "node:test";

// a stand-in DOM, just enough for the section to mount and paint (nothing here is measured)
const el = () => { const e = { hidden: false, dataset: {}, style: {}, innerHTML: "", textContent: "", scrollTop: 0, clientHeight: 0, scrollHeight: 0,
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, addEventListener(t, f) { (e.on[t] ||= []).push(f); }, on: {}, removeEventListener() {},
  setAttribute() {}, getAttribute: () => null, removeAttribute() {}, hasAttribute: () => false, querySelector: () => null, querySelectorAll: () => [], contains: () => false, focus() {}, closest: () => null, getClientRects: () => [] };
  return e; };
Object.assign(globalThis, {
  document: { getElementById: () => el(), createElement: () => el(), querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, body: el(), documentElement: el(), activeElement: null },
  location: new URL("http://127.0.0.1/"), localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, CSS: { escape: String }, requestAnimationFrame: (f) => setTimeout(f, 0),
});
globalThis.window = globalThis;

mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: 1_000_000 });
const { createHerald } = await import("../js/herald.js");
const { createLaunchpad } = await import("../js/launchpad.js");
const appSrc = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const at = async (ms) => { mock.timers.tick(ms); await flush(); };

/** A Launchpad on a project "demo" with a deploy under way, its herald, and app.js's notice adapter. */
async function world({ stopAnswer = async () => ({}), unlinkAnswer = async () => ({}), linked = false }) {
  const state = { herald: null };
  const her = createHerald({ state });
  const heraldShow = (h, ms) => her.show(h, ms), heraldFor = (mid, make, ms) => her.forMsg(mid, make, ms), heraldDrop = (mid) => her.drop(mid);
  // app.js's adapter, as written there (checked against its source below)
  const notice = (mid, l, ms) => { const h = { mid, kind: l.kind === "err" ? "stopped" : l.kind || "done", text: l.text, ...(l.sub ? { sub: l.sub } : {}), ...(l.undo ? { undo: l.undo, undoLabel: l.undoLabel, undoUntil: l.until || 0, ownFocus: true } : {}) }; return heraldFor(mid, () => h, ms) || heraldShow(h, ms); };
  const unnotice = (mid) => heraldDrop(mid);
  let stream = null;
  const api = {
    check: async () => (linked
      ? { state: "linked", name: "demo", repo: { branch: "main" }, github: { connected: true, workflow: true }, blockers: [], env: [], app: { id: "a1", name: "demo", url: "https://demo.example", host: "demo.example", status: "running" } }
      : { state: "ready", name: "demo", repo: { branch: "main" }, github: { connected: true, workflow: true }, blockers: [], env: [], running: "r1" }),
    watch: (p, on) => { stream = on; return { stop() {} }; },
    stop: () => stopAnswer(),
    unlink: () => unlinkAnswer(),
  };
  const lp = createLaunchpad({ api, projectOf: (v) => (v === "p:demo" ? "demo" : null), announce() {}, notify() {}, notice, unnotice, onChange() {} });
  const section = el(); const hs = el(), ha = el(), body = el();
  section.querySelector = (q) => (q === ".lp-hs" ? hs : q === ".lp-ha" ? ha : q === ".fr-b" ? body : null);
  section.contains = () => true;
  lp.mount(section, { open() {}, hide() {} });
  lp.ensure("p:demo"); await flush();
  if (!linked) { stream({ type: "run", started: Date.now() - 5000 }); stream({ type: "step", step: "build", state: "doing", at: Date.now() }); }
  lp.paint("p:demo", true);
  const press = (name) => section.on.click[0]({ target: { closest: (q) => (q === "[data-lp]" ? { dataset: { lp: name } } : null) }, preventDefault() {} });
  const line = () => (state.herald && state.herald.until > Date.now() ? state.herald : null);
  const waiting = () => her.HQ.map((x) => x.h);
  return { state, her, press, line, waiting, stream: (e) => stream(e) };
}

let passed = 0;
const tests = [];
const t = (name, fn) => tests.push([name, fn]);

t("app.js hands Launchpad one notice per subject (mid), changed in place, and drops it; an Undo past its deadline does nothing", () => {
  assert.match(appSrc, /notice: \(mid, l, ms\) => \{ const h = \{ mid, kind: l\.kind === "err" \? "stopped" : l\.kind \|\| "done", text: l\.text, \.\.\.\(l\.sub \? \{ sub: l\.sub \} : \{\}\), \.\.\.\(l\.undo \? \{ undo: l\.undo, undoLabel: l\.undoLabel, undoUntil: l\.until \|\| 0, ownFocus: true \} : \{\}\) \}; return heraldFor\(mid, \(\) => h, ms\) \|\| heraldShow\(h, ms\); \},/);
  assert.match(appSrc, /unnotice: \(mid\) => heraldDrop\(mid\) \}\);/);
  assert.match(appSrc, /if \(typeof u === "function"\) \{ if \(h\.undoUntil && Date\.now\(\) > h\.undoUntil\) return; h\.until = 0; u\(\); heraldNext\(\); \}/);
});

t("Stop, refused: one notice the whole way; its Undo lasts exactly the window; then 'Couldn't stop … · Stop again', never beside 'Stopping … · Undo'", async () => {
  let answer; const w = await world({ stopAnswer: () => new Promise((ok, no) => (answer = no)) });
  w.press("stop");
  let l = w.line();
  assert.equal(l?.text, "Stopping the deploy of demo"); assert.equal(typeof l.undo, "function");
  assert.equal(l.undoUntil, Date.now() + 3000, "its Undo's deadline is the window's, not the notice's own clock");
  const mid = l.mid; assert.match(mid, /^lp-stop:demo:/);
  await at(3000); // the window ends: the stop goes out
  l = w.line();
  assert.equal(l.mid, mid, "the same notice");
  assert.equal(l.text, "Stopping the deploy of demo…"); assert.equal(l.undo, undefined, "no Undo once the stop has gone out");
  answer(new Error("Fixture offline")); await flush(); // refused, a moment later
  l = w.line();
  assert.equal(l.mid, mid); assert.equal(l.text, "Couldn't stop the deploy of demo"); assert.equal(l.undoLabel, "Stop again");
  assert.ok(![l, ...w.waiting()].some((h) => /^Stopping the deploy of demo$/.test(h.text) && h.undo), "no 'Stopping … · Undo' left anywhere");
  await at(200); // where the old notice lived on (3000 → 3200): still only the refusal
  assert.equal(w.line()?.text, "Couldn't stop the deploy of demo");
});

t("Stop, confirmed: the same notice becomes 'Deploy of demo stopped'", async () => {
  const w = await world({ stopAnswer: async () => ({ stopped: true }) });
  w.press("stop"); const mid = w.line().mid;
  await at(3000);
  const l = w.line();
  assert.equal(l.mid, mid); assert.equal(l.text, "Deploy of demo stopped"); assert.equal(l.undo, undefined);
});

t("Stop taken back in the panel (Keep deploying): the notice goes with it; no stop is sent", async () => {
  let sent = 0; const w = await world({ stopAnswer: async () => { sent++; return { stopped: true }; } });
  w.press("stop"); assert.ok(w.line());
  w.press("stop-undo"); await flush();
  assert.equal(w.line(), null, "the notice is gone");
  await at(3500); assert.equal(sent, 0);
});

t("Stop while the run goes live in its window: the notice goes, and nothing is sent", async () => {
  let sent = 0; const w = await world({ stopAnswer: async () => { sent++; return { stopped: true }; } });
  w.press("stop");
  w.stream({ step: "live", state: "done", host: "demo.example", url: "https://demo.example" });
  assert.equal(w.line(), null, "no notice offers to stop a run that is over");
  await at(3500); assert.equal(sent, 0);
});

t("Stop again, from the refused notice: a new window on the same notice, with its own Undo deadline", async () => {
  let n = 0; const w = await world({ stopAnswer: async () => { n++; throw new Error("Fixture offline"); } });
  w.press("stop"); await at(3000); await flush();
  let l = w.line(); assert.equal(l.undoLabel, "Stop again");
  l.until = 0; l.undo(); // what the herald's click does for this line (no deadline on Stop again)
  l = w.line();
  assert.equal(l.text, "Stopping the deploy of demo"); assert.equal(l.undoUntil, Date.now() + 3000);
  await at(3000); await flush(); assert.equal(n, 2);
});

t("Unlink: its Undo lasts exactly as long as the unlink waits; then the same notice, no Undo; refused, it says so in place", async () => {
  let sent = 0, answer; const w = await world({ linked: true, unlinkAnswer: () => { sent++; return new Promise((ok, no) => (answer = no)); } });
  w.press("unlink");
  let l = w.line();
  assert.equal(l?.text, "Unlinked from Launchpad"); assert.equal(typeof l.undo, "function");
  assert.equal(l.undoUntil, Date.now() + 3200, "its Undo's deadline is the unlink's own window");
  const mid = l.mid; assert.equal(mid, "lp-unlink:demo");
  await at(3200); // sent
  l = w.line(); assert.equal(sent, 1);
  assert.equal(l.mid, mid); assert.equal(l.undo, undefined, "no Undo once it has gone out");
  answer(new Error("Fixture offline")); await flush();
  l = w.line();
  assert.equal(l.mid, mid); assert.equal(l.text, "Couldn't unlink from Launchpad"); assert.match(l.sub, /Fixture offline\. It's still linked\./);
});

t("Unlink undone from its notice within the window: nothing is sent", async () => {
  let sent = 0; const w = await world({ linked: true, unlinkAnswer: async () => { sent++; return {}; } });
  w.press("unlink");
  const l = w.line(); l.until = 0; l.undo(); // what the herald's click does (inside the deadline)
  await at(3500); assert.equal(sent, 0);
});

for (const [name, fn] of tests) {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + (e.stack || e.message)); process.exitCode = 1; }
}
mock.timers.reset();
console.log(`${passed} passed${process.exitCode ? ", some failed" : ""}`);
