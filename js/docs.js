// Open files, as documents. One model per open project
// file, the way VS Code keeps one per editor: what's on disk (base, version), what you have (the editor's text),
// and one state every view of it shares. No DOM, no editor: the view hands its text in (`source`), and is told
// when the text must change under it (`apply`), so this file is tested in node with a fake clock.
//
// States: "saved" (what you see is what's on disk) · "dirty" (you typed: unsaved until you press ⌘S / Ctrl+S, the
// owner's call on 19 Nov 11:42Z: "ctrl s should save it. no auto save") · "saving" (a PUT is out; typing goes on) · "conflict" (you and someone else
// changed the same lines: the merge view) · "deleted" (gone on disk: your text stays, Save makes it again) ·
// "readonly" (XO keeps it, or too big, or not text) · "error" (a save failed: your text stays, it says why).
// A file that runs code asks once before its first save (Space's 428): "confirm" is set and nothing is sent until
// you answer.
//
// Someone else's change (an agent, bash, git, another tab: Space's file.version event, or today's /changes signal)
// comes in through `changed`: a saved document takes the new text in place, as a new version, with the lines
// that changed marked; a dirty one merges it into yours (core/platform/diff.js), and only lines you both changed ask.
// Each text the document has been is a version (newest last): who made it, when, and its text while it's held.
//
// Drafts (js/drafts.js) stay what VS Code calls hot exit: unsaved text kept in this browser after a pause, on
// leaving, and before the page goes; a document opened over its draft takes it back, unsaved, for ⌘S.

import { merge3, changes, linesOf } from "../core/platform/index.js";
import { draftKey, getDraft, putDraft, dropDraft } from "./drafts.js";

// (no autosave: the owner, 19 Nov 11:42Z. A save is ⌘S, Restore, or Save in the "save your changes?" question)
export const DRAFT_MS = 800;
// the versions held per document, with their text (older ones keep who and when; their text is read from Space)
export const KEEP_TEXT = 20;
// your saves this close together are one version (Space's merge window, SPACE-CONTRACT.md §1.1): a typing session
// that autosaves every second reads as one step back, not fifty
export const MERGE_MS = 10000;

/** What a refused save means (Space's PUT /file), as a state and words. Pure. */
export function refusal(err) {
  const s = err && err.status, c = err && err.code;
  if (s === 428 && c === "confirm_required") return { kind: "confirm", words: "" };
  if (s === 409 && c === "file_changed" && err.current && typeof err.current.content === "string") return { kind: "changed", words: "" };
  if (s === 409 && c === "file_changed" && err.current === null) return { kind: "deleted", words: "This file was deleted on disk. Your text is kept: save to make it again." };
  if (s === 403 && c === "read_only_place") return { kind: "readonly", words: "XO keeps this file: it can't be saved here" };
  if (s === 403 && c === "outside_project") return { kind: "error", words: "This file is outside the project" };
  if (s === 403) return { kind: "error", words: "Saving isn't allowed here" };
  if (s === 413) return { kind: "error", words: "Too large to save here" };
  if (s === 503 && c === "writer_key_missing") return { kind: "error", words: "XO Space hasn't enabled saving yet" };
  if (s === 409) return { kind: "error", words: "The file changed and XO didn't send the new version" };
  if (!s) return { kind: "offline", words: "Not saved: XO can't be reached. It saves when it's back." };
  return { kind: "error", words: (err && err.message) || "Couldn't save" };
}

/**
 * Lines of `next` that differ from `prev`, 1-based and inclusive ([{from, to}]), for marking what someone else
 * changed. A deletion marks the line where it was. Pure.
 */
export function changedLines(prev, next) {
  const out = [];
  const n = Math.max(1, linesOf(next).length);
  for (const c of changes(linesOf(prev), linesOf(next))) {
    const from = c.bStart + 1, to = Math.max(c.bEnd, c.bStart + 1);
    out.push({ from: Math.min(from, n), to: Math.min(to, n) });
  }
  return out;
}

/**
 * The smallest edit that turns `a` into `b`, as character offsets {from, to, insert}, or null when they're the
 * same: an editor applies it as one change, so the caret and scroll stay where they were. Pure.
 */
export function minimalEdit(a, b) {
  if (a === b) return null;
  let s = 0;
  const max = Math.min(a.length, b.length);
  while (s < max && a.charCodeAt(s) === b.charCodeAt(s)) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a.charCodeAt(ea - 1) === b.charCodeAt(eb - 1)) { ea--; eb--; }
  return { from: s, to: ea, insert: b.slice(s, eb) };
}

/** Who made a version, in a few words ("You", "Pricing page", "Changed on disk"). Pure. */
export function byWords(by, threadTitle = () => null) {
  if (!by) return "";
  if (by.kind === "ui" || by.kind === "you") return "You";
  if (by.kind === "agent") return (by.thread_ts && threadTitle(by.thread_ts)) || "An agent";
  if (by.kind === "git") return "Git";
  if (by.kind === "disk") return "Changed on disk";
  return "";
}

/**
 * The documents. api: {projectFile, saveProjectFile} (js/api.js); store: localStorage or a stand-in; clock:
 * {now, set(fn, ms) → id, clear(id)}; onChange(doc, what): every state change ("state", "saved", "version",
 * "applied", "conflict"), for the views to redraw.
 */
export function createDocs({ api, store = null, clock = { now: () => Date.now(), set: (f, ms) => setTimeout(f, ms), clear: (id) => clearTimeout(id) }, onChange = () => {} }) {
  const docs = new Map(); // key → doc
  const keyOf = (project, rel) => draftKey(project, rel);
  const emit = (d, what) => { try { onChange(d, what); } catch (e) { console.error(e); } };

  /** The text the document has now: its view's, or what it held when the view let go. */
  const textOf = (d) => (d.source ? d.source() : d.text);

  function setState(d, state, err = null) {
    if (d.state === state && d.err === err) return;
    d.state = state; d.err = err;
    emit(d, "state");
  }

  function pushVersion(d, v) {
    const last = d.versions[d.versions.length - 1];
    if (last && last.version === v.version && v.version) { Object.assign(last, { ...v, text: v.text ?? last.text }); return; }
    const now = clock.now();
    if (last && v.by && v.by.kind === "ui" && last.by && last.by.kind === "ui" && last.kind !== "restore" && v.kind !== "restore" && last.t != null && now - last.t < MERGE_MS) {
      Object.assign(last, { version: v.version || null, at: v.at || new Date(now).toISOString(), text: v.text ?? null, id: last.id || v.id || null, t: now });
      emit(d, "version");
      return;
    }
    d.versions.push({ t: now, restores: v.restores ?? null, id: v.id || null, version: v.version || null, at: v.at || new Date(clock.now()).toISOString(), by: v.by || null, text: v.text ?? null, kind: v.kind || "edit" });
    // only the newest few keep their text in memory
    const held = d.versions.filter((x) => x.text != null);
    for (const x of held.slice(0, Math.max(0, held.length - KEEP_TEXT))) x.text = null;
    emit(d, "version");
  }

  /**
   * Open (or find) a file's document from what /file answered (content, version, editable, place…). A draft
   * left in this browser comes back as unsaved text and saves itself. refs count the views holding it.
   */
  function open(project, rel, data) {
    const key = keyOf(project, rel);
    let d = docs.get(key);
    if (d) { d.refs++; return d; }
    d = {
      key, project, rel, refs: 1,
      text: String(data.content ?? ""), base: String(data.content ?? ""), version: data.version ?? null,
      place: data.place || null, kind: data.kind || null, lineEndings: data.line_endings || null,
      state: "saved", err: null, confirm: false, confirmed: false, offline: false,
      source: null, apply: null, viewing: null,
      versions: [], saveT: 0, draftT: 0, inflight: null, merge: null, gen: 0,
    };
    if (data.editable === false || data.truncated || data.version == null) {
      d.state = "readonly";
      d.err = data.not_editable_reason || (data.truncated ? "truncated" : "not_text");
    }
    docs.set(key, d);
    pushVersion(d, { version: d.version, at: data.modified_at || null, by: null, text: d.base, kind: "open" });
    const dr = d.state === "saved" ? getDraft(store, key) : null;
    if (dr && dr.text !== d.base) {
      // your unsaved text from before: back, dirty, against the version it started from (a file that moved since
      // merges at the save, as any other change does)
      d.text = dr.text; d.base = dr.base; d.version = dr.version;
      d.state = "dirty";
    } else if (dr) dropDraft(store, key);
    return d;
  }

  /** A view lets go of the document; the last one gone keeps unsaved text as a draft (never saves it) and forgets it. */
  function release(d) {
    if (!d || --d.refs > 0) return;
    if (d.source) { d.text = d.source(); d.source = null; }
    d.apply = null;
    if (d.state === "dirty" || d.state === "error" || d.state === "deleted" || d.state === "conflict") keepDraft(d);
    // a save still out finishes on its own; the document goes once nothing holds it
    const gone = () => { if (d.refs <= 0 && !d.inflight) { clock.clear(d.saveT); clock.clear(d.draftT); docs.delete(d.key); } };
    if (d.inflight) d.inflight.then(gone, gone); else gone();
  }

  /**
   * The view's hooks: source() → its text now; apply(edit, {lines, why}) changes its text by a minimal edit
   * (someone else's change, a merge), keeping the caret where it was.
   */
  function attach(d, { source, apply, length = null }) {
    if (d.source && !source) d.text = d.source();
    d.source = source || null; d.apply = apply || null; d.length = source ? length : null;
    if (source) { const t = source(); if (t !== d.text) { const e = minimalEdit(t, d.text); if (e && apply) apply(e, { lines: [], why: "restore" }); } }
  }

  function keepDraft(d) {
    clock.clear(d.draftT);
    const text = textOf(d);
    if (text === d.base) { dropDraft(store, d.key); return true; }
    return putDraft(store, d.key, { text, base: d.base, version: d.version, at: clock.now() });
  }

  /** You typed (the view says so on each change: cheap, no text read). */
  function edited(d) {
    if (d.state === "readonly" || d.state === "conflict" || d.viewing) return;
    // back to the saved text (undone, or typed back): saved again, and its draft goes (the owner, 19 Nov 12:06Z: "i
    // edit and then when i undo everything, this still shows"). Cheap: the text is compared only when its length is
    // the saved one's (the view says its length without building the text)
    if ((d.state === "dirty" || d.state === "error") && sameAsSaved(d)) {
      clock.clear(d.draftT);
      dropDraft(store, d.key);
      setState(d, "saved");
      return;
    }
    if (d.state === "saved" || d.state === "error" || d.state === "deleted") setState(d, d.state === "deleted" ? "deleted" : "dirty", d.state === "deleted" ? d.err : null);
    clock.clear(d.draftT);
    d.draftT = clock.set(() => keepDraft(d), DRAFT_MS);
  }
  /** The text is the saved one again: same length first (no text built), then the same text. */
  function sameAsSaved(d) {
    const n = d.length ? d.length() : null;
    if (n != null && n !== d.base.length) return false;
    return textOf(d) === d.base;
  }

  /** Save now: ⌘S / Ctrl+S (or Save in the "save your changes?" question). The only way a file is written. */
  function flush(d) {
    if (!d || d.confirm) return d && d.inflight;
    if (d.state !== "dirty" && d.state !== "deleted" && d.state !== "error") return d.inflight;
    return save(d);
  }

  async function save(d, { confirm = null } = {}) {
    if (d.inflight) { d.again = true; return d.inflight; }
    if (d.state === "readonly" || d.state === "conflict" || d.viewing) return;
    if (d.confirm && !confirm) return;
    const text = textOf(d);
    if (text === d.base && d.state !== "deleted") {
      dropDraft(store, d.key);
      if (d.state !== "saved") setState(d, "saved");
      return;
    }
    const was = d.state;
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
        // the file changed since you opened it: merged into yours, and (it was your ⌘S) saved on top when nothing clashes
        if (o.kind === "changed") { mergeIn(d, err.current, { by: { kind: "agent" }, saving: true }); return; }
        if (o.kind === "deleted") { d.deleted = true; setState(d, "deleted", o.words); keepDraft(d); return; }
        if (o.kind === "readonly") { setState(d, "readonly", "read_only_place"); keepDraft(d); return; }
        if (o.kind === "offline") { d.offline = true; setState(d, "error", "Not saved: XO can't be reached. Your text is kept; press ⌘S again."); keepDraft(d); return; }
        setState(d, "error", o.words); keepDraft(d);
        void was;
      }
      if (d.again) { d.again = false; if (d.state === "dirty") save(d); } // ⌘S pressed again while it saved
    })();
    d.inflight = run;
    return run;
  }

  /** Answer the "this file runs code" question: yes saves now (and from then on); no leaves it unsaved. */
  function confirmRunsCode(d, yes) {
    if (!d.confirm) return;
    if (!yes) { d.confirm = false; d.declined = true; setState(d, "dirty"); emit(d, "confirm"); return; }
    d.confirm = false; d.confirmed = true;
    save(d, { confirm: "runs_code" });
  }

  /**
   * Someone else's version of the file: {version, content} (a 409's current, or one read after a change came in),
   * with who made it. Saved: the new text goes in. Dirty: merged into yours. Same lines: the merge view.
   */
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
    // the same lines, changed both ways: the merge view decides; nothing saves until every place is chosen. The
    // editor holds the merge with your lines in each such place (ours), shown against the same merge with theirs
    // (other): each place is one chunk, kept (yours) or taken back (theirs)
    const ours = merge3(d.base, mine, theirs, { pick: "ours" }).text, other = merge3(d.base, mine, theirs, { pick: "theirs" }).text;
    d.merge = { base: d.base, mine, theirs, version: current.version, text: ours, other, left: m.conflicts, saving };
    const e = minimalEdit(mine, ours);
    d.text = ours;
    if (e && d.apply) d.apply(e, { lines: changedLines(mine, ours), why: "merging" });
    keepDraft(d);
    setState(d, "conflict");
    emit(d, "conflict");
  }

  /** The merge view's places still to choose. With none left, `resolve` takes what the editor holds and saves it. */
  function mergeProgress(d, left) {
    if (!d.merge || d.merge.left === left) return;
    d.merge.left = left;
    emit(d, "state");
  }
  function resolve(d) {
    if (!d.merge || d.merge.left) return false;
    const { version, theirs, saving } = d.merge;
    d.merge = null;
    d.base = theirs; d.version = version;
    // what the editor holds now is the choice (each place kept or taken back); saved now only when the clash came
    // from your ⌘S, otherwise it waits for the next one
    d.text = textOf(d);
    setState(d, "dirty");
    keepDraft(d);
    if (saving) flush(d);
    return true;
  }

  /**
   * A change to the file came in (Space's file.version, or today's /changes signal): the new text is read and
   * taken in. info: {version, by, at, id, kind ("delete", "rename", …), path (rename's new path)}. read(d) →
   * /file's answer; the default reads Space.
   */
  async function changed(project, rel, info = {}, read = null) {
    const d = docs.get(keyOf(project, rel));
    if (!d) return null;
    if (info.version && info.version === d.version) return d; // ours, or already in
    if (info.kind === "delete") {
      d.deleted = true;
      pushVersion(d, { version: null, at: info.at, by: info.by, text: null, id: info.id, kind: "delete" });
      setState(d, "deleted", "This file was deleted on disk. Your text is kept: save to make it again.");
      keepDraft(d);
      return d;
    }
    const my = ++d.gen;
    let cur;
    try { cur = read ? await read(d) : await api.projectFile(d.project, d.rel); } catch { return d; }
    if (my !== d.gen || !docs.has(d.key)) return d;
    if (!cur || typeof cur.content !== "string" || cur.truncated) return d;
    if (cur.version === d.version) return d;
    if (d.inflight) { await d.inflight.catch(() => {}); if (cur.version === d.version) return d; }
    mergeIn(d, { version: cur.version, content: cur.content }, { by: info.by || null, at: info.at || cur.modified_at || null, id: info.id || null });
    return d;
  }

  /** Versions Space reports (GET /versions) fold in: who and when for versions held here, older ones listed. */
  /** The file was renamed or moved (Space's rename event, or the tree's own): the document follows it. */
  function renamed(project, oldRel, newRel) {
    const d = docs.get(keyOf(project, oldRel));
    if (!d || docs.has(keyOf(project, newRel))) return null;
    const was = d.key;
    docs.delete(was);
    dropDraft(store, was);
    d.rel = newRel; d.key = keyOf(project, newRel);
    docs.set(d.key, d);
    if (d.state !== "saved") keepDraft(d);
    emit(d, "renamed");
    return d;
  }

  function knownVersions(d, list) {
    if (!d || !Array.isArray(list)) return;
    const have = new Map(d.versions.filter((v) => v.version).map((v) => [v.version, v]));
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
  function view(d, index) {
    if (index == null || index >= d.versions.length - 1) { d.viewing = null; emit(d, "state"); return null; }
    d.viewing = d.versions[Math.max(0, index)];
    emit(d, "state");
    return d.viewing;
  }

  /** Don't save: your unsaved text goes (and its draft); the document is the file again. */
  function discard(d) {
    if (!d) return;
    const now = textOf(d), e = minimalEdit(now, d.base);
    d.text = d.base; d.merge = null; d.confirm = false;
    if (e && d.apply) d.apply(e, { lines: [], why: "discard" });
    dropDraft(store, d.key);
    setState(d, d.deleted ? "deleted" : "saved", d.deleted ? d.err : null);
  }

  /** Make an older version's text the file's again: a save, so it's a new version (and undoable). Space records it as
   *  a restore of that version (its id goes with the save) where it knows the version. */
  function restore(d, text, { id = null } = {}) {
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
    get: (project, rel) => docs.get(keyOf(project, rel)) || null,
    all: () => [...docs.values()],
    /** Unsaved anywhere (the page going away asks only when a draft couldn't be kept). */
    unsaved: () => [...docs.values()].filter((d) => d.state === "dirty" || d.state === "saving" || d.state === "conflict" || d.state === "error" || d.state === "deleted"),
    textOf,
  };
}
