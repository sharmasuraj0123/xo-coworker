// @ts-check

import { SHAPE_VERSION, PRESETS, PRESET_ID, isObj as isObject, merge, createShape, everythingLayer, migrateDevice } from "./model.js";
import { createShapeSync } from "./sync.js";
import { createScope } from "../../kernel/scope.js";
import { erase, localStore, read as readStored, reportStorageFailure, write as writeStored } from "../../platform/storage.js";
import { reportFailure } from "../notices/failures.js";

/** @import { Shape } from "./model.js" @import { ShapeStoreOptions, Store } from "./store-options.d.ts" */

export const KEYS = { mine: "cv-shape-mine", device: "cv-shape-device", preset: "cv-shape-preset", unsynced: "cv-shape-unsynced" };
/** How long a write XO couldn't take waits before it's sent again: 30 s, then doubling, at most 5 minutes. */
const RETRY_MS = [30000, 60000, 120000, 300000];
/** @returns {Store} */
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), ephemeral: true }; };
/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObj = (value) => isObject(value);
/** @param {string} id @param {AbortSignal} [signal] */
const fetchPreset = async (id, signal) => {
  const r = await fetch(new URL(`./presets/${id}.json`, import.meta.url), { cache: "no-cache", signal });
  if (!r.ok) throw new Error(r.status === 404 ? "there's no such preset" : `HTTP ${r.status}`);
  return r.json();
};

/** @param {ShapeStoreOptions} [options] @param {import("../../kernel/types").Lifetime} [scope] */
export function createShapeStore({
  storage = localStore(reportStorageFailure) || memory(), load = fetchPreset, caps = null, remote = null,
  notice = () => {}, retryMs = RETRY_MS,
} = {}, scope = createScope()) {
  const { signal } = scope;
  /** @param {string} k */
  const read = (k) => readStored(k, JSON.parse, null, storage, (error) => {
    if (!(error instanceof SyntaxError)) reportStorageFailure(error);
  });
  /** @param {string} k @param {unknown} v */
  const write = (k, v) => {
    let value;
    try { value = JSON.stringify(v); } catch (error) { reportFailure(error); return false; }
    return writeStored(k, value, storage, reportStorageFailure).kept && !storage.ephemeral;
  };
  const clearUnsynced = () => erase(KEYS.unsynced, storage);
  let mine = read(KEYS.mine);
  let device = read(KEYS.device);
  if (device == null) {
    device = migrateDevice({ getItem: (key) => readStored(key, (value) => value, null, storage, reportStorageFailure) });
    write(KEYS.device, device);
  }
  const files = new Map();      // preset id → its file, as read
  const loadErr = new Map();    // preset id → why it couldn't be read
  const cached = read(KEYS.preset);
  if (isObj(cached) && typeof cached.id === "string" && isObj(cached.doc)) files.set(cached.id, cached.doc);
  /** @type {Set<() => void>} */
  const subs = new Set();
  scope.effect(() => () => subs.clear());
  /** @type {Shape} */
  let shape;

  const presetId = () => (isObj(mine) && typeof mine.preset === "string" && PRESET_ID.test(mine.preset) ? mine.preset : null);
  /** @param {string | null} id */
  const builtin = (id) => !id || PRESETS.some((p) => p.id === id && p.builtin);
  function build() {
    const id = presetId();
    const file = builtin(id) ? null : files.get(id);
    shape = createShape([file && { from: "preset", doc: file }, { from: "mine", doc: mine }, { from: "device", doc: device }].filter(Boolean), caps);
    if (id && !builtin(id) && loadErr.has(id)) shape.problems.unshift({ from: "preset", path: id, text: `couldn't be read (${loadErr.get(id)}); XO shows everything until it can` });
  }
  const emit = () => { build(); for (const f of subs) f(); };

  /** Read a preset file (once per page unless fresh); null when it can't be read. @param {string} id @param {{ fresh?: boolean }} [o] */
  async function loadPreset(id, { fresh = false } = {}) {
    if (signal.aborted || builtin(id)) return null;
    if (!PRESET_ID.test(id)) throw new Error("that isn't a preset name");
    if (files.has(id) && !fresh) return files.get(id);
    try {
      const doc = await load(id, signal);
      if (signal.aborted) return null;
      if (!isObj(doc)) throw new Error("it isn't a JSON object");
      const was = files.has(id) && !loadErr.has(id) ? JSON.stringify(files.get(id)) : null;
      files.set(id, doc); loadErr.delete(id);
      // the active preset's file read at last (after a failure) or anew applies as choosing it does: kept and emitted, so it shows at once, not after a reload
      if (id === presetId() && was !== JSON.stringify(doc)) { remember(id); emit(); }
      return doc;
    } catch (err) {
      if (signal.aborted) return null;
      loadErr.set(id, err instanceof Error ? err.message : String(err));
      return files.get(id) || null;
    }
  }
  /** @param {string} id */
  const remember = (id) => { if (!builtin(id) && files.has(id)) write(KEYS.preset, { id, doc: files.get(id) }); };
  /** A shape that came from elsewhere (Storm, another device) names a preset this page may not have read yet. */
  const ensurePreset = () => {
    const id = presetId();
    if (id && !builtin(id) && !files.has(id)) loadPreset(id).then(() => {
      if (!signal.aborted) { remember(id); emit(); }
    });
  };
  /** @param {string} from */
  const newer = (from) => shape.newer.has(from);

  const sync = createShapeSync({
    scope, remote, notice, retryMs,
    storage: { read, write, clearUnsynced, keys: KEYS },
    local: { get mine() { return mine; }, set mine(value) { mine = value; }, build, emit, ensurePreset, newer },
  });
  const { saveMine, heard, settled, onHeld } = sync;

  /** Your own changes beyond the preset's name (what Reset to preset would clear). */
  const ownKeys = () => (isObj(mine) ? Object.keys(mine).filter((k) => k !== "shape" && k !== "preset") : []);

  build();
  const synced = sync.start();
  const ready = (async () => {
    await synced;
    if (signal.aborted) return;
    const id = presetId();
    if (!id || builtin(id)) return;
    const before = JSON.stringify(files.get(id) || null);
    await loadPreset(id, { fresh: true });
    if (signal.aborted) return;
    remember(id);
    if (JSON.stringify(files.get(id) || null) !== before || loadErr.has(id)) emit();
  })();

  return {
    get shape() { return shape; },
    on: (/** @type {string} */ id) => shape.on(id),
    list: (/** @type {string} */ slot) => shape.list(slot),
    get: (/** @type {string} */ k) => shape.get(k),
    word: (/** @type {unknown} */ w) => shape.word(w),
    opts: (/** @type {string} */ id) => shape.opts(id),
    get problems() { return shape.problems; },
    get presetId() { return presetId(); },
    /** Has a preset ever been chosen (first run asks until one is)? */
    get chosen() { return presetId() != null; },
    get mine() { return mine; },
    get device() { return device; },
    /** Settles once the load's read of Storm's shape has (at once without Storm): the first run waits for it. */
    synced,
    /** Where mine is kept now: {mode: reading|on|off|unknown, version}. */
    get sync() { return sync.status(); },
    /** A ui.shape settings event from the stream (app.js hands it over). */
    heard,
    /** Settles when every change so far has been written (or refused); for tests and a page about to go. */
    settled,
    /** Changes of yours a write couldn't land yet: {why: "unreachable" (sent again by itself) or "refused" (with your next), text: why, in a sentence}, else null. */
    get held() { return sync.held(); },
    /** Called when what's held changes (held, or landed). @param {() => void} fn */
    onHeld,
    ownKeys, ready, loadPreset,
    presetFile: (/** @type {string} */ id) => files.get(id) || null,
    presetError: (/** @type {string} */ id) => loadErr.get(id) || null,
    /** The preset alone, over the built-in defaults (for "what it changes"). @param {string} id */
    presetShape: (id) => createShape(builtin(id) ? [] : [files.get(id) && { from: "preset", doc: files.get(id) }].filter(Boolean)),
    /** Choose a preset. Your own changes are cleared (Settings asks first); this device's stay. @param {string} id */
    async choose(id) {
      if (newer("mine")) return { error: "Your shape was saved by a newer XO; it isn't changed here." };
      await loadPreset(id);
      if (signal.aborted) return { ok: false };
      remember(id);
      const kept = saveMine({ shape: SHAPE_VERSION, preset: id });
      emit();
      return { ok: true, kept };
    },
    /** @param {unknown} doc */
    async setMine(doc) {
      if (!isObj(doc)) return { error: "Your layer must be a JSON object, { … }." };
      if (newer("mine")) return { error: "Your shape was saved by a newer XO; it isn't changed here." };
      const id = typeof doc.preset === "string" && PRESET_ID.test(doc.preset) ? doc.preset : null;
      if (id) await loadPreset(id);
      if (signal.aborted) return { ok: false };
      if (id) remember(id);
      const kept = saveMine({ shape: SHAPE_VERSION, ...doc });
      emit();
      return { ok: true, kept };
    },
    /** @param {unknown} patch */
    patchMine(patch) {
      if (!isObj(patch)) return { error: "A change is a JSON object, { … }." };
      if (newer("mine")) return { error: "Your shape was saved by a newer XO; it isn't changed here." };
      const kept = saveMine(merge({ shape: SHAPE_VERSION, ...(isObj(mine) ? mine : {}) }, patch));
      emit();
      return { ok: true, kept };
    },
    /** @param {unknown} patch */
    setDevice(patch) {
      if (newer("device")) return { error: "This device's shape was saved by a newer XO; it isn't changed here." };
      device = { ...merge(device || {}, patch), shape: SHAPE_VERSION };
      const kept = write(KEYS.device, device);
      emit();
      return { ok: true, kept };
    },
    /** Back to exactly what the preset says: your changes and this device's are cleared. */
    resetToPreset() {
      if (newer("mine") || newer("device")) return { error: "Your shape was saved by a newer XO; it isn't changed here." };
      const mineKept = saveMine({ shape: SHAPE_VERSION, preset: presetId() || "everything" });
      device = { shape: SHAPE_VERSION }; // the marker stays, so cv-hops is never folded in twice
      const kept = write(KEYS.device, device) && mineKept;
      emit();
      return { ok: true, kept };
    },
    /** Every surface on, on top of the preset (Reset to preset takes it back). */
    showEverything() {
      if (newer("mine") || newer("device")) return { error: "Your shape was saved by a newer XO; it isn't changed here." };
      const mineKept = saveMine(everythingLayer(presetId() || "everything"));
      device = { shape: SHAPE_VERSION, ...(device && device.density ? { density: device.density } : {}) };
      const kept = write(KEYS.device, device) && mineKept;
      emit();
      return { ok: true, kept };
    },
    /** @param {() => void} fn */
    onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
