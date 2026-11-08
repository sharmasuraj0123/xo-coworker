// The file viewer (if1 #2): a shared file opens in a panel beside the conversation, like a canvas.
// Markdown renders (markdown.js), other text is coloured code with line numbers (highlight.js), and
// HTML shows in a sandboxed frame that runs the page's own scripts but has no same-origin (an opaque origin:
// no reach into XO's window, cookies, storage or /api, which serve.py refuses a null origin; no popups,
// forms or top navigation; Source shows its text), and an
// image shows fitted to the panel (Actual size, or a click on it, shows it 1:1). It reads the
// project-scoped `/api/xo-projects/<project>/file` and `/image` routes only, never `/api/files/*`.
// A file attached to a message (hub #30) opens here too: an image as itself, a PDF in a frame, text as
// text (read with fetch, never rendered as HTML), all from the attachment route, which the server
// guards with its own headers. A long paste not sent yet previews from the composer.
// A project file also downloads whole from the project-scoped `/download` route, which matters most
// when the preview stops at 256 KB. It is fetched with the Coder header and saved as a blob, so the
// token never sits in a URL (or the browser's download history).
// Esc closes it; on phones it takes the whole screen. Focus goes in, and back to the file card.
// With the Map open (js/map.js) the two are one right-hand panel with two modes, Live and File: `tabs`
// draws the switch, and switching to Live parks the file (hidden, kept) until you come back to it.

import { esc, isImagePath } from "./util.js";
import { fileIcon } from "./fileicons.js";
import { ICON, $ } from "./ui.js";
import { renderMarkdown } from "./markdown.js";
import { api, attachmentUrl, attachmentText } from "./api.js";
import { kindOf, typeWord } from "./attach.js";
import * as DV from "./diffview.js";
import * as K from "./keys.js";
import { countsHtml } from "./changesframe.js";
import { merge3 } from "./merge.js";
import { draftKey, getDraft, putDraft, dropDraft } from "./drafts.js";
import { isImageChange, drawImageChange } from "./imagechange.js";

const size = (n) => (n == null ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const bytes = (s) => new TextEncoder().encode(s).length;
const extOf = (name) => (/\.([\w-]+)$/.exec(String(name || "")) || [])[1] || "";
const KIND_WORD = { markdown: "Markdown", html: "HTML", text: "Text", code: "Code", json: "JSON" };

const EDIT_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
const LOCK_IC = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>';
const BOLT_IC = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3.5 5.5 13.5H12l-1 7 7.5-10H12z"/></svg>';
// files git or an agent runs (Space confirms a save to one with a 428; the head says so before you edit)
// before Space answers with the file's place: what git or an agent runs. Case doesn't matter (Space treats
// .GIT/ and .Claude/ as .git/ and .claude/, on any file system)
export const RUNS = /^(?:\.git|\.claude|\.codex|\.agents)(?:\/|$)|^\.mcp\.json$/i;
// Space's reasons a file can't be edited here, in words
const NOT_EDITABLE = {
  read_only_place: "Read only · XO keeps this file",
  too_large: "Too large to edit here",
  truncated: "Too large to edit here",
  not_utf8: "Not plain text",
  not_text: "Not plain text",
  historical: "An earlier version: read only",
};
const ASK_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.3-4.6A7.5 7.5 0 1 1 20 11.5z"/></svg>';
const MORE_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>';
const SPLIT_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M12 4.5v15"/></svg>';
// the Source toggle's glyph: angle brackets, drawn like the other line icons
const SRC_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 7-5 5 5 5M16 7l5 5-5 5"/></svg>';

/**
 * What a refused save means, in words (Space's PUT /file): {kind: "confirm" (a file that runs code: ask, then
 * send again with confirm "runs_code") | "conflict" (the file changed: merge, err.current) | "readonly" |
 * "error", words}. Pure.
 */
export function saveOutcome(err) {
  const s = err && err.status, c = err && err.code;
  if (s === 428 && c === "confirm_required") return { kind: "confirm", words: "" };
  if (s === 409 && c === "file_changed" && err.current && typeof err.current.content === "string") return { kind: "conflict", words: "" };
  if (s === 409 && c === "file_changed" && err.current === null) return { kind: "error", words: "This file was deleted while you were editing: copy what you need" };
  if (s === 403 && c === "read_only_place") return { kind: "readonly", words: "XO keeps this file: it can't be saved here" };
  if (s === 403 && c === "outside_project") return { kind: "error", words: "This file is outside the project" };
  if (s === 403) return { kind: "error", words: "Saving isn't allowed here" };
  if (s === 503 && c === "writer_key_missing") return { kind: "error", words: "XO Space hasn't enabled saving yet" };
  if (s === 409) return { kind: "error", words: "The file changed and XO didn't send the new version: copy your edit, then open it again" };
  return { kind: "error", words: (err && err.message) || "Couldn't save" };
}

/*
 * A text file shows whole through Pierre too (js/diffview.js file: virtualised, coloured in the worker).
 * Select lines (drag across the numbers, or Shift-click) and "Ask about lines 36–43 ⌘L" appears under them;
 * it opens a small composer under those lines (the code moves down for it) that sends to the file's own
 * thread, or the project's coordinator. ask: {target(f) → its name in words, or null when there's nowhere
 * to send; send(f, a, b, text) → true when it went}. lines on a file opened: [a, b] selected and in view.
 */
/*
 * Edit (P3): a file Space says you can edit (/file's version, editable) turns into Pierre's editor in place;
 * Save (⌘S) sends it with the version you started from. A file that runs code asks once before its first
 * save; a place XO keeps is read only, said in words; if the file changed while you edited, both versions
 * are merged and any place you both changed waits in Pierre's merge view for your choice. A save never
 * commits. edits: {saved(f, {path, editId, merged}) after a save: the app offers Undo and Tell the agent;
 * removed(f) when a new file's Undo took it away}. A file just made (Files › New file, open's f.created: its
 * edit id) opens being edited, with "Created · Undo" at its foot.
 */
export function createViewer({ announce, onChange, tabs, changes = null, ask = null, edits = null, away = null }) {
  const el = $("#viewer");
  const V = { open: false, parked: false, file: null, data: null, error: null, loading: false, mode: "preview", returnTo: null, gen: 0, copied: false, dims: null, saving: false, saveError: null, show: "file", split: false, draft: null, menu: false };
  // the diff, kept across redraws of the head (Pierre's element moves with its body): {el, handle, img (an image
  // change's drawing, js/imagechange.js), key, gen}
  const DF = { el: null, handle: null, img: null, key: null, gen: 0 };
  /** This file in its place's changes ({scope, path, file, base}), or null. */
  const chg = () => (changes && V.file && V.file.project && V.file.rel ? changes.at(V.file.project, V.file.rel) : null);
  const showsDiff = () => V.show === "changes" && !!chg();
  // the whole file through Pierre: {el (the scroller), handle, key, pend, gen, sel: {a, b}, asking, q (the composer)}
  const FL = { el: null, handle: null, key: null, pend: null, gen: 0, sel: null, asking: false, q: null };
  // editing: {ed (the editor), base (the text you started from), version, dirty, saving, err, confirm,
  //   from (opened from a draft unlike the file), confirmed (this file runs code and you said Save once),
  //   discard (asking to discard), conflict: {view, version, left, text}}; saved: the last save's toast
  //   {path, editId, name}
  const ED = { on: false };
  // drafts (js/drafts.js): your unsaved edits, kept in this browser when you leave the file
  const store = (() => { try { return localStorage; } catch { return null; } })();
  const dkey = () => (V.file && V.file.project && V.file.rel ? draftKey(V.file.project, V.file.rel) : null);
  let draftT = 0;
  /** Keep what's in the editor as this file's draft (or let it go, when it's the file again). False: not kept. */
  function keepDraft() {
    clearTimeout(draftT);
    if (!ED.on || !ED.ed || ED.conflict) return false;
    const text = ED.ed.text();
    if (text === ED.base) { dropDraft(store, dkey()); V.draft = null; if (ED.dirty) { ED.dirty = false; ED.from = false; paintHead(); } return true; }
    const d = { text, base: ED.base, version: ED.version, at: Date.now() };
    if (!putDraft(store, dkey(), d)) return false;
    V.draft = d;
    return true;
  }
  /** After a pause in typing, never on a keystroke. */
  const draftSoon = () => { clearTimeout(draftT); draftT = setTimeout(keepDraft, 800); };
  const letDraftGo = () => { clearTimeout(draftT); dropDraft(store, dkey()); V.draft = null; };
  let saved = null;
  const showsFile = () => {
    const d = V.data;
    if (!V.open || V.loading || V.error || V.why || !d || typeof d.content !== "string" || showsDiff()) return false;
    return d.kind === "markdown" || d.kind === "html" ? V.mode === "source" : d.kind !== "image" && d.kind !== "pdf";
  };

  /** The object URL an image is shown from lives as long as the image is open. */
  function dropImage() {
    if (V.data && V.data.url && !V.data.remote) URL.revokeObjectURL(V.data.url);
  }

  /** A shared project file saves whole; attachments and pastes have no project. */
  const canSave = () => !!(V.file.project && V.file.rel);

  /** Download the whole file (a project file's own route). Its own name: Edit's save() is another job. */
  async function download() {
    if (V.saving) return;
    const f = V.file;
    V.saving = true; V.saveError = null; redrawKeep();
    try {
      const url = URL.createObjectURL(await api.projectDownload(f.project, f.rel));
      const a = Object.assign(document.createElement("a"), { href: url, download: f.name || "file" });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      if (f === V.file) V.saveError = err.message || "Couldn't download this file.";
    }
    if (f !== V.file) return;
    V.saving = false; redrawKeep();
  }

  /**
   * ⋯ in the head: Copy, Copy path, Download (an attachment: Download, or Open in a new tab), in a menu. While
   * a copy or a download lasts, the ⋯ itself says so ("Copied", "Downloading…"): the menu has closed by then.
   */
  function moreHtml(f, canCopy) {
    const url = f.att ? esc(attachmentUrl(f.att.chat, f.att.id)) : "";
    const items = [
      canCopy && `<button type="button" role="menuitem" data-vw-copy>${ICON.copy}<span>Copy</span></button>`,
      canSave() && `<button type="button" role="menuitem" data-vw-copy-path>${ICON.copy}<span>Copy path</span></button>`,
      // an attachment opens in its own tab too; text has no inline view there, so it downloads
      f.att ? (kindOf(f.type || "") === "text"
        ? `<a role="menuitem" href="${url}" download="${esc(f.name || "file")}">${ICON.down}<span>Download</span></a>`
        : `<a role="menuitem" href="${url}" target="_blank" rel="noopener noreferrer">${ICON.arrow}<span>Open in a new tab</span></a>`)
        : canSave() && `<button type="button" role="menuitem" data-vw-download>${ICON.down}<span>Download</span></button>`,
    ].filter(Boolean);
    if (!items.length) return "";
    const done = V.copied, busy = V.saving, word = done ? "Copied" : busy ? "Downloading…" : "";
    return `<span class="vw-mw"><button type="button" class="vw-btn vw-more${done ? " is-done" : busy ? " is-busy" : ""}" data-vw-more aria-haspopup="menu" aria-expanded="${!!V.menu}" title="${word || "Copy, download"}" aria-label="${word || "More: copy, download"}"${busy ? " disabled" : ""}>` +
      `${done ? ICON.check : busy ? `<i class="spin" aria-hidden="true"></i>` : MORE_IC}${word ? `<span>${word}</span>` : ""}</button>` +
      (V.menu ? `<span class="vw-menu" role="menu" aria-label="${esc(f.name || "This file")}">${items.join("")}</span>` : "") + `</span>`;
  }
  /** Close the ⋯'s menu; back: focus the ⋯ again (Esc, Tab, or after what you chose). */
  function menuOff(back = false) {
    if (!V.menu) return;
    V.menu = false;
    paintHead();
    if (back) el.querySelector("[data-vw-more]")?.focus({ preventScroll: true });
  }
  const inMore = () => !!(document.activeElement && document.activeElement.closest && document.activeElement.closest(".vw-mw"));
  /** Redraw for a copy or a download, with focus kept on the ⋯ when it was there or in its menu. */
  function redrawKeep() {
    const on = inMore();
    V.keepScroll = true; render();
    if (on) el.querySelector("[data-vw-more]")?.focus({ preventScroll: true });
  }

  function head() {
    const f = V.file, d = V.data;
    const kind = f.att || f.local != null ? typeWord(f.type || "", f.name) : d ? KIND_WORD[d.kind] || (extOf(f.name).toUpperCase() || "Text") : String(f.type || "").split("/").pop() || "";
    const c = chg(), diffing = showsDiff();
    const meta = diffing ? [] : [kind, V.dims && `${V.dims.w} × ${V.dims.h}`, size(d ? d.size_bytes : f.bytes)].filter(Boolean);
    const canCopy = !diffing && !!(d && typeof d.content === "string");
    const more = moreHtml(f, canCopy);
    // a changed file: what changed, or the whole file (the design's head: name, counts, the switch)
    const show = c ? `<div class="vw-seg is-words" role="group" aria-label="Show"><button type="button" data-vw-show="changes" aria-pressed="${diffing}">Changes</button><button type="button" data-vw-show="file" aria-pressed="${!diffing}">File</button></div>` +
      (diffing ? `<button type="button" class="vw-btn vw-split${V.split ? " is-on" : ""}" data-vw-split aria-pressed="${V.split}" title="${V.split ? "One column" : "Side by side"}" aria-label="Side by side">${SPLIT_IC}</button>` : "") : "";
    const toggle = diffing ? "" : d && (d.kind === "html" || d.kind === "markdown")
      ? `<div class="vw-seg" role="group" aria-label="Show"><button type="button" data-vw-mode="preview" aria-pressed="${V.mode === "preview"}" title="Preview" aria-label="Preview">${ICON.eye}<span>Preview</span></button><button type="button" data-vw-mode="source" aria-pressed="${V.mode === "source"}" title="Source" aria-label="Source">${SRC_IC}<span>Source</span></button></div>`
      : d && d.kind === "image"
        ? `<div class="vw-seg" role="group" aria-label="Size"><button type="button" data-vw-mode="preview" aria-pressed="${V.mode === "preview"}">Fit</button><button type="button" data-vw-mode="actual" aria-pressed="${V.mode === "actual"}" aria-label="Actual size"><span class="vw-wide">Actual size</span><span class="vw-narrow" aria-hidden="true">1:1</span></button></div>`
        : "";
    const name = `<span class="vw-ic" aria-hidden="true">${fileIcon(f.name || f.path || "")}</span>` +
      `<div class="vw-t"><h2 id="vw-h"${f.where ? ` title="${esc(f.where)}"` : ""}>${esc(f.name || f.path)}</h2>${c && diffing ? countsHtml(c.file) : ""}${meta.length && !ED.on ? `<span class="vw-meta">${esc(meta.join(" · "))}</span>` : ""}</div>`;
    const runs = !diffing && runsCode() ? `<span class="xd-runs" title="Git or an agent runs what this file says">${BOLT_IC}<span>Runs code</span></span>` : "";
    if (ED.on) return `<header class="vw-top">${name}<div class="vw-acts">${runs}${editActs()}</div>${ED.confirm ? confirmPop() : ""}</header>`;
    const why = !diffing && d && typeof d.content === "string" && d.editable === false ? NOT_EDITABLE[d.not_editable_reason] || "Read only" : "";
    const edit = why ? `<span class="xd-ro" title="${d.not_editable_reason === "read_only_place" ? "XO keeps this file: change it from its own screen" : esc(why)}">${d.not_editable_reason === "read_only_place" ? LOCK_IC : ""}<span>${esc(why)}</span></span>`
      : diffing && V.draft ? `<button type="button" class="xd-btn xd-draft" data-vw-show="file" title="Your unsaved edits to this file are kept: see them in File"><i></i>Your draft</button>`
      : !diffing && canEdit() && V.draft && !ED.opening ? `<span class="xd-state" title="Your unsaved edits, kept in this browser"><i></i>Your draft</span><button type="button" class="xd-btn" data-vw-draftx title="Let your draft go">Discard</button><button type="button" class="xd-edit" data-vw-edit title="Continue editing (E)" aria-label="Continue your draft">${EDIT_IC}<span>Continue</span></button>`
      : !diffing && canEdit() ? `<button type="button" class="xd-edit" data-vw-edit title="Edit (E)" aria-label="Edit"${ED.opening ? " disabled" : ""}>${EDIT_IC}<span>${ED.opening ? "Opening…" : "Edit"}</span></button>` : "";
    const upd = V.updated && !diffing ? `<button type="button" class="xd-btn vw-upd" data-vw-update title="An agent changed this file after you opened it: show the new version">Updated · Show</button>` : "";
    return `<header class="vw-top">${name}` +
      `<div class="vw-acts">${upd}${runs}${show}${toggle}${edit}${more}` +
      `<button type="button" class="vw-x" data-vw-close aria-label="Close the file" title="Close (Esc)">${ICON.close}</button></div></header>`;
  }

  // ── editing ─────────────────────────────────────────────────────────────────────────────────
  /** The file's path in its own place (a worktree's own path), for the run-code rule and messages. */
  const localPath = () => String(V.file.rel || "").replace(/^\.xo\/worktrees\/[^/]+\//, "");
  // Space says (/file's place: ordinary, read_only, runs_code); before it answers, the same rule by path
  const runsCode = () => !!(V.file && V.file.project && V.file.rel && (V.data && V.data.place ? V.data.place === "runs_code" : RUNS.test(localPath())));
  /** Space says this file can be edited here (a version to save against, and not one it keeps). */
  // only where Space answers with its edit fields; a cut preview has no version and is read whole to edit
  const canEdit = () => !!(edits && V.file.project && V.file.rel && V.data && typeof V.data.content === "string" && !V.loading && !showsDiff() && V.data.kind !== "image" && V.data.kind !== "pdf" && "editable" in V.data && V.data.editable !== false && (V.data.version != null || V.data.truncated));
  const MODS = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl ";
  function editActs() {
    if (ED.discard) return `<span class="xd-state">Discard your edits?</span><button type="button" class="xd-btn" data-vw-keep>Keep editing</button><button type="button" class="xd-btn is-warn" data-vw-discard>Discard</button>`;
    if (ED.conflict) return `<span class="xd-state">${ED.conflict.left ? `${ED.conflict.left} ${ED.conflict.left === 1 ? "place" : "places"} to choose` : "All chosen"}</span><span class="xd-vsep"></span><button type="button" class="xd-btn" data-vw-cancel>Cancel</button><button type="button" class="xd-btn is-pri" data-vw-saveit${ED.conflict.left || ED.saving ? " disabled" : ""}>Save <kbd>${MODS}S</kbd></button>`;
    return (ED.moved ? `<span class="xd-state" title="It changed since you left it: Save merges your edits with those changes">Changed since your draft</span>` : ED.dirty || ED.err ? `<span class="xd-state"><i></i>Edited</span>` : "") +
      `<span class="xd-vsep"></span><button type="button" class="xd-btn" data-vw-cancel>Cancel</button><button type="button" class="xd-btn is-pri" data-vw-saveit${ED.saving ? " disabled" : ""}>${ED.saving ? "Saving…" : `Save <kbd>${MODS}S</kbd>`}</button>`;
  }
  const confirmPop = () => `<div class="xd-pop" role="dialog" aria-label="Save a file that runs code"><p><b>Git or an agent runs what this file says.</b> A slip here runs on the next commit or the next agent turn. Save anyway?</p><div class="xd-pop-a"><button type="button" class="xd-btn" data-vw-noconfirm>Cancel</button><button type="button" class="xd-btn is-pri" data-vw-confirm>Save</button></div></div>`;
  /** Redraw only the head: the editor below keeps its focus and caret. */
  function paintHead() {
    const top = el.querySelector(".vw-top");
    if (!top) return;
    top.outerHTML = head();
    errPaint();
  }
  /** A save that didn't go, in words, on its own line under the head: never pushing Cancel and Save away. */
  function errPaint() {
    let line = el.querySelector(":scope > .xd-errline");
    const why = ED.on ? ED.err : null;
    if (!why) { if (line) line.remove(); return; }
    if (!line) { line = document.createElement("p"); line.className = "vw-cut xd-errline"; line.setAttribute("role", "alert"); el.querySelector(".vw-top")?.after(line); }
    line.innerHTML = `${ICON.clock}<span>${esc(why)}</span>`;
  }
  /** Edit: the head turns into Cancel · Save once the editor is really there (a caret you can type at). */
  async function startEdit() {
    const f = V.file, my = V.gen;
    if (!canEdit() || ED.on || ED.opening) return;
    Object.assign(ED, { opening: true, ed: null, base: null, version: null, dirty: false, saving: false, err: null, confirm: false, discard: false, conflict: null, real: null, moved: false, from: false });
    V.saveError = null; V.menu = false;
    if (!(saved && saved.created)) { saved = null; toastPaint(); }
    // a document (Markdown, HTML) is edited as its source
    if (!showsFile()) { V.mode = "source"; V.textMode = "source"; render(); } else paintHead();
    const fail = (why) => { ED.opening = false; if (my !== V.gen) return; if (why) V.saveError = why; render(); };
    try {
      // the whole file and its current version (a preview can stop at 256 KB; an edit reads up to 1 MB)
      const d = await api.projectFile(f.project, f.rel, null, { purpose: "edit" });
      if (my !== V.gen) return fail();
      if (d.editable === false || d.truncated || d.version == null) { V.data = { ...V.data, ...d, editable: false, not_editable_reason: d.not_editable_reason || (d.truncated ? "truncated" : "not_text") }; return fail(); }
      // your draft, if you left one: the editor opens on it, against the version you started from (a file
      // that changed since saves through the usual merge); the file itself comes back if you leave it again
      const dr = V.draft;
      if (dr) { ED.real = d; ED.moved = dr.version !== d.version; V.data = { ...d, content: dr.text, version: dr.version }; dropFile(); render(); }
      else if (d.content !== V.data.content) { V.data = d; dropFile(); render(); }
      else V.data = d;
      for (let i = 0; i < 60 && !FL.handle; i++) await new Promise((r) => requestAnimationFrame(r));
      if (my !== V.gen || !FL.handle) return fail();
      // per keystroke only what's cheap: the editor's own "something to undo"; the whole text is read once a
      // pause in typing, for the draft (and its "the same as the file again")
      const ed = await FL.handle.edit({ onChange: () => { if (!ED.ed) return; const dirty = ED.from || ED.ed.dirty(); draftSoon(); if (dirty !== ED.dirty || ED.err) { ED.dirty = dirty; ED.err = null; paintHead(); } } });
      if (my !== V.gen) { ed.stop(); return fail(); }
      Object.assign(ED, dr ? { on: true, opening: false, ed, base: dr.base, version: dr.version, dirty: dr.text !== dr.base, from: dr.text !== dr.base } : { on: true, opening: false, ed, base: d.content, version: d.version, from: false });
      if (FL.sel) { FL.sel = null; askCapsule(); }
      paintHead();
      ed.focus({ lineNumber: f.lines ? f.lines[0] : "first-visible" });
      announce(`Editing ${f.name}. ${MODS}S saves, Esc leaves.`);
    } catch (err) {
      if (err.status === 413) { V.data = { ...V.data, editable: false, not_editable_reason: "too_large" }; return fail(); }
      fail(err.message || "Couldn't open this file for editing.");
    }
  }
  /** Leave editing. keep: what's now in the file view stays (after a save); else it goes back to the file. */
  function stopEdit({ keep = false } = {}) {
    if (!ED.on) return;
    if (ED.ed) ED.ed.stop();
    const was = ED.conflict;
    clearTimeout(draftT);
    ED.on = false; ED.ed = null; ED.conflict = null; ED.confirm = false; ED.discard = false; ED.moved = false;
    if (was && was.view) { was.view.destroy(); }
    if (!keep && ED.real) V.data = ED.real; // the file as it is, not your draft
    ED.real = null;
    if (!keep || was) { dropFile(); }
    render();
  }
  function cancelEdit() {
    if (ED.dirty && !ED.discard && !ED.conflict) { ED.discard = true; paintHead(); return; }
    letDraftGo();
    stopEdit();
  }
  async function save(confirm = null) {
    if (!ED.on || ED.saving) return;
    const f = V.file, conflict = ED.conflict;
    const text = conflict ? conflict.text : ED.ed && ED.ed.text();
    if (text == null) return;
    if (!conflict && text === ED.base) { stopEdit({ keep: true }); return; }
    ED.saving = true; ED.err = null; ED.confirm = false; paintHead();
    try {
      const r = await api.saveProjectFile(f.project, f.rel, text, conflict ? conflict.version : ED.version, confirm || (ED.confirmed ? "runs_code" : null));
      V.data = { ...V.data, content: text, version: r.version, size_bytes: new TextEncoder().encode(text).length, modified_at: r.saved_at || V.data.modified_at };
      ED.saving = false;
      letDraftGo();
      ED.real = null;
      stopEdit({ keep: !conflict });
      saved = { path: localPath(), name: f.name, editId: r.edit_id, merged: !!conflict, unchanged: !!r.unchanged };
      toastPaint();
      announce(`Saved ${f.name}.`);
      edits && edits.saved && edits.saved(f, saved);
    } catch (err) {
      ED.saving = false;
      const o = saveOutcome(err);
      if (o.kind === "confirm") { ED.confirm = true; paintHead(); el.querySelector("[data-vw-confirm]")?.focus(); return; }
      if (o.kind === "conflict") { clash(text, err.current); return; }
      if (o.kind === "readonly") V.data = { ...V.data, editable: false, not_editable_reason: "read_only_place" };
      ED.err = o.words; // your edit stays in the editor: nothing is lost
      paintHead();
    }
  }
  /**
   * The file changed while you edited (409): yours and the agent's, merged against where you started. With
   * no place you both changed, it saves at once (against the agent's version); otherwise the merge view.
   */
  async function clash(mine, current) {
    const m = merge3(ED.base, mine, current.content);
    if (!m.conflicts) { ED.conflict = { view: null, version: current.version, left: 0, text: m.text }; return save(); }
    if (ED.ed) { ED.ed.stop(); ED.ed = null; }
    const host = fileBody();
    if (FL.handle) { FL.handle.destroy(); FL.handle = null; FL.key = null; FL.pend = null; }
    host.replaceChildren();
    ED.conflict = { view: null, version: current.version, left: m.conflicts, text: m.text };
    el.querySelector(".xd-bar")?.remove();
    host.insertAdjacentHTML("beforebegin", `<p class="xd-bar"><b>The agent changed ${esc(V.file.name)} while you were editing.</b> Where you both changed the same lines, choose what to keep, then save.</p>`);
    paintHead();
    ED.conflict.view = await DV.conflict(host, m.text, {
      path: V.file.name,
      labels: { current: "Keep yours", incoming: "Take the agent's", both: "Keep both" },
      onResolve: (text, left) => { if (!ED.conflict) return; ED.conflict.text = text; ED.conflict.left = left; paintHead(); },
    });
  }
  /** "Saved · Undo · Tell the agent", at the foot of the file, for the last save. */
  function toastPaint() {
    let t = el.querySelector(":scope > .xd-toast");
    if (!saved || !V.open) { if (t) t.remove(); return; }
    if (!t) { t = document.createElement("div"); t.className = "xd-toast"; el.appendChild(t); }
    const acts = `${saved.editId ? `<button type="button" class="t-undo" data-vw-undo${saved.created ? ` title="Take ${esc(saved.name)} away again"` : ""}>Undo</button>` : ""}${edits && edits.tell && !saved.unchanged && !saved.created ? `<button type="button" class="t-undo" data-vw-tell>Tell the agent</button>` : ""}`;
    t.innerHTML = `<div class="toast" role="status"><span class="t-ic">${ICON.check}</span><span class="t-m"><b>${saved.created ? "Created" : saved.unchanged ? "Nothing to save" : "Saved"}</b> <span>${esc(saved.name)}${saved.unchanged ? " is as it was" : saved.merged ? ", with the agent's changes" : ""}</span></span>` +
      `${acts ? `<span class="xd-tacts">${acts}</span>` : ""}<button type="button" class="xd-tx" data-vw-toastx aria-label="Close">${ICON.close}</button></div>`;
  }
  async function undoSave() {
    const f = V.file, s = saved;
    if (!s || !s.editId) return;
    saved = null; toastPaint();
    if (s.created) { // the file goes: what you typed in it since goes with it
      if (ED.on) { letDraftGo(); stopEdit(); }
      try { await api.undoProjectEdit(f.project, s.editId); }
      catch (err) { if (V.file === f) { V.saveError = err.status === 409 ? `${s.name} changed since it was made: it stays` : err.message || "Couldn't undo it."; render(); } return; }
      announce(`${s.name} is gone.`);
      if (V.file === f) close();
      if (edits && edits.removed) edits.removed(f);
      return;
    }
    try { await api.undoProjectEdit(f.project, s.editId); announce(`${s.name} is back as it was.`); }
    catch (err) { V.saveError = err.status === 410 ? "That save can't be undone any more: the version before it is gone" : err.status === 404 ? "That save isn't in XO's log any more" : err.message || "Couldn't undo the save."; }
    if (V.file !== f) return;
    dropFile(); load();
  }

  function body() {
    if (V.why) return `<div class="vw-empty"><p>${esc(V.why)}</p><p class="vw-path"><code>${esc(V.file.path)}</code><button type="button" class="vw-btn" data-vw-copy-path>${ICON.copy}<span>${V.copied ? "Copied" : "Copy the path"}</span></button></p></div>`;
    if (V.loading) return `<p class="vw-empty"><i class="spin" aria-hidden="true"></i> Reading the file…</p>`;
    if (V.error) return `<div class="vw-empty"><p>${esc(V.error)}</p></div>`;
    const d = V.data;
    if (d.kind === "image") {
      const actual = V.mode === "actual";
      return `<div class="vw-img${actual ? " is-actual" : ""}"><img src="${esc(d.url)}" alt="${esc(V.file.name || "Image")}" draggable="false" title="${actual ? "Fit to the panel" : "Show at actual size"}"></div>`;
    }
    if (d.kind === "pdf") return `<iframe class="vw-frame vw-pdf" src="${esc(d.url)}" title="${esc(V.file.name || "PDF")}" referrerpolicy="no-referrer"></iframe>`;
    const text = String(d.content ?? "");
    const cut = d.truncated ? `<p class="vw-cut">${ICON.clock}<span>Showing the first ${esc(size(bytes(text)))} of ${esc(size(d.size_bytes))}. The rest isn't previewed.</span>${canSave() ? `<button type="button" class="vw-cut-dl" data-vw-download${V.saving ? " disabled" : ""}>Download the whole file</button>` : ""}</p>` : "";
    let main;
    if (d.kind === "markdown" && V.mode !== "source") main = `<article class="prose vw-md">${renderMarkdown(text)}</article>`;
    else if (d.kind === "html" && V.mode === "preview") main = `<iframe class="vw-frame" sandbox="allow-scripts" referrerpolicy="no-referrer" title="${esc(V.file.name || "HTML preview")}" srcdoc="${esc(text)}"></iframe>`;
    else main = ""; // text and code show through Pierre (render → showsFile)
    return cut + main;
  }

  /** The diff body: one element, kept (with Pierre's drawing in it) while the head around it redraws. */
  function diffBody() {
    if (!DF.el) { DF.el = document.createElement("div"); DF.el.className = "vw-body vw-diff"; DF.el.tabIndex = 0; }
    return DF.el;
  }
  function dropDiff() { DF.gen++; if (DF.handle) { DF.handle.destroy(); DF.handle = null; } if (DF.img) { DF.img.drop(); DF.img = null; } DF.key = null; DF.pend = null; }
  /** Both whole versions, for "N unmodified lines" (read only when you unfold them). */
  async function bothSides(c, fd) {
    const f = V.file, oldRel = (c.scope.base ? `${c.scope.base}/` : "") + (c.file.old_path || c.path);
    const [o, n] = await Promise.all([
      c.file.status === "added" ? null : api.projectFile(f.project, oldRel, { commit: c.base, path: c.file.old_path || c.path }),
      c.file.status === "deleted" ? null : api.projectFile(f.project, f.rel),
    ]);
    if ((o && o.truncated) || (n && n.truncated)) throw new Error("too large to unfold");
    return { oldFile: o ? { name: fd.prevName || fd.name, contents: o.content } : null, newFile: n ? { name: fd.name, contents: n.content } : null };
  }
  async function drawDiff(c) {
    const host = diffBody();
    const patch = await changes.patchAt(c).catch(() => null);
    const key = `${c.scope.key}|${c.path}|${patch ? patch.length + ":" + patch.slice(-64) : `none:${c.file.version || ""}`}`;
    if ((DF.key === key && (DF.handle || DF.img)) || DF.pend === key) return; // drawn, or on its way
    DF.pend = key;
    const my = ++DF.gen;
    if (!patch) {
      dropDiff();
      // an image: itself (js/imagechange.js), Before beside Now when it changed, in place of "Binary file"
      if (isImageChange(c.file) && V.file.project && V.file.rel) {
        DF.img = drawImageChange(host, { project: V.file.project, rel: V.file.rel, file: c.file, at: c.base || null });
        DF.key = key;
        return;
      }
      const why = c.file.binary || c.file.patch_omitted === "binary" ? "Binary file" : c.file.patch_omitted === "submodule" ? "A submodule" : "Too large to show here";
      host.innerHTML = `<div class="vw-empty"><p>${esc(why)}.</p>${canSave() ? `<p><button type="button" class="vw-cut-dl" data-vw-download>Download</button></p>` : ""}</div>`;
      DF.key = key;
      return;
    }
    if (DF.img) { DF.img.drop(); DF.img = null; }
    try {
      if (DF.handle && DF.key && DF.key.startsWith(`${c.scope.key}|${c.path}|`)) DF.handle.update(patch);
      else {
        if (DF.handle) { DF.handle.destroy(); DF.handle = null; }
        host.replaceChildren();
        const h = await DV.diff(host, patch, { path: c.path, wrap: true, split: V.split, loadFiles: (fd) => bothSides(c, fd) });
        if (my !== DF.gen) { h.destroy(); return; }
        DF.handle = h;
      }
      DF.key = key;
    } catch {
      if (my !== DF.gen) return;
      dropDiff(); // (clears pend: Try again draws afresh)
      host.innerHTML = `<div class="vw-empty"><p>Couldn't draw this diff.</p><p><button type="button" class="vw-cut-dl" data-vw-show="changes">Try again</button></p></div>`;
    }
  }

  // ── the whole file, through Pierre ──────────────────────────────────────────────────────────────
  function fileBody() {
    if (!FL.el) { FL.el = document.createElement("div"); FL.el.className = "vw-body vw-file"; FL.el.tabIndex = 0; }
    return FL.el;
  }
  function dropFile() { FL.gen++; if (FL.handle) { FL.handle.destroy(); FL.handle = null; } FL.key = null; FL.pend = null; FL.sel = null; FL.asking = false; askCapsule(); }
  async function drawFile() {
    const d = V.data, f = V.file;
    const key = `${f.project || ""}|${f.rel || f.path || f.name}|${d.size_bytes ?? d.content.length}|${d.modified_at || ""}`;
    if ((FL.key === key && FL.handle) || FL.pend === key) return;
    if (FL.handle) dropFile();
    FL.pend = key;
    const my = ++FL.gen, host = fileBody();
    try {
      const h = await DV.file(host, d.content, {
        path: f.name || f.path, wrap: true, key,
        onSelect: ask && f.project && f.rel ? (r) => select(r) : undefined,
        note: ask && f.project && f.rel ? () => composer() : undefined,
      });
      if (my !== FL.gen) { h.destroy(); return; }
      FL.handle = h; FL.key = key;
      if (f.lines) { const [a, b] = f.lines; h.select({ start: a, end: b }); requestAnimationFrame(() => { h.reveal(a); select({ start: a, end: b }); }); }
    } catch {
      if (my !== FL.gen) return;
      FL.pend = null;
      host.innerHTML = `<div class="vw-empty"><p>Couldn't show this file.</p><p><button type="button" class="vw-cut-dl" data-vw-retry>Try again</button></p></div>`;
    }
  }
  /** A selection ended (or cleared): "Ask about lines a–b" under its last line. */
  function select(r) {
    if (!r && FL.pressing) return; // a press on the capsule itself isn't "clicked elsewhere"
    FL.sel = r ? { a: Math.min(r.start, r.end), b: Math.max(r.start, r.end) } : null;
    if (!FL.sel && FL.asking) return; // the composer stays until you send or close it
    askCapsule();
  }
  const MOD = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl ";
  function askCapsule() {
    const host = FL.el;
    if (!host) return;
    let b = host.querySelector(":scope > .xd-ask");
    const s = FL.sel, at = s && !FL.asking && FL.handle && ask && ask.target(V.file) ? FL.handle.place(s.b) : null;
    if (!at) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement("button"); b.type = "button"; b.className = "xd-ask"; b.dataset.vwAsk = "";
      b.addEventListener("pointerdown", () => { FL.pressing = true; addEventListener("pointerup", () => setTimeout(() => { FL.pressing = false; }), { once: true }); });
      host.appendChild(b);
    }
    b.innerHTML = `${ASK_IC}<span>Ask about ${s.a === s.b ? `line ${s.a}` : `lines ${s.a}–${s.b}`}</span><kbd>${MOD}L</kbd>`;
    b.style.top = `${Math.round(at.bottom + 6)}px`;
  }
  /** The small composer, as a row under the selected lines (Pierre makes room for it: nothing is covered). */
  function composer() {
    if (FL.q) return FL.q;
    const q = document.createElement("form");
    q.className = "xd-q";
    q.innerHTML = `<p class="xd-ref"></p><textarea class="xd-in" rows="2" aria-label="Your question about these lines" placeholder="Ask about these lines"></textarea>` +
      `<div class="xd-row"><span class="xd-to"></span><span class="xd-sp"></span><span class="xd-hint">Esc to close</span><button type="submit" class="xd-send" aria-label="Send">${ICON.send}</button></div>`;
    q.addEventListener("submit", (e) => { e.preventDefault(); sendAsk(); });
    q.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendAsk(); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeAsk(); }
    });
    return (FL.q = q);
  }
  function openAsk() {
    const s = FL.sel, f = V.file;
    if (!s || !FL.handle || !ask) return;
    const to = ask.target(f);
    if (!to) return;
    // beside the chat, the lines go into the chat's own composer (the owner's D4); this composer is the
    // fallback where there's no chat beside the file, or it's another place's
    if (ask.compose && ask.compose(f, s.a, s.b)) return;
    const q = composer();
    q.querySelector(".xd-ref").innerHTML = `${fileIcon(f.name || f.path)}<span>${esc(f.name || f.path)} · ${s.a === s.b ? `line ${s.a}` : `lines ${s.a}–${s.b}`}</span>`;
    q.querySelector(".xd-to").innerHTML = `To <b>${esc(to)}</b>`;
    FL.asking = { a: s.a, b: s.b };
    askCapsule();
    FL.handle.select({ start: s.a, end: s.b }); // the lines stay marked while you write
    FL.handle.note(s.b);
    // Pierre places the row on its next frame or two: focus lands once it's there
    const ta = q.querySelector(".xd-in");
    let n = 0;
    const focus = () => { if (!FL.asking) return; if (ta.isConnected) ta.focus({ preventScroll: true }); if (document.activeElement !== ta && ++n < 20) requestAnimationFrame(focus); };
    requestAnimationFrame(focus);
  }
  function closeAsk() {
    if (!FL.asking) return;
    FL.asking = false;
    if (FL.handle) FL.handle.note(null);
    if (FL.q) FL.q.querySelector(".xd-in").value = "";
    askCapsule();
    FL.el?.focus({ preventScroll: true });
  }
  function sendAsk() {
    const q = FL.q, t = q && q.querySelector(".xd-in").value.trim();
    if (!t || !FL.asking) return;
    if (ask.send(V.file, FL.asking.a, FL.asking.b, t)) { closeAsk(); FL.sel = null; FL.handle?.select(null); askCapsule(); }
  }

  function render() {
    if (!V.open) return;
    if (showsFile()) {
      // the head redraws; the file's body (Pierre's drawing, where you are, a question you're writing) stays
      const host = fileBody(), top = host.scrollTop, d = V.data;
      if (DF.handle || DF.key) dropDiff();
      const cut = d.truncated ? `<p class="vw-cut">${ICON.clock}<span>Showing the first ${esc(size(bytes(d.content)))} of ${esc(size(d.size_bytes))}. The rest isn't previewed.</span>${canSave() ? `<button type="button" class="vw-cut-dl" data-vw-download${V.saving ? " disabled" : ""}>Download the whole file</button>` : ""}</p>` : "";
      const bar = el.querySelector(":scope > .xd-bar");
      const failed = V.saveError ? `<p class="vw-cut" role="alert">${ICON.clock}<span>${esc(V.saveError)}</span></p>` : "";
      el.innerHTML = (tabs ? tabs() : "") + head() + failed + cut + `<i data-vw-file hidden></i>`;
      el.querySelector("[data-vw-file]").replaceWith(host);
      if (bar && ED.conflict) host.before(bar);
      host.scrollTop = top;
      errPaint();
      toastPaint();
      if (!ED.conflict) drawFile();
      return;
    }
    if (FL.handle || FL.key) dropFile();
    if (showsDiff()) {
      // the head redraws; the diff's body (and where you are in it) stays
      const host = diffBody(), top = host.scrollTop;
      el.innerHTML = (tabs ? tabs() : "") + head() + `<i data-vw-diff hidden></i>`;
      el.querySelector("[data-vw-diff]").replaceWith(host);
      host.scrollTop = top;
      drawDiff(chg());
      return;
    }
    if (DF.handle || DF.key) dropDiff();
    const keep = el.querySelector(".vw-body")?.scrollTop || 0;
    const framed = V.data && ((V.data.kind === "html" && V.mode === "preview") || V.data.kind === "pdf");
    const failed = V.saveError ? `<p class="vw-cut" role="alert">${ICON.clock}<span>${esc(V.saveError)}</span></p>` : "";
    el.innerHTML = (tabs ? tabs() : "") + head() + `<div class="vw-body${framed ? " is-frame" : ""}" tabindex="0">${failed}${body()}</div>`;
    if (V.keepScroll) el.querySelector(".vw-body").scrollTop = keep;
    V.keepScroll = false;
  }

  /** An attachment or a paste, in the shape the body draws. Images and PDFs load from their URL. */
  async function readAttachment(f) {
    const name = f.name || "";
    const textKind = /\.(md|markdown)$/i.test(name) || f.type === "text/markdown" ? "markdown" : "code";
    if (f.local != null) return { kind: textKind, content: String(f.local), name, size_bytes: f.bytes };
    const k = kindOf(f.type || "");
    if (k !== "text") return { kind: k, url: attachmentUrl(f.att.chat, f.att.id), name, size_bytes: f.bytes, remote: true };
    return { kind: textKind, content: await attachmentText(f.att.chat, f.att.id), name, size_bytes: f.bytes };
  }

  async function load() {
    const my = ++V.gen;
    dropImage();
    V.loading = true; V.error = null; V.data = null; V.dims = null;
    render();
    try {
      if (V.file.att || V.file.local != null) {
        const d = await readAttachment(V.file);
        if (my !== V.gen) return;
        V.data = d;
      } else if (V.file.image) {
        const blob = await api.projectImage(V.file.project, V.file.rel);
        if (my !== V.gen) return;
        V.data = { kind: "image", size_bytes: blob.size, url: URL.createObjectURL(blob) };
      } else {
        const d = await api.projectFile(V.file.project, V.file.rel);
        if (my !== V.gen) return;
        V.data = d;
        if (typeof d.content !== "string") V.error = "XO sent this file without its text.";
      }
    } catch (err) {
      if (my !== V.gen) return;
      V.error = err.status === 404 ? "This file isn't there any more." : err.status === 403 && err.code === "outside_project" ? "This file is outside the project: a link leads out of it." : err.message || "Couldn't read this file.";
    }
    V.loading = false;
    // the version that came with what was loaded (a content hash), never one read afterwards
    V.seenSig = V.data && typeof V.data.version === "string" ? V.data.version : null; V.updated = false;
    render();
    if (V.fresh) { V.fresh = false; if (canEdit()) startEdit(); }
  }
  // Stable inspection (Astra I6): what you're reading never changes under you. When an agent changes the file after
  // it was read, the head says "Updated" and you take the new version when you choose (Show), not mid-sentence.
  // the project's changes carry each changed file's content hash (version, the same as /file's): a different hash is
  // a newer version; a file the changes don't list, or list without a hash, is never claimed to have moved
  const sigNow = () => { const c = V.file && V.file.project && V.file.rel && changes ? changes.at(V.file.project, V.file.rel) : null; return c && typeof c.file.version === "string" ? c.file.version : null; };
  /** Called on every app render: a newer version since this one was read lights "Updated". */
  function notice() {
    if (!V.open || V.parked || V.loading || !V.data || V.seenSig == null || ED.on || V.updated) return;
    const now = sigNow();
    if (now && now !== V.seenSig) { V.updated = true; paintHead(); }
  }

  /**
   * f: {name, path, type, bytes, project?, rel?, why?} for a shared file, {name, type, bytes, att:
   * {chat, id}} for an attachment, {name, bytes, local: text} for a paste; from: where focus returns.
   */
  function open(f, from) {
    const was = V.open;
    // the file you were editing, before this one takes its place: your edits wait as its draft
    if (ED.on && ED.dirty) keepDraft();
    if (ED.on) { if (ED.ed) ED.ed.stop(); if (ED.conflict && ED.conflict.view) ED.conflict.view.destroy(); ED.on = false; ED.conflict = null; ED.real = null; ED.moved = false; }
    dropImage();
    if (V.parked) { V.parked = false; el.hidden = false; }
    Object.assign(V, { open: true, file: { ...f, where: f.rel || f.path || "", image: f.att ? kindOf(f.type || "") === "image" : f.local == null && isImagePath(f.rel || f.path || f.name) }, data: null, dims: null, error: null, why: f.why || null, mode: V.textMode || "preview", copied: false, saving: false, saveError: null, menu: false, returnTo: from || (was ? V.returnTo : document.activeElement) });
    if (V.file.image) V.mode = "preview";
    V.draft = getDraft(store, dkey()); // your unsaved edits in this file from before, if any
    // a changed file asked for as a change (the panel's Open in Files, the tree's Changed section) opens on
    // its diff; any other way in, whole. The diff is drawn from the patch and needs no read of the file.
    // a file just made: "Created · Undo" until the next save, and the editor opens on it once it's read
    saved = f.created ? { path: localPath(), name: f.name, editId: typeof f.created === "string" ? f.created : null, created: true } : null;
    V.fresh = !!f.created;
    ED.confirmed = false; // a file that runs code asks again once you've left it
    dropDiff(); dropFile(); if (DF.el) DF.el.scrollTop = 0; if (FL.el) FL.el.scrollTop = 0;
    V.show = f.show === "changes" ? "changes" : "file";
    el.hidden = false;
    document.body.classList.add("viewer-open");
    if (!was) { el.classList.remove("is-in"); void el.offsetWidth; el.classList.add("is-in"); }
    if (V.why) render(); else if (showsDiff()) { V.loading = false; render(); } else load();
    el.focus({ preventScroll: true });
    announce(`${f.name || f.path} is open beside the conversation. Esc closes it.`);
    onChange && onChange();
  }

  function close({ restore = true } = {}) {
    if (!V.open) return;
    V.open = false; V.parked = false; V.gen++;
    if (ED.on && ED.dirty) keepDraft(); // closed while editing: your edits wait as its draft
    if (ED.on) { if (ED.ed) ED.ed.stop(); if (ED.conflict && ED.conflict.view) ED.conflict.view.destroy(); ED.on = false; ED.conflict = null; ED.real = null; ED.moved = false; }
    V.draft = null;
    saved = null; el.querySelector(":scope > .xd-toast")?.remove();
    dropImage(); V.data = null; dropDiff(); dropFile();
    el.hidden = true; el.innerHTML = "";
    document.body.classList.remove("viewer-open");
    const back = V.returnTo;
    V.returnTo = null;
    if (restore && back && back.isConnected) back.focus({ preventScroll: true });
    onChange && onChange();
  }

  /** Copy, and say so on the button. Where the browser has no clipboard API (a page not served over https or
   *  from this machine), the selection's own copy; where both refuse, the head says so in words. */
  async function copy(text) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      const ta = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
      ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
      const back = document.activeElement;
      el.appendChild(ta); ta.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove(); back && back.focus && back.focus({ preventScroll: true });
    }
    if (!ok) { V.saveError = "Couldn't copy: the browser didn't allow it here. Select the text and copy it, or download the file."; redrawKeep(); announce("Couldn't copy."); return; }
    V.copied = true; V.saveError = null;
    redrawKeep();
    announce("Copied.");
    setTimeout(() => { if (V.copied) { V.copied = false; redrawKeep(); } }, 1400);
  }

  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-vw-more]")) {
      V.menu = !V.menu; paintHead();
      (V.menu ? el.querySelector(".vw-menu [role=menuitem]") : el.querySelector("[data-vw-more]"))?.focus({ preventScroll: true });
      return;
    }
    // a menu item: the menu closes, then it acts (a link is left to the browser, so its close waits a turn)
    if (V.menu && e.target.closest(".vw-menu a")) { setTimeout(() => menuOff(true)); return; }
    if (V.menu && e.target.closest(".vw-menu")) V.menu = false;
    if (e.target.closest("[data-vw-close]")) { close(); return; }
    const sh = e.target.closest("[data-vw-show]");
    if (sh) { V.show = sh.dataset.vwShow; if (V.show === "file" && !V.data && !V.loading) { load(); return; } V.keepScroll = true; render(); return; }
    if (e.target.closest("[data-vw-ask]")) { openAsk(); return; }
    if (e.target.closest("[data-vw-edit]")) { startEdit(); return; }
    if (e.target.closest("[data-vw-saveit]")) { save(); return; }
    if (e.target.closest("[data-vw-cancel]")) { cancelEdit(); return; }
    if (e.target.closest("[data-vw-keep]")) { ED.discard = false; ED.then = null; paintHead(); ED.ed?.focus(); return; }
    if (e.target.closest("[data-vw-discard]")) { const then = ED.then; ED.then = null; letDraftGo(); stopEdit(); if (then) then(); return; }
    if (e.target.closest("[data-vw-draftx]")) { letDraftGo(); paintHead(); el.querySelector("[data-vw-edit]")?.focus(); announce("Your draft is gone."); return; }
    if (e.target.closest("[data-vw-confirm]")) { ED.confirmed = true; save("runs_code"); return; }
    if (e.target.closest("[data-vw-noconfirm]")) { ED.confirm = false; paintHead(); ED.ed?.focus(); return; }
    if (e.target.closest("[data-vw-undo]")) { undoSave(); return; }
    if (e.target.closest("[data-vw-tell]")) { const s = saved; saved = null; toastPaint(); if (s && edits.tell(V.file, s)) announce("Told the agent."); return; }
    if (e.target.closest("[data-vw-toastx]")) { saved = null; toastPaint(); return; }
    if (e.target.closest("[data-vw-retry]")) { FL.pend = null; drawFile(); return; }
    if (e.target.closest("[data-vw-split]")) { V.split = !V.split; if (DF.handle) DF.handle.split(V.split); render(); return; }
    const m = e.target.closest("[data-vw-mode]");
    if (m) { V.mode = m.dataset.vwMode; if (V.mode !== "actual") V.textMode = V.mode; render(); return; }
    if (e.target.closest(".vw-img img")) { V.mode = V.mode === "actual" ? "preview" : "actual"; render(); return; }
    if (e.target.closest("[data-vw-copy]")) { copy(String(V.data.content)); return; }
    if (e.target.closest("[data-vw-copy-path]")) { copy(V.file.rel ? localPath() : V.file.path); return; }
    // the new version, at the place you were reading
    if (e.target.closest("[data-vw-update]")) { const top = el.querySelector(".vw-body")?.scrollTop || 0; load().then(() => { const b = el.querySelector(".vw-body"); if (b) b.scrollTop = top; }); return; }
        if (e.target.closest("[data-vw-download]")) download();
  });
  // an image's size shows in the header once it has decoded; one that won't decode says so
  el.addEventListener("load", (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !V.data || V.data.kind !== "image" || V.dims) return;
    V.dims = { w: img.naturalWidth, h: img.naturalHeight };
    el.querySelector(".vw-top").outerHTML = head();
  }, true);
  el.addEventListener("error", (e) => {
    if (!(e.target instanceof HTMLImageElement) || !V.data || V.data.kind !== "image") return;
    V.error = "This image couldn't be shown: the file may be damaged or in a format this browser can't read.";
    dropImage(); V.data = null;
    render();
  }, true);
  // a reload or a closed tab with unsaved edits: the browser's own question (the only one it allows)
  addEventListener("beforeunload", (e) => { if (ED.on && (ED.dirty || ED.conflict) && !(ED.dirty && !ED.conflict && keepDraft())) { e.preventDefault(); e.returnValue = ""; } });
  // a press anywhere but the ⋯ and its menu closes the menu
  document.addEventListener("pointerdown", (e) => { if (V.menu && !(e.target.closest && e.target.closest(".vw-mw"))) menuOff(); }, true);
  // a tab put away (a phone may close it later): the draft is kept now
  document.addEventListener("visibilitychange", () => { if (document.hidden && ED.on && ED.dirty) keepDraft(); });
  el.addEventListener("keydown", (e) => {
    if (V.menu && e.target.closest(".vw-mw")) {
      const items = [...el.querySelectorAll(".vw-menu [role=menuitem]")], i = items.indexOf(document.activeElement);
      if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); menuOff(true); return; }
      const to = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? (i < 0 ? -1 : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : null;
      if (to != null && items.length) { e.preventDefault(); items[(to + items.length) % items.length].focus(); }
      return;
    }
    const mod = (e.metaKey || e.ctrlKey) && !e.altKey;
    if (ED.on) {
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); if (ED.confirm) { ED.confirmed = true; save("runs_code"); } else save(); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (ED.confirm) { ED.confirm = false; paintHead(); ED.ed?.focus(); } else cancelEdit(); return; }
      return;
    }
    if (!mod && !e.altKey && (e.key === "e" || e.key === "E") && !e.target.closest("input, textarea, [contenteditable]") && canEdit() && !FL.asking) { e.preventDefault(); startEdit(); return; }
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      if (FL.sel && !FL.asking) { FL.sel = null; FL.handle?.select(null); askCapsule(); return; } // a selection clears first
      if (away && away()) return; // beside the chat, the file is put away, not closed (js/filesview.js)
      close(); return;
    }
    // ⌘L (Ctrl L): ask about the lines selected in a file (the browser's own ⌘L only while lines are selected)
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "l" && FL.sel && !FL.asking && showsFile()) { e.preventDefault(); openAsk(); return; }
    // J / K: the next or previous change, on a diff
    if (!showsDiff() || !DF.el || e.target.closest("input, textarea, [contenteditable]")) return;
    const dir = K.is(e, "nextChange") ? 1 : K.is(e, "prevChange") ? -1 : 0;
    if (dir) { e.preventDefault(); DV.jump(DF.el, dir); }
  });

  /** Live mode: the file steps aside, kept as it was (scroll and all), until `unpark`. */
  function park() {
    if (!V.open || V.parked) return;
    V.keep = el.querySelector(".vw-body")?.scrollTop || 0;
    V.parked = true; el.hidden = true;
    document.body.classList.remove("viewer-open");
    onChange && onChange();
  }
  function unpark() {
    if (!V.open || !V.parked) return;
    V.parked = false; el.hidden = false;
    document.body.classList.add("viewer-open");
    render();
    const b = el.querySelector(".vw-body");
    if (b) b.scrollTop = V.keep || 0;
    el.focus({ preventScroll: true });
    onChange && onChange();
  }
  /** Repaint the header (the Live · File switch follows the Map). */
  function refresh() { if (V.open && !V.parked) { V.keepScroll = true; render(); } }

  return {
    open, close, park, unpark, refresh, notice,
    get isOpen() { return V.open && !V.parked; }, get hasFile() { return V.open; }, get isParked() { return V.open && V.parked; }, get file() { return V.file; },
    /** Unsaved edits on screen (leaving asks first). */
    get editing() { return ED.on && (ED.dirty || !!ED.conflict); },
    /** You're leaving (another place, back to the conversation): with unsaved edits, the head asks first;
     *  go() runs once you choose Discard. */
    leave(go) {
      if (!(ED.on && (ED.dirty || ED.conflict))) { go(); return; }
      // kept as a draft in this browser: it'll be waiting when you come back. A merge in progress, or a draft
      // too big to keep, asks first, as before
      if (!ED.conflict && keepDraft()) { stopEdit(); announce("Your edits are kept as a draft."); go(); return; }
      ED.discard = true; ED.then = go; paintHead(); el.querySelector("[data-vw-keep]")?.focus();
    },
  };
}
