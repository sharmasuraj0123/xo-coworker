// @ts-check

import { sameDoc, copy, changesOf, applyChanges, oneKey } from "./changes.js";
import { isObj as isObject } from "./model.js";
import { requestFailureMessage } from "../notices/failures.js";

/** @import { Change } from "./changes.js" @import { ShapeView, Sync, ShapeSyncOptions, SyncActions } from "./store-options.d.ts" */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObj = (value) => isObject(value);

/** @param {Pick<ShapeSyncOptions, "scope" | "remote" | "notice" | "local">} options @param {Sync} R @param {SyncActions} actions */
function createRemoteSync({ scope, remote, notice, local }, R, actions) {
  const { hold, unhold, later, settleHeld, setMine } = actions;
  const { build, emit, ensurePreset, newer } = local;
  /** @param {unknown} v @returns {v is ShapeView} */
  const isView = (v) => v != null && typeof v === "object" && "version" in v && typeof v.version === "string"
    && "shape" in v && (v.shape === null || isObj(v.shape));
  /** @param {unknown} err */
  const gone = (err) => isObj(err) && (err.status === 404 || err.status === 405);

  /** @param {ShapeView} view @param {{ adopt: boolean }} o */
  function took(view, { adopt }) {
    R.mode = "on";
    R.version = view.version;
    R.synced = isObj(view.shape) ? view.shape : null;
    R.knows = true;
    if (!adopt || sameDoc(R.synced, local.mine)) return false;
    setMine(copy(R.synced));
    build();
    return true;
  }
  /** @param {{ adopt?: boolean }} [o] */
  function reread({ adopt = true } = {}) {
    if (!remote || scope.signal.aborted) return R.read;
    R.read = (async () => {
      try {
        const v = await remote.get();
        if (scope.signal.aborted) return;
        if (!isView(v)) { R.mode = "off"; return; }
        if (took(v, { adopt: adopt && isObj(v.shape) && !R.pend.length && !R.busy && !R.held.length })) { ensurePreset(); emit(); }
        if (!scope.signal.aborted) settleHeld();
      } catch (err) {
        if (scope.signal.aborted) return;
        if (!gone(err)) requestFailureMessage(err, "Couldn't read your shape.");
        R.mode = gone(err) ? "off" : R.mode === "on" ? "on" : "unknown";
        if (R.mode === "off") unhold();
        else if (R.held.length && R.why === "unreachable") later();
      }
    })();
    return R.read;
  }
  const NOT_THERE = "your other devices don't have this change";
  /** @param {unknown} err @param {Change[][]} pend */
  function failed(err, pend) {
    if (gone(err)) { R.mode = "off"; unhold(); return; }
    const detail = isObj(err) ? err : {};
    const { status, message, current } = detail;
    if (status === 409 && detail.code === "shape_changed" && isView(current)) {
      const all = [...R.held.splice(0), ...pend]; unhold(); conflict(current, all); return;
    }
    const refused = typeof status === "number" && status >= 400 && status < 500;
    if (err && !refused) requestFailureMessage(err, "Couldn't save your shape.");
    const reason = !refused ? "XO couldn't be reached."
      : status === 413 ? "XO keeps a shape of up to 64 KB, and this one is larger."
        : status === 400 && message ? String(message).replace(/\s*$/, "").replace(/([^.!?])$/, "$1.")
          : "XO refused it.";
    R.held.push(...pend);
    hold(refused ? "refused" : "unreachable", reason);
    if (!refused) later();
    if (!R.kept) {
      const where = refused ? `XO refused it: ${reason}` : "XO couldn't be reached. It's sent again while this page is open.";
      notice({ text: "Your shape isn't saved", sub: `This browser won't keep it after a reload, and ${where}` });
    }
    else if (refused) notice({ text: "XO refused your shape change", sub: `${reason} It's kept on this device only: ${NOT_THERE}.` });
    else notice({
      text: "Your shape is saved on this device only",
      sub: `XO couldn't be reached, so ${NOT_THERE} yet. It's sent again when XO answers.`,
    });
  }
  /** @param {ShapeView} current @param {Change[][]} pend */
  function conflict(current, pend) {
    const all = pend.flat();
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
  /** Write one change at a time, then send anything queued while it was pending. @returns {Promise<void> | null} */
  function push() {
    if (scope.signal.aborted || R.busy || !R.pend.length || !remote) return R.busy;
    R.busy = (async () => {
      try {
        await R.read;
        if (R.mode === "unknown") await reread({ adopt: false });
        if (scope.signal.aborted) return;
        if (R.mode === "off") { R.pend = []; unhold(); return; }
        if (R.mode !== "on") { failed(null, R.pend.splice(0)); return; }
        if (R.synced && !sameDoc(R.synced, R.known)) { conflict({ shape: R.synced, version: R.version }, R.pend.splice(0)); return; }
        const n = R.pend.length, sent = copy(local.mine), wasHeld = !!R.why;
        let v;
        try { v = await remote.put({ shape: sent, if_version: R.version || "new" }); }
        catch (err) { if (!scope.signal.aborted) failed(err, R.pend.splice(0)); return; }
        if (scope.signal.aborted) return;
        R.pend.splice(0, n);
        R.retried = false;
        if (isView(v)) took(v, { adopt: false }); else { R.synced = sent; R.version = null; }
        R.known = R.synced;
        if (wasHeld && !R.held.length) {
          unhold();
          notice({ text: "Your shape is saved", sub: "Your other devices have your change now." });
        }
      } finally {
        R.busy = null;
        if (R.pend.length) push();
        else if (R.heard !== undefined) {
          const heard = R.heard;
          R.heard = undefined;
          if (!sameDoc(heard, R.synced)) reread();
        }
      }
    })();
    return R.busy;
  }
  return { reread, conflict, push };
}

/** @param {ShapeSyncOptions} options */
export function createShapeSync({ scope, remote, notice, retryMs, storage, local }) {
  const { read, write, clearUnsynced, keys: KEYS } = storage;
  const { emit, ensurePreset } = local;
  /** @type {Sync} */
  const R = {
    mode: remote ? "reading" : "off", version: null, synced: null, knows: false, known: null,
    pend: [], busy: null, heard: undefined, retried: false, read: Promise.resolve(), held: [],
    why: null, text: "", kept: true, tries: 0, localOk: true,
  };
  /** @type {Set<() => void>} */
  const heldSubs = new Set();
  scope.effect(() => () => heldSubs.clear());
  const heldSaid = () => { for (const f of heldSubs) f(); };
  {
    const un = remote ? read(KEYS.unsynced) : null;
    if (isObj(un) && Array.isArray(un.changes) && un.changes.length) {
      R.held = [un.changes];
      R.known = isObj(un.known) ? un.known : null;
      R.why = un.why === "refused" ? "refused" : "unreachable";
      R.text = typeof un.text === "string" ? un.text : "";
      if (isObj(un.mine) || un.mine === null) { if (!("stored" in un) || sameDoc(local.mine, un.stored)) local.mine = un.mine; }
      else local.mine = applyChanges(local.mine, un.changes);
      if ("known" in un) {
        const delta = changesOf(R.known, local.mine);
        if (delta.length) R.held = [delta];
        else { R.held = []; R.why = null; R.text = ""; clearUnsynced(); }
      }
    }
    else if (!remote) clearUnsynced();
  }
  /** @param {string} why @param {string} text */
  function hold(why, text) {
    R.why = why;
    R.text = text;
    R.kept = write(KEYS.unsynced, {
      changes: [...R.held, ...R.pend].flat(), known: R.known, why, text, mine: local.mine, stored: read(KEYS.mine),
    });
    heldSaid();
  }
  /** @type {(() => void) | undefined} */
  let cancelRetry;
  function unhold() {
    const was = !!R.why;
    R.held = []; R.why = null; R.text = ""; R.kept = true; R.tries = 0;
    cancelRetry?.();
    clearUnsynced();
    if (was) heldSaid();
  }
  /** A write XO couldn't take goes again by itself: after a while, or as soon as a read reaches Storm. */
  function later() {
    cancelRetry?.();
    cancelRetry = scope.timeout(resend, retryMs[Math.min(R.tries++, retryMs.length - 1)]);
  }
  function resend() {
    if (!R.held.length || R.busy || R.why !== "unreachable") return;
    R.pend.push(...R.held.splice(0));
    push();
  }
  /** A read reached Storm with your changes held: another device's since means a conflict; else they go again. */
  function settleHeld() {
    if (!R.held.length || R.busy || R.mode !== "on") return;
    if (!sameDoc(R.synced, R.known)) {
      const pend = R.held.splice(0);
      unhold();
      conflict({ shape: R.synced, version: R.version }, pend);
      push();
      return;
    }
    resend();
  }
  /** @param {unknown} doc */
  const setMine = (doc) => { local.mine = doc; R.localOk = write(KEYS.mine, doc); return R.localOk; };
  const { reread, conflict, push } = createRemoteSync({ scope, remote, notice, local }, R, { hold, unhold, later, settleHeld, setMine });

  /** @param {unknown} doc */
  const saveMine = (doc) => {
    const before = local.mine;
    const here = setMine(doc);
    if (R.mode === "off") return here;
    const ch = changesOf(before, doc);
    if (!ch.length) return here || R.mode === "on";
    if (!R.pend.length && !R.busy && !R.held.length) R.known = R.knows ? R.synced : before;
    R.pend.push(...R.held.splice(0), ch);
    if (R.why) hold(R.why, R.text);
    push();
    return here || R.mode === "on";
  };
  /** @param {unknown} value */
  function heard(value) {
    if (!remote || scope.signal.aborted) return;
    const doc = isObj(value) && isObj(value.doc) ? value.doc : null;
    if (R.mode === "reading") { R.read.then(() => heard(value)); return; }
    if (R.mode !== "on") { reread(); return; }
    if (R.busy || R.pend.length) { R.heard = doc; return; }
    if (R.held.length) { reread(); return; }
    if (sameDoc(doc, R.synced)) return;
    R.synced = doc;
    R.version = null;
    if (!sameDoc(doc, local.mine)) { setMine(doc ? copy(doc) : null); ensurePreset(); emit(); }
    reread();
  }
  const held = () => R.why ? { why: R.why, text: R.text, kept: R.kept } : null;
  return {
    start: () => remote ? reread() : R.read,
    saveMine, heard, held,
    status: () => ({ mode: R.mode, version: R.version }),
    async settled() {
      while (!scope.signal.aborted && (R.busy || R.pend.length)) await (R.busy || push());
      await R.read;
    },
    /** @param {() => void} fn */
    onHeld(fn) { heldSubs.add(fn); return () => heldSubs.delete(fn); },
  };
}
