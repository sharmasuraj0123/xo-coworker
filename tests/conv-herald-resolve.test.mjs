// A thread's resolve has one notice (C041, the controls grader on 1ef7056): a refused resolve says "Couldn't resolve it
// · Retry"; when a later resolve of the same thread goes through, that notice is replaced (on screen or waiting), or
// taken away when the outcome has nothing to say. It never stays with a live Retry that would resolve the thread again.
// The real herald (js/herald.js) with a hand-moved clock, and how the app's resolveThread uses it (js/app.js).
//   node tests/conv-herald-resolve.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + (e.stack || e.message)); process.exitCode = 1; } };
const H = await import("../js/herald.js");
const clock = () => { let now = 1000, timers = []; return { now: () => now, set: (fn, ms) => { timers.push({ at: now + ms, fn }); return timers.length; }, clear: () => {}, tick(ms) { now += ms; const due = timers.filter((x) => x.at <= now); timers = timers.filter((x) => x.at > now); due.forEach((x) => x.fn()); } }; };
const make = () => { const c = clock(), state = { herald: null }; const her = H.createHerald({ state, now: c.now, setTimer: c.set, clearTimer: c.clear }); return { c, state, her }; };
const about = "resolve:t1";
const refused = () => ({ kind: "stopped", text: "Couldn't resolve it", sub: "Fixture refused", mid: about, undo: () => {}, undoLabel: "Retry" });
const resolved = () => ({ kind: "done", text: "Resolved", sub: "Fix the login form", mid: about, undo: () => {} });
// the app's way of saying a resolve's outcome: the thread's notice changed in place, else a new one
const say = (her, h, ms) => { if (!her.forMsg(about, () => h, ms)) her.show(h, ms); };

await t("a refused resolve, then one that works: the notice says Resolved, and the refusal never comes back", () => {
  const { c, state, her } = make();
  say(her, refused(), 8000);
  assert.equal(state.herald.text, "Couldn't resolve it");
  c.tick(1500);
  say(her, resolved(), 6000);
  assert.equal(state.herald.text, "Resolved", "replaced on screen, not queued behind the refusal");
  assert.equal(her.HQ.filter((x) => x.h.mid === about).length, 0, "nothing of this thread's left waiting");
  c.tick(7000);
  assert.ok(!state.herald || state.herald.until <= c.now() || state.herald.mid !== about || state.herald.text !== "Couldn't resolve it", "the refusal isn't shown after");
});

await t("a refusal waiting behind another Undo is replaced where it waits", () => {
  const { c, state, her } = make();
  her.show({ kind: "done", text: "Stopped the run", undo: () => {} }, 3000);
  say(her, refused(), 8000);
  assert.equal(state.herald.text, "Stopped the run");
  say(her, resolved(), 6000);
  c.tick(3100);
  assert.equal(state.herald.text, "Resolved", "what shows after the other Undo is the newer word");
});

await t("a resolve that works with nothing to say (the All row's) takes the refusal away, on screen or waiting", () => {
  const { c, state, her } = make();
  assert.equal(typeof her.drop, "function", "the herald can take a subject's notice away (drop)");
  say(her, refused(), 8000);
  her.drop(about);
  assert.ok(!state.herald || state.herald.until <= c.now(), "off the screen");
  her.show({ kind: "done", text: "Stopped the run", undo: () => {} }, 3000);
  say(her, refused(), 8000);
  her.drop(about);
  c.tick(3100);
  assert.ok(!state.herald || state.herald.until <= c.now() || state.herald.text !== "Couldn't resolve it", "and gone from the queue");
  assert.equal(her.HQ.length, 0);
});

await t("an unrelated notice is never dropped with this thread's", () => {
  const { state, her } = make();
  her.show({ kind: "done", text: "Stopped the run", undo: () => {} }, 3000);
  her.drop(about);
  assert.equal(state.herald.text, "Stopped the run");
});

await t("the app's resolveThread gives both of its notices the thread's subject, and drops it when it has nothing to say", () => {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const i = app.indexOf("function resolveThread("), body = app.slice(i, app.indexOf("\n}\n", i));
  assert.match(body, /const about = `resolve:\$\{tid\}`/, "one subject per thread");
  assert.match(body, /heraldFor\(about,/, "a notice changed in place first");
  assert.equal((body.match(/mid: about/g) || []).length, 2, "the refusal's and the success's notices both carry it");
  assert.equal((body.match(/else heraldDrop\(about\)/g) || []).length, 2, "an outcome with nothing to say takes the old notice away");
  assert.doesNotMatch(body, /heraldShow\(\{ kind: "(stopped|done)"/, "no notice of a resolve is shown without its subject");
});

console.log(`${passed} passed`);
