// The UI's shape (js/shape.js): merge semantics, per-key fallback, unknown keys, ordering, capability
// gating, versions and the cv-hops migration; and mine kept on Storm (GET/PUT /api/chat/shape, xo-space
// 8c6bc03): read on load, written only on a change, conflicts, the live event, a backend without the route.
// No network: the presets are read from disk, and Storm is a fake.
//   node tests/shape.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { merge, migrate, cleanLayer, createShape, describeShape, everythingLayer, migrateDevice, createShapeStore, changesOf, applyChanges, oneKey, sameDoc, SURFACES, KEYS, SHAPE_VERSION } from "../js/shape.js";

let passed = 0;
const pending = [];
const t = (name, fn) => {
  const done = () => { passed++; console.log("  ok  " + name); };
  const fail = (e) => { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; };
  try { const r = fn(); if (r && r.then) pending.push(r.then(done, fail)); else done(); } catch (e) { fail(e); }
};
const preset = (id) => JSON.parse(readFileSync(new URL(`../presets/${id}.json`, import.meta.url), "utf8"));
const P = (id) => ({ from: "preset", doc: preset(id) });
const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

// ── RFC 7396 ────────────────────────────────────────────────────────────────
t("merge: objects merge, scalars replace, null removes, arrays replace (RFC 7396)", () => {
  assert.deepEqual(merge({ a: "b" }, { a: "c" }), { a: "c" });
  assert.deepEqual(merge({ a: "b" }, { b: "c" }), { a: "b", b: "c" });
  assert.deepEqual(merge({ a: "b" }, { a: null }), {});
  assert.deepEqual(merge({ a: "b", b: "c" }, { a: null }), { b: "c" });
  assert.deepEqual(merge({ a: ["b"] }, { a: "c" }), { a: "c" });
  assert.deepEqual(merge({ a: "c" }, { a: ["b"] }), { a: ["b"] });
  assert.deepEqual(merge({ a: { b: "c" } }, { a: { b: "d", c: null } }), { a: { b: "d" } });
  assert.deepEqual(merge({ a: [{ b: "c" }] }, { a: [1] }), { a: [1] });
  assert.deepEqual(merge(["a", "b"], ["c", "d"]), ["c", "d"]);
  assert.deepEqual(merge({ a: "b" }, ["c"]), ["c"]);
  assert.equal(merge({ a: "foo" }, null), null);
  assert.equal(merge({ a: "foo" }, "bar"), "bar");
  assert.deepEqual(merge({ e: null }, { a: 1 }), { e: null, a: 1 });
  assert.deepEqual(merge([1, 2], { a: "b", c: null }), { a: "b" });
  assert.deepEqual(merge({}, { a: { bb: { ccc: null } } }), { a: { bb: {} } });
});
t("merge never changes its inputs", () => {
  const a = { s: { x: { on: true } } }, b = { s: { x: { on: false }, y: { on: true } } };
  merge(a, b);
  assert.deepEqual(a, { s: { x: { on: true } } });
  assert.deepEqual(b, { s: { x: { on: false }, y: { on: true } } });
});

// ── layers ──────────────────────────────────────────────────────────────────
t("built-in defaults are today's UI: everything on, hops off, raw work, full picker, comfortable", () => {
  const S = createShape([]);
  for (const s of SURFACES) assert.equal(S.on(s.id), s.on, s.id);
  assert.equal(S.on("xo:thread/hops"), false);
  assert.equal(S.opts("xo:thread/work").mode, "raw");
  assert.equal(S.opts("xo:composer/intel").mode, "full");
  assert.equal(S.get("density"), "comfortable");
  assert.equal(S.word("thread"), "thread");
  assert.deepEqual(S.problems, []);
});
t("layers stack lowest first: preset < mine < device, per surface and per key", () => {
  const S = createShape([
    { from: "preset", doc: { preset: 1, surfaces: { "xo:thread/branch": { on: false }, "xo:home/recent": { order: 15 } } } },
    { from: "mine", doc: { surfaces: { "xo:thread/branch": { on: true } } } },
    { from: "device", doc: { density: "compact" } },
  ]);
  assert.equal(S.on("xo:thread/branch"), true, "mine wins over the preset");
  assert.equal(S.opts("xo:home/recent").order, 15, "the preset's other key on the same map survives");
  assert.equal(S.get("density"), "compact");
});
t("surfaces are a map: a preset's new surface reaches someone who changed another", () => {
  const S = createShape([
    { from: "preset", doc: { surfaces: { "xo:panel/map": { on: false } } } },
    { from: "mine", doc: { surfaces: { "xo:thread/runtime": { on: false } } } },
  ]);
  assert.equal(S.on("xo:panel/map"), false);
  assert.equal(S.on("xo:thread/runtime"), false);
});
t("null in a higher layer removes the key: the built-in default shows through", () => {
  const S = createShape([P("marketing"), { from: "mine", doc: { words: { thread: null }, surfaces: { "xo:thread/branch": null } } }]);
  assert.equal(S.word("thread"), "thread");
  assert.equal(S.on("xo:thread/branch"), true);
  assert.equal(S.on("xo:thread/runtime"), false, "the preset's other surfaces stay");
});

// ── fault tolerance ────────────────────────────────────────────────────────
t("a bad value falls back to the layer below for that key only", () => {
  const S = createShape([
    { from: "preset", doc: { density: "compact", surfaces: { "xo:thread/work": { mode: "words" }, "xo:home/recent": { order: 15 } } } },
    { from: "mine", doc: { density: "tiny", surfaces: { "xo:thread/work": { mode: "wordy" }, "xo:home/recent": { order: "first", on: false } } } },
  ]);
  assert.equal(S.get("density"), "compact", "mine's bad density → the preset's");
  assert.equal(S.opts("xo:thread/work").mode, "words", "mine's bad mode → the preset's");
  assert.equal(S.opts("xo:home/recent").order, 15, "mine's bad order → the preset's");
  assert.equal(S.on("xo:home/recent"), false, "mine's good key beside a bad one still applies");
  const paths = S.problems.map((p) => `${p.from}:${p.path}`);
  assert.deepEqual(paths.sort(), ["mine:density", "mine:surfaces › xo:home/recent › order", "mine:surfaces › xo:thread/work › mode"]);
  assert.match(S.problems.find((p) => p.path === "density").text, /isn't comfortable or compact/);
});
t("unknown keys are ignored and listed; nothing else is lost", () => {
  const S = createShape([{ from: "mine", doc: { theme: "neon", surfaces: { "xo:sidebar/everything": { on: false }, "xo:thread/branch": { on: false, colour: "red" } }, words: { project: "client" } } }]);
  assert.equal(S.on("xo:thread/branch"), false);
  assert.equal(S.word("project"), "project");
  const unknown = S.problems.filter((p) => p.ignored).map((p) => p.path).sort();
  assert.deepEqual(unknown, ["surfaces › xo:sidebar/everything", "surfaces › xo:thread/branch › colour", "theme", "words › project"]);
});
t("a surface you need can't be switched off, only changed", () => {
  const S = createShape([{ from: "mine", doc: { surfaces: { "xo:thread/work": { on: false, mode: "words" }, "xo:settings/rules": { on: false } } } }]);
  assert.equal(S.on("xo:thread/work"), true);
  assert.equal(S.opts("xo:thread/work").mode, "words");
  assert.equal(S.on("xo:settings/rules"), true);
  assert.equal(S.problems.length, 2);
});
t("a layer that isn't an object is ignored whole, and listed", () => {
  const S = createShape([{ from: "mine", doc: ["compact"] }, { from: "device", doc: "x" }]);
  assert.equal(S.get("density"), "comfortable");
  assert.equal(S.problems.length, 2);
});
t("the chosen preset is named in mine, never per device", () => {
  const S = createShape([{ from: "mine", doc: { preset: "marketing" } }, { from: "device", doc: { preset: "engineering" } }]);
  assert.equal(S.get("preset"), "marketing");
  assert.equal(S.problems.length, 1);
  assert.equal(S.problems[0].from, "device");
});
t("apps and their surfaces are kept as data (inert); a bad app id or enable is listed", () => {
  const S = createShape([{ from: "preset", doc: { preset: 1, apps: { "space.xo.design": { version: "^0.4", enable: "sometimes" }, "Not An Id": {} }, surfaces: { "space.xo.design:inspect": { on: true } } } }]);
  assert.deepEqual(S.get("apps"), { "space.xo.design": { version: "^0.4" } });
  assert.equal(S.on("space.xo.design:inspect"), false, "apps aren't built: nothing of theirs shows");
  assert.equal(S.problems.length, 2);
});

// ── order, slots, capabilities ──────────────────────────────────────────────
t("list(slot): only what's on, by order; ties keep the registry's order", () => {
  const S = createShape([{ from: "mine", doc: { surfaces: { "xo:home/recent": { order: 15 } } } }]);
  assert.deepEqual(S.list("home").map((s) => s.id), ["xo:home/next", "xo:home/recent", "xo:home/handled"]);
  const T = createShape([{ from: "mine", doc: { surfaces: { "xo:home/recent": { order: 20 }, "xo:home/handled": { on: false } } } }]);
  assert.deepEqual(T.list("home").map((s) => s.id), ["xo:home/next", "xo:home/recent"]);
  const U = createShape([{ from: "mine", doc: { surfaces: { "xo:home/recent": { order: 20 } } } }]);
  assert.deepEqual(U.list("home").map((s) => s.id), ["xo:home/next", "xo:home/handled", "xo:home/recent"], "a tie keeps registry order");
  assert.deepEqual(S.list("panel").map((s) => s.id), ["xo:panel/agents", "xo:panel/map", "xo:panel/changes"]);
});
t("capabilities: a surface the backend can't do stays away, whatever the shape says", () => {
  const off = createShape([{ from: "mine", doc: { surfaces: { "xo:dock/shells": { on: true } } } }], new Set());
  assert.equal(off.on("xo:dock/shells"), false);
  const on = createShape([], new Set(["terminal"]));
  assert.equal(on.on("xo:dock/shells"), true);
  const live = { has: (c) => c === "terminal" && flag };
  let flag = false;
  const S = createShape([], live);
  assert.equal(S.on("xo:dock/shells"), false);
  flag = true;
  assert.equal(S.on("xo:dock/shells"), true, "caps are asked each time, so they can follow the backend");
  const wanted = createShape([{ from: "mine", doc: { surfaces: { "xo:dock/shells": { on: false } } } }], new Set(["terminal"]));
  assert.equal(wanted.on("xo:dock/shells"), false, "and the shape can hide what the backend has");
  assert.deepEqual(createShape([], new Set()).list("dock"), []);
});

// ── words ───────────────────────────────────────────────────────────────────
t("word(): the shape's noun, keeping capitals and plurals; unknown words pass through", () => {
  const S = createShape([P("marketing")]);
  assert.equal(S.word("thread"), "task");
  assert.equal(S.word("Thread"), "Task");
  assert.equal(S.word("threads"), "tasks");
  assert.equal(S.word("Threads"), "Tasks");
  assert.equal(S.word("project"), "project");
  assert.equal(createShape([]).word("Threads"), "Threads");
});

// ── the two presets ─────────────────────────────────────────────────────────
t("both preset files are clean: no problems, only XO surfaces that exist", () => {
  for (const id of ["engineering", "marketing"]) {
    const r = cleanLayer(preset(id), "preset");
    assert.deepEqual(r.problems, [], id);
    assert.equal(preset(id).id, id);
  }
});
t("Engineering: today's receipts, plus hops, compact", () => {
  const S = createShape([P("engineering")], new Set(["terminal"]));
  for (const id of ["xo:thread/branch", "xo:thread/runtime", "xo:thread/subagents", "xo:thread/hops", "xo:dock/shells", "xo:panel/map", "xo:panel/changes"]) assert.equal(S.on(id), true, id);
  assert.equal(S.opts("xo:thread/work").mode, "raw");
  assert.equal(S.get("density"), "compact");
  assert.deepEqual(describeShape(createShape([]), createShape([P("engineering")])), ["Shows how messages travel.", "Compact: tighter rows and smaller reading text."]);
});
t("Marketing: plain words, no receipts, Recently made above Handled, technical Settings under Advanced", () => {
  const S = createShape([P("marketing")], new Set(["terminal"]));
  for (const id of ["xo:thread/branch", "xo:thread/runtime", "xo:thread/subagents", "xo:thread/hops", "xo:dock/shells", "xo:panel/map", "xo:panel/changes"]) assert.equal(S.on(id), false, id);
  assert.equal(S.on("xo:panel/agents"), true);
  assert.equal(S.opts("xo:thread/work").mode, "words");
  assert.equal(S.opts("xo:composer/intel").mode, "simple");
  assert.deepEqual(S.list("home").map((s) => s.id), ["xo:home/next", "xo:home/recent", "xo:home/handled"]);
  assert.deepEqual(S.list("settings").filter((s) => s.advanced).map((s) => s.id), ["xo:settings/routing", "xo:settings/rules", "xo:settings/worktrees"]);
  const d = describeShape(createShape([]), S);
  assert.equal(d[0], "Hides branch chips, runtime names, sub-agent counts, raw commands, Shells, the panel's Map and the panel's Changes.");
  assert.ok(d.includes("Says “task” for “thread”."));
  assert.ok(d.includes("Puts Recently made above Handled on Home."));
  assert.ok(d.includes("Moves Routing, Rules and Worktrees under Advanced in Settings."));
});
t("Show everything: every surface on over any preset, XO's own words", () => {
  const S = createShape([P("marketing"), { from: "mine", doc: everythingLayer("marketing") }], new Set(["terminal"]));
  for (const s of SURFACES) assert.equal(S.on(s.id), true, s.id);
  assert.equal(S.opts("xo:thread/work").mode, "raw");
  assert.equal(S.opts("xo:composer/intel").mode, "full");
  assert.equal(S.word("thread"), "thread");
  assert.equal(S.list("settings").some((s) => s.advanced), false);
  assert.deepEqual(S.problems, []);
});

// ── versions ────────────────────────────────────────────────────────────────
t("versions: older documents migrate step by step; newer ones are read, flagged, never written", () => {
  const steps = { 0: (d) => ({ ...d, density: d.dense ? "compact" : "comfortable", dense: undefined }) };
  const m = migrate({ shape: 0, dense: true }, "shape", 0, steps);
  assert.equal(m.shape, SHAPE_VERSION);
  assert.equal(m.density, "compact");
  const r = cleanLayer({ shape: 0, density: "compact" }, "mine");
  assert.equal(r.newer, false);
  assert.equal(r.layer.density, "compact");
  const n = cleanLayer({ shape: 99, density: "compact", hologram: true }, "mine");
  assert.equal(n.newer, true);
  assert.equal(n.layer.density, "compact", "what it understands is used");
  assert.ok(n.problems.some((p) => /newer XO/.test(p.text)));
  const S = createShape([{ from: "mine", doc: { shape: 99 } }]);
  assert.ok(S.newer.has("mine"));
  const bad = cleanLayer({ shape: "one" }, "mine");
  assert.equal(bad.problems.length, 1);
  const p = cleanLayer({ preset: 0, id: "x", name: "X", summary: "y", density: "compact" }, "preset");
  assert.deepEqual(p.problems, []);
  assert.deepEqual(p.layer, { density: "compact" }, "a preset's own label isn't part of the shape");
});
t("cv-hops folds into this device's layer once; the old key stays", () => {
  assert.deepEqual(migrateDevice(mem({ "cv-hops": "1" })), { shape: 1, surfaces: { "xo:thread/hops": { on: true } } });
  assert.deepEqual(migrateDevice(mem({ "cv-hops": "0" })), { shape: 1, surfaces: { "xo:thread/hops": { on: false } } });
  assert.deepEqual(migrateDevice(mem()), { shape: 1 });
  const st = mem({ "cv-hops": "1" });
  const S = createShapeStore({ storage: st, load: async () => { throw new Error("offline"); } });
  assert.equal(S.on("xo:thread/hops"), true);
  assert.equal(st.getItem("cv-hops"), "1", "the old key is left in place");
  assert.ok(st.getItem(KEYS.device));
  st.setItem("cv-hops", "0");
  const again = createShapeStore({ storage: st, load: async () => ({}) });
  assert.equal(again.on("xo:thread/hops"), true, "folded in once: a later cv-hops write doesn't come back in");
});

// ── the store ───────────────────────────────────────────────────────────────
t("store: first run until a preset is chosen; choosing reads the file, caches it, and applies", async () => {
  const st = mem();
  const reads = [];
  const load = async (id) => { reads.push(id); return preset(id); };
  const S = createShapeStore({ storage: st, load, caps: new Set(["terminal"]) });
  await S.ready;
  assert.equal(S.chosen, false);
  let changes = 0;
  S.onChange(() => changes++);
  await S.choose("marketing");
  assert.equal(S.chosen, true);
  assert.equal(S.presetId, "marketing");
  assert.equal(S.on("xo:dock/shells"), false);
  assert.equal(changes, 1);
  assert.deepEqual(JSON.parse(st.getItem(KEYS.mine)), { shape: 1, preset: "marketing" });
  assert.equal(JSON.parse(st.getItem(KEYS.preset)).id, "marketing");
  // a reload paints from the cache before the file is read again
  const R = createShapeStore({ storage: st, load: () => new Promise(() => {}), caps: new Set(["terminal"]) });
  assert.equal(R.on("xo:dock/shells"), false, "the cached preset shapes the first paint");
  assert.equal(R.word("thread"), "task");
});
test_store_more();
function test_store_more() {
  t("store: dismissing the question is Everything (no file read); Reset and Show everything", async () => {
    const st = mem({ "cv-hops": "0" });
    const S = createShapeStore({ storage: st, load: async (id) => preset(id), caps: new Set(["terminal"]) });
    await S.choose("everything");
    assert.equal(S.chosen, true);
    assert.deepEqual(S.problems, []);
    await S.choose("engineering");
    assert.equal(S.on("xo:thread/hops"), false, "this device's own choice (cv-hops 0) still wins over the preset");
    S.resetToPreset();
    assert.equal(S.on("xo:thread/hops"), true, "Reset to preset: exactly the preset");
    assert.equal(S.presetId, "engineering");
    assert.equal(createShapeStore({ storage: st, load: async () => ({}) }).on("xo:thread/hops"), true, "and cv-hops isn't folded in again");
    await S.choose("marketing");
    S.showEverything();
    assert.equal(S.on("xo:thread/branch"), true);
    assert.equal(S.presetId, "marketing", "Show everything keeps your preset, for Reset");
    assert.ok(S.ownKeys().length);
    S.resetToPreset();
    assert.equal(S.on("xo:thread/branch"), false);
    assert.deepEqual(S.ownKeys(), []);
  });
  t("store: Edit as JSON and this device's switch; a preset that can't be read shows everything and says why", async () => {
    const st = mem();
    const S = createShapeStore({ storage: st, load: async (id) => { if (id === "ghost") throw new Error("there's no such preset"); return preset(id); } });
    const r = await S.setMine({ preset: "marketing", surfaces: { "xo:thread/branch": { on: true } }, typo: 1 });
    assert.ok(r.ok);
    assert.equal(S.on("xo:thread/branch"), true);
    assert.equal(S.on("xo:thread/runtime"), false);
    assert.equal(S.problems.length, 1);
    assert.equal((await S.setMine([1])).error.length > 0, true);
    S.setDevice({ density: "compact" });
    assert.equal(S.get("density"), "compact");
    assert.equal(JSON.parse(st.getItem(KEYS.device)).density, "compact");
    await S.setMine({ preset: "ghost" });
    assert.equal(S.on("xo:thread/runtime"), true, "no file: the built-in defaults");
    assert.match(S.problems[0].text, /couldn't be read/);
  });
  t("store: a newer XO's document is never written over", async () => {
    const st = mem({ [KEYS.mine]: JSON.stringify({ shape: 7, preset: "engineering", density: "compact" }) });
    const S = createShapeStore({ storage: st, load: async (id) => preset(id) });
    const r = await S.choose("marketing");
    assert.ok(r.error);
    assert.equal(JSON.parse(st.getItem(KEYS.mine)).shape, 7);
    assert.equal(S.get("density"), "compact");
  });
}

// ── mine on Storm ─────────────────────────────────────────────────────────────
t("changesOf: one change per leaf (a switch inside surfaces is its own key); null is a value; removals listed", () => {
  assert.deepEqual(changesOf({ shape: 1, preset: "m" }, { shape: 1, preset: "m", surfaces: { "xo:thread/branch": { on: true } } }), [{ path: ["surfaces", "xo:thread/branch", "on"], value: true }]);
  assert.deepEqual(changesOf({ shape: 1, preset: "m" }, { shape: 1, preset: "e" }), [{ path: ["preset"], value: "e" }]);
  assert.deepEqual(changesOf({ density: "compact", surfaces: { a: { on: true } } }, {}), [{ path: ["density"], gone: true }, { path: ["surfaces", "a", "on"], gone: true }]);
  assert.deepEqual(changesOf({}, { words: { thread: null } }), [{ path: ["words", "thread"], value: null }]);
  assert.deepEqual(changesOf({ layout: { dock: ["a"] } }, { layout: { dock: ["a", "b"] } }), [{ path: ["layout", "dock"], value: ["a", "b"] }]); // a list is one value
  assert.deepEqual(changesOf(null, null), []);
  assert.ok(sameDoc({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 }) && !sameDoc({ a: 1 }, { a: 2 }) && sameDoc(null, undefined));
});
t("applyChanges: on top of another document, null kept as a value, an emptied object gone; oneKey", () => {
  const theirs = { shape: 1, preset: "marketing", surfaces: { "xo:home/handled": { on: false } } };
  const mineCh = changesOf({ shape: 1, preset: "marketing" }, { shape: 1, preset: "marketing", surfaces: { "xo:thread/branch": { on: true } } });
  assert.deepEqual(applyChanges(theirs, mineCh), { shape: 1, preset: "marketing", surfaces: { "xo:home/handled": { on: false }, "xo:thread/branch": { on: true } } });
  assert.deepEqual(theirs.surfaces, { "xo:home/handled": { on: false } }, "never changes its input");
  assert.deepEqual(applyChanges({ words: { thread: "task" } }, [{ path: ["words", "thread"], value: null }]), { words: { thread: null } });
  assert.deepEqual(applyChanges({ surfaces: { a: { on: true } }, x: 1 }, [{ path: ["surfaces", "a", "on"], gone: true }]), { x: 1 });
  assert.equal(oneKey(mineCh), true);
  assert.equal(oneKey([{ path: ["density"], value: "compact" }, { path: ["density"], value: "comfortable" }]), true, "the same key set twice is still one");
  assert.equal(oneKey([{ path: ["preset"], value: "e" }, { path: ["density"], gone: true }]), false);
  assert.equal(oneKey([]), false);
});

/** A fake Storm behind the shape route: it keeps one document, checks if_version, and records every call. */
function fakeStorm({ doc = null, route = true } = {}) {
  let stored = doc;
  const calls = [];
  const version = (d) => { if (d == null) return "new"; let h = 5381; for (const c of JSON.stringify(d)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(12, "0").slice(-12); };
  const view = () => ({ shape: stored == null ? null : JSON.parse(JSON.stringify(stored)), version: version(stored), updated_at: stored == null ? null : "2026-11-04T17:00:00Z" });
  const err = (status, code, extra = {}) => Object.assign(new Error(code), { status, code, ...extra });
  const F = {
    calls, view, err,
    next: { get: [], put: [] },           // one-off answers (functions), in order
    set(d) { stored = d; },               // another device saves
    get stored() { return stored; },
    async get() {
      calls.push(["GET"]);
      if (F.next.get.length) return F.next.get.shift()();
      if (!route) throw err(404, "http_404");
      return view();
    },
    async put(body) {
      calls.push(["PUT", JSON.parse(JSON.stringify(body))]);
      if (F.next.put.length) await F.next.put.shift()();
      if (!route) throw err(404, "http_404");
      if (body.if_version != null && body.if_version !== version(stored)) throw err(409, "shape_changed", { current: view() });
      stored = body.shape;
      return view();
    },
  };
  return F;
}
const puts = (F) => F.calls.filter((c) => c[0] === "PUT");
const store = (opts) => { const notes = []; const S = createShapeStore({ load: async (id) => preset(id), notice: (n) => notes.push(n), ...opts }); return { S, notes }; };

t("Storm without the route (404): this browser's copy, as before; nothing is written, on load or on a change", async () => {
  const st = mem({ [KEYS.mine]: JSON.stringify({ shape: 1, preset: "marketing" }) });
  const F = fakeStorm({ route: false });
  const { S, notes } = store({ storage: st, remote: F });
  assert.equal(S.presetId, "marketing", "the first paint is this browser's copy");
  await S.ready;
  assert.equal(S.sync.mode, "off");
  await S.choose("engineering");
  S.setDevice({ density: "comfortable" });
  await S.settled();
  assert.deepEqual(F.calls, [["GET"]]);
  assert.deepEqual(JSON.parse(st.getItem(KEYS.mine)), { shape: 1, preset: "engineering" });
  assert.deepEqual(notes, []);
});
t("a read that fails (not a 404) keeps this browser's copy; a change reads again, then writes with that version", async () => {
  const doc = { shape: 1, preset: "marketing" };
  const st = mem({ [KEYS.mine]: JSON.stringify(doc) });
  const F = fakeStorm({ doc });
  F.next.get.push(() => { throw F.err(0, "network"); });
  const { S } = store({ storage: st, remote: F });
  await S.ready;
  assert.equal(S.sync.mode, "unknown");
  assert.equal(S.presetId, "marketing");
  await S.choose("engineering");
  await S.settled();
  assert.deepEqual(F.calls.map((c) => c[0]), ["GET", "GET", "PUT"]);
  assert.deepEqual(puts(F)[0][1], { shape: { shape: 1, preset: "engineering" }, if_version: fakeStorm({ doc }).view().version });
  assert.equal(S.sync.mode, "on");
  assert.deepEqual(F.stored, { shape: 1, preset: "engineering" });
});
t("Storm's shape is yours here: adopted on load and cached, nothing written; your change is a PUT with if_version", async () => {
  const theirs = { shape: 1, preset: "marketing", density: "compact" };
  const st = mem({ [KEYS.mine]: JSON.stringify({ shape: 1, preset: "everything" }) });
  const F = fakeStorm({ doc: theirs });
  const v0 = F.view().version;
  const { S } = store({ storage: st, remote: F, caps: new Set(["terminal"]) });
  let changes = 0;
  S.onChange(() => changes++);
  await S.ready;
  assert.equal(S.presetId, "marketing");
  assert.equal(S.get("density"), "compact");
  assert.equal(S.on("xo:dock/shells"), false, "the preset Storm's shape names is read and applied");
  assert.ok(changes >= 1, "the page is told");
  assert.deepEqual(JSON.parse(st.getItem(KEYS.mine)), theirs, "the copy here follows Storm's");
  assert.deepEqual(F.calls, [["GET"]], "a load only reads");
  S.setDevice({ density: "comfortable" });
  await S.settled();
  assert.equal(puts(F).length, 0, "this device's layer stays here");
  await S.choose("engineering");
  await S.settled();
  assert.deepEqual(puts(F).map((c) => c[1]), [{ shape: { shape: 1, preset: "engineering" }, if_version: v0 }]);
  assert.equal(S.sync.version, F.view().version, "the version it answered is the next write's");
  const v1 = S.sync.version;
  S.showEverything();
  await S.settled();
  assert.equal(puts(F).length, 2);
  assert.equal(puts(F)[1][1].if_version, v1);
  assert.deepEqual(F.stored.surfaces["xo:thread/branch"], { on: true });
});
t("a fresh browser waits for Storm's answer: a shape chosen on another device means no first-run question", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "engineering" } });
  const { S } = store({ storage: mem(), remote: F });
  assert.equal(S.chosen, false, "before the read: nothing here yet");
  await S.synced;
  assert.equal(S.chosen, true);
  assert.equal(S.presetId, "engineering");
  assert.deepEqual(F.calls, [["GET"]]);
});
t("Storm has none and this browser has one: nothing offered or uploaded on load; the first change uploads it as new", async () => {
  const local = { shape: 1, preset: "marketing", surfaces: { "xo:thread/branch": { on: true } } };
  const st = mem({ [KEYS.mine]: JSON.stringify(local) });
  const F = fakeStorm({ doc: null });
  const { S, notes } = store({ storage: st, remote: F });
  await S.ready;
  await S.settled();
  assert.deepEqual(F.calls, [["GET"]]);
  assert.equal(S.sync.mode, "on");
  assert.equal(S.sync.version, "new");
  assert.deepEqual(S.mine, local, "kept as it is");
  assert.equal(S.on("xo:thread/branch"), true);
  await S.setMine({ ...local, density: "compact" });
  await S.settled();
  assert.deepEqual(puts(F).map((c) => c[1]), [{ shape: { ...local, density: "compact" }, if_version: "new" }]);
  assert.deepEqual(F.stored, { ...local, density: "compact" });
  assert.deepEqual(notes, []);
});
t("another device saved first, and the change is one key: Storm's is taken, the change goes back on top, said quietly", async () => {
  const d0 = { shape: 1, preset: "marketing" };
  const F = fakeStorm({ doc: d0 });
  const { S, notes } = store({ storage: mem(), remote: F });
  await S.ready;
  F.set({ shape: 1, preset: "marketing", surfaces: { "xo:home/handled": { on: false } } }); // the phone, unheard yet
  const v1 = F.view().version;
  await S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await S.settled();
  assert.deepEqual(puts(F).map((c) => c[1].if_version), [fakeStorm({ doc: d0 }).view().version, v1], "the second write is on Storm's version");
  assert.deepEqual(F.stored, { shape: 1, preset: "marketing", surfaces: { "xo:home/handled": { on: false } }, density: "compact" });
  assert.deepEqual(S.mine, F.stored);
  assert.equal(S.on("xo:home/handled"), false, "the other device's change shows here");
  assert.equal(S.get("density"), "compact", "and yours is still on top");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].text, "Your shape changed on another device");
  assert.match(notes[0].sub, /kept on top/);
});
t("another device saved first, and the change is larger (a preset switch clearing your own): Storm's stays, said quietly", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing", density: "compact" } });
  const { S, notes } = store({ storage: mem(), remote: F });
  await S.ready;
  F.set({ shape: 1, preset: "engineering" });
  await S.choose("everything");
  await S.settled();
  assert.equal(puts(F).length, 1, "no second write");
  assert.deepEqual(F.stored, { shape: 1, preset: "engineering" });
  assert.equal(S.presetId, "engineering", "this device shows Storm's");
  assert.match(notes[0].sub, /wasn't kept/);
});
t("another device's change on the stream applies at once, then its version is read; our own echo changes nothing", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const st = mem();
  const { S } = store({ storage: st, remote: F });
  await S.ready;
  let changes = 0;
  S.onChange(() => changes++);
  const phone = { shape: 1, preset: "marketing", density: "compact" };
  F.set(phone);
  S.heard({ doc: phone, updated_at: "2026-11-04T17:01:00Z" });
  assert.equal(S.get("density"), "compact", "at once, without a reload");
  assert.equal(changes, 1);
  assert.deepEqual(JSON.parse(st.getItem(KEYS.mine)), phone, "and cached");
  await S.settled();
  assert.equal(S.sync.version, F.view().version, "the event has no version: it's read");
  assert.equal(puts(F).length, 0, "hearing never writes");
  await S.setMine({ ...phone, preset: "engineering" });
  await S.settled();
  const reads = F.calls.length;
  S.heard({ doc: F.stored, updated_at: "2026-11-04T17:02:00Z" }); // our own write, echoed
  await S.settled();
  assert.equal(F.calls.length, reads, "nothing read or written for an echo");
  assert.equal(changes, 2);
  // cleared on another device while this one follows Storm: cleared here too
  F.set(null);
  S.heard(null);
  assert.equal(S.mine, null);
  assert.equal(S.chosen, false);
});
t("an event heard while a write is on its way waits for it: the conflict settles both", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const { S, notes } = store({ storage: mem(), remote: F });
  await S.ready;
  let open;
  F.next.put.push(() => new Promise((r) => { open = r; }));
  const done = S.setMine({ shape: 1, preset: "marketing", surfaces: { "xo:thread/branch": { on: false } } });
  await done;
  const phone = { shape: 1, preset: "marketing", density: "compact" };
  F.set(phone);
  S.heard({ doc: phone });
  assert.equal(S.get("density"), "comfortable", "not applied under a write on its way");
  assert.equal(S.on("xo:thread/branch"), false, "your change still shows");
  open();
  await S.settled();
  assert.deepEqual(F.stored, { shape: 1, preset: "marketing", density: "compact", surfaces: { "xo:thread/branch": { on: false } } });
  assert.deepEqual(S.mine, F.stored);
  assert.match(notes[0].sub, /kept on top/);
});
t("a write Storm refuses (413, 400) or can't take stays on this device, said quietly; nothing is lost here", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const st = mem();
  const { S, notes } = store({ storage: st, remote: F });
  await S.ready;
  F.next.put.push(() => { throw F.err(413, "shape_too_large"); });
  await S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await S.settled();
  assert.equal(S.get("density"), "compact");
  assert.equal(JSON.parse(st.getItem(KEYS.mine)).density, "compact");
  assert.deepEqual(F.stored, { shape: 1, preset: "marketing" });
  assert.equal(notes[0].text, "XO refused your shape change", "a refusal says so plainly, never that it's saved");
  assert.match(notes[0].sub, /64 KB, and this one is larger\. It's kept on this device only/);
  assert.deepEqual(S.held, { why: "refused", text: "XO keeps a shape of up to 64 KB, and this one is larger.", kept: true });
  F.next.put.push(() => { throw Object.assign(new Error("The shape nests deeper than 12 levels."), { status: 400, code: "bad_shape" }); });
  await S.setMine({ shape: 1, preset: "marketing", density: "comfortable" });
  await S.settled();
  assert.match(notes[1].sub, /deeper than 12 levels\. It's kept on this device only: your other devices/);
  // the next change tries again, with everything here
  await S.setMine({ shape: 1, preset: "engineering", density: "comfortable" });
  await S.settled();
  assert.deepEqual(F.stored, { shape: 1, preset: "engineering", density: "comfortable" });
});
t("pictures from the web: on by default and in both presets; this device can turn them off (they're links then)", () => {
  assert.equal(createShape([]).on("xo:conversation/webpics"), true);
  for (const id of ["engineering", "marketing"]) assert.equal(createShape([P(id)]).on("xo:conversation/webpics"), true, id);
  const off = createShape([P("marketing"), { from: "device", doc: { surfaces: { "xo:conversation/webpics": { on: false } } } }]);
  assert.equal(off.on("xo:conversation/webpics"), false);
  assert.deepEqual(off.problems, []);
});
t("Storm gains the route while a page is open (a restart): the first ui.shape event reads it and follows it", async () => {
  const F = fakeStorm({ route: false });
  const { S } = store({ storage: mem({ [KEYS.mine]: JSON.stringify({ shape: 1, preset: "marketing" }) }), remote: F });
  await S.ready;
  assert.equal(S.sync.mode, "off");
  const phone = { shape: 1, preset: "engineering" };
  F.next.get.push(() => ({ shape: phone, version: "0123456789ab", updated_at: null }));
  S.heard({ doc: phone });
  await S.settled();
  assert.deepEqual([S.sync.mode, S.sync.version, S.presetId], ["on", "0123456789ab", "engineering"]);
  assert.equal(puts(F).length, 0);
});
t("no load ever writes: whatever Storm and this browser hold, a page load is one GET", async () => {
  const docs = [null, { shape: 1, preset: "marketing" }];
  for (const theirs of docs) for (const local of docs) for (const route of [true, false]) {
    const F = fakeStorm({ doc: theirs, route });
    const { S } = store({ storage: mem(local ? { [KEYS.mine]: JSON.stringify(local) } : {}), remote: F });
    await S.ready;
    await S.settled();
    assert.deepEqual(F.calls, [["GET"]], JSON.stringify({ theirs, local, route }));
  }
});

// ── what outlives a reload (owner, 2026-11-08: apply it and say it won't survive a reload; queue failed saves and retry) ──
/** A browser storage that refuses writes to the shape's keys (full, or switched off), and reads as usual. */
const refusing = (init = {}) => { const m = mem(init); return { ...m, setItem: (k, v) => { if (String(k).startsWith("cv-shape")) throw Object.assign(new Error("QuotaExceededError"), { name: "QuotaExceededError" }); m.setItem(k, v); } }; };
t("a change this browser can't keep still applies, and says so (kept: false); with Storm keeping mine, mine is kept", async () => {
  const st = refusing({ [KEYS.mine]: JSON.stringify({ shape: 1, preset: "everything" }) });
  const { S } = store({ storage: st });
  const r = S.setDevice({ density: "compact" });
  assert.deepEqual(r, { ok: true, kept: false });
  assert.equal(S.get("density"), "compact", "it applies now");
  assert.equal(st.getItem(KEYS.device), null, "and nothing was stored");
  assert.deepEqual(await S.choose("marketing"), { ok: true, kept: false }, "no Storm: mine can't outlive a reload either");
  assert.deepEqual(S.resetToPreset(), { ok: true, kept: false });
  assert.deepEqual(S.showEverything(), { ok: true, kept: false });
  // where Storm keeps mine, a change of mine is kept there (the device layer still isn't)
  const F = fakeStorm({ doc: { shape: 1, preset: "everything" } });
  const on = store({ storage: refusing(), remote: F }).S;
  await on.ready;
  assert.deepEqual(await on.choose("marketing"), { ok: true, kept: true });
  assert.deepEqual(on.setDevice({ density: "compact" }), { ok: true, kept: false });
  await on.settled();
  assert.equal(F.stored.preset, "marketing");
  // a storage that takes it: kept
  assert.deepEqual(store({ storage: mem() }).S.setDevice({ density: "compact" }), { ok: true, kept: true });
});
t("a write XO couldn't take (503) is held here, so a reload doesn't read Storm's older shape over it; it's sent again", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const st = mem();
  const first = store({ storage: st, remote: F });
  await first.S.ready;
  F.next.put.push(() => { throw F.err(503, "unavailable"); });
  await first.S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await first.S.settled();
  assert.deepEqual(first.S.held, { why: "unreachable", text: "XO couldn't be reached.", kept: true });
  assert.deepEqual(F.stored, { shape: 1, preset: "marketing" }, "Storm still has the old one");
  assert.match(first.notes[0].sub, /sent again when XO answers/);
  assert.ok(st.getItem(KEYS.unsynced), "held where a reload finds it");
  // the reload: Storm's older shape is read, not taken over the change; the change goes again, once
  const again = store({ storage: st, remote: F });
  assert.equal(again.S.get("density"), "compact", "the first paint keeps it");
  await again.S.ready;
  await again.S.settled();
  assert.equal(again.S.get("density"), "compact", "and the read didn't take it away");
  assert.deepEqual(F.stored, { shape: 1, preset: "marketing", density: "compact" }, "it reached Storm");
  assert.equal(st.getItem(KEYS.unsynced), null, "nothing held any more");
  assert.equal(again.S.held, null);
  assert.equal(again.notes.at(-1).text, "Your shape is saved");
});
t("held, then another device saved first: the reload's read is a conflict (one key goes back on top), never a silent loss", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const st = mem();
  const first = store({ storage: st, remote: F });
  await first.S.ready;
  F.next.put.push(() => { throw F.err(0, "network"); });
  await first.S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await first.S.settled();
  F.set({ shape: 1, preset: "engineering" }); // the phone switched preset meanwhile
  const again = store({ storage: st, remote: F });
  await again.S.ready;
  await again.S.settled();
  assert.deepEqual(F.stored, { shape: 1, preset: "engineering", density: "compact" }, "the phone's, with this change on top");
  assert.equal(again.S.presetId, "engineering");
  assert.equal(again.S.get("density"), "compact");
  assert.match(again.notes[0].sub, /kept on top/);
  assert.equal(st.getItem(KEYS.unsynced), null);
});
t("a write XO refused (413) stays on this device across a reload: the load only reads, and the next change sends it all", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const st = mem();
  const first = store({ storage: st, remote: F });
  await first.S.ready;
  F.next.put.push(() => { throw F.err(413, "shape_too_large"); });
  await first.S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await first.S.settled();
  assert.equal(first.S.held.why, "refused");
  const calls = F.calls.length;
  const again = store({ storage: st, remote: F });
  await again.S.ready;
  await again.S.settled();
  assert.deepEqual(F.calls.slice(calls).map((c) => c[0]), ["GET"], "a refused change isn't sent again by itself");
  assert.deepEqual(again.S.held, { why: "refused", text: "XO keeps a shape of up to 64 KB, and this one is larger.", kept: true }, "and after a reload it still says why");
  assert.equal(again.S.get("density"), "compact", "and the read didn't take it away");
  await again.S.setMine({ shape: 1, preset: "engineering", density: "compact" });
  await again.S.settled();
  assert.deepEqual(F.stored, { shape: 1, preset: "engineering", density: "compact" });
  assert.equal(st.getItem(KEYS.unsynced), null);
});
t("held while the page stays open: the next read that reaches Storm (a stream event) sends it again", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const { S, notes } = store({ storage: mem(), remote: F });
  await S.ready;
  F.next.put.push(() => { throw F.err(502, "bad_gateway"); });
  await S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await S.settled();
  assert.equal(S.held.why, "unreachable");
  S.heard({ doc: { shape: 1, preset: "marketing" } }); // XO is back: an event, then a read
  await S.settled();
  await S.settled();
  assert.deepEqual(F.stored, { shape: 1, preset: "marketing", density: "compact" });
  assert.equal(S.held, null);
  assert.equal(notes.at(-1).text, "Your shape is saved");
});
t("neither kept here nor taken by XO: it says so plainly, never \"saved on this device\"", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const { S, notes } = store({ storage: refusing(), remote: F });
  await S.ready;
  F.next.put.push(() => { throw F.err(503, "unavailable"); });
  await S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await S.settled();
  assert.equal(notes[0].text, "Your shape isn't saved");
  assert.match(notes[0].sub, /won't keep it after a reload, and XO couldn't be reached/);
});

// ── Astra on a63139f: held changes across an offline reload, an unkept note, both refusing, a replacement in flight ──
t("a reload while XO can't be reached, with a change held: the retry is scheduled, and it lands once XO answers", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const st = mem();
  const first = store({ storage: st, remote: F });
  await first.S.ready;
  F.next.put.push(() => { throw F.err(503, "unavailable"); });
  await first.S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await first.S.settled();
  // the reload's read fails too (offline): nothing else will come along to send it, so its own timer must
  F.next.get.push(() => { throw F.err(0, "network"); });
  const again = store({ storage: st, remote: F, retryMs: [20] });
  await again.S.ready;
  await again.S.settled();
  assert.equal(again.S.held.why, "unreachable");
  for (let i = 0; i < 50 && F.stored.density !== "compact"; i++) await new Promise((r) => setTimeout(r, 10));
  await again.S.settled();
  assert.deepEqual(F.stored, { shape: 1, preset: "marketing", density: "compact" }, "sent again by itself");
  assert.equal(again.S.held, null);
});
t("held, but this browser couldn't keep the note of it: never \"kept on this device\", it says a reload loses it", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const base = mem();
  const st = { ...base, setItem: (k, v) => { if (k === KEYS.unsynced) throw new Error("QuotaExceededError"); base.setItem(k, v); } };
  const { S, notes } = store({ storage: st, remote: F });
  await S.ready;
  F.next.put.push(() => { throw F.err(503, "unavailable"); });
  await S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await S.settled();
  assert.deepEqual(S.held, { why: "unreachable", text: "XO couldn't be reached.", kept: false });
  assert.equal(notes[0].text, "Your shape isn't saved");
  assert.match(notes[0].sub, /won't keep it after a reload/);
});
t("XO refused it and this browser couldn't keep it either: what's held says so (kept: false), as the notice does", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const refusingAll = { ...mem(), setItem: (k) => { if (String(k).startsWith("cv-shape")) throw new Error("QuotaExceededError"); } };
  const { S, notes } = store({ storage: refusingAll, remote: F });
  await S.ready;
  F.next.put.push(() => { throw F.err(413, "shape_too_large"); });
  await S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await S.settled();
  assert.equal(S.held.why, "refused");
  assert.equal(S.held.kept, false, "not on this device either");
  assert.equal(notes[0].text, "Your shape isn't saved");
});
t("a change sent while another is held doesn't hide that it's held until XO has them; then it's gone", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const { S } = store({ storage: mem(), remote: F });
  await S.ready;
  F.next.put.push(() => { throw F.err(413, "shape_too_large"); });
  await S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await S.settled();
  assert.equal(S.held.why, "refused");
  let answer;
  F.next.put.push(() => new Promise((r) => (answer = r)));
  const next = S.setMine({ shape: 1, preset: "engineering", density: "compact" });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(S.held && S.held.why, "refused", "still said while the new PUT is out");
  answer();
  await next;
  await S.settled();
  assert.equal(S.held, null);
  assert.equal(F.stored.preset, "engineering");
});

t("no browser storage at all (its getter throws, as some private modes do): a change applies, and says it won't outlive a reload", async () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("SecurityError: storage is disabled"); } });
  try {
    const S = createShapeStore({ load: async (id) => preset(id) });
    assert.deepEqual(S.setDevice({ density: "compact" }), { ok: true, kept: false });
    assert.equal(S.get("density"), "compact", "it applies for this page");
    assert.deepEqual(await S.choose("marketing"), { ok: true, kept: false });
  } finally {
    if (had) Object.defineProperty(globalThis, "localStorage", had); else delete globalThis.localStorage;
  }
});

t("this browser kept the note but not mine itself: a reload restores the change from the note and sends that, not the older copy", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const base = mem({ [KEYS.mine]: JSON.stringify({ shape: 1, preset: "marketing" }) });
  let refuseMine = true;
  const st = { ...base, setItem: (k, v) => { if (k === KEYS.mine && refuseMine) throw new Error("QuotaExceededError"); base.setItem(k, v); } };
  const first = store({ storage: st, remote: F });
  await first.S.ready;
  F.next.put.push(() => { throw F.err(503, "unavailable"); });
  await first.S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await first.S.settled();
  assert.equal(JSON.parse(base.getItem(KEYS.mine)).density, undefined, "mine itself wasn't written");
  assert.equal(first.S.held.kept, true, "the note keeps it");
  refuseMine = false;
  const again = store({ storage: st, remote: F });
  assert.equal(again.S.get("density"), "compact", "the first paint is the change, from the note");
  await again.S.ready;
  await again.S.settled();
  assert.deepEqual(F.stored, { shape: 1, preset: "marketing", density: "compact" }, "what's sent again is the change");
  assert.equal(again.notes.at(-1).text, "Your shape is saved");
});
t("refused, with this browser keeping the note but not mine: after a reload the change is still what shows, and still refused", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const base = mem({ [KEYS.mine]: JSON.stringify({ shape: 1, preset: "marketing" }) });
  const st = { ...base, setItem: (k, v) => { if (k === KEYS.mine) throw new Error("QuotaExceededError"); base.setItem(k, v); } };
  const first = store({ storage: st, remote: F });
  await first.S.ready;
  F.next.put.push(() => { throw F.err(413, "shape_too_large"); });
  await first.S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await first.S.settled();
  const again = store({ storage: st, remote: F });
  await again.S.ready;
  await again.S.settled();
  assert.equal(again.S.get("density"), "compact");
  assert.equal(again.S.held.why, "refused");
  assert.equal(again.S.held.kept, true, "kept here is claimed only with the change actually here");
  assert.deepEqual(F.stored, { shape: 1, preset: "marketing" }, "nothing sent by itself");
});
t("a note from an earlier build (the changes, no mine) over an older copy of mine: the changes are put back, never claimed while missing", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const st = mem({
    [KEYS.mine]: JSON.stringify({ shape: 1, preset: "marketing" }),
    [KEYS.unsynced]: JSON.stringify({ changes: [{ path: ["density"], value: "compact" }], known: { shape: 1, preset: "marketing" }, why: "refused", text: "XO refused it." }),
  });
  const { S } = store({ storage: st, remote: F });
  assert.equal(S.get("density"), "compact", "the held change is there");
  await S.ready;
  await S.settled();
  assert.deepEqual(S.held, { why: "refused", text: "XO refused it.", kept: true });
  assert.equal(S.get("density"), "compact");
});

t("refused, then a newer change written here while its PUT is out: a reload keeps the newer one (the note follows mine)", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const st = mem();
  const first = store({ storage: st, remote: F });
  await first.S.ready;
  F.next.put.push(() => { throw F.err(413, "shape_too_large"); });
  await first.S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await first.S.settled();
  F.next.put.push(() => new Promise(() => {})); // the newer change's PUT never answers: the page goes before it does
  first.S.setMine({ shape: 1, preset: "marketing", density: "comfortable" });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(JSON.parse(st.getItem(KEYS.mine)).density, "comfortable", "written here");
  const again = store({ storage: st, remote: F });
  assert.equal(again.S.get("density"), "comfortable", "the reload keeps the newer change");
  assert.equal(again.S.held.why, "refused", "and still says what's held");
});
t("…and when the note couldn't follow (its write failed), this browser's newer copy of mine still wins over it", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const base = mem();
  let refuseNote = false;
  const st = { ...base, setItem: (k, v) => { if (k === KEYS.unsynced && refuseNote) throw new Error("QuotaExceededError"); base.setItem(k, v); } };
  const first = store({ storage: st, remote: F });
  await first.S.ready;
  F.next.put.push(() => { throw F.err(413, "shape_too_large"); });
  await first.S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await first.S.settled();
  refuseNote = true;
  F.next.put.push(() => new Promise(() => {}));
  first.S.setMine({ shape: 1, preset: "marketing", density: "comfortable" });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(JSON.parse(base.getItem(KEYS.unsynced)).mine.density, "compact", "the note is the older one");
  const again = store({ storage: st, remote: F });
  assert.equal(again.S.get("density"), "comfortable", "this browser's newer copy wins");
});

t("a stale note, a newer copy of mine, and another device's change meanwhile: the conflict is about the newer change, not the stale delta", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const base = mem();
  let refuseNote = false;
  const st = { ...base, setItem: (k, v) => { if (k === KEYS.unsynced && refuseNote) throw new Error("QuotaExceededError"); base.setItem(k, v); } };
  const first = store({ storage: st, remote: F });
  await first.S.ready;
  F.next.put.push(() => { throw F.err(413, "shape_too_large"); });
  await first.S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await first.S.settled();
  refuseNote = true; // the note can't follow the newer change
  F.next.put.push(() => new Promise(() => {}));
  first.S.setMine({ shape: 1, preset: "marketing", density: "comfortable", words: { thread: "task" } });
  await new Promise((r) => setTimeout(r, 10));
  F.set({ shape: 1, preset: "everything" }); // another device, meanwhile (a preset without a density of its own)
  const again = store({ storage: st, remote: F });
  await again.S.ready;
  await again.S.settled();
  assert.notEqual(F.stored.density, "compact", "the stale compact isn't replayed onto Storm");
  assert.notEqual(again.S.get("density"), "compact", "nor shown here");
  // the newer change is two keys (density, a word): Storm's stays, and it's said that this change wasn't kept
  assert.deepEqual(F.stored, { shape: 1, preset: "everything" });
  assert.deepEqual(again.S.mine, { shape: 1, preset: "everything" });
  assert.match(again.notes.at(-1).sub, /wasn't kept/);
});
t("a note whose newer copy of mine is what Storm already has: nothing is held, and nothing claimed", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const st = mem({
    [KEYS.mine]: JSON.stringify({ shape: 1, preset: "marketing" }),
    [KEYS.unsynced]: JSON.stringify({ changes: [{ path: ["density"], value: "compact" }], known: { shape: 1, preset: "marketing" }, why: "refused", text: "XO refused it.", mine: { shape: 1, preset: "marketing", density: "compact" }, stored: { shape: 1, preset: "marketing", density: "compact" } }),
  });
  const { S } = store({ storage: st, remote: F });
  await S.ready;
  await S.settled();
  assert.equal(S.held, null);
  assert.equal(S.get("density"), "comfortable");
  assert.equal(st.getItem(KEYS.unsynced), null);
});

t("SRC-SET-QUEUE-7 as Astra ran it: the stale note, a newer comfortable + word change, a project word changed elsewhere: no stale replay", async () => {
  const F = fakeStorm({ doc: { shape: 1, preset: "marketing" } });
  const base = mem();
  let refuseNote = false;
  const st = { ...base, setItem: (k, v) => { if (k === KEYS.unsynced && refuseNote) throw new Error("QuotaExceededError"); base.setItem(k, v); } };
  const first = store({ storage: st, remote: F });
  await first.S.ready;
  F.next.put.push(() => { throw F.err(413, "shape_too_large"); });
  await first.S.setMine({ shape: 1, preset: "marketing", density: "compact" });
  await first.S.settled();
  refuseNote = true;
  F.next.put.push(() => new Promise(() => {}));
  first.S.setMine({ shape: 1, preset: "marketing", density: "comfortable", words: { thread: "task" } });
  await new Promise((r) => setTimeout(r, 10));
  F.set({ shape: 1, preset: "marketing", words: { project: "client" } }); // the project word, changed on another device
  const again = store({ storage: st, remote: F });
  assert.equal(again.S.get("density"), "comfortable", "first paint: the newer change");
  await again.S.ready;
  await again.S.settled();
  assert.notEqual(F.stored.density, "compact", "the stale compact delta isn't replayed");
  assert.equal(again.S.mine.density === "compact", false);
  assert.match(again.notes.at(-1).sub, /wasn't kept/, "two keys over another device's change: said, as every conflict is");
  assert.equal(again.S.held, null);
});

await Promise.all(pending);
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
