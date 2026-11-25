// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { latest, cancelLatest } from "../../core/platform/latest.js";
import { reportFailure } from "../../core/platform/util.js";
import { merge3, changes, linesOf } from "../../core/platform/index.js";
import { draftKey, getDraft, putDraft, dropDraft } from "./drafts.js";
/** @import { By, ChangeInfo, DocsDeps, DocumentData, DocumentHooks, DocumentState } from "./document-types.d.ts" */
/** @import { DocumentText, FileVersion, ViewerDocument } from "./document-types.d.ts" */

// Writes require an explicit save or restore.
export const DRAFT_MS = 800;
export const KEEP_TEXT = 20;
export const MERGE_MS = 10000;

export function refusal(/** @type {unknown} */ err) {
  const details = err && typeof err === "object" ? err : {};
  const s = "status" in details ? details.status : null, c = "code" in details ? details.code : null;
  const current = "current" in details ? details.current : undefined;
  if (s === 428 && c === "confirm_required") return { kind: "confirm", words: "" };
  if (s === 409 && c === "file_changed") {
    if (current && typeof current === "object" && "content" in current && typeof current.content === "string") {
      const version = "version" in current && typeof current.version === "string" ? current.version : null;
      return { kind: "changed", words: "", current: { content: current.content, version } };
    }
    if (current === null) {
      return { kind: "deleted", words: "This file was deleted on disk. Your text is kept: save to make it again." };
    }
  }
  if (s === 403 && c === "read_only_place") return { kind: "readonly", words: "XO keeps this file: it can't be saved here" };
  if (s === 403 && c === "outside_project") return { kind: "error", words: "This file is outside the project" };
  if (s === 403) return { kind: "error", words: "Saving isn't allowed here" };
  if (s === 413) return { kind: "error", words: "Too large to save here" };
  if (s === 503 && c === "writer_key_missing") return { kind: "error", words: "XO Space hasn't enabled saving yet" };
  if (s === 409) return { kind: "error", words: "The file changed and XO didn't send the new version" };
  if (!s) return { kind: "offline", words: "Not saved: XO can't be reached. It saves when it's back." };
  const message = "message" in details && typeof details.message === "string" ? details.message : "";
  return { kind: "error", words: message || "Couldn't save" };
}

/** Lines of `next` that differ from `prev`, 1-based and inclusive ([{from, to}]), for marking what someone else changed. */
export function changedLines(/** @type {string} */ prev, /** @type {string} */ next) {
  const out = [];
  const n = Math.max(1, linesOf(next).length);
  for (const c of changes(linesOf(prev), linesOf(next))) {
    const from = c.bStart + 1, to = Math.max(c.bEnd, c.bStart + 1);
    out.push({ from: Math.min(from, n), to: Math.min(to, n) });
  }
  return out;
}

/** The smallest edit that turns `a` into `b`, as character offsets {from, to, insert}, or null when they're the same. */
export function minimalEdit(/** @type {string} */ a, /** @type {string} */ b) {
  if (a === b) return null;
  let s = 0;
  const max = Math.min(a.length, b.length);
  while (s < max && a.charCodeAt(s) === b.charCodeAt(s)) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a.charCodeAt(ea - 1) === b.charCodeAt(eb - 1)) { ea--; eb--; }
  return { from: s, to: ea, insert: b.slice(s, eb) };
}

export function byWords(/** @type {By | null | undefined} */ by, /** @type {(ts: string) => string | null} */ threadTitle = () => null) {
  if (!by) return "";
  if (by.kind === "ui" || by.kind === "you") return "You";
  if (by.kind === "agent") return (by.thread_ts && threadTitle(by.thread_ts)) || "An agent";
  if (by.kind === "git") return "Git";
  if (by.kind === "disk") return "Changed on disk";
  return "";
}

/** @param {unknown} error */
function abortedRead(error) { return error instanceof DOMException && error.name === "AbortError"; }

/** @param {unknown} error */
function missingFile(error) { return !!error && typeof error === "object" && "status" in error && error.status === 404; }

export function createDocs(/** @type {DocsDeps} */ { api, store = null, clock, scope = createScope(), onChange = () => {} }) {
  /** @type {Map<string, ViewerDocument>} */
  const docs = new Map();
  const nowTime = () => clock ? clock.now() : Date.now();
  const emit = (/** @type {ViewerDocument} */ d, /** @type {string} */ what) => {
    if (scope.signal.aborted || d.refs <= 0) return;
    try { onChange(d, what); } catch (error) { reportFailure(error); }
  };

  const textOf = (/** @type {ViewerDocument} */ d) => (d.source ? d.source() : d.text);

  function setState(/** @type {ViewerDocument} */ d, /** @type {DocumentState} */ state, /** @type {string | null} */ err = null) {
    if (d.state === state && d.err === err) return;
    d.state = state; d.err = err;
    emit(d, "state");
  }

  function pushVersion(/** @type {ViewerDocument} */ d, /** @type {FileVersion} */ v) {
    const last = d.versions[d.versions.length - 1];
    if (last && last.version === v.version && v.version) { Object.assign(last, { ...v, text: v.text ?? last.text }); return; }
    const now = nowTime();
    if (last && v.by && v.by.kind === "ui" && last.by && last.by.kind === "ui" && last.kind !== "restore" && v.kind !== "restore" && last.t != null && now - last.t < MERGE_MS) {
      Object.assign(last, { version: v.version || null, at: v.at || new Date(now).toISOString(), text: v.text ?? null, id: last.id || v.id || null, t: now });
      emit(d, "version");
      return;
    }
    d.versions.push({ t: now, restores: v.restores ?? null, id: v.id || null, version: v.version || null,
      at: v.at || new Date(nowTime()).toISOString(), by: v.by || null, text: v.text ?? null, kind: v.kind || "edit" });
    const held = d.versions.filter((x) => x.text != null);
    for (const x of held.slice(0, Math.max(0, held.length - KEEP_TEXT))) x.text = null;
    emit(d, "version");
  }

  function open(/** @type {string} */ project, /** @type {string} */ rel, /** @type {DocumentData} */ data) {
    const key = draftKey(project, rel);
    let d = docs.get(key);
    if (d) { d.refs++; return d; }
    d = {
      key, project, rel, refs: 1, revision: 0,
      text: String(data.content ?? ""), base: String(data.content ?? ""), version: data.version ?? null,
      place: data.place || null, kind: data.kind || null, lineEndings: data.line_endings || null,
      state: "saved", err: null, confirm: false, confirmed: false, offline: false,
      source: null, apply: null, viewing: null,
      versions: [], cancelDraft: () => {}, inflight: null, merge: null,
    };
    if (data.editable === false || data.truncated || data.version == null) {
      d.state = "readonly";
      d.err = data.not_editable_reason || (data.truncated ? "truncated" : "not_text");
    }
    docs.set(key, d);
    pushVersion(d, { version: d.version, at: data.modified_at || null, by: null, text: d.base, kind: "open" });
    const dr = d.state === "saved" ? getDraft(store, key) : null;
    if (dr && dr.text !== d.base) {
      d.text = dr.text; d.base = dr.base; d.version = dr.version;
      d.state = "dirty";
    } else if (dr) dropDraft(store, key);
    return d;
  }

  /** A view lets go of the document; the last one gone keeps unsaved text as a draft (never saves it) and forgets it. */
  function release(/** @type {ViewerDocument} */ d) {
    if (!d || --d.refs > 0) return;
    cancelLatest(d);
    d.cancelDraft();
    if (d.source) { d.text = d.source(); d.source = null; }
    d.apply = null;
    if (d.state === "dirty" || d.state === "error" || d.state === "deleted" || d.state === "conflict") keepDraft(d);
    const gone = () => { if (d.refs <= 0 && !d.inflight && docs.get(d.key) === d) docs.delete(d.key); };
    if (d.inflight) d.inflight.then(gone, gone); else gone();
  }

  function attach(/** @type {ViewerDocument} */ d, /** @type {DocumentHooks} */ { source, apply, length = null }) {
    if (d.source && !source) d.text = d.source();
    d.source = source || null; d.apply = apply || null; d.length = source ? length : null;
    if (source) { const t = source(); if (t !== d.text) { const e = minimalEdit(t, d.text); if (e && apply) apply(e, { lines: [], why: "restore" }); } }
  }

  function keepDraft(/** @type {ViewerDocument} */ d) {
    d.cancelDraft();
    const text = textOf(d);
    if (text === d.base) { dropDraft(store, d.key); return true; }
    return putDraft(store, d.key, { text, base: d.base, version: d.version, at: nowTime() });
  }

  function edited(/** @type {ViewerDocument} */ d) {
    if (d.state === "readonly" || d.state === "conflict" || d.viewing) return;
    if ((d.state === "dirty" || d.state === "error") && sameAsSaved(d)) {
      d.cancelDraft();
      dropDraft(store, d.key);
      setState(d, "saved");
      return;
    }
    if (d.state === "saved" || d.state === "error" || d.state === "deleted") setState(d, d.state === "deleted" ? "deleted" : "dirty", d.state === "deleted" ? d.err : null);
    d.cancelDraft();
    if (!clock) d.cancelDraft = scope.timeout(() => keepDraft(d), DRAFT_MS);
    else d.cancelDraft = scope.effect(() => {
      const timer = clock.set(() => { d.cancelDraft(); keepDraft(d); }, DRAFT_MS);
      return () => clock.clear(timer);
    });
  }
  /** The text is the saved one again: same length first (no text built), then the same text. */
  function sameAsSaved(/** @type {ViewerDocument} */ d) {
    const n = d.length ? d.length() : null;
    if (n != null && n !== d.base.length) return false;
    return textOf(d) === d.base;
  }

  /** Save now: ⌘S / Ctrl+S (or Save in the "save your changes?" question). The only way a file is written. */
  function flush(/** @type {ViewerDocument} */ d) {
    if (!d || d.confirm) return d && d.inflight;
    if (d.state !== "dirty" && d.state !== "deleted" && d.state !== "error") return d.inflight;
    return save(d);
  }

  async function save(/** @type {ViewerDocument} */ d, /** @type {{ confirm?: string | null }} */ { confirm = null } = {}) {
    if (d.inflight) { d.again = true; return d.inflight; }
    if (d.state === "readonly" || d.state === "conflict" || d.viewing) return;
    if (d.confirm && !confirm) return;
    const text = textOf(d);
    if (text === d.base && d.state !== "deleted") {
      dropDraft(store, d.key);
      if (d.state !== "saved") setState(d, "saved");
      return;
    }
    d.revision++;
    cancelLatest(d);
    setState(d, "saving");
    const sentBase = d.deleted ? null : d.version;
    const run = (async () => {
      try {
        const restoreOf = d.restoreOf, restoring = !!d.restoring; d.restoreOf = null; d.restoring = false;
        const r = await api.saveProjectFile(d.project, d.rel, text, sentBase, confirm || (d.confirmed ? "runs_code" : null), restoreOf ? { restoreOf } : undefined);
        d.inflight = null;
        d.base = text; d.version = r.version; d.deleted = false; d.offline = false; d.confirm = false;
        if (confirm) d.confirmed = true;
        pushVersion(d, { version: r.version, at: r.saved_at || null, by: { kind: "ui" }, text, id: r.edit_id || null, kind: restoring ? "restore" : "edit", restores: restoreOf || null });
        const now = textOf(d);
        if (now !== text) setState(d, "dirty"); // typed while it saved: unsaved again, for the next ⌘S
        else { dropDraft(store, d.key); setState(d, "saved"); }
        emit(d, "saved");
      } catch (err) {
        d.inflight = null;
        const o = refusal(err);
        if (o.kind === "confirm") { d.confirm = true; setState(d, "dirty"); emit(d, "confirm"); return; }
        if (o.current) { mergeIn(d, o.current, { by: { kind: "agent" }, saving: true }); return; }
        if (o.kind === "deleted") { d.deleted = true; setState(d, "deleted", o.words); keepDraft(d); return; }
        if (o.kind === "readonly") { setState(d, "readonly", "read_only_place"); keepDraft(d); return; }
        if (o.kind === "offline") { d.offline = true; setState(d, "error", "Not saved: XO can't be reached. Your text is kept; press ⌘S again."); keepDraft(d); return; }
        setState(d, "error", o.words); keepDraft(d);
      }
      if (d.again) { d.again = false; if (d.state === "dirty") save(d); } // ⌘S pressed again while it saved
    })();
    d.inflight = run;
    return run;
  }

  function confirmRunsCode(/** @type {ViewerDocument} */ d, /** @type {boolean} */ yes) {
    if (!d.confirm) return;
    if (!yes) { d.confirm = false; d.declined = true; setState(d, "dirty"); emit(d, "confirm"); return; }
    d.confirm = false; d.confirmed = true;
    save(d, { confirm: "runs_code" });
  }

  /** Someone else's version of the file: {version, content} (a 409's current, or one read after a change came in), with who made it. */
  /** @param {ViewerDocument} d @param {DocumentText | null | undefined} current @param {ChangeInfo & { saving?: boolean }} [options] */
  function mergeIn(d, current, { by = null, at = null, id = null, saving = false } = {}) {
    if (!current || typeof current.content !== "string") return;
    if (current.version && current.version === d.version) return;
    const theirs = current.content;
    const mine = textOf(d);
    pushVersion(d, { version: current.version, at, by, text: theirs, id, kind: "edit" });
    if (d.state === "saved" || mine === d.base) {
      const e = minimalEdit(mine, theirs);
      d.base = theirs; d.version = current.version; d.text = theirs;
      if (e && d.apply) d.apply(e, { lines: changedLines(mine, theirs), why: "theirs" });
      dropDraft(store, d.key);
      setState(d, "saved");
      emit(d, "applied");
      return;
    }
    const m = merge3(d.base, mine, theirs);
    if (!m.conflicts) {
      const e = minimalEdit(mine, m.text);
      d.base = theirs; d.version = current.version; d.text = m.text;
      if (e && d.apply) d.apply(e, { lines: changedLines(mine, m.text), why: "merged" });
      if (m.text === theirs) { dropDraft(store, d.key); setState(d, "saved"); }
      else { setState(d, "dirty"); keepDraft(d); if (saving) save(d); }
      emit(d, "applied");
      return;
    }
    const ours = merge3(d.base, mine, theirs, { pick: "ours" }).text, other = merge3(d.base, mine, theirs, { pick: "theirs" }).text;
    d.merge = { base: d.base, mine, theirs, version: current.version, text: ours, other, left: m.conflicts, saving };
    const e = minimalEdit(mine, ours);
    d.text = ours;
    if (e && d.apply) d.apply(e, { lines: changedLines(mine, ours), why: "merging" });
    keepDraft(d);
    setState(d, "conflict");
    emit(d, "conflict");
  }

  function mergeProgress(/** @type {ViewerDocument} */ d, /** @type {number} */ left) {
    if (!d.merge || d.merge.left === left) return;
    d.merge.left = left;
    emit(d, "state");
  }
  function resolve(/** @type {ViewerDocument} */ d) {
    if (!d.merge || d.merge.left) return false;
    const { version, theirs, saving } = d.merge;
    d.merge = null;
    d.base = theirs; d.version = version;
    d.text = textOf(d);
    setState(d, "dirty");
    keepDraft(d);
    if (saving) flush(d);
    return true;
  }

  /** A change to the file came in (Space's file.version, or today's /changes signal): the new text is read and taken in. */
  async function changed(/** @type {string} */ project, /** @type {string} */ rel, /** @type {ChangeInfo} */ info = {}) {
    const key = draftKey(project, rel), d = docs.get(key);
    if (!d || scope.signal.aborted || d.refs <= 0) return null;
    const revision = ++d.revision;
    cancelLatest(d);
    if (!d.inflight && info.version && info.version === d.version) return d;
    if (info.kind === "delete") {
      d.deleted = true;
      pushVersion(d, { version: null, at: info.at, by: info.by, text: null, id: info.id, kind: "delete" });
      setState(d, "deleted", "This file was deleted on disk. Your text is kept: save to make it again.");
      keepDraft(d);
      return d;
    }
    try {
      await latest(d, async (signal) => {
        while (d.inflight) { await d.inflight; signal.throwIfAborted(); }
        return api.projectFile(project, rel, null, { signal });
      }, {
        signal: scope.signal,
        commit(cur) {
          if (d.revision !== revision || docs.get(key) !== d || d.refs <= 0 || !cur || cur.truncated) return;
          if (typeof cur.content !== "string") return;
          if (cur.version === d.version) return;
          mergeIn(d, { version: cur.version ?? null, content: cur.content }, { by: info.by, at: info.at || cur.modified_at, id: info.id });
        },
      });
    } catch (error) {
      if (!scope.signal.aborted && !abortedRead(error) && !missingFile(error)) reportFailure(error);
    }
    return d;
  }

  function renamed(/** @type {string} */ project, /** @type {string} */ oldRel, /** @type {string} */ newRel) {
    const d = docs.get(draftKey(project, oldRel));
    if (!d || docs.has(draftKey(project, newRel))) return null;
    cancelLatest(d);
    const was = d.key;
    docs.delete(was);
    dropDraft(store, was);
    d.rel = newRel; d.key = draftKey(project, newRel);
    docs.set(d.key, d);
    if (d.state !== "saved") keepDraft(d);
    emit(d, "renamed");
    return d;
  }

  /** Versions Space reports (GET /versions) fold in: who and when for versions held here, older ones listed. */
  function knownVersions(/** @type {ViewerDocument} */ d, /** @type {FileVersion[]} */ list) {
    if (!d || !Array.isArray(list)) return;
    const have = new Map(d.versions.filter((v) => v.version).map((v) => [v.version, v]));
    /** @type {FileVersion[]} */
    const older = [];
    for (const v of [...list].reverse()) { // oldest first
      const h = have.get(v.version);
      if (h) { h.by = h.by || v.by || null; h.at = v.at || h.at; h.id = h.id || v.id || null; continue; }
      older.push({ id: v.id || null, version: v.version || null, at: v.at || null, by: v.by || null, text: null, kind: v.kind || "edit" });
    }
    const firstHeld = d.versions[0] && d.versions[0].version;
    const at = older.findIndex((v) => v.version === firstHeld);
    d.versions = (at >= 0 ? older.slice(0, at) : older.filter((v) => !have.has(v.version))).concat(d.versions);
    emit(d, "version");
  }

  /** Look at an older version (read only; null goes back to the latest). Returns the version shown. */
  function view(/** @type {ViewerDocument} */ d, /** @type {number | null} */ index) {
    if (index == null || index >= d.versions.length - 1) { d.viewing = null; emit(d, "state"); return null; }
    d.viewing = d.versions[Math.max(0, index)];
    emit(d, "state");
    return d.viewing;
  }

  /** Don't save: your unsaved text goes (and its draft); the document is the file again. */
  function discard(/** @type {ViewerDocument} */ d) {
    if (!d) return;
    const now = textOf(d), e = minimalEdit(now, d.base);
    d.text = d.base; d.merge = null; d.confirm = false;
    if (e && d.apply) d.apply(e, { lines: [], why: "discard" });
    dropDraft(store, d.key);
    setState(d, d.deleted ? "deleted" : "saved", d.deleted ? d.err : null);
  }

  /** Make an older version's text the file's again: a save, so it's a new version (and undoable). */
  function restore(/** @type {ViewerDocument} */ d, /** @type {string} */ text, /** @type {{id?: string | null}} */ { id = null } = {}) {
    d.viewing = null;
    d.restoreOf = id || null; d.restoring = true;
    const now = textOf(d);
    const e = minimalEdit(now, text);
    d.text = text;
    if (e && d.apply) d.apply(e, { lines: changedLines(now, text), why: "restore" });
    setState(d, "dirty");
    return flush(d);
  }

  return {
    open, release, attach, edited, flush, save, discard, confirmRunsCode, changed, mergeIn, mergeProgress, resolve, knownVersions, view, restore, keepDraft, renamed,
    get: (/** @type {string} */ project, /** @type {string | undefined} */ rel) => rel ? docs.get(draftKey(project, rel)) || null : null,
    all: () => [...docs.values()],
    unsaved: () => [...docs.values()].filter((d) => d.state === "dirty" || d.state === "saving" || d.state === "conflict" || d.state === "error" || d.state === "deleted"),
    textOf,
  };
}
