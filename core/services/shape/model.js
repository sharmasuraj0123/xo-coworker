// @ts-check

/** @typedef {{ id: string, slot: string, order: number, on: boolean, keep?: boolean, needs?: string, label: string, noun: string, opts?: Record<string, string[] | boolean> }} Surface @typedef {{ from: string, path: string, text: string, ignored?: boolean }} Problem @typedef {(path: string, text: string, ignored?: boolean) => void} Bad @typedef {(v: any) => string | null} Check @typedef {(v: any, path: string, bad: Bad) => any} Field @typedef {{ on: (id: string) => boolean, list: (slot: string) => any[], opts: (id: string) => any, word: (w: any) => string, get: (k: string) => any, problems: Problem[], doc: Record<string, any>, newer: Set<string> }} Shape */

export const SHAPE_VERSION = 1;   // "shape": 1 in mine and in this device's layer
export const PRESET_VERSION = 1;  // "preset": 1 in presets/*.json

/** Stepwise migrations, run on read: MIGRATIONS.shape[n] turns a version-n document into version n + 1 (none yet); a document newer than this UI knows is read for what it understands and never written over. @type {Record<string, Record<number, (d: any) => any>>} */
export const MIGRATIONS = { shape: {}, preset: {} };

/** Every surface that can come and go: `on` and `order` are today's defaults, `needs` a backend capability, `opts` a choice (a list, its first the default) or a flag, `keep` can't be switched off, `noun` names it in a sentence. @type {Surface[]} */
export const SURFACES = [
  { id: "xo:home/next", slot: "home", order: 10, on: true, keep: true, label: "Your next move", noun: "Your next move" },
  { id: "xo:home/handled", slot: "home", order: 20, on: true, label: "Handled", noun: "Handled" },
  { id: "xo:home/recent", slot: "home", order: 30, on: true, label: "Recently made", noun: "Recently made" },
  { id: "xo:thread/branch", slot: "thread", order: 10, on: true, label: "Branch chips", noun: "branch chips" },
  { id: "xo:thread/runtime", slot: "thread", order: 20, on: true, label: "Runtime names", noun: "runtime names" },
  { id: "xo:thread/subagents", slot: "thread", order: 30, on: true, label: "Sub-agent counts", noun: "sub-agent counts" },
  { id: "xo:thread/work", slot: "thread", order: 40, on: true, keep: true, label: "A turn's work", noun: "a turn's work", opts: { mode: ["raw", "words"] } },
  { id: "xo:thread/hops", slot: "thread", order: 50, on: false, label: "How messages travel", noun: "how messages travel" },
  // a picture an agent links to, read from its site (which learns someone looked): on, unless a device says no
  { id: "xo:conversation/webpics", slot: "conversation", order: 10, on: true, label: "Pictures from the web", noun: "pictures from the web" },
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

/** The few nouns a shape may rename, each with its canonical word (help text and agents keep that one). @type {Record<string, string>} */
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

/** @param {any} v */
export const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
/** @param {any} v */
const say = (v) => { const s = JSON.stringify(v); return s === undefined ? String(v) : s.length > 40 ? `${s.slice(0, 39)}…` : s; };
/** @param {string[]} xs */
const orList = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);
/** "a, b and c" @param {string[]} xs */
export const andList = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** RFC 7396: objects merge key by key, null removes a key, anything else (arrays too) replaces. @param {any} target @param {any} patch @returns {any} */
export function merge(target, patch) {
  if (!isObj(patch)) return patch;
  const out = isObj(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = merge(out[k], v);
  }
  return out;
}

/** Run a document's migrations from its version up to the current one (steps: injectable for tests). @param {any} doc @param {string} [kind] @param {number} [from] @param {Record<number, (d: any) => any>} [steps] */
export function migrate(doc, kind = "shape", from = 0, steps = MIGRATIONS[kind]) {
  const cur = kind === "preset" ? PRESET_VERSION : SHAPE_VERSION;
  const key = kind === "preset" ? "preset" : "shape";
  let d = doc;
  for (let v = from; v < cur; v++) if (steps && typeof steps[v] === "function") d = steps[v](d);
  return { ...d, [key]: cur };
}

/** The checks: each returns null when a value is fine, or what's wrong with it, in plain words. @type {{ bool: Check, num: Check, str: Check, oneOf: (xs: any[]) => Check, strs: Check, list: Check, obj: Check, word: Check }} */
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
/** A value with one check: kept, or dropped so the layer below shows through. @type {(chk: Check) => Field} */
const one = (chk) => (v, path, bad) => { const e = chk(v); if (e) { bad(path, `${e}; the layer below is used`); return undefined; } return v; };
/** An object whose known keys each have a check; an unknown key is listed and ignored, a bad one dropped. @type {(spec: ((k: string) => Field | null) | Record<string, Field>, what: string) => Field} */
const fields = (spec, what) => (v, path, bad) => {
  if (!isObj(v)) { bad(path, `${say(v)} isn't an object; the layer below is used`); return undefined; }
  /** @type {Record<string, any>} */
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
/** @type {Field} */
const kept = (v, path, bad) => { bad(path, "can't be switched off, only changed; it's ignored"); return undefined; };
/** @param {string} id @returns {Field | null} */
function surfaceSpec(id) {
  const s = BY.get(id);
  // an app's surface is kept as data until apps ship; a typo of XO's own is listed
  if (!s) return APP_SURFACE.test(id) ? fields({ on: one(C.bool), order: one(C.num) }, "option") : null;
  /** @type {Record<string, Field>} */
  const spec = { order: one(C.num), on: s.keep ? kept : one(C.bool) };
  for (const [k, d] of Object.entries(s.opts || {})) spec[k] = one(Array.isArray(d) ? C.oneOf(d) : C.bool);
  return fields(spec, "option");
}
/** @type {Record<string, Field>} */
const TOP = {
  density: one(C.oneOf(DENSITY)),
  words: fields((w) => (Object.hasOwn(WORDS, w) ? one(C.word) : null), "word"),
  surfaces: fields(surfaceSpec, "surface"),
  apps: fields((id) => (APP_ID.test(id) ? fields({ version: one(C.str), enable: one(C.oneOf(ENABLE)) }, "app setting") : null), "app id"),
  // side: the sidebar's places, {order, shown}; icons: a project's own icon, {project id: topic}; both yours, for every device, read whole and checked by app.js
  layout: fields({ panel: one(C.list), dock: one(C.strs), artifacts: one(C.strs), canvas: one(C.str), commands: one(C.strs), open: one(C.obj), side: one(C.obj), icons: one(C.obj) }, "layout key"),
  defaults: fields({ model: one(C.str), effort: one(C.str), home: one(C.obj), newProject: one(C.obj), settings: one(C.obj), skills: one(C.strs) }, "default"),
};

/** One layer, checked key by key: {layer (only what's valid), problems, newer}; `from` names it ("preset", "mine", "device"), a preset file carries its own version key and label, and the chosen preset is named in mine only. @param {any} raw @param {string} [from] */
export function cleanLayer(raw, from = "mine") {
  /** @type {Problem[]} */
  const problems = [];
  /** @type {Bad} */
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
  /** @type {Record<string, any>} */
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

/** The merged shape: layers lowest first, each a document or {from, doc}, over the built-in defaults; caps ({has(name)} or a Set) is what the backend can do, and a surface that needs a missing one stays away. @param {any[]} [layers] @param {any} [caps] @returns {Shape} */
export function createShape(layers = [], caps = null) {
  /** @type {Problem[]} */
  const problems = [];
  /** @type {Set<string>} */
  const newer = new Set();
  /** @type {Record<string, any>} */
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

  /** A surface's settings, merged: {on, order, …its options}; null for an id nobody registered. @param {string} id @returns {any} */
  function opts(id) {
    const s = BY.get(id);
    if (!s) return null;
    /** @type {Record<string, any>} */
    const out = { on: s.on, order: s.order };
    for (const [k, d] of Object.entries(s.opts || {})) out[k] = Array.isArray(d) ? d[0] : d;
    const o = isObj(surf[id]) ? surf[id] : {};
    for (const [k, v] of Object.entries(o)) if (Object.hasOwn(out, k)) out[k] = v;
    if (s.keep) out.on = true;
    return out;
  }
  /** @param {string | undefined} need */
  const has = (need) => !need || !caps || (typeof caps.has === "function" ? !!caps.has(need) : !!caps[need]);
  /** Shown? The shape wants it and the backend can do it. An app's surface waits for apps. @param {string} id */
  function on(id) {
    const s = BY.get(id);
    if (!s) return String(id).startsWith("xo:"); // an unregistered XO id is a typo in code: shown, never lost
    return !!opts(id).on && has(s.needs);
  }
  /** The surfaces of one slot that are on, by order (ties keep the registry's order). @param {string} slot */
  const list = (slot) => SURFACES.filter((s) => s.slot === slot && on(s.id)).map((s) => ({ ...s, ...opts(s.id) })).sort((a, b) => a.order - b.order);
  /** A noun in the shape's words, keeping its capital and plural: word("Threads") → "Tasks". @param {any} w */
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

/** What shape b changes compared with shape a, as plain sentences (Settings › Shape: "Hides branch chips, raw commands and Shells."); both are createShape results. @param {Shape} a @param {Shape} b */
export function describeShape(a, b) {
  /** @type {string[]} */
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
  if (i >= 0 && ha[i] && hb.includes(ha[i])) out.push(`Puts ${/** @type {Surface} */ (BY.get(hb[i])).label} above ${/** @type {Surface} */ (BY.get(ha[i])).label} on Home.`);
  /** @param {Shape} sh */
  const adv = (sh) => sh.list("settings").filter((s) => s.advanced).map((s) => s.label);
  const aa = adv(a), ab = adv(b);
  const moved = ab.filter((x) => !aa.includes(x)), back = aa.filter((x) => !ab.includes(x));
  if (moved.length) out.push(`Moves ${andList(moved)} under Advanced in Settings.`);
  if (back.length) out.push(`Brings ${andList(back)} back out of Advanced.`);
  if (a.get("density") !== b.get("density")) out.push(b.get("density") === "compact" ? "Compact: tighter rows and smaller reading text." : "Comfortable rows and reading text.");
  return out;
}

/** What "Show everything" writes into mine: every surface on, every option at its fullest, XO's own words. @param {string | null} [presetId] */
export function everythingLayer(presetId) {
  /** @type {Record<string, any>} */
  const surfaces = {};
  for (const s of SURFACES) {
    /** @type {Record<string, any>} */
    const o = {};
    if (!s.keep) o.on = true;
    for (const [k, d] of Object.entries(s.opts || {})) o[k] = Array.isArray(d) ? d[0] : false;
    if (Object.keys(o).length) surfaces[s.id] = o;
  }
  const words = Object.fromEntries(Object.keys(WORDS).map((w) => [w, null]));
  return { shape: SHAPE_VERSION, ...(presetId ? { preset: presetId } : {}), surfaces, words };
}

/** Today's per-browser preferences, folded into this device's layer once. The old keys stay in place. @param {{ getItem: (k: string) => string | null }} storage */
export function migrateDevice(storage) {
  /** @type {Record<string, any>} */
  const d = { shape: SHAPE_VERSION };
  let hops = null;
  try { hops = storage.getItem("cv-hops"); } catch { /* private mode */ }
  if (hops === "1" || hops === "0") d.surfaces = { "xo:thread/hops": { on: hops === "1" } };
  return d;
}
