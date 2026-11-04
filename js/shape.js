// The UI's shape, per person (design-research/2026-11-vision/shape/proposal.md). What overwhelms a
// non-technical person can comfort a technical one, so the person picks the shape (a preset, a switch,
// Edit as JSON) and the UI never reshapes itself on its own: only a person's click writes a layer.
//
// One list of every surface that can come and go (SURFACES: an id, a slot, an order, on by default,
// what it needs from the backend, its options), and one document that says which are on, in what
// order, how dense and in which words. keys.js is the same idea at small scale: defaults in code, only
// the differences stored, a Settings page generated from the list.
//
// Layers, lowest first, merged per key with JSON Merge Patch (RFC 7396: objects merge, anything else
// replaces, null removes):
//   built-in defaults (here) < preset (presets/<id>.json) < mine (cv-shape-mine) < this device (cv-shape-device)
// `surfaces` and `apps` are maps keyed by id, never arrays, so a preset that adds a surface still
// reaches someone who changed another. A bad value falls back to the layer below for that key only; an
// unknown key is ignored. Both are listed as problems (Settings › Shape), and nothing blanks the screen.
//
// Ids follow the apps contract (apps/README.md §6): XO's own surfaces are `xo:<id>`, an app's are
// `<app id>:<surface>`. Apps aren't built yet, so their entries are kept as data and do nothing.
//
// No DOM here, so tests/shape.test.mjs runs it in node. createShapeStore is the browser half, with its
// storage and its fetch injectable.

export const SHAPE_VERSION = 1;   // "shape": 1 in mine and in this device's layer
export const PRESET_VERSION = 1;  // "preset": 1 in presets/*.json

/**
 * Stepwise migrations, run on read: MIGRATIONS.shape[n] turns a version-n document into version n + 1.
 * None yet. A document newer than this UI knows is read for what it understands and never written over.
 */
export const MIGRATIONS = { shape: {}, preset: {} };

/**
 * Every surface that can come and go. `on` and `order` are the built-in defaults (today's UI). `needs`:
 * a capability the backend must have (the surface stays away without it, whatever the shape says).
 * `opts`: a list is a choice (its first value the default), a boolean a flag. `keep`: it can't be
 * switched off, only changed (you need it to work). `noun` is how Settings names it in a sentence.
 */
export const SURFACES = [
  { id: "xo:home/next", slot: "home", order: 10, on: true, keep: true, label: "Your next move", noun: "Your next move" },
  { id: "xo:home/handled", slot: "home", order: 20, on: true, label: "Handled", noun: "Handled" },
  { id: "xo:home/recent", slot: "home", order: 30, on: true, label: "Recently made", noun: "Recently made" },
  { id: "xo:thread/branch", slot: "thread", order: 10, on: true, label: "Branch chips", noun: "branch chips" },
  { id: "xo:thread/runtime", slot: "thread", order: 20, on: true, label: "Runtime names", noun: "runtime names" },
  { id: "xo:thread/subagents", slot: "thread", order: 30, on: true, label: "Sub-agent counts", noun: "sub-agent counts" },
  { id: "xo:thread/work", slot: "thread", order: 40, on: true, keep: true, label: "A turn's work", noun: "a turn's work", opts: { mode: ["raw", "words"] } },
  { id: "xo:thread/hops", slot: "thread", order: 50, on: false, label: "How messages travel", noun: "how messages travel" },
  { id: "xo:dock/shells", slot: "dock", order: 10, on: true, needs: "terminal", label: "Shells", noun: "Shells" },
  { id: "xo:panel/agents", slot: "panel", order: 10, on: true, label: "The panel's Agents", noun: "the panel's Agents" },
  { id: "xo:panel/map", slot: "panel", order: 20, on: true, label: "The panel's Map", noun: "the panel's Map" },
  { id: "xo:panel/changes", slot: "panel", order: 30, on: true, label: "The panel's Changes", noun: "the panel's Changes" },
  { id: "xo:composer/intel", slot: "composer", order: 30, on: true, keep: true, label: "Model and effort", noun: "the model choice", opts: { mode: ["full", "simple"] } },
  { id: "xo:settings/routing", slot: "settings", order: 30, on: true, keep: true, label: "Routing", noun: "Routing", opts: { advanced: false } },
  { id: "xo:settings/rules", slot: "settings", order: 50, on: true, keep: true, label: "Rules", noun: "Rules", opts: { advanced: false } },
  { id: "xo:settings/worktrees", slot: "settings", order: 60, on: true, keep: true, label: "Worktrees", noun: "Worktrees", opts: { advanced: false } },
];
const BY = new Map(SURFACES.map((s) => [s.id, s]));

/** The few nouns a shape may rename, each with its canonical word (help text and agents keep that one). */
export const WORDS = { thread: "thread" };

/** The presets offered, in order. Their files may carry their own name and summary; these are the fallback. */
export const PRESETS = [
  { id: "engineering", name: "Build software", summary: "Branches, runtimes, the commands agents ran, and Shells a key away." },
  { id: "marketing", name: "Make content and campaigns", summary: "What was made, in plain words. Technical detail is a click away." },
  { id: "everything", name: "Everything", summary: "Every part of XO, as it is today. Nothing hidden.", builtin: true },
];
export const PRESET_ID = /^[a-z][a-z0-9-]{0,31}$/;
const APP_ID = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;
const APP_SURFACE = /^[a-z0-9]+(\.[a-z0-9-]+)+:[a-z0-9][\w/-]*$/;
export const DENSITY = ["comfortable", "compact"];
const ENABLE = ["all-projects", "new-projects", "when-asked", "off"];

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const say = (v) => { const s = JSON.stringify(v); return s === undefined ? String(v) : s.length > 40 ? `${s.slice(0, 39)}…` : s; };
const orList = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);
/** "a, b and c" */
export const andList = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** RFC 7396: objects merge key by key, null removes a key, anything else (arrays too) replaces. */
export function merge(target, patch) {
  if (!isObj(patch)) return patch;
  const out = isObj(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = merge(out[k], v);
  }
  return out;
}

/** Run a document's migrations from its version up to the current one (steps: injectable for tests). */
export function migrate(doc, kind = "shape", from = 0, steps = MIGRATIONS[kind]) {
  const cur = kind === "preset" ? PRESET_VERSION : SHAPE_VERSION;
  const key = kind === "preset" ? "preset" : "shape";
  let d = doc;
  for (let v = from; v < cur; v++) if (steps && typeof steps[v] === "function") d = steps[v](d);
  return { ...d, [key]: cur };
}

// ── checks: each returns null when a value is fine, or what's wrong with it, in plain words ──────────
const C = {
  bool: (v) => (typeof v === "boolean" ? null : `${say(v)} isn't true or false`),
  num: (v) => (typeof v === "number" && Number.isFinite(v) ? null : `${say(v)} isn't a number`),
  str: (v) => (typeof v === "string" && v.trim() ? null : `${say(v)} isn't a word`),
  oneOf: (xs) => (v) => (xs.includes(v) ? null : `${say(v)} isn't ${orList(xs)}`),
  strs: (v) => (Array.isArray(v) && v.every((x) => typeof x === "string") ? null : `${say(v)} isn't a list of names`),
  list: (v) => (Array.isArray(v) ? null : `${say(v)} isn't a list`),
  obj: (v) => (isObj(v) ? null : `${say(v)} isn't an object`),
  word: (v) => (typeof v === "string" && /^[a-z][a-z -]{0,23}$/i.test(v.trim()) ? null : `${say(v)} isn't a word (letters, up to 24)`),
};
/** A value with one check: kept, or dropped so the layer below shows through. */
const one = (chk) => (v, path, bad) => { const e = chk(v); if (e) { bad(path, `${e}; the layer below is used`); return undefined; } return v; };
/** An object whose known keys each have a check; an unknown key is listed and ignored, a bad one dropped. */
const fields = (spec, what) => (v, path, bad) => {
  if (!isObj(v)) { bad(path, `${say(v)} isn't an object; the layer below is used`); return undefined; }
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    const p = path ? `${path} › ${k}` : k;
    const chk = typeof spec === "function" ? spec(k) : Object.hasOwn(spec, k) ? spec[k] : null;
    if (!chk) { bad(p, `isn't a known ${what}; it's ignored`, true); continue; }
    if (x === null) { out[k] = null; continue; } // null removes it from the layers below (RFC 7396)
    const y = chk(x, p, bad);
    if (y !== undefined) out[k] = y;
  }
  return out;
};
const kept = (v, path, bad) => { bad(path, "can't be switched off, only changed; it's ignored"); return undefined; };
function surfaceSpec(id) {
  const s = BY.get(id);
  // an app's surface is kept as data until apps ship; a typo of XO's own is listed
  if (!s) return APP_SURFACE.test(id) ? fields({ on: one(C.bool), order: one(C.num) }, "option") : null;
  const spec = { order: one(C.num), on: s.keep ? kept : one(C.bool) };
  for (const [k, d] of Object.entries(s.opts || {})) spec[k] = one(Array.isArray(d) ? C.oneOf(d) : C.bool);
  return fields(spec, "option");
}
const TOP = {
  density: one(C.oneOf(DENSITY)),
  words: fields((w) => (Object.hasOwn(WORDS, w) ? one(C.word) : null), "word"),
  surfaces: fields(surfaceSpec, "surface"),
  apps: fields((id) => (APP_ID.test(id) ? fields({ version: one(C.str), enable: one(C.oneOf(ENABLE)) }, "app setting") : null), "app id"),
  layout: fields({ panel: one(C.list), dock: one(C.strs), artifacts: one(C.strs), canvas: one(C.str), commands: one(C.strs), open: one(C.obj) }, "layout key"),
  defaults: fields({ model: one(C.str), effort: one(C.str), home: one(C.obj), newProject: one(C.obj), settings: one(C.obj), skills: one(C.strs) }, "default"),
};

/**
 * One layer, checked key by key: {layer (only what's valid), problems, newer}. `from` names the layer
 * ("preset", "mine", "device"): a preset file carries its own version key and label; the chosen preset
 * is named in mine only.
 */
export function cleanLayer(raw, from = "mine") {
  const problems = [];
  const bad = (path, text, ignored = false) => problems.push({ from, path, text, ignored });
  if (raw == null) return { layer: {}, problems, newer: false };
  if (!isObj(raw)) { bad("", "isn't a JSON object; the whole layer is ignored", true); return { layer: {}, problems, newer: false }; }
  const isPreset = from === "preset";
  const vk = isPreset ? "preset" : "shape";
  const cur = isPreset ? PRESET_VERSION : SHAPE_VERSION;
  let doc = raw, v = raw[vk], newer = false;
  if (v === undefined) v = cur;
  else if (!Number.isInteger(v) || v < 0) { bad(vk, `${say(v)} isn't a version number; read as version ${cur}`); v = cur; }
  if (v > cur) { newer = true; bad(vk, `was written by a newer XO (version ${v}): what this one understands is used, and it's never written over here`); }
  else if (v < cur) doc = migrate(raw, isPreset ? "preset" : "shape", v);
  const layer = {};
  for (const [k, val] of Object.entries(doc)) {
    if (k === vk) continue;
    if (isPreset && (k === "id" || k === "name" || k === "summary")) continue; // the preset's own label
    if (k === "preset") {
      if (from === "device") bad(k, "is chosen in Settings › Shape, not per device; it's ignored", true);
      else if (val === null || (typeof val === "string" && PRESET_ID.test(val))) layer.preset = val;
      else bad(k, `${say(val)} isn't a preset name; it's ignored`);
      continue;
    }
    if (!Object.hasOwn(TOP, k)) { bad(k, "isn't a shape key; it's ignored", true); continue; }
    if (val === null) { layer[k] = null; continue; }
    const out = TOP[k](val, k, bad);
    if (out !== undefined) layer[k] = out;
  }
  return { layer, problems, newer };
}

/**
 * The merged shape. layers: lowest first, each a document or {from, doc}; the built-in defaults go under
 * them all. caps: what the backend can do ({has(name)} or a Set); a surface that needs a missing one stays
 * away. Returns {on(id), list(slot), get(key), word(w), opts(id), problems, doc, newer}.
 */
export function createShape(layers = [], caps = null) {
  const problems = [];
  const newer = new Set();
  let doc = { density: DENSITY[0] };
  layers.forEach((L, i) => {
    if (!L) return;
    const named = isObj(L) && Object.hasOwn(L, "from") && Object.hasOwn(L, "doc") && Object.keys(L).length === 2;
    const from = named ? L.from : `layer ${i + 1}`;
    const r = cleanLayer(named ? L.doc : L, from);
    problems.push(...r.problems);
    if (r.newer) newer.add(from);
    doc = merge(doc, r.layer);
  });
  if (!DENSITY.includes(doc.density)) doc.density = DENSITY[0];
  const surf = isObj(doc.surfaces) ? doc.surfaces : {};
  const words = isObj(doc.words) ? doc.words : {};

  /** A surface's settings, merged: {on, order, …its options}; null for an id nobody registered. */
  function opts(id) {
    const s = BY.get(id);
    if (!s) return null;
    const out = { on: s.on, order: s.order };
    for (const [k, d] of Object.entries(s.opts || {})) out[k] = Array.isArray(d) ? d[0] : d;
    const o = isObj(surf[id]) ? surf[id] : {};
    for (const [k, v] of Object.entries(o)) if (Object.hasOwn(out, k)) out[k] = v;
    if (s.keep) out.on = true;
    return out;
  }
  const has = (need) => !need || !caps || (typeof caps.has === "function" ? !!caps.has(need) : !!caps[need]);
  /** Shown? The shape wants it and the backend can do it. An app's surface waits for apps. */
  function on(id) {
    const s = BY.get(id);
    if (!s) return String(id).startsWith("xo:"); // an unregistered XO id is a typo in code: shown, never lost
    return !!opts(id).on && has(s.needs);
  }
  /** The surfaces of one slot that are on, by order (ties keep the registry's order). */
  const list = (slot) => SURFACES.filter((s) => s.slot === slot && on(s.id)).map((s) => ({ ...s, ...opts(s.id) })).sort((a, b) => a.order - b.order);
  /** A noun in the shape's words, keeping its capital and plural: word("Threads") → "Tasks". */
  function word(w) {
    const s = String(w ?? "");
    const low = s.toLowerCase();
    let base = low, plural = false;
    if (!Object.hasOwn(WORDS, base) && base.endsWith("s") && Object.hasOwn(WORDS, base.slice(0, -1))) { base = base.slice(0, -1); plural = true; }
    if (!Object.hasOwn(WORDS, base)) return s;
    let out = (typeof words[base] === "string" && words[base].trim()) || WORDS[base];
    out = out.trim() + (plural ? "s" : "");
    return s[0] && s[0] !== low[0] ? out[0].toUpperCase() + out.slice(1) : out;
  }
  return { on, list, opts, word, get: (k) => doc[k], problems, doc, newer };
}

/**
 * What shape b changes compared with shape a, as plain sentences (Settings › Shape: "Hides branch
 * chips, raw commands and Shells."). Both are createShape results.
 */
export function describeShape(a, b) {
  const out = [];
  const hides = [], shows = [];
  for (const s of SURFACES) {
    if (!s.keep) {
      const x = a.opts(s.id).on, y = b.opts(s.id).on;
      if (x && !y) hides.push(s.noun);
      if (!x && y) shows.push(s.noun);
    }
    if (s.id === "xo:thread/work" && a.opts(s.id).mode !== b.opts(s.id).mode) (b.opts(s.id).mode === "words" ? hides : shows).push("raw commands");
  }
  if (hides.length) out.push(`Hides ${andList(hides)}.`);
  if (shows.length) out.push(`Shows ${andList(shows)}.`);
  if (b.opts("xo:thread/work").mode === "words" && a.opts("xo:thread/work").mode !== "words") out.push("Says what a turn did in plain words; Details shows every step.");
  if (b.opts("xo:composer/intel").mode === "simple" && a.opts("xo:composer/intel").mode !== "simple") out.push("The model choice is Auto or Deep, with every option one click away.");
  for (const w of Object.keys(WORDS)) if (a.word(w) !== b.word(w)) out.push(`Says “${b.word(w)}” for “${a.word(w)}”.`);
  const ha = a.list("home").map((s) => s.id), hb = b.list("home").map((s) => s.id);
  const i = hb.findIndex((id, k) => id !== ha[k] && ha.includes(id));
  if (i >= 0 && ha[i] && hb.includes(ha[i])) out.push(`Puts ${BY.get(hb[i]).label} above ${BY.get(ha[i]).label} on Home.`);
  const adv = (sh) => sh.list("settings").filter((s) => s.advanced).map((s) => s.label);
  const aa = adv(a), ab = adv(b);
  const moved = ab.filter((x) => !aa.includes(x)), back = aa.filter((x) => !ab.includes(x));
  if (moved.length) out.push(`Moves ${andList(moved)} under Advanced in Settings.`);
  if (back.length) out.push(`Brings ${andList(back)} back out of Advanced.`);
  if (a.get("density") !== b.get("density")) out.push(b.get("density") === "compact" ? "Compact: tighter rows and smaller reading text." : "Comfortable rows and reading text.");
  return out;
}

/** What "Show everything" writes into mine: every surface on, every option at its fullest, XO's own words. */
export function everythingLayer(presetId) {
  const surfaces = {};
  for (const s of SURFACES) {
    const o = {};
    if (!s.keep) o.on = true;
    for (const [k, d] of Object.entries(s.opts || {})) o[k] = Array.isArray(d) ? d[0] : false;
    if (Object.keys(o).length) surfaces[s.id] = o;
  }
  const words = Object.fromEntries(Object.keys(WORDS).map((w) => [w, null]));
  return { shape: SHAPE_VERSION, ...(presetId ? { preset: presetId } : {}), surfaces, words };
}

/** Today's per-browser preferences, folded into this device's layer once. The old keys stay in place. */
export function migrateDevice(storage) {
  const d = { shape: SHAPE_VERSION };
  let hops = null;
  try { hops = storage.getItem("cv-hops"); } catch { /* private mode */ }
  if (hops === "1" || hops === "0") d.surfaces = { "xo:thread/hops": { on: hops === "1" } };
  return d;
}

export const KEYS = { mine: "cv-shape-mine", device: "cv-shape-device", preset: "cv-shape-preset" };
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const defaultStorage = () => { try { return globalThis.localStorage || memory(); } catch { return memory(); } };
/** A preset file, served next to the UI (GET only). */
const fetchPreset = async (id) => {
  const r = await fetch(new URL(`../presets/${id}.json`, import.meta.url), { cache: "no-cache" });
  if (!r.ok) throw new Error(r.status === 404 ? "there's no such preset" : `HTTP ${r.status}`);
  return r.json();
};

/**
 * The live shape for the page. Mine and this device's layer are kept in localStorage; the active preset
 * is cached too, so the first paint already has the right shape (the file is read again after boot).
 * TODO(storm): mine moves to GET/PUT /api/chat/shape, and the presets to GET /api/chat/shape/presets,
 * once Storm has the routes, so your shape follows you to your phone. Until then it's per browser.
 */
export function createShapeStore({ storage = defaultStorage(), load = fetchPreset, caps = null } = {}) {
  const read = (k) => { try { const s = storage.getItem(k); return s ? JSON.parse(s) : null; } catch { return null; } };
  const write = (k, v) => { try { storage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
  let mine = read(KEYS.mine);
  let device = read(KEYS.device);
  if (device == null) { device = migrateDevice(storage); write(KEYS.device, device); }
  const files = new Map();      // preset id → its file, as read
  const loadErr = new Map();    // preset id → why it couldn't be read
  const cached = read(KEYS.preset);
  if (isObj(cached) && typeof cached.id === "string" && isObj(cached.doc)) files.set(cached.id, cached.doc);
  const subs = new Set();
  let shape = null;

  const presetId = () => (isObj(mine) && typeof mine.preset === "string" && PRESET_ID.test(mine.preset) ? mine.preset : null);
  const builtin = (id) => !id || PRESETS.some((p) => p.id === id && p.builtin);
  function build() {
    const id = presetId();
    const file = builtin(id) ? null : files.get(id);
    shape = createShape([file && { from: "preset", doc: file }, { from: "mine", doc: mine }, { from: "device", doc: device }].filter(Boolean), caps);
    if (id && !builtin(id) && loadErr.has(id)) shape.problems.unshift({ from: "preset", path: id, text: `couldn't be read (${loadErr.get(id)}); XO shows everything until it can` });
  }
  const emit = () => { build(); for (const f of subs) f(); };

  /** Read a preset file (once per page unless fresh); null when it can't be read. */
  async function loadPreset(id, { fresh = false } = {}) {
    if (builtin(id)) return null;
    if (!PRESET_ID.test(id)) throw new Error("that isn't a preset name");
    if (files.has(id) && !fresh) return files.get(id);
    try {
      const doc = await load(id);
      if (!isObj(doc)) throw new Error("it isn't a JSON object");
      files.set(id, doc); loadErr.delete(id);
      return doc;
    } catch (err) { loadErr.set(id, err.message || String(err)); return files.get(id) || null; }
  }
  const remember = (id) => { if (!builtin(id) && files.has(id)) write(KEYS.preset, { id, doc: files.get(id) }); };
  const saveMine = (doc) => { mine = doc; write(KEYS.mine, doc); };
  const newer = (from) => shape.newer.has(from);
  /** Your own changes beyond the preset's name (what Reset to preset would clear). */
  const ownKeys = () => (isObj(mine) ? Object.keys(mine).filter((k) => k !== "shape" && k !== "preset") : []);

  build();
  // after boot: the active preset's file, read fresh; a change (a new release of it) applies once, here
  const ready = (async () => {
    const id = presetId();
    if (!id || builtin(id)) return;
    const before = JSON.stringify(files.get(id) || null);
    await loadPreset(id, { fresh: true });
    remember(id);
    if (JSON.stringify(files.get(id) || null) !== before || loadErr.has(id)) emit();
  })();

  return {
    get shape() { return shape; },
    on: (id) => shape.on(id),
    list: (slot) => shape.list(slot),
    get: (k) => shape.get(k),
    word: (w) => shape.word(w),
    opts: (id) => shape.opts(id),
    get problems() { return shape.problems; },
    get presetId() { return presetId(); },
    /** Has a preset ever been chosen (first run asks until one is)? */
    get chosen() { return presetId() != null; },
    get mine() { return mine; },
    get device() { return device; },
    ownKeys, ready, loadPreset,
    presetFile: (id) => files.get(id) || null,
    presetError: (id) => loadErr.get(id) || null,
    /** The preset alone, over the built-in defaults (for "what it changes"). */
    presetShape: (id) => createShape(builtin(id) ? [] : [files.get(id) && { from: "preset", doc: files.get(id) }].filter(Boolean)),
    /** Choose a preset. Your own changes are cleared (Settings asks first); this device's stay. */
    async choose(id) {
      if (newer("mine")) return { error: "Your shape was saved by a newer XO; it isn't changed here." };
      await loadPreset(id);
      remember(id);
      saveMine({ shape: SHAPE_VERSION, preset: id });
      emit();
      return { ok: true };
    },
    /** Edit as JSON: mine replaced by your document (a preset named in it is read first). */
    async setMine(doc) {
      if (!isObj(doc)) return { error: "Your layer must be a JSON object, { … }." };
      if (newer("mine")) return { error: "Your shape was saved by a newer XO; it isn't changed here." };
      const id = typeof doc.preset === "string" && PRESET_ID.test(doc.preset) ? doc.preset : null;
      if (id) { await loadPreset(id); remember(id); }
      saveMine({ shape: SHAPE_VERSION, ...doc });
      emit();
      return { ok: true };
    },
    /** A change on this device only (a merge patch into its layer), e.g. a switch in Settings. */
    setDevice(patch) {
      if (newer("device")) return { error: "This device's shape was saved by a newer XO; it isn't changed here." };
      device = { ...merge(device || {}, patch), shape: SHAPE_VERSION };
      write(KEYS.device, device);
      emit();
      return { ok: true };
    },
    /** Back to exactly what the preset says: your changes and this device's are cleared. */
    resetToPreset() {
      if (newer("mine") || newer("device")) return { error: "Your shape was saved by a newer XO; it isn't changed here." };
      saveMine({ shape: SHAPE_VERSION, preset: presetId() || "everything" });
      device = { shape: SHAPE_VERSION }; // the marker stays, so cv-hops is never folded in twice
      write(KEYS.device, device);
      emit();
      return { ok: true };
    },
    /** Every surface on, on top of the preset (Reset to preset takes it back). */
    showEverything() {
      if (newer("mine") || newer("device")) return { error: "Your shape was saved by a newer XO; it isn't changed here." };
      saveMine(everythingLayer(presetId() || "everything"));
      device = { shape: SHAPE_VERSION, ...(device && device.density ? { density: device.density } : {}) };
      write(KEYS.device, device);
      emit();
      return { ok: true };
    },
    onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
