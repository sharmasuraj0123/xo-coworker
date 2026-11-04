// The UI's shape (js/shape.js): merge semantics, per-key fallback, unknown keys, ordering, capability
// gating, versions and the cv-hops migration. No network: the presets are read from disk.
//   node tests/shape.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { merge, migrate, cleanLayer, createShape, describeShape, everythingLayer, migrateDevice, createShapeStore, SURFACES, KEYS, SHAPE_VERSION } from "../js/shape.js";

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

await Promise.all(pending);
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
