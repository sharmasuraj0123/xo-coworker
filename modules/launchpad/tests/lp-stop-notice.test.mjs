// Stop and Unlink each have one notice, changed in place, whose Undo's deadline is the action's own; the real notices service and Launchpad on a mocked clock, with app.js's notice() adapter.
import assert from "node:assert/strict";
import { mock } from "node:test";
import { createLaunchpadHerald } from "../herald.js";
import { createConversationNotices } from "../../../core/services/notices/line.js";

// a stand-in DOM, just enough for the section to mount and paint in place (nothing here is measured)
const el = () => { const e = { hidden: false, dataset: {}, style: {}, innerHTML: "", textContent: "", content: { childNodes: [] }, firstChild: null, scrollTop: 0, clientHeight: 0, scrollHeight: 0,
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, addEventListener(t, f) { (e.on[t] ||= []).push(f); }, on: {}, removeEventListener() {},
  setAttribute() {}, getAttribute: () => null, removeAttribute() {}, hasAttribute: () => false, querySelector: () => null, querySelectorAll: () => [], contains: () => false, focus() {}, closest: () => null, getClientRects: () => [] };
  return e; };
Object.assign(globalThis, {
  document: { getElementById: () => el(), createElement: () => el(), querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, body: el(), documentElement: el(), activeElement: null },
  location: new URL("http://127.0.0.1/"), localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, CSS: { escape: String }, requestAnimationFrame: (f) => setTimeout(f, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
});
globalThis.window = globalThis;

mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: 1_000_000 });
const { createLaunchpad } = await import("../launchpad.js");

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const at = async (ms) => { mock.timers.tick(ms); await flush(); };

/** A Launchpad on a project "demo" with a deploy under way, its herald, and app.js's notice adapter. */
async function world({ stopAnswer = async () => ({}), unlinkAnswer = async () => ({}), linked = false }) {
  const her = createConversationNotices(() => {});
  let stream = null;
  const api = {
    check: async () => (linked
      ? { state: "linked", name: "demo", repo: { branch: "main" }, github: { connected: true, workflow: true }, blockers: [], env: [], app: { id: "a1", name: "demo", url: "https://demo.example", host: "demo.example", status: "running" } }
      : { state: "ready", name: "demo", repo: { branch: "main" }, github: { connected: true, workflow: true }, blockers: [], env: [], running: "r1" }),
    watch: (p, on) => { stream = on; return { stop() {} }; },
    stop: () => stopAnswer(),
    unlink: () => unlinkAnswer(),
  };
  const lp = createLaunchpad({ api, projectOf: (v) => (v === "p:demo" ? "demo" : null), announce() {}, ...createLaunchpadHerald(her), onChange() {} });
  const section = el(); const hs = el(), ha = el(), body = el();
  section.querySelector = (q) => (q === ".lp-hs" ? hs : q === ".lp-ha" ? ha : q === ".fr-b" ? body : null);
  section.contains = () => true;
  lp.mount(section, { open() {}, hide() {} });
  lp.ensure("p:demo"); await flush();
  if (!linked) { stream({ type: "run", started: Date.now() - 5000 }); stream({ type: "step", step: "build", state: "doing", at: Date.now() }); }
  lp.paint("p:demo", true);
  const press = (name) => section.on.click[0]({ target: { closest: (q) => (q === "[data-lp]" ? { dataset: { lp: name } } : null) }, preventDefault() {} });
  return { her, press, line: her.current, stream: (e) => stream(e), setLinked: (v) => { linked = v; } };
}

let passed = 0;
const tests = [];
const t = (name, fn) => tests.push([name, fn]);

t("a notice's Undo waits for its own deadline and does nothing after it", async () => {
  const her = createConversationNotices(() => {});
  const { notice } = createLaunchpadHerald(her);
  let undoCount = 0;
  notice("deploy", { text: "Stopping", kind: "halt", until: Date.now() + 30, undo: () => { undoCount++; } }, 500);
  await at(31);
  her.undo();
  assert.equal(undoCount, 0);
  assert.equal(her.current().kind, "halt");
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
  assert.equal(l.kind, "halt");
  assert.equal(l.text, "Stopping the deploy of demo…"); assert.equal(l.undo, undefined, "no Undo once the stop has gone out");
  answer(new Error("Fixture offline")); await flush(); // refused, a moment later
  l = w.line();
  assert.equal(l.mid, mid); assert.equal(l.text, "Couldn't stop the deploy of demo"); assert.equal(l.undoLabel, "Stop again");
  assert.equal(l.kind, "stopped");
  await at(200); // where the old notice lived on (3000 → 3200): still only the refusal
  assert.equal(w.line()?.text, "Couldn't stop the deploy of demo");
  await at(Math.max(0, w.line().until - Date.now()) + 1);
  assert.equal(w.line(), null, "no earlier Undo reappears after the refusal expires");
});

t("Stop, confirmed: the same notice becomes 'Deploy of demo stopped'", async () => {
  const w = await world({ stopAnswer: async () => ({ stopped: true }) });
  w.press("stop"); const mid = w.line().mid;
  await at(3000);
  const l = w.line();
  assert.equal(l.mid, mid); assert.equal(l.text, "Deploy of demo stopped"); assert.equal(l.undo, undefined);
});

for (const late of ["{stopped: true}", "a refusal"]) {
  t(`The stream says it stopped before Space answers: the late answer (${late}) leaves 'Deploy of demo stopped' as it is`, async () => {
    let answer; const w = await world({ stopAnswer: () => new Promise((ok, no) => (answer = { ok, no })) });
    w.press("stop"); const mid = w.line().mid;
    await at(3000); // the stop is out
    w.stream({ type: "step", step: "build", state: "failed", error: { code: "cancelled" } }); await flush(); // the stream: stopped
    assert.equal(w.line()?.text, "Deploy of demo stopped");
    if (late === "a refusal") answer.no(new Error("Fixture offline")); else answer.ok({ stopped: true });
    await flush();
    const l = w.line();
    assert.equal(l?.mid, mid, "the stop's notice is still on screen"); assert.equal(l.text, "Deploy of demo stopped", "its outcome, untouched");
  });
}

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
  w.her.undo();
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
  assert.equal(l.kind, "stopped");
});

t("Unlink whose answer failed but which happened: it reads the project again and says it's unlinked, never 'still linked'", async () => {
  let answer; const w = await world({ linked: true, unlinkAnswer: () => new Promise((ok, no) => (answer = no)) });
  w.press("unlink");
  await at(3200);
  w.setLinked(false);
  answer(new Error("Bad reply")); await flush(); await flush();
  const l = w.line();
  assert.equal(l.text, "Unlinked from Launchpad");
  assert.ok(!/still linked/.test(l.sub || ""));
});

t("Unlink undone from its notice within the window: nothing is sent", async () => {
  let sent = 0; const w = await world({ linked: true, unlinkAnswer: async () => { sent++; return {}; } });
  w.press("unlink");
  w.her.undo();
  await at(3500); assert.equal(sent, 0);
});

for (const [name, fn] of tests) {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + (e.stack || e.message)); process.exitCode = 1; }
}
mock.timers.reset();
console.log(`${passed} passed${process.exitCode ? ", some failed" : ""}`);
