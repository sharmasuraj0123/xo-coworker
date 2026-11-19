// @ts-check

import { SHAPE_VERSION, PRESETS, PRESET_ID, isObj, merge, createShape, everythingLayer, migrateDevice } from "./model.js";
import { sameDoc, copy, changesOf, applyChanges, oneKey } from "./changes.js";

/** @typedef {import("./model.js").Shape} Shape @typedef {import("./changes.js").Change} Change @typedef {{ getItem: (k: string) => string | null, setItem: (k: string, v: string) => void, removeItem: (k: string) => void, ephemeral?: boolean }} Store @typedef {{ get: () => Promise<any>, put: (b: { shape: any, if_version: string }) => Promise<any> }} Remote @typedef {{ mode: string, version: string | null, synced: any, knows: boolean, known: any, pend: Change[][], busy: Promise<void> | null, heard: any, retried: boolean, read: Promise<void>, held: Change[][], why: string | null, text: string, kept: boolean, tries: number, timer: any, localOk: boolean }} Sync */

// unsynced: your change Storm hasn't taken yet (a failed write), kept so a reload neither loses it nor reads over it
export const KEYS = { mine: "cv-shape-mine", device: "cv-shape-device", preset: "cv-shape-preset", unsynced: "cv-shape-unsynced" };
/** How long a write XO couldn't take waits before it's sent again: 30 s, then doubling, at most 5 minutes. */
const RETRY_MS = [30000, 60000, 120000, 300000];
/** In memory only (no browser storage could be had): it holds for the page, and says it outlives nothing (ephemeral). @returns {Store} */
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), ephemeral: true }; };
/** @returns {Store} */
const defaultStorage = () => { try { return globalThis.localStorage || memory(); } catch { return memory(); } };
/** A preset file, served next to the UI (GET only). @param {string} id */
const fetchPreset = async (id) => {
  const r = await fetch(new URL(`../../../presets/${id}.json`, import.meta.url), { cache: "no-cache" });
  if (!r.ok) throw new Error(r.status === 404 ? "there's no such preset" : `HTTP ${r.status}`);
  return r.json();
};

/** The live shape for the page: this device's layer and the active preset kept here for the first paint, mine kept on Storm (GET/PUT /api/chat/shape) where Storm keeps it; remote {get(), put({shape, if_version})} and notice({text, sub}) are injectable. @param {{ storage?: Store, load?: (id: string) => Promise<any>, caps?: any, remote?: Remote | null, notice?: (n: { text: string, sub: string }) => void, retryMs?: number[] }} [o] */
export function createShapeStore({ storage = defaultStorage(), load = fetchPreset, caps = null, remote = null, notice = () => {}, retryMs = RETRY_MS } = {}) {
  /** @param {string} k */
  const read = (k) => { try { const s = storage.getItem(k); return s ? JSON.parse(s) : null; } catch { return null; } };
  /** A write says whether this browser kept it (a full or switched-off storage refuses): the change still applies, and the caller is told it won't survive a reload, never that it was saved. @param {string} k @param {any} v */
  const write = (k, v) => { try { storage.setItem(k, JSON.stringify(v)); return !storage.ephemeral; } catch { return false; } };
  let mine = read(KEYS.mine);
  let device = read(KEYS.device);
  if (device == null) { device = migrateDevice(storage); write(KEYS.device, device); }
  const files = new Map();      // preset id → its file, as read
  const loadErr = new Map();    // preset id → why it couldn't be read
  const cached = read(KEYS.preset);
  if (isObj(cached) && typeof cached.id === "string" && isObj(cached.doc)) files.set(cached.id, cached.doc);
  /** @type {Set<() => void>} */
  const subs = new Set();
  /** @type {Shape} */
  let shape = /** @type {any} */ (null);

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
    if (builtin(id)) return null;
    if (!PRESET_ID.test(id)) throw new Error("that isn't a preset name");
    if (files.has(id) && !fresh) return files.get(id);
    try {
      const doc = await load(id);
      if (!isObj(doc)) throw new Error("it isn't a JSON object");
      const was = files.has(id) && !loadErr.has(id) ? JSON.stringify(files.get(id)) : null;
      files.set(id, doc); loadErr.delete(id);
      // the active preset's file read at last (after a failure) or anew applies as choosing it does: kept and emitted, so it shows at once, not after a reload
      if (id === presetId() && was !== JSON.stringify(doc)) { remember(id); emit(); }
      return doc;
    } catch (/** @type {any} */ err) { loadErr.set(id, err.message || String(err)); return files.get(id) || null; }
  }
  /** @param {string} id */
  const remember = (id) => { if (!builtin(id) && files.has(id)) write(KEYS.preset, { id, doc: files.get(id) }); };
  /** A shape that came from elsewhere (Storm, another device) names a preset this page may not have read yet. */
  const ensurePreset = () => { const id = presetId(); if (id && !builtin(id) && !files.has(id)) loadPreset(id).then(() => { remember(id); emit(); }); };
  /** @param {string} from */
  const newer = (from) => shape.newer.has(from);

  /** Mine on Storm: where it's kept (mode, version), what Storm holds (synced), your changes on their way (pend, busy) or held (held, why, text, kept). @type {Sync} */
  const R = { mode: remote ? "reading" : "off", version: null, synced: null, knows: false, known: null, pend: [], busy: null, heard: undefined, retried: false, read: Promise.resolve(), held: [], why: null, text: "", kept: true, tries: 0, timer: null, localOk: true };
  /** @type {Set<() => void>} */
  const heldSubs = new Set(); // Settings › Shape: what's held, and why, shown while it is
  const heldSaid = () => { for (const f of heldSubs) f(); };
  {
    const un = remote ? read(KEYS.unsynced) : null;
    if (un && Array.isArray(un.changes) && un.changes.length) {
      R.held = [un.changes]; R.known = isObj(un.known) ? un.known : null; R.why = un.why === "refused" ? "refused" : "unreachable"; R.text = typeof un.text === "string" ? un.text : "";
      // the note's mine shows when this browser's copy is unchanged since the note (a copy written since is newer and stays); a note without mine puts its changes on top
      if (isObj(un.mine) || un.mine === null) { if (!("stored" in un) || sameDoc(mine, un.stored)) mine = un.mine; }
      else mine = applyChanges(mine, un.changes);
      // one coherent revision: what's held is exactly the difference between mine and what Storm held when it began; none, and nothing is held
      if ("known" in un) {
        const delta = changesOf(R.known, mine);
        if (delta.length) R.held = [delta];
        else { R.held = []; R.why = null; R.text = ""; try { storage.removeItem(KEYS.unsynced); } catch { /* nothing kept */ } }
      }
    }
    else if (!remote) { try { storage.removeItem(KEYS.unsynced); } catch { /* nothing kept */ } }
  }
  /** Keep the held changes (and why) where a reload finds them, with mine as it is now and this browser's stored copy of it (kept: whether that note was kept); or let them go, once Storm has them or can't. @param {string} why @param {string} text */
  function hold(why, text) { R.why = why; R.text = text; R.kept = write(KEYS.unsynced, { changes: [...R.held, ...R.pend].flat(), known: R.known, why, text, mine, stored: read(KEYS.mine) }); heldSaid(); }
  function unhold() { const was = !!R.why; R.held = []; R.why = null; R.text = ""; R.kept = true; R.tries = 0; clearTimeout(R.timer); try { storage.removeItem(KEYS.unsynced); } catch { /* nothing kept */ } if (was) heldSaid(); }
  /** A write XO couldn't take goes again by itself: after a while, or as soon as a read reaches Storm. */
  function later() {
    clearTimeout(R.timer);
    R.timer = setTimeout(resend, retryMs[Math.min(R.tries++, retryMs.length - 1)]);
    R.timer.unref?.(); // never keeps a node test (or a closing page) alive
  }
  function resend() {
    if (!R.held.length || R.busy || R.why !== "unreachable") return;
    R.pend.push(...R.held.splice(0));
    push();
  }
  /** A read reached Storm with your changes held: another device's since means a conflict; else they go again. */
  function settleHeld() {
    if (!R.held.length || R.busy || R.mode !== "on") return;
    if (!sameDoc(R.synced, R.known)) { const pend = R.held.splice(0); unhold(); conflict({ shape: R.synced, version: R.version }, pend); push(); return; }
    resend();
  }
  /** @param {any} v */
  const isView = (v) => isObj(v) && typeof v.version === "string" && (v.shape === null || isObj(v.shape));
  /** @param {any} err */
  const gone = (err) => !!err && (err.status === 404 || err.status === 405);
  /** @param {any} doc */
  const setMine = (doc) => { mine = doc; R.localOk = write(KEYS.mine, doc); return R.localOk; }; // the copy here follows (null too: Storm has none)
  /** What Storm holds, from a GET or PUT answer (or a conflict's `current`). adopt: it becomes mine here too. @param {any} view @param {{ adopt: boolean }} o */
  function took(view, { adopt }) {
    R.mode = "on";
    R.version = view.version;
    R.synced = isObj(view.shape) ? view.shape : null;
    R.knows = true;
    if (!adopt || sameDoc(R.synced, mine)) return false;
    setMine(copy(R.synced));
    build();
    return true;
  }
  /** Read Storm's (GET). adopt: Storm's becomes mine here, unless a change of yours is on its way (its PUT settles that). @param {{ adopt?: boolean }} [o] */
  function reread({ adopt = true } = {}) {
    if (!remote) return R.read;
    R.read = (async () => {
      try {
        const v = await remote.get();
        if (!isView(v)) { R.mode = "off"; return; } // not Storm's shape route: this browser's copy, as before
        // Storm without a shape doesn't take this browser's away: it goes up with your first change
        if (took(v, { adopt: adopt && isObj(v.shape) && !R.pend.length && !R.busy && !R.held.length })) { ensurePreset(); emit(); }
        settleHeld();
      } catch (err) {
        R.mode = gone(err) ? "off" : R.mode === "on" ? "on" : "unknown";
        if (R.mode === "off") unhold();
        else if (R.held.length && R.why === "unreachable") later(); // still can't reach it: try again in a while
      }
    })();
    return R.read;
  }
  const NOT_THERE = "your other devices don't have this change";
  /** A write that didn't land: a conflict changes what you see; the rest is held (unreachable: sent again by itself; refused: with your next change), said quietly and truthfully. @param {any} err @param {Change[][]} pend */
  function failed(err, pend) {
    if (gone(err)) { R.mode = "off"; unhold(); return; } // no route after all (an older backend again): this browser's, quietly
    if (err && err.status === 409 && err.code === "shape_changed" && isView(err.current)) { const all = [...R.held.splice(0), ...pend]; unhold(); conflict(err.current, all); return; }
    const refused = !!err && err.status >= 400 && err.status < 500;
    // why, in a sentence of its own: shown in the notice now, and in Settings › Shape while it's held
    const reason = !refused ? "XO couldn't be reached."
      : err.status === 413 ? "XO keeps a shape of up to 64 KB, and this one is larger."
        : err.status === 400 && err.message ? String(err.message).replace(/\s*$/, "").replace(/([^.!?])$/, "$1.")
          : "XO refused it.";
    R.held.push(...pend);
    hold(refused ? "refused" : "unreachable", reason);
    if (!refused) later();
    // kept here (mine and the note of it) or not: said the same way now and in Settings › Shape after
    if (!R.kept) notice({ text: "Your shape isn't saved", sub: `This browser won't keep it after a reload, and ${refused ? `XO refused it: ${reason}` : "XO couldn't be reached. It's sent again while this page is open."}` });
    else if (refused) notice({ text: "XO refused your shape change", sub: `${reason} It's kept on this device only: ${NOT_THERE}.` });
    else notice({ text: "Your shape is saved on this device only", sub: `XO couldn't be reached, so ${NOT_THERE} yet. It's sent again when XO answers.` });
  }
  /** Another device saved first: Storm's (current) is taken here, and your change goes back on top once when it's one clear key; anything larger keeps Storm's. Said quietly. @param {any} current @param {Change[][]} pend */
  function conflict(current, pend) {
    const all = pend.flat();
    // Storm has none now (cleared elsewhere): as on a first upload, this device's goes up as "new"
    if (!isObj(current.shape)) {
      took(current, { adopt: false });
      R.known = null;
      if (all.length && !R.retried) { R.retried = true; R.pend = [all]; } else R.retried = false;
      return;
    }
    took(current, { adopt: true });
    build();
    if (all.length && oneKey(all) && !R.retried && !newer("mine")) {
      R.retried = true;
      const doc = applyChanges(R.synced, all);
      R.known = R.synced;
      setMine(doc);
      R.pend = [changesOf(R.synced, doc)];
      notice({ text: "Your shape changed on another device", sub: "Your change here is kept on top of it." });
    } else {
      R.retried = false;
      notice({ text: "Your shape changed on another device", sub: "This device shows it now; your last change here wasn't kept." });
    }
    ensurePreset();
    emit();
  }
  /** Write mine to Storm, one PUT at a time; changes made meanwhile go with the next. @returns {Promise<void> | null} */
  function push() {
    if (R.busy || !R.pend.length || !remote) return R.busy;
    R.busy = (async () => {
      try {
        await R.read; // the load's GET (or a re-read) settles first
        if (R.mode === "unknown") await reread({ adopt: false }); // it failed: read once more before writing over anything
        if (R.mode === "off") { R.pend = []; unhold(); return; }
        if (R.mode !== "on") { failed(null, R.pend.splice(0)); return; } // couldn't be reached: held, and sent again
        // a read since your change began found another device's shape there: the same as a conflict
        if (R.synced && !sameDoc(R.synced, R.known)) { conflict({ shape: R.synced, version: R.version }, R.pend.splice(0)); return; }
        const n = R.pend.length, sent = copy(mine), wasHeld = !!R.why;
        let v;
        try { v = await remote.put({ shape: sent, if_version: R.version || "new" }); } catch (err) { failed(err, R.pend.splice(0)); return; }
        R.pend.splice(0, n);
        R.retried = false;
        if (isView(v)) took(v, { adopt: false }); else { R.synced = sent; R.version = null; }
        R.known = R.synced; // what changes made meanwhile go on top of
        // it's on Storm now: nothing is held any more, and a change that waited says it got there
        if (wasHeld && !R.held.length) { unhold(); notice({ text: "Your shape is saved", sub: "Your other devices have your change now." }); }
      } finally {
        R.busy = null;
        if (R.pend.length) push();
        else if (R.heard !== undefined) { const h = R.heard; R.heard = undefined; if (!sameDoc(h, R.synced)) reread(); } // not our own echo: read what's there now
      }
    })();
    return R.busy;
  }
  /** Your change to mine: kept here at once, and on Storm when it keeps shapes (with any change still held: the PUT is the whole of mine); true when it outlives a reload as far as is known now. @param {any} doc */
  const saveMine = (doc) => {
    const before = mine;
    const here = setMine(doc);
    if (R.mode === "off") return here;
    const ch = changesOf(before, doc);
    if (!ch.length) return here || R.mode === "on";
    // what Storm held as this change began (never read yet: this browser's copy is the best guess of it)
    if (!R.pend.length && !R.busy && !R.held.length) R.known = R.knows ? R.synced : before;
    R.pend.push(...R.held.splice(0), ch);
    // something is held: its note follows mine at once, so a reload while this PUT is out restores this, not the older
    if (R.why) hold(R.why, R.text);
    push();
    return here || R.mode === "on";
  };
  /** A ui.shape `settings` event ({doc, updated_at}, or null when cleared), another device's change or our own write's echo: applied at once, then read for its version. @param {any} value */
  function heard(value) {
    if (!remote) return;
    const doc = isObj(value) && isObj(value.doc) ? value.doc : null;
    if (R.mode === "reading") { R.read.then(() => heard(value)); return; }
    if (R.mode !== "on") { reread(); return; } // Storm keeps shapes after all (a restart while this page was open)
    if (R.busy || R.pend.length) { R.heard = doc; return; } // our write settles first (a conflict says so)
    if (R.held.length) { reread(); return; } // a change of yours is held: the read decides (a conflict, or it goes again)
    if (sameDoc(doc, R.synced)) return; // what Storm holds already: our own write's echo
    R.synced = doc;
    R.version = null; // the next read says which (and takes anything newer still)
    if (!sameDoc(doc, mine)) { setMine(doc ? copy(doc) : null); ensurePreset(); emit(); }
    reread();
  }
  /** Your own changes beyond the preset's name (what Reset to preset would clear). */
  const ownKeys = () => (isObj(mine) ? Object.keys(mine).filter((k) => k !== "shape" && k !== "preset") : []);

  build();
  // the load's one read of Storm's (a GET; nothing is written on load)
  if (remote) reread();
  const synced = R.read;
  // after boot: the active preset's file, read fresh; a change (a new release of it) applies once, here
  const ready = (async () => {
    await synced;
    const id = presetId();
    if (!id || builtin(id)) return;
    const before = JSON.stringify(files.get(id) || null);
    await loadPreset(id, { fresh: true });
    remember(id);
    if (JSON.stringify(files.get(id) || null) !== before || loadErr.has(id)) emit();
  })();

  return {
    get shape() { return shape; },
    on: (/** @type {string} */ id) => shape.on(id),
    list: (/** @type {string} */ slot) => shape.list(slot),
    get: (/** @type {string} */ k) => shape.get(k),
    word: (/** @type {any} */ w) => shape.word(w),
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
    get sync() { return { mode: R.mode, version: R.version }; },
    /** A ui.shape settings event from the stream (app.js hands it over). */
    heard,
    /** Settles when every change so far has been written (or refused); for tests and a page about to go. */
    settled: async () => { while (R.busy || R.pend.length) { await (R.busy || push()); } await R.read; },
    /** Changes of yours a write couldn't land yet: {why: "unreachable" (sent again by itself) or "refused" (with your next), text: why, in a sentence}, else null. */
    get held() { return R.why ? { why: R.why, text: R.text, kept: R.kept } : null; },
    /** Called when what's held changes (held, or landed). @param {() => void} fn */
    onHeld(fn) { heldSubs.add(fn); return () => heldSubs.delete(fn); },
    ownKeys, ready, loadPreset,
    presetFile: (/** @type {string} */ id) => files.get(id) || null,
    presetError: (/** @type {string} */ id) => loadErr.get(id) || null,
    /** The preset alone, over the built-in defaults (for "what it changes"). @param {string} id */
    presetShape: (id) => createShape(builtin(id) ? [] : [files.get(id) && { from: "preset", doc: files.get(id) }].filter(Boolean)),
    /** Choose a preset. Your own changes are cleared (Settings asks first); this device's stay. @param {string} id */
    async choose(id) {
      if (newer("mine")) return { error: "Your shape was saved by a newer XO; it isn't changed here." };
      await loadPreset(id);
      remember(id);
      const kept = saveMine({ shape: SHAPE_VERSION, preset: id });
      emit();
      return { ok: true, kept };
    },
    /** Edit as JSON: mine replaced by your document (a preset named in it is read first). @param {any} doc */
    async setMine(doc) {
      if (!isObj(doc)) return { error: "Your layer must be a JSON object, { … }." };
      if (newer("mine")) return { error: "Your shape was saved by a newer XO; it isn't changed here." };
      const id = typeof doc.preset === "string" && PRESET_ID.test(doc.preset) ? doc.preset : null;
      if (id) { await loadPreset(id); remember(id); }
      const kept = saveMine({ shape: SHAPE_VERSION, ...doc });
      emit();
      return { ok: true, kept };
    },
    /** A change of yours kept for every device (a merge patch into mine; null removes a key), e.g. the sidebar's places or a project's icon; Reset to preset clears it with the rest of your changes. @param {any} patch */
    patchMine(patch) {
      if (!isObj(patch)) return { error: "A change is a JSON object, { … }." };
      if (newer("mine")) return { error: "Your shape was saved by a newer XO; it isn't changed here." };
      const kept = saveMine(merge({ shape: SHAPE_VERSION, ...(isObj(mine) ? mine : {}) }, patch));
      emit();
      return { ok: true, kept };
    },
    /** A change on this device only (a merge patch into its layer), e.g. a switch in Settings. @param {any} patch */
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
