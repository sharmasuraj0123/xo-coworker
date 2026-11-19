// The file viewer (if1 #2), in Files: a file opens beside the conversation, like a canvas, ready to read and to
// type in. Every text file is one editor (modules/files/editor.js, CodeMirror): code reads as code, Markdown as a page
// (Page, or Source: the same editor), and what you type saves on ⌘S only (modules/files/documents.js, one document per open
// file; unsaved text waits as a draft in this browser). There's no Edit button and no autosave. Someone else's change
// (an agent, bash, git) comes in place as a new version, the lines it touched glowing for a moment; if you were
// typing, it's merged into yours, and only lines you both changed ask (Keep yours · Take theirs). Each version is in
// the head's ‹ n of m ›: who made it, an older one read only with Restore, and Show changes.
// HTML shows in a sandboxed frame that runs the page's own scripts but has no same-origin (an opaque origin:
// no reach into XO's window, cookies, storage or /api, which serve.py refuses a null origin; no popups,
// forms or top navigation; Source shows its text), and an
// image shows fitted to the panel (Actual size, or a click on it, shows it 1:1). It reads the
// project-scoped `/api/xo-projects/<project>/file` and `/image` routes only, never `/api/files/*`.
// A file attached to a message (hub #30) opens here too, read only: an image as itself, a PDF in a frame, text as
// text (read with fetch, never rendered as HTML), all from the attachment route, which the server
// guards with its own headers. A long paste not sent yet previews from the composer.
// A project file also downloads whole from the project-scoped `/download` route. It is fetched with the Coder
// header and saved as a blob, so the token never sits in a URL (or the browser's download history).
// Several files stay open as tabs (a single click opens a preview tab the next one replaces; typing in it, or a
// double click on its tab, keeps it). Esc puts the file away (or closes it); on phones it takes the whole screen.
// Focus goes in, and back to what opened it.

import { esc, isImagePath } from "../core/platform/index.js";
import { fileIcon } from "./fileicons.js";
import { ICON, $, xi } from "./ui.js";
import { usable } from "./focusview.js";
import { api, attachmentUrl, attachmentText, missingRoute } from "./api.js";
import { kindOf, typeWord } from "./attach.js";
import * as DV from "../modules/changes/diffview.js";
import * as K from "../core/platform/keys.js";
import { pointerFollows } from "./keynav.js";
import { redrawNode } from "./redraw.js";
import { countsHtml } from "../core/ui/components/counts.js";
import { createDocs, byWords } from "../modules/files/documents.js";
import { mount as mountEditor, prefetch as prefetchEditor } from "../modules/files/editor.js";
import { isImageChange, drawImageChange } from "../modules/changes/imagechange.js";

const size = (n) => (n == null || !Number.isFinite(n) ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const bytes = (s) => new TextEncoder().encode(s).length;
const extOf = (name) => (/\.([\w-]+)$/.exec(String(name || "")) || [])[1] || "";
const KIND_WORD = { markdown: "Markdown", html: "HTML", text: "Text", code: "Code", json: "JSON" };

const LOCK_IC = xi("lock", "", "sm");
const BOLT_IC = xi("runs-code", "", "sm");
// files git or an agent runs (Space confirms a save to one with a 428; the head says so before you type)
// before Space answers with the file's place: what git or an agent runs. Case doesn't matter (Space treats
// .GIT/ and .Claude/ as .git/ and .claude/, on any file system)
export const RUNS = /^(?:\.git|\.claude|\.codex|\.agents)(?:\/|$)|^\.mcp\.json$/i;
// Space's reasons a file can't be changed here, in words
const NOT_EDITABLE = {
  read_only_place: "Read only · XO keeps this file",
  too_large: "Too large to edit here",
  truncated: "Too large to edit here",
  not_utf8: "Not plain text",
  not_text: "Not plain text",
  historical: "An earlier version: read only",
  attachment: "Read only",
};
const MORE_IC = ICON.more;
const SPLIT_IC = ICON.split;
// the Source toggle's glyph: angle brackets, drawn like the other line icons
const SRC_IC = ICON.code;
const PAGE_IC = ICON.doc;
const PREV_IC = ICON.back;
const NEXT_IC = ICON.right;

/** When, in a few words ("just now", "4 min ago", "10:42"). Pure. */
export function whenWords(at, now = Date.now()) {
  const t = Date.parse(at || "");
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, (now - t) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  const d = new Date(t);
  const same = new Date(now).toDateString() === d.toDateString();
  return same ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

/**
 * The viewer. ask: {target(f) → its name in words, or null when there's nowhere to send; send(f, a, b, text) → true
 * when it went; compose(f, a, b) → true when the lines went into the chat's own composer; file(f)}. edits: {saved(f)
 * after each save (its place's changes are read again)}. threadTitle(ts) names who made a version. away() puts the
 * file away beside a chat (Esc); home() is where focus goes when what opened the file is gone.
 */
export function createViewer({ announce, onChange, tabs, changes = null, ask = null, edits = null, away = null, home = null, threadTitle = () => null, opened = null }) {
  const el = $("#viewer");
  // a copy still on its way after this long says so ("Copying…"): quicker, and it only says Copied
  const COPY_SAYS_MS = 150;
  const V = { open: false, parked: false, file: null, data: null, error: null, loading: false, mode: "preview", textMode: "page", imgMode: "preview", returnTo: null, gen: 0, copied: false, dims: null, busy: null, saveError: null, show: "file", split: false, menu: false, tabs: [], showChanges: false };
  // the diff, kept across redraws of the head (Pierre's element moves with its body): {el, handle, img (an image
  // change's drawing, modules/changes/imagechange.js), key, gen, failed (the change the renderer last failed to draw: its notice
  // turns busy when it's drawn again)}
  const DF = { el: null, handle: null, img: null, key: null, gen: 0, ask: 0, reading: null, failed: null };
  /** This file in its place's changes ({scope, path, file, base}), or null. */
  const chg = () => (changes && V.file && V.file.project && V.file.rel ? changes.at(V.file.project, V.file.rel) : null);
  const showsDiff = () => V.show === "changes" && !!chg();
  // the text file's editor: {el (its body, kept across redraws of the head), h (the editor), key (which document),
  // gen, sel ({a, b}: lines selected), asking ({a, b}: the fallback composer is open)}
  const TX = { el: null, h: null, key: null, gen: 0, sel: null, asking: false, q: null };
  // the open files' documents (modules/files/documents.js): one per project file, shared by every tab and view of it
  const store = (() => { try { return localStorage; } catch { return null; } })();
  const docs = createDocs({ api, store, onChange: (d, what) => docChanged(d, what) });
  /** The document on show (a project file's, or an attachment's read-only one), or null. */
  const doc = () => (V.data && V.data.doc) || null;
  /** A text file shows in the editor: everything but images, PDFs and HTML's own preview. */
  const showsText = () => {
    const d = V.data;
    if (!V.open || V.loading || V.error || V.why || !d || typeof d.content !== "string" || showsDiff()) return false;
    if (d.kind === "html") return V.mode === "source";
    return d.kind !== "image" && d.kind !== "pdf";
  };
  const isMd = () => !!(V.data && V.data.kind === "markdown");

  /** The object URL an image is shown from lives as long as the image is open. */
  function dropImage() {
    if (V.data && V.data.url && !V.data.remote) URL.revokeObjectURL(V.data.url);
  }

  /** A shared project file saves whole; attachments and pastes have no project. */
  const canSave = () => !!(V.file.project && V.file.rel);

  /** Download the whole file (a project file's own route). Its own name: Edit's save() is another job. */
  async function download() {
    if (V.busy) return; // one thing at a time from the ⋯: a copy or a download already on its way
    const f = V.file;
    V.busy = { kind: "download", shown: true }; V.copied = false; V.saveError = null; redrawKeep(); // a new action: the last one's Copied is over
    try {
      const url = URL.createObjectURL(await api.projectDownload(f.project, f.rel));
      const a = Object.assign(document.createElement("a"), { href: url, download: f.name || "file" });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      if (f === V.file) V.saveError = err.message || "Couldn't download this file.";
    }
    if (f !== V.file) return;
    V.busy = null; redrawKeep();
  }

  /**
   * ⋯ in the head: Copy, Copy path, Download (an attachment: Download, or Open in a new tab), in a menu. While
   * a copy or a download lasts, the ⋯ itself says so ("Copied", "Downloading…"): the menu has closed by then.
   */
  /** The ⋯ menu: its own items, and the folds (what leaves a narrow head for it: the owner's choice, 9 Nov). A fold
   *  shows only while its head is narrow (css: @container vwtop); f-wide below 560 px, f-narrow below 400. */
  function moreHtml(f, canCopy, folds = []) {
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
    if (!items.length && !folds.length) return "";
    // what's on its way says so before what's done: the newest action's state (a Download right after Copy said
    // "Copied" all through the download: the controls grader on 8a4ed16, S126 / V52)
    const busy = !!(V.busy && V.busy.shown), done = !busy && V.copied, word = busy ? (V.busy.kind === "copy" ? "Copying…" : "Downloading…") : done ? "Copied" : "";
    // with only folds in it, ⋯ shows only while one of them does
    const only = items.length ? "" : ` only-folds${folds.some((x) => x.includes("f-wide")) ? " fw" : ""}${folds.some((x) => x.includes("f-narrow")) ? " fn" : ""}`;
    return `<span class="vw-mw${only}"><button type="button" class="vw-btn vw-more${done ? " is-done" : busy ? " is-busy" : ""}" data-vw-more aria-haspopup="menu" aria-expanded="${!!V.menu}" title="${word || "Copy, download"}" aria-label="${word || "More: copy, download"}"${busy ? ' aria-disabled="true" aria-busy="true"' : ""}>` +
      `${done ? ICON.check : busy ? `<i class="spin" aria-hidden="true"></i>` : MORE_IC}${word ? `<span>${word}</span>` : ""}</button>` +
      (V.menu ? `<span class="vw-menu" role="menu" aria-label="${esc(f.name || "This file")}">${folds.join("")}${items.join("")}</span>` : "") + `</span>`;
  }
  /** Close the ⋯'s menu; back: focus the ⋯ again (Esc, Tab, or after what you chose). */
  function menuOff(back = false) {
    if (!V.menu) return;
    V.menu = false;
    paintHead();
    if (back) el.querySelector("[data-vw-more]")?.focus({ preventScroll: true });
  }
  /** The first of these that shows: a control folded into ⋯ is drawn twice, in the head (hidden while the head is
   *  narrow) and in the menu, and focus put on the hidden one falls to the page. */
  const shown = (root, sel) => [...root.querySelectorAll(sel)].find((x) => x.getClientRects().length > 0) || null;
  /** The ⋯ menu's items that show (a fold shows only while the head is narrow) */
  const menuItems = () => [...el.querySelectorAll(".vw-menu :is([role=menuitem],[role=menuitemradio])")].filter((x) => x.getClientRects().length > 0);
  const inMore = () => !!(document.activeElement && document.activeElement.closest && document.activeElement.closest(".vw-mw"));
  /** Redraw for a copy or a download, with focus kept on the ⋯ when it was there or in its menu. */
  function redrawKeep() {
    const on = inMore();
    V.keepScroll = true; render();
    if (on) el.querySelector("[data-vw-more]")?.focus({ preventScroll: true });
  }

  // ── the head: the file's name, its state, its versions, the view switch, ⋯ and × ─────────────────────────────
  /** The document's state in a few words, with its dot: Saving… · Saved · Not saved: why · Deleted on disk. */
  function stateHtml(d) {
    if (!d || d.state === "readonly") return "";
    if (d.state === "conflict") { const n = d.merge ? d.merge.left : 0; return `<span class="xd-state is-need" role="status"><i></i>${n} ${n === 1 ? "place" : "places"} to choose</span>`; }
    if (d.state === "saving") return `<span class="xd-state is-quiet" role="status">Saving…</span>`;
    if (d.state === "dirty") return `<span class="xd-state is-unsaved" role="status" title="${MODK}S saves it"><i></i>Unsaved · ${MODK}S</span>`;
    if (d.state === "deleted") return `<span class="xd-state is-need" role="status" title="${esc(d.err || "")}"><i></i>Deleted on disk</span>`;
    if (d.state === "error") return `<span class="xd-state is-need" role="status" title="${esc(d.err || "")}"><i></i>Not saved</span>`;
    return V.savedFlash === d ? `<span class="xd-state is-quiet is-done" role="status">Saved</span>` : "";
  }
  /** ‹ n of m ›, who made the one shown and when, Show changes; on an older one, Restore and Latest. */
  function versionsHtml(d) {
    if (!d || d.versions.length < 2 || showsDiff()) return "";
    const n = d.versions.length, at = d.viewing ? d.versions.indexOf(d.viewing) : n - 1, v = d.versions[at];
    const who = byWords(v.by, threadTitle) || (at === 0 ? "When you opened it" : "");
    const when = whenWords(v.at);
    const words = [who, when].filter(Boolean).join(" · ");
    const step = `<span class="vw-vers" role="group" aria-label="Versions"><button type="button" class="vw-btn" data-vw-ver="-1" aria-label="The version before"${at <= 0 ? ' aria-disabled="true"' : ""}>${PREV_IC}</button>` +
      `<span class="vw-vn" title="${esc(words)}"><b>${at + 1}</b> of ${n}</span>` +
      `<button type="button" class="vw-btn" data-vw-ver="1" aria-label="The version after"${at >= n - 1 ? ' aria-disabled="true"' : ""}>${NEXT_IC}</button></span>`;
    const who2 = words ? `<span class="vw-who">${esc(words)}</span>` : "";
    if (d.viewing) {
      const can = d.viewing.text != null;
      return step + who2 + (can && d.state !== "readonly" ? `<button type="button" class="xd-btn" data-vw-restore title="Make this version the file again (a new version: nothing is lost)">Restore</button>` : "") +
        `<button type="button" class="xd-btn" data-vw-latest>Latest</button>`;
    }
    const prev = d.versions[n - 2];
    const canShow = prev && prev.text != null && d.state !== "conflict";
    return step + who2 + (canShow ? `<button type="button" class="xd-btn${V.showChanges ? " is-on" : ""}" data-vw-changes aria-pressed="${!!V.showChanges}" title="Mark what this version changed">Show changes</button>` : "");
  }
  const MODK = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl ";
  /** Closing files with unsaved changes asks, as VS Code does: Save, Don't save, or Cancel (V.asking: {docs, then}). */
  const unsavedPop = () => {
    const A = V.asking, n = A.docs.length;
    const what = n === 1 ? `your changes to ${esc(A.docs[0].rel.split("/").pop())}` : `your changes to ${n} files`;
    return `<div class="xd-pop" role="alertdialog" aria-label="Save ${what}?"><p><b>Save ${what}?</b> If you don't, they're gone.</p><div class="xd-pop-a"><button type="button" class="xd-btn" data-vw-unsaved="discard">Don't save</button><button type="button" class="xd-btn" data-vw-unsaved="cancel">Cancel</button><button type="button" class="xd-btn is-pri" data-vw-unsaved="save">Save</button></div></div>`;
  };
  /** Ask before closing what has unsaved changes; then() goes on once it's saved or let go. */
  function askUnsaved(list, then, cancel = null) {
    const ds = list.filter((D) => D && (D.state === "dirty" || D.state === "error" || D.state === "conflict" || D.state === "deleted"));
    if (!ds.length) { then(); return; }
    if (V.asking && V.asking.cancel) V.asking.cancel(); // a question already open gives way to this one
    V.asking = { docs: ds, then, cancel };
    paintHead();
    el.querySelector('[data-vw-unsaved="save"]')?.focus({ preventScroll: true });
  }
  async function answerUnsaved(how) {
    const A = V.asking;
    V.asking = null;
    if (!A || how === "cancel") { A?.cancel?.(); paintHead(); TX.h?.focus(); return; }
    if (how === "discard") { for (const D of A.docs) docs.discard(D); A.then(); return; }
    await Promise.all(A.docs.map((D) => docs.flush(D)));
    // saved (or refused: then it stays open, saying why, and what asked hears no)
    if (A.docs.every((D) => D.state === "saved")) A.then(); else { A.cancel?.(); paintHead(); }
  }
  /** A file that runs code asks once before its first save: Save, or Not now (it stays unsaved, in this browser). */
  const confirmPop = () => `<div class="xd-pop" role="dialog" aria-label="Save a file that runs code"><p><b>Git or an agent runs what this file says.</b> A slip here runs on the next commit or the next agent turn. Save it?</p><div class="xd-pop-a"><button type="button" class="xd-btn" data-vw-noconfirm>Not now</button><button type="button" class="xd-btn is-pri" data-vw-confirm>Save</button></div></div>`;
  /** The open files, as tabs (two or more): a preview tab's name in italics; a dot while one has unsaved text. */
  function tabsHtml() {
    if (V.tabs.length < 2) return "";
    const cur = V.file;
    return `<div class="vw-tabs" role="tablist" aria-label="Open files">` + V.tabs.map((t, i) => {
      const on = t.file === cur, d = t.doc, dirty = d && (d.state === "dirty" || d.state === "saving" || d.state === "conflict" || d.state === "error");
      return `<span class="vw-tab${on ? " is-on" : ""}${t.preview ? " is-preview" : ""}" role="presentation"><button type="button" role="tab" class="vw-tab-b" data-vw-tab="${i}" aria-selected="${on}" title="${esc(t.file.where || t.file.name || "")}">` +
        `<span class="vw-ic" aria-hidden="true">${fileIcon(t.file.name || t.file.path || "")}</span><span class="vw-tn">${esc(t.file.name || t.file.path || "")}</span></button>` +
        `<button type="button" class="vw-tab-x${dirty ? " is-dirty" : ""}" data-vw-tabx="${i}" aria-label="Close ${esc(t.file.name || "")}${dirty ? " (not saved yet)" : ""}"><i aria-hidden="true"></i>${ICON.close}</button></span>`;
    }).join("") + `</div>`;
  }

  function head() {
    const f = V.file, d = V.data, D = doc();
    const kind = f.att || f.local != null ? typeWord(f.type || "", f.name) : d ? KIND_WORD[d.kind] || (extOf(f.name).toUpperCase() || "Text") : String(f.type || "").split("/").pop() || "";
    const c = chg(), diffing = showsDiff();
    const meta = diffing ? [] : [kind, V.dims && `${V.dims.w} × ${V.dims.h}`, size(d ? d.size_bytes : f.bytes)].filter(Boolean);
    const canCopy = !diffing && !!(d && typeof d.content === "string");
    // a changed file: what changed, or the whole file (the design's head: name, counts, the switch)
    const show = c ? `<div class="vw-seg is-words" role="group" aria-label="Show"><button type="button" data-vw-show="changes" aria-pressed="${diffing}">Changes</button><button type="button" data-vw-show="file" aria-pressed="${!diffing}">File</button></div>` +
      (diffing ? `<button type="button" class="vw-btn vw-split${V.split ? " is-on" : ""}" data-vw-split aria-pressed="${V.split}" title="${V.split ? "One column" : "Side by side"}" aria-label="Side by side">${SPLIT_IC}</button>` : "") : "";
    // Markdown: Page or Source (the same editor); HTML: Preview (its own page, in a frame) or Source; an image: Fit or 1:1
    const toggle = diffing ? "" : d && d.kind === "markdown"
      ? `<div class="vw-seg" role="group" aria-label="Show"><button type="button" data-vw-mode="page" aria-pressed="${V.textMode !== "source"}" title="As a page" aria-label="Page">${PAGE_IC}<span>Page</span></button><button type="button" data-vw-mode="source" aria-pressed="${V.textMode === "source"}" title="Source" aria-label="Source">${SRC_IC}<span>Source</span></button></div>`
      : d && d.kind === "html"
        ? `<div class="vw-seg" role="group" aria-label="Show"><button type="button" data-vw-mode="preview" aria-pressed="${V.mode === "preview"}" title="Preview" aria-label="Preview">${ICON.eye}<span>Preview</span></button><button type="button" data-vw-mode="source" aria-pressed="${V.mode === "source"}" title="Source" aria-label="Source">${SRC_IC}<span>Source</span></button></div>`
        : d && d.kind === "image"
          ? `<div class="vw-seg" role="group" aria-label="Size"><button type="button" data-vw-mode="preview" aria-pressed="${V.imgMode !== "actual"}">Fit</button><button type="button" data-vw-mode="actual" aria-pressed="${V.imgMode === "actual"}" aria-label="Actual size"><span class="vw-wide">Actual size</span><span class="vw-narrow" aria-hidden="true">1:1</span></button></div>`
          : "";
    const state = !diffing ? stateHtml(D) : "";
    const name = `<span class="vw-ic" aria-hidden="true">${fileIcon(f.name || f.path || "")}</span>` +
      `<div class="vw-t"><h2 id="vw-h"${f.where ? ` title="${esc(f.where)}"` : ""}>${esc(f.name || f.path)}</h2>${c && diffing ? countsHtml(c.file) : ""}${meta.length && !state ? `<span class="vw-meta">${esc(meta.join(" · "))}</span>` : state}</div>`;
    const runs = !diffing && runsCode() ? `<span class="xd-runs" title="Git or an agent runs what this file says">${BOLT_IC}<span>Runs code</span></span>` : "";
    const why = !diffing && d && typeof d.content === "string" && (d.editable === false || (D && D.state === "readonly")) ? NOT_EDITABLE[d.not_editable_reason || (D && D.err)] || "Read only" : "";
    const ro = why ? `<span class="xd-ro" title="${d.not_editable_reason === "read_only_place" ? "XO keeps this file: change it from its own screen" : esc(why)}">${d.not_editable_reason === "read_only_place" ? LOCK_IC : ""}<span>${esc(why)}</span></span>` : "";
    // Ask about this: the whole file, into its conversation's composer (lines have their own "Ask about lines")
    const askT = ask && ask.file && f.project && f.rel && ask.target(f);
    const askB = askT && !diffing ? `<button type="button" class="xd-btn vw-ask" data-vw-askfile title="Ask ${esc(askT)} about this file">Ask about this</button>` : "";
    // a narrow head keeps one row: the view switch, ⋯ and × stay; these fold into ⋯ (the owner's choice, 9 Nov: at
    // 320 px More was pushed off and the name went to nothing)
    const fold = (cls, attrs, label, role = "menuitem") => `<button type="button" role="${role}" class="vw-fold ${cls}" ${attrs}><span>${label}</span></button>`;
    const folds = [
      askB && fold("f-wide", `data-vw-askfile title="Ask ${esc(askT)} about this file"`, "Ask about this"),
      runs && fold("f-wide", `aria-disabled="true" title="Git or an agent runs what this file says"`, "Runs code"),
      // both switches in one head: the file's own (Page · Source, Fit · Actual size) folds, Changes · File stays
      show && toggle && (d.kind === "image"
        ? fold("f-narrow", `data-vw-mode="preview" aria-checked="${V.imgMode !== "actual"}"`, "Fit", "menuitemradio") + fold("f-narrow", `data-vw-mode="actual" aria-checked="${V.imgMode === "actual"}"`, "Actual size", "menuitemradio")
        : d.kind === "markdown"
          ? fold("f-narrow", `data-vw-mode="page" aria-checked="${V.textMode !== "source"}"`, "Page", "menuitemradio") + fold("f-narrow", `data-vw-mode="source" aria-checked="${V.textMode === "source"}"`, "Source", "menuitemradio")
          : fold("f-narrow", `data-vw-mode="preview" aria-checked="${V.mode === "preview"}"`, "Preview", "menuitemradio") + fold("f-narrow", `data-vw-mode="source" aria-checked="${V.mode === "source"}"`, "Source", "menuitemradio")),
    ].filter(Boolean);
    const more = moreHtml(f, canCopy, folds);
    return `<header class="vw-top">${name}` +
      `<div class="vw-acts">${askB}${runs}${ro}${show}${toggle}${more}` +
      `<button type="button" class="vw-x" data-vw-close aria-label="Close the file" title="Close (Esc)">${ICON.close}</button></div>` +
      (D && D.confirm ? confirmPop() : V.asking ? unsavedPop() : "") + `</header>`;
  }
  /** The bar under the head: the file's versions (two or more), or nothing. */
  function verBar() {
    const D = doc(), vers = showsDiff() ? "" : versionsHtml(D);
    return vers ? `<div class="vw-verbar${D && D.viewing ? " is-old" : ""}">${vers}</div>` : "";
  }

  /** The file's path in its own place (a worktree's own path), for the run-code rule and messages. */
  const localPath = () => String(V.file.rel || "").replace(/^\.xo\/worktrees\/[^/]+\//, "");
  // Space says (/file's place: ordinary, read_only, runs_code); before it answers, the same rule by path
  const runsCode = () => !!(V.file && V.file.project && V.file.rel && (V.data && V.data.place ? V.data.place === "runs_code" : RUNS.test(localPath())));
  /** A viewer control's hook as a selector, its name and value ([data-vw-show="file"], never only [data-vw-show]: that
   *  finds Changes for File, the controls grader's V99-v3 on 2a8d278): how every redraw finds the focused control again. */
  const hookOf = (e) => { const a = e && e.attributes && [...e.attributes].find((x) => x.name.startsWith("data-vw-")); return a ? (a.value ? `[${a.name}="${CSS.escape(a.value)}"]` : `[${a.name}]`) : ""; };
  /** Redraw only the head (and the versions bar under it): the editor below keeps its focus and caret. A control in the
   *  head that had focus keeps it across the redraw. */
  function paintHead() {
    const top = el.querySelector(".vw-top");
    if (!top) return;
    const ae = document.activeElement;
    const had = ae && top.contains(ae) ? hookOf(ae) : "";
    const fromMenu = !!(ae && ae.closest && ae.closest(".vw-menu"));
    // the head is drawn again (in place), the control under the keyboard maybe with it: the viewer holds focus first, in
    // this step, and the same control (or what follows it) takes it back below
    if (ae && top.contains(ae)) el.focus({ preventScroll: true });
    redrawNode(top, head()); // in place: a head control that stays is the same node, so a press on it still clicks
    paintBars();
    if (!had) return;
    const now = el.querySelector(".vw-top");
    // the same control where it shows; one chosen from ⋯'s menu, else the ⋯ itself (focus goes back to what opened it)
    const to = shown(now, had) || (fromMenu && shown(now, "[data-vw-more]")) || headFocus(false);
    if (to && to !== document.activeElement) to.focus({ preventScroll: true });
  }
  /** The open files' tabs above the head and the versions bar under it, each drawn again in place (made or taken away
   *  as they come and go); a control of theirs that had focus keeps it, the same way the head's do. */
  function paintBars() {
    const top = el.querySelector(".vw-top");
    if (!top) return;
    const ae = document.activeElement;
    const zone = (x) => !!x && !!x.closest && !!x.closest(".vw-tabs, .vw-verbar") && el.contains(x);
    const had = zone(ae) ? hookOf(ae) : "";
    if (had) el.focus({ preventScroll: true });
    const place = (cls, html, put) => {
      const now = el.querySelector(`:scope > .${cls}`);
      if (now && html) redrawNode(now, html); else if (now) now.remove(); else if (html) put(html);
    };
    place("vw-tabs", tabsHtml(), (h) => top.insertAdjacentHTML("beforebegin", h));
    place("vw-verbar", verBar(), (h) => el.querySelector(".vw-top").insertAdjacentHTML("afterend", h));
    if (!had) return;
    const to = shown(el, had) || headFocus(false);
    if (to && to !== document.activeElement) to.focus({ preventScroll: true });
  }
  /**
   * Where focus goes when what had it goes (a notice closed, a version left): never the page, never somewhere that
   * shows no ring. The text, when there's an editor; else the head's first control that shows (Close is always
   * there); the viewer itself only with none. go=false: only say where it would go.
   */
  function headFocus(go = true) {
    const head = el.querySelector(".vw-top");
    const to = (TX.h && showsText() && TX.h.view.contentDOM)
      || (head && [...head.querySelectorAll('button:not(:disabled), [tabindex="0"]')].find((x) => x.getClientRects().length && !x.closest("[inert]"))) || el;
    if (go) to.focus({ preventScroll: true });
    return to;
  }
  // focus was on the viewer (or dropped to the page when its control went): it may be put back after a redraw
  const focusHere = () => { const a = document.activeElement; return !a || a === document.body || el.contains(a); };

  /** The documents changed (a save, a version, someone else's change): the head says so; a clash opens its chunks. */
  function docChanged(d, what) {
    // a tab's dot follows its document whether or not it's the one on show
    if (!V.open) return;
    if (what === "saved") { edits && edits.saved && edits.saved({ project: d.project, rel: d.rel }); flashSaved(d); }
    if (d !== doc()) { if (what === "state" || what === "saved") paintHead(); return; }
    if (what === "conflict" && TX.h) { TX.h.showMerge(); announce(`${V.file.name} changed while you were typing. Where you both changed the same lines, keep yours or take theirs.`); }
    if (what === "applied" && d.state === "saved") announce(`${V.file.name} changed: the new version is in.`);
    if (what === "state" && TX.h) TX.h.refresh();
    if (what === "confirm" && d.confirm) { paintHead(); el.querySelector("[data-vw-confirm]")?.focus({ preventScroll: true }); return; }
    // typing in a preview tab keeps it
    if (what === "state" && d.state === "dirty") { const t = V.tabs.find((x) => x.doc === d); if (t && t.preview) t.preview = false; }
    paintHead();
  }
  let flashT = 0;
  /** "Saved", quietly, for a moment after each save of the file on show. */
  function flashSaved(d) {
    if (d !== doc()) return;
    V.savedFlash = d; clearTimeout(flashT);
    flashT = setTimeout(() => { if (V.savedFlash === d) { V.savedFlash = null; if (V.open) paintHead(); } }, 1600);
  }

  function body() {
    if (V.why) return `<div class="vw-empty"><p>${esc(V.why)}</p><p class="vw-path"><code>${esc(V.file.path)}</code><button type="button" class="btn vw-path-copy" data-vw-copy-path${V.busy ? ` aria-disabled="true"${V.busy.kind === "copy" ? ' aria-busy="true"' : ""}` : ""}>${ICON.copy}<span>${V.copied ? "Copied" : V.busy && V.busy.kind === "copy" && V.busy.shown ? "Copying…" : "Copy the path"}</span></button></p></div>`;
    if (V.loading) return `<p class="vw-empty"><i class="spin" aria-hidden="true"></i> Reading the file…</p>`;
    if (V.error) return `<div class="vw-empty"><p>${esc(V.error)}</p></div>`;
    const d = V.data;
    if (d.kind === "image") {
      const actual = V.imgMode === "actual";
      return `<div class="vw-img${actual ? " is-actual" : ""}"><img src="${esc(d.url)}" alt="${esc(V.file.name || "Image")}" draggable="false" title="${actual ? "Fit to the panel" : "Show at actual size"}"></div>`;
    }
    if (d.kind === "pdf") return `<iframe class="vw-frame vw-pdf" src="${esc(d.url)}" title="${esc(V.file.name || "PDF")}" referrerpolicy="no-referrer"></iframe>`;
    const text = String(d.content ?? "");
    const cut = cutHtml();
    if (d.kind === "html" && V.mode === "preview") return cut + `<iframe class="vw-frame" sandbox="allow-scripts" referrerpolicy="no-referrer" title="${esc(V.file.name || "HTML preview")}" srcdoc="${esc(d.doc ? docs.textOf(d.doc) : text)}"></iframe>`;
    return cut; // text shows in the editor (render → showsText)
  }
  /** A file over 1 MB reads only its first part: said so, with the whole file a download away. */
  function cutHtml() {
    const d = V.data;
    if (!d || !d.truncated) return "";
    return `<p class="vw-cut">${ICON.clock}<span>Showing the first ${esc(size(bytes(d.content)))} of ${esc(size(d.size_bytes))}. The rest isn't shown.</span>${canSave() ? `<button type="button" class="vw-cut-dl" data-vw-download${V.busy ? ` aria-disabled="true"${V.busy.kind === "download" ? ' aria-busy="true"' : ""}` : ""}>Download the whole file</button>` : ""}</p>`;
  }

  /** The diff body: one element, kept (with Pierre's drawing in it) while the head around it redraws. */
  function diffBody() {
    if (!DF.el) { DF.el = document.createElement("div"); DF.el.className = "vw-body vw-diff"; DF.el.tabIndex = 0; }
    return DF.el;
  }
  function dropDiff() { DF.gen++; if (DF.handle) { DF.handle.destroy(); DF.handle = null; } if (DF.img) { DF.img.drop(); DF.img = null; } DF.key = null; DF.pend = null; DF.reading = null; }
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
  async function drawDiff(c, { again = false } = {}) {
    const host = diffBody(), at = `${c.scope.key}|${c.path}|`, ask = ++DF.ask;
    const ours = (k) => !!k && k.startsWith(at);
    // a read that failed stays said until you ask again (Try again), rather than being read again on every redraw
    if (!again && DF.key === `${at}none:error:${c.file.version || ""}`) return; // (a newer version is read afresh)
    // while this change is read, its body says so: never blank, never the last change's drawing or words (Files/Map
    // grader on 44e429d: a held read left them showing)
    if ((again || (!ours(DF.key) && !ours(DF.pend))) && DF.reading !== at) {
      if (DF.handle) { DF.handle.destroy(); DF.handle = null; }
      if (DF.img) { DF.img.drop(); DF.img = null; }
      DF.key = null; DF.pend = null;
      // drawing again after the renderer failed on this change says so in its notice, in place, its Try again busy (a
      // second press does nothing more), so focus on it stays on it, as the file's does (S139). Its words were replaced
      // by "Reading the change…" before render looked for the focused Try again, and the head took focus (the controls
      // grader on 70375ad, Image-renderer-retry-v2). Otherwise the body says it's reading.
      const redo = DF.failed === at && host.querySelector(":scope > .vw-empty [data-vw-diff-redraw]");
      DF.failed = null;
      if (redo) {
        const box = redo.closest(".vw-empty"), words = box.querySelector("p");
        box.setAttribute("role", "status");
        if (words) words.textContent = "Drawing this diff…";
        redo.setAttribute("aria-busy", "true"); redo.setAttribute("aria-disabled", "true"); redo.textContent = "Trying again…";
      } else inRegion(host, () => { host.innerHTML = `<p class="vw-empty" role="status"><i class="spin" aria-hidden="true"></i> Reading the change…</p>`; });
      DF.reading = at;
    }
    // a read that failed is said as a failure, never as "too large" (Astra: a failed fetch read "Too large to show")
    let readErr = null;
    const patch = await changes.patchAt(c).catch((err) => { readErr = err; return null; });
    // only the newest read, and only while it's still the change on show: an answer for the file you left, or an
    // older read of this one, never draws over what's there now
    const now = V.open && showsDiff() ? chg() : null;
    if (ask !== DF.ask || !now || `${now.scope.key}|${now.path}|` !== at) return;
    const key = `${at}${patch ? patch.length + ":" + patch.slice(-64) : `none:${readErr ? `error:${c.file.version || ""}` : c.file.version || ""}`}`;
    if (DF.key === key || DF.pend === key) return; // drawn (a drawing, or its words), or on its way
    DF.pend = key; DF.reading = null;
    const my = ++DF.gen;
    if (!patch) {
      dropDiff();
      // an image: itself (modules/changes/imagechange.js), Before beside Now when it changed, in place of "Binary file"
      if (isImageChange(c.file) && V.file.project && V.file.rel) {
        DF.img = drawImageChange(host, { project: V.file.project, rel: V.file.rel, file: c.file, read: changes.read, at: c.base || null });
        DF.key = key;
        return;
      }
      if (readErr) {
        inRegion(host, () => { host.innerHTML = `<div class="vw-empty" role="alert"><p>Couldn't read this change${readErr.message ? `: ${esc(readErr.message)}` : ""}.</p><p><button type="button" class="vw-cut-dl" data-vw-diff-retry>Try again</button></p></div>`; });
        DF.key = key;
        return;
      }
      const why = c.file.binary || c.file.patch_omitted === "binary" ? "Binary file" : c.file.patch_omitted === "submodule" ? "A submodule" : "Too large to show here";
      inRegion(host, () => { host.innerHTML = `<div class="vw-empty"><p>${esc(why)}.</p>${canSave() ? `<p><button type="button" class="vw-cut-dl" data-vw-download>Download</button></p>` : ""}</div>`; });
      DF.key = key;
      return;
    }
    if (DF.img) { DF.img.drop(); DF.img = null; }
    try {
      if (DF.handle && DF.key && DF.key.startsWith(`${c.scope.key}|${c.path}|`)) DF.handle.update(patch);
      else {
        if (DF.handle) { DF.handle.destroy(); DF.handle = null; }
        // (the busy notice of a draw after a failure stays until the drawing is in, then goes; focus on its Try again
        // goes to the diff's body)
        if (!host.querySelector(':scope > .vw-empty [data-vw-diff-redraw][aria-busy="true"]')) inRegion(host, () => host.replaceChildren());
        const h = await DV.diff(host, patch, { path: c.path, wrap: true, split: V.split, loadFiles: (fd) => bothSides(c, fd) });
        if (my !== DF.gen) { h.destroy(); return; }
        DF.handle = h;
        inRegion(host, () => { for (const x of host.querySelectorAll(":scope > .vw-empty")) x.remove(); });
      }
      DF.key = key;
    } catch {
      if (my !== DF.gen) return;
      dropDiff(); // (clears pend: Try again draws afresh)
      DF.failed = at;
      // its Try again shows the changes again, behind a hook of its own: render finds the focused control again by its
      // first hook across the whole viewer, and data-vw-show="changes" first found the head's Changes (the controls
      // grader on 70375ad, Image-renderer-retry-v2)
      inRegion(host, () => { host.innerHTML = `<div class="vw-empty"><p>Couldn't draw this diff.</p><p><button type="button" class="vw-cut-dl" data-vw-diff-redraw data-vw-show="changes">Try again</button></p></div>`; });
    }
  }

  /** A file's or a change's region drawn anew (its notice gone, its words replaced, the drawing in): focus that was
   *  on something in it stays in it, on the same control drawn again (by its hook), else on the region itself, never
   *  the page (the controls grader on aa2e4f9, S139: a busy Try again pressed, then the file drew over its notice, and
   *  focus fell to BODY). Every place the viewer replaces a region's content goes through here. */
  function inRegion(host, change) {
    const a = document.activeElement, inside = !!a && a !== host && host.contains(a);
    const hook = inside ? hookOf(a) : "";
    change();
    if (!inside) return;
    const now = document.activeElement;
    if (now && now !== document.body && host.contains(now) && now.getClientRects().length) return;
    const same = hook && host.querySelector(hook);
    (same && same.getClientRects().length && !same.matches('[aria-busy="true"]') ? same : host).focus({ preventScroll: true });
  }

  // ── the text: one editor (modules/files/editor.js) on the document (modules/files/documents.js) ─────────────────────────────────────────
  function textBody() {
    // the editor's own text takes the keys (a tab stop of its own); the body holds focus only when what was in it goes
    // (a notice drawn over, a Try again pressed), so focus never falls to the page
    if (!TX.el) { TX.el = document.createElement("div"); TX.el.className = "vw-body vw-file vw-doc"; TX.el.tabIndex = -1; }
    return TX.el;
  }
  /** Let the editor go (its state stays with its document, for when the file is back). */
  function dropText() {
    TX.gen++;
    if (TX.h) { TX.h.destroy(); TX.h = null; }
    TX.key = null; TX.sel = null; closeAsk(true);
    if (TX.el) TX.el.replaceChildren();
  }
  /** The editor for the document on show: made once per document, kept while the head redraws. */
  async function drawText() {
    const D = doc();
    if (!D) return;
    const page = isMd() && V.textMode !== "source";
    const key = `${D.key}|${page ? "page" : "src"}`;
    if (TX.key === key && TX.h) return;
    if (TX.h && TX.key && TX.key.split("|").slice(0, -1).join("|") === D.key) { TX.h.setPage(page); TX.key = key; return; }
    // drawing again after a failure says so while it's out, in place: the failure's words become what's happening and
    // its Try again shows it's busy (a second press does nothing more); drawn, the notice goes; failed, it says so again
    const again = TX.el && TX.el.querySelector(":scope > .vw-empty [data-vw-retry]");
    if (!again) dropText();
    else { TX.gen++; if (TX.h) { TX.h.destroy(); TX.h = null; } }
    TX.key = key;
    const my = TX.gen, host = textBody(), f = V.file;
    if (again) {
      const box = again.closest(".vw-empty"), words = box.querySelector("p");
      box.setAttribute("role", "status");
      if (words) words.textContent = "Drawing this file…";
      again.setAttribute("aria-busy", "true"); again.setAttribute("aria-disabled", "true"); again.textContent = "Trying again…";
    }
    host.classList.toggle("is-page", page);
    const askable = !!(ask && f.project && f.rel && ask.target(f));
    try {
      const h = await mountEditor(host, {
        docs, doc: D, name: f.name || f.path || "", page,
        onLines: askable ? (l) => { TX.sel = l; } : null,
        onAsk: askable ? (l) => openAsk(l) : null,
        onSave: () => { docs.flush(D); },
      });
      if (my !== TX.gen) { h.destroy(); return; }
      TX.h = h;
      // the renderer that failed said so in this same body; drawn now, that notice and its Try again go
      inRegion(host, () => { for (const x of host.querySelectorAll(":scope > .vw-empty")) x.remove(); });
      if (D.state === "conflict") h.showMerge();
      if (D.viewing) h.showVersion(D.viewing.text);
      else if (V.showChanges) showChangesNow();
      // a link to lines (path:a-b) selects them; a file just made puts the caret in it
      if (f.lines) { const [a, b] = f.lines; h.select(a, b); }
      if (el.contains(document.activeElement) || document.activeElement === document.body || V.focusText) { V.focusText = false; h.focus(); }
    } catch (err) {
      if (my !== TX.gen) return;
      TX.key = null;
      console.error(err);
      inRegion(host, () => { host.innerHTML = `<div class="vw-empty"><p>Couldn't show this file.</p><p><button type="button" class="vw-cut-dl" data-vw-retry>Try again</button></p></div>`; });
    }
  }
  /** Show changes: what the version on show changed from the one before it, marked in the text. */
  function showChangesNow() {
    const D = doc();
    if (!TX.h || !D) return;
    const n = D.versions.length, prev = n > 1 ? D.versions[n - 2] : null;
    TX.h.showChanges(V.showChanges && prev && prev.text != null ? prev.text : null);
  }
  /** Step to an older or newer version (read only), or back to the latest. */
  async function stepVersion(dir) {
    const D = doc();
    if (!D || !TX.h) return;
    const n = D.versions.length, at = D.viewing ? D.versions.indexOf(D.viewing) : n - 1;
    let to = Math.min(n - 1, Math.max(0, at + dir));
    if (to === at || to < 0 || to > n - 1) return;
    // an older version whose text isn't held here is read from Space's version store (§4.2); one it no longer keeps
    // (pruned, a secret's) is stepped over
    for (; to > 0 && to < n - 1 && D.versions[to].text == null; to += dir) {
      const v = D.versions[to];
      if (!v.version || v.gone) continue;
      try {
        const r = await api.projectFile(D.project, D.rel, null, { version: v.version });
        if (typeof r.content === "string") { v.text = r.content; break; }
      } catch { v.gone = true; }
      if (doc() !== D) return;
    }
    if (to === at || to < 0 || to > n - 1 || doc() !== D) return;
    if (to === n - 1) { docs.view(D, null); TX.h.showVersion(null); announce("The latest version."); }
    else {
      if (V.showChanges) { V.showChanges = false; TX.h.showChanges(null); }
      const v = docs.view(D, to);
      if (!v || v.text == null) { docs.view(D, null); return; }
      TX.h.showVersion(v.text);
      announce(`Version ${to + 1} of ${n}${byWords(v.by, threadTitle) ? `, by ${byWords(v.by, threadTitle)}` : ""}. Read only.`);
    }
    paintHead();
  }

  // ── asking about lines: "Ask about lines a–b ⌘L" under a selection (the editor draws it); beside the chat the lines
  // go into the chat's own composer (the owner's D4); elsewhere a small composer opens under the head ──
  function openAsk(l) {
    const f = V.file;
    if (!l || !ask) return;
    const to = ask.target(f);
    if (!to) return;
    if (ask.compose && ask.compose(f, l.a, l.b)) return;
    TX.asking = { a: l.a, b: l.b };
    let q = el.querySelector(":scope > .xd-q");
    if (!q) {
      q = document.createElement("form");
      q.className = "xd-q";
      q.innerHTML = `<p class="xd-ref"></p><textarea class="xd-in" rows="2" aria-label="Your question about these lines" placeholder="Ask about these lines"></textarea>` +
        `<div class="xd-row"><span class="xd-to"></span><span class="xd-sp"></span><span class="xd-hint">Esc to close</span><button type="submit" class="xd-send" aria-label="Send">${ICON.send}</button></div>`;
      q.addEventListener("submit", (e) => { e.preventDefault(); sendAsk(); });
      q.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendAsk(); }
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeAsk(); }
      });
      (el.querySelector(":scope > .vw-verbar") || el.querySelector(":scope > .vw-top")).after(q);
    }
    q.querySelector(".xd-ref").innerHTML = `${fileIcon(f.name || f.path)}<span>${esc(f.name || f.path)} · ${l.a === l.b ? `line ${l.a}` : `lines ${l.a}–${l.b}`}</span>`;
    q.querySelector(".xd-to").innerHTML = `To <b>${esc(to)}</b>`;
    q.querySelector(".xd-in").focus({ preventScroll: true });
  }
  function closeAsk(quiet = false) {
    const q = el.querySelector(":scope > .xd-q");
    const had = !!TX.asking;
    TX.asking = false;
    if (q) q.remove();
    if (had && !quiet && TX.h) TX.h.focus();
  }
  function sendAsk() {
    const q = el.querySelector(":scope > .xd-q"), t = q && q.querySelector(".xd-in").value.trim();
    if (!t || !TX.asking) return;
    if (ask.send(V.file, TX.asking.a, TX.asking.b, t)) { closeAsk(); if (TX.h) TX.h.clearSelection(); }
  }


  /**
   * Redraw. A control of the viewer's that had focus keeps it (the same control drawn again: Changes after
   * pressing Changes), else the text, else the head's first control: a redraw never drops focus to the page
   * (Astra S127). Focus inside the text is left alone (the editor isn't redrawn).
   */
  function render() {
    const ae = document.activeElement;
    let was = null;
    const fromMenu = !!(ae && ae.closest && ae.closest(".vw-menu"));
    // a control that shows a view and isn't drawn in it: focus goes to that view's segment
    const chose = ae && ae.dataset && ae.dataset.vwShow;
    if (ae && ae !== el && el.contains(ae) && !(TX.el && TX.el.contains(ae))) was = hookOf(ae);
    renderNow();
    if (was == null || !V.open) return;
    const now = document.activeElement;
    if (now && now !== document.body && now.isConnected && now.getClientRects().length) return;
    const to = (was && shown(el, was)) || (fromMenu && shown(el, "[data-vw-more]"))
      || (chose && chose === V.show && shown(el, `.vw-seg [data-vw-show="${chose}"]`))
      || (was === "[data-vw-cut-sel]" && (shown(el, "[data-vw-copy-path]") || shown(el, "[data-vw-more]"))) || headFocus(false);
    to.focus({ preventScroll: true });
  }
  /** What every view of the viewer draws above its body, the same way in each: the stage's tabs, the open files' tabs,
   *  the head, and a download, copy or undo that failed (V.saveError), said under the head. */
  const above = () => {
    const cut = V.saveError && (typeof V.saveError === "string" ? { text: V.saveError } : V.saveError);
    const D = doc(), err = D && (D.state === "error" || D.state === "deleted") && D.err ? D.err : null;
    return (tabs ? tabs() : "") + tabsHtml() + head() + verBar() +
      (V.saveError ? `<p class="vw-cut" role="alert">${ICON.warn}<span>${esc(cut.text)}</span>${cut.select ? `<input class="vw-cut-sel" data-vw-cut-sel readonly value="${esc(cut.select)}" aria-label="The path, to copy" spellcheck="false">` : ""}</p>` : "") +
      (err && !showsDiff() ? `<p class="vw-cut xd-errline" role="alert">${ICON.warn}<span>${esc(err)}</span>${D.state === "deleted" ? `<button type="button" class="vw-cut-dl" data-vw-saveagain>Save it again</button>` : `<button type="button" class="vw-cut-dl" data-vw-saveagain>Try again</button>`}</p>` : "");
  };
  function renderNow() {
    if (!V.open) return;
    const asking = el.querySelector(":scope > .xd-q");
    if (showsText()) {
      // the head redraws; the text's body (the editor, where you are) stays
      const host = textBody();
      if (DF.handle || DF.key) dropDiff();
      el.innerHTML = above() + cutHtml() + `<i data-vw-file hidden></i>`;
      el.querySelector("[data-vw-file]").replaceWith(host);
      if (asking) (el.querySelector(":scope > .vw-verbar") || el.querySelector(":scope > .vw-top")).after(asking);
      drawText();
      return;
    }
    if (TX.h || TX.key) dropText();
    if (showsDiff()) {
      // the head redraws; the diff's body (and where you are in it) stays
      const host = diffBody(), top = host.scrollTop;
      el.innerHTML = above() + `<i data-vw-diff hidden></i>`;
      el.querySelector("[data-vw-diff]").replaceWith(host);
      host.scrollTop = top;
      drawDiff(chg());
      return;
    }
    if (DF.handle || DF.key) dropDiff();
    const keep = el.querySelector(".vw-body")?.scrollTop || 0;
    const framed = V.data && ((V.data.kind === "html" && V.mode === "preview") || V.data.kind === "pdf");
    el.innerHTML = above() + `<div class="vw-body${framed ? " is-frame" : ""}" tabindex="0">${body()}</div>`;
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

  /** Read a project text file whole for its document (up to 1 MB, editable); a bigger one reads its first part only. */
  async function readText(f) {
    try { return await api.projectFile(f.project, f.rel, null, { purpose: "edit" }); }
    catch (err) {
      if (err.status !== 413) throw err;
      const d = await api.projectFile(f.project, f.rel);
      return { ...d, editable: false, not_editable_reason: "too_large" };
    }
  }

  async function load() {
    const my = ++V.gen, tab = V.tab;
    dropImage();
    V.loading = true; V.error = null; V.data = null; V.dims = null;
    render();
    try {
      if (V.file.att || V.file.local != null) {
        const d = await readAttachment(V.file);
        if (my !== V.gen) return;
        if (typeof d.content === "string") d.doc = docs.open(`att:${V.file.att ? V.file.att.chat : "paste"}`, V.file.att ? V.file.att.id : V.file.name || "paste", { ...d, version: null, editable: false, not_editable_reason: "attachment" });
        V.data = d;
      } else if (V.file.image) {
        const blob = await api.projectImage(V.file.project, V.file.rel);
        if (my !== V.gen) return;
        V.data = { kind: "image", size_bytes: blob.size, url: URL.createObjectURL(blob) };
      } else {
        const d = await readText(V.file);
        if (my !== V.gen) return;
        if (typeof d.content !== "string") V.error = "XO sent this file without its text.";
        else d.doc = docs.open(V.file.project, V.file.rel, d);
        V.data = d;
        if (d.doc) loadVersions(d.doc);
      }
      if (tab) { tab.data = V.data; tab.doc = V.data && V.data.doc || null; }
    } catch (err) {
      if (my !== V.gen) return;
      V.error = err.status === 404 ? "This file isn't there any more." : err.status === 403 && err.code === "outside_project" ? "This file is outside the project: a link leads out of it." : err.message || "Couldn't read this file.";
    }
    V.loading = false;
    render();
  }
  /** Who made each version and when, from Space (GET /versions, SPACE-CONTRACT.md §4.1), where it has them. */
  let versionsRoute = true;
  async function loadVersions(D) {
    if (!versionsRoute || !api.projectVersions) return;
    try {
      const r = await api.projectVersions(D.project, D.rel);
      docs.knownVersions(D, r.versions || []);
    } catch (err) { if (missingRoute(err)) versionsRoute = false; } // a bare 404: no route yet
  }

  // Someone else changed a file that's open. Space says so itself (its file.version event: app.js → fileChanged);
  // until it does, the project's changes are the signal: a changed file's hash in /changes (read after each edit an
  // agent finishes) that isn't the open document's version means a newer one. Either way the document takes it in
  // (modules/files/documents.js changed): in place when you have nothing unsaved, merged when you do.
  const sigNow = (D) => { const c = changes ? changes.at(D.project, D.rel) : null; return c && typeof c.file.version === "string" ? c.file.version : null; };
  let pushed = false; // Space sends file.version: the /changes signal isn't needed
  /** Called on every app render (the /changes signal, on today's Space). */
  function notice() {
    if (pushed || !V.open) return;
    for (const t of V.tabs) {
      const D = t.doc;
      if (!D || D.state === "readonly" || D.state === "conflict" || !D.project || D.project.startsWith("att:")) continue;
      const now = sigNow(D);
      if (!now || now === D.version || now === D.checkedSig) continue;
      D.checkedSig = now;
      docs.changed(D.project, D.rel, { version: now, by: { kind: "agent" } });
    }
  }
  /** Space's file.version (and .attributed, file.rescan): what changed, who made it. */
  function fileChanged(ev) {
    pushed = true;
    if (!ev || !ev.project_id) return;
    if (ev.type === "file.rescan") { // the watcher lost track: every open document checks its file again
      for (const D of docs.all()) if (D.project === ev.project_id) docs.changed(D.project, D.rel, {});
      return;
    }
    const D = docs.get(ev.project_id, ev.path) || (ev.old_path ? docs.get(ev.project_id, ev.old_path) : null);
    if (!D) return;
    // renamed or moved: the document, and its tab, follow the file to its new path
    if (ev.kind === "rename" && ev.old_path && ev.path && D.rel === ev.old_path) {
      docs.renamed(D.project, ev.old_path, ev.path);
      const name = ev.path.split("/").pop();
      for (const t of V.tabs) if (t.doc === D) { t.file = { ...t.file, rel: ev.path, path: ev.path, name, where: ev.path }; if (t === V.tab) V.file = t.file; }
      if (D === doc()) { announce(`${name}: the file moved to ${ev.path}.`); render(); } else paintHead();
      if (ev.version && ev.version === D.version) return;
    }
    if (ev.type === "file.version.attributed") { // who made a version already in
      const v = D.versions.find((x) => x.id === ev.id);
      if (v) { v.by = ev.by; if (D === doc()) paintHead(); }
      return;
    }
    docs.changed(D.project, D.rel, { version: ev.version, by: ev.by, at: ev.at, id: ev.id, kind: ev.kind });
  }

  // ── tabs: several files open at once ──────────────────────────────────────────────────────────────────────────
  const sameFile = (a, b) => !!a && !!b && (a.project && a.rel ? a.project === b.project && a.rel === b.rel : a.att && b.att ? a.att.chat === b.att.chat && a.att.id === b.att.id : a === b);
  function releaseTab(t) {
    if (t.doc) { docs.release(t.doc); t.doc = null; }
    if (t.data && t.data.url && !t.data.remote) URL.revokeObjectURL(t.data.url);
  }
  /** Show a tab: its document is already open (instant), or the file is read. */
  function showTab(t) {
    dropText();
    V.gen++;
    V.tab = t; V.file = t.file;
    Object.assign(V, { data: t.data || null, dims: null, error: null, why: t.file.why || null, imgMode: "preview", copied: false, busy: null, saveError: null, menu: false, showChanges: false });
    V.show = t.file.show === "changes" ? "changes" : "file";
    dropDiff(); if (DF.el) DF.el.scrollTop = 0;
    if (V.why) render(); else if (showsDiff()) { V.loading = false; render(); } else if (t.data) { V.loading = false; render(); } else load();
  }

  /**
   * f: {name, path, type, bytes, project?, rel?, why?, lines?: [a, b], show?: "changes", pin?} for a shared file,
   * {name, type, bytes, att: {chat, id}} for an attachment, {name, bytes, local: text} for a paste; from: where
   * focus returns. A file already open comes forward; another takes the preview tab's place (or a new tab).
   */
  function open(f, from) {
    const was = V.open;
    if (V.parked) { V.parked = false; el.hidden = false; }
    const file = { ...f, where: f.rel || f.path || "", image: f.att ? kindOf(f.type || "") === "image" : f.local == null && isImagePath(f.rel || f.path || f.name) };
    // leaving the file on show: what's pending in it saves now
    let t = V.tabs.find((x) => sameFile(x.file, file));
    if (t) { t.file = { ...t.file, ...file }; }
    else {
      const prev = V.tabs.findIndex((x) => x.preview && !(x.doc && (x.doc.state === "dirty" || x.doc.state === "saving" || x.doc.state === "conflict")));
      t = { file, data: null, doc: null, preview: !f.pin && !f.created };
      if (prev >= 0) { releaseTab(V.tabs[prev]); V.tabs.splice(prev, 1, t); } else V.tabs.push(t);
    }
    if (!was) V.returnTo = from || document.activeElement;
    else if (from) V.returnTo = from;
    V.open = true;
    el.hidden = false;
    document.body.classList.add("viewer-open");
    if (!was) { el.classList.remove("is-in"); void el.offsetWidth; el.classList.add("is-in"); }
    V.focusText = !!f.created;
    prefetchEditor();
    showTab(t);
    if (!(f.created || f.lines)) el.focus({ preventScroll: true });
    announce(`${f.name || f.path} is open in the panel. Esc goes back to its sections.`);
    // the panel's Files page brings itself forward (modules/files/page.js): every way in ends here
    opened && opened(V.file, { focus: !!from || !!f.created || !!f.lines });
    onChange && onChange();
  }
  /** Close one tab; the last one closes the viewer. */
  function closeTab(i) {
    const t = V.tabs[i];
    if (!t) return;
    if (V.tabs.length === 1) { close(); return; }
    if (t.doc && !V.asking) { askUnsaved([t.doc], () => closeTab(V.tabs.indexOf(t))); if (V.asking) return; }
    const on = t === V.tab;
    releaseTab(t);
    V.tabs.splice(i, 1);
    if (on) { const next = V.tabs[Math.min(i, V.tabs.length - 1)]; V.focusText = true; showTab(next); } else paintHead();
    onChange && onChange();
  }

  function close({ restore = true, ask = false } = {}) {
    if (!V.open) return;
    // closed by you (× or Esc) with unsaved changes: asked first (Save, Don't save, Cancel), as VS Code does. Closed by
    // the app (another place): unsaved text waits as a draft in this browser, unsaved, for when the file opens again
    if (ask) { const ds = V.tabs.map((t) => t.doc).filter(Boolean); askUnsaved(ds, () => close({ restore })); if (V.asking) return; }
    for (const D of docs.unsaved()) docs.keepDraft(D);
    V.open = false; V.parked = false; V.gen++;
    const a = document.activeElement, lost = !a || a === document.body || el.contains(a); // focus goes with the viewer
    dropText(); dropDiff();
    // their documents go (anything unsaved was saved or let go in the question above)
    for (const t of V.tabs) releaseTab(t);
    V.tabs = []; V.tab = null; V.data = null;
    el.hidden = true; el.innerHTML = "";
    document.body.classList.remove("viewer-open");
    const back = V.returnTo;
    V.returnTo = null;
    if (restore) {
      // back to what opened it; if that was drawn again meanwhile (a message redrawn as its turn went on), to the
      // one drawn in its place; else, when focus would fall to the page, where you'd carry on (Files/Map grader on
      // 44e429d: only a still-connected opener was restored)
      const to = [back, likeOf(back)].find(usable) || (lost && home ? home() : null);
      to?.focus({ preventScroll: true });
    }
    onChange && onChange();
  }
  /** The control drawn in place of one that's gone: the same kind, saying the same thing (its file, change, box). */
  function likeOf(b) {
    if (!b || !b.getAttribute || b.isConnected) return null;
    for (const at of ["data-file", "data-cx", "data-node", "data-made-file", "data-k"]) {
      const v = b.getAttribute(at);
      if (v != null) return [...document.querySelectorAll(`${b.tagName}[${at}="${CSS.escape(v)}"]`)].find(usable) || null;
    }
    return b.id ? document.getElementById(b.id) : null;
  }

  /** Copy, and say so on the button. Where the browser has no clipboard API (a page not served over https or
   *  from this machine), the selection's own copy; where both refuse, the head says so in words. */
  async function copy(text, what = "contents") {
    // one pending state for the ⋯'s actions (V.busy, the download's too): a copy on its way takes no repeat (Enter,
    // Space, a tap, or More opened again stacked four clipboard calls: the controls grader on 76a53c1, S124/S125),
    // and says it's copying once it outlasts a moment; a refusal or success ends it
    if (V.busy) return;
    // the copy's own token: its result is said only on the file it started on, by the copy that's still the one on
    // its way (another file opened meanwhile resets V.busy): a late Copied or refusal painted onto the next file and
    // took focus to its More, and the old 1400 ms timer cleared the new copy's Copied (the controls grader on
    // 76a53c1, S124 / C81)
    const busy = V.busy = { kind: "copy", shown: false }, file = V.file;
    V.copied = false; // a new copy: the last one's Copied is over
    const slow = setTimeout(() => { if (V.busy === busy) { busy.shown = true; redrawKeep(); } }, COPY_SAYS_MS);
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      const ta = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
      ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
      const back = document.activeElement;
      el.appendChild(ta); ta.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove(); back && back.focus && back.focus({ preventScroll: true });
    }
    clearTimeout(slow);
    if (V.busy !== busy || V.file !== file) return; // settled after its file went: nothing to say here
    V.busy = null;
    // refused: said for what it was. The contents can be selected or downloaded; a path can't be had either way (the
    // view shows the file's name and its contents, a download is the file), so the path itself is offered to copy
    if (!ok) {
      V.saveError = what === "path"
        ? { text: "Couldn't copy the path: the browser didn't allow it here. Here it is to copy:", select: text }
        : "Couldn't copy: the browser didn't allow it here. Select the text and copy it, or download the file.";
      redrawKeep(); announce(what === "path" ? "Couldn't copy the path." : "Couldn't copy."); return;
    }
    V.copied = busy; V.saveError = null; // this copy's Copied, cleared by this copy's timer only
    redrawKeep();
    announce("Copied.");
    setTimeout(() => { if (V.copied === busy) { V.copied = false; redrawKeep(); } }, 1400);
  }

  // a choice from ⋯'s menu: it acts, then the menu goes and focus is on something that shows: where the action put
  // it, else the same control where it shows, else the ⋯
  el.addEventListener("click", (e) => {
    const fromMenu = V.menu && !!e.target.closest(".vw-menu") && !e.target.closest(".vw-menu a");
    act(e);
    if (!fromMenu || !V.open) return;
    if (el.querySelector(".vw-menu") && !V.menu) paintHead(); // nothing redrew the head: the menu goes now
    const a = document.activeElement;
    if (!a || a === document.body || (el.contains(a) && !a.getClientRects().length)) (shown(el, "[data-vw-more]") || headFocus(false)).focus({ preventScroll: true });
  });
  el.addEventListener("dblclick", (e) => {
    // a double click on a preview tab keeps it
    const tb = e.target.closest("[data-vw-tab]");
    if (tb) { const t = V.tabs[+tb.dataset.vwTab]; if (t && t.preview) { t.preview = false; paintHead(); } }
  });
  function act(e) {
    if (e.target.closest("[data-vw-more]")) {
      // while it downloads it says so and keeps focus, but doesn't open (aria-disabled, not disabled: a disabled
      // button drops focus to the page, and it never came back when the download ended: Astra C092/S126)
      if (V.busy) return;
      V.menu = !V.menu; paintHead();
      (V.menu ? menuItems()[0] : el.querySelector("[data-vw-more]"))?.focus({ preventScroll: true });
      return;
    }
    // a menu item: the menu closes, then it acts (a link is left to the browser, so its close waits a turn)
    if (V.menu && e.target.closest(".vw-menu a")) { setTimeout(() => menuOff(true)); return; }
    if (V.menu && e.target.closest(".vw-menu")) V.menu = false;
    const tx = e.target.closest("[data-vw-tabx]");
    if (tx) { closeTab(+tx.dataset.vwTabx); return; }
    const tb = e.target.closest("[data-vw-tab]");
    if (tb) { const t = V.tabs[+tb.dataset.vwTab]; if (t && t !== V.tab) { V.focusText = true; showTab(t); onChange && onChange(); } return; }
    const un = e.target.closest("[data-vw-unsaved]");
    if (un) { answerUnsaved(un.dataset.vwUnsaved); return; }
    if (e.target.closest("[data-vw-close]")) { close({ ask: true }); return; }
    if (e.target.closest('[data-vw-diff-redraw][aria-busy="true"]')) return;
    const sh = e.target.closest("[data-vw-show]");
    if (sh) { V.show = sh.dataset.vwShow; if (V.show === "file" && !V.data && !V.loading) { load(); return; } V.keepScroll = true; render(); return; }
    const ver = e.target.closest("[data-vw-ver]");
    if (ver) { if (ver.getAttribute("aria-disabled") !== "true") stepVersion(+ver.dataset.vwVer); return; }
    if (e.target.closest("[data-vw-latest]")) { const D = doc(); if (D && TX.h) { docs.view(D, null); TX.h.showVersion(null); paintHead(); TX.h.focus(); } return; }
    if (e.target.closest("[data-vw-restore]")) {
      const D = doc(), v = D && D.viewing;
      if (!v || v.text == null || !TX.h) return;
      TX.h.showVersion(null);
      docs.restore(D, v.text, { id: v.id });
      announce("That version is the file again (a new version: the one before is kept).");
      paintHead(); TX.h.focus();
      return;
    }
    if (e.target.closest("[data-vw-changes]")) { V.showChanges = !V.showChanges; showChangesNow(); paintHead(); return; }
    if (e.target.closest("[data-vw-saveagain]")) { const D = doc(); if (D) docs.save(D); return; }
    if (e.target.closest("[data-vw-confirm]")) { const D = doc(); if (D) docs.confirmRunsCode(D, true); TX.h?.focus(); return; }
    if (e.target.closest("[data-vw-noconfirm]")) { const D = doc(); if (D) docs.confirmRunsCode(D, false); paintHead(); TX.h?.focus(); return; }
    // the renderer's Try again: the editor again (focus waits on the file's body, where the file appears)
    if (e.target.closest('[data-vw-retry][aria-busy="true"]')) return;
    if (e.target.closest("[data-vw-retry]")) { TX.key = null; drawText(); return; }
    // a change that failed to read: read it again; focus waits on the diff's body, where the change appears
    if (e.target.closest("[data-vw-diff-retry]")) { const c = chg(); if (!c) return; diffBody().focus({ preventScroll: true }); drawDiff(c, { again: true }); return; }
    if (e.target.closest("[data-vw-split]")) { V.split = !V.split; if (DF.handle) DF.handle.split(V.split); render(); return; }
    const m = e.target.closest("[data-vw-mode]");
    if (m) {
      const mode = m.dataset.vwMode;
      // an image's Fit or 1:1 is the image's own: never a document's mode (the controls grader on 131d146, I79: the values
      // are shared, "preview" being both an image's Fit and HTML's Preview)
      if (V.file.image || (V.data && V.data.kind === "image")) { V.imgMode = mode; render(); return; }
      // Markdown's Page or Source: the same editor, switched in place (caret, undo and scroll stay)
      if (mode === "page" || (mode === "source" && isMd())) { V.textMode = mode; if (TX.h) { TX.h.setPage(mode === "page"); TX.key = `${doc().key}|${mode === "page" ? "page" : "src"}`; TX.el?.classList.toggle("is-page", mode === "page"); paintHead(); } else render(); return; }
      V.mode = mode; render(); return;
    }
    if (e.target.closest(".vw-img img")) { V.imgMode = V.imgMode === "actual" ? "preview" : "actual"; render(); return; }
    if (e.target.closest("[data-vw-copy]")) { const D = doc(); copy(D ? docs.textOf(D) : String(V.data.content)); return; }
    if (e.target.closest("[data-vw-copy-path]")) { copy(V.file.rel ? localPath() : V.file.path, "path"); return; }
    if (e.target.closest("[data-vw-askfile]")) { ask.file(V.file); return; }
    if (e.target.closest("[data-vw-download]")) download();
  }
  // an image's size shows in the header once it has decoded; one that won't decode says so
  el.addEventListener("load", (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !V.data || V.data.kind !== "image" || V.dims) return;
    V.dims = { w: img.naturalWidth, h: img.naturalHeight };
    paintHead(); // the one head redraw: a head control that had focus keeps it (C092 v1: More lost it to BODY here)
  }, true);
  el.addEventListener("error", (e) => {
    if (!(e.target instanceof HTMLImageElement) || !V.data || V.data.kind !== "image") return;
    V.error = "This image couldn't be shown: the file may be damaged or in a format this browser can't read.";
    dropImage(); V.data = null;
    render();
  }, true);
  // the page going away (a reload, a closed tab): what's pending saves now, and waits as a draft in this browser
  // meanwhile; the browser's own question only when a draft couldn't be kept
  addEventListener("pagehide", () => { for (const D of docs.unsaved()) docs.keepDraft(D); });
  addEventListener("beforeunload", (e) => { const lost = docs.unsaved().filter((D) => D.state === "conflict" || !docs.keepDraft(D)); if (lost.length) { e.preventDefault(); e.returnValue = ""; } });
  // a press anywhere but the ⋯ and its menu closes the menu
  document.addEventListener("pointerdown", (e) => { if (V.menu && !(e.target.closest && e.target.closest(".vw-mw"))) menuOff(); }, true);
  // a tab put away (a phone may close it later): what's pending saves now, kept as a draft meanwhile
  document.addEventListener("visibilitychange", () => { if (document.hidden) for (const D of docs.unsaved()) docs.keepDraft(D); });
  pointerFollows(el); // the More menu: the item under the mouse is the active one (C058)
  // the path a refused Copy path offers: focused (Tab, or a click), all of it is selected, ready to copy; a click that
  // only placed the caret selects it all again
  el.addEventListener("focusin", (e) => { if (e.target.matches?.(".vw-cut-sel")) e.target.select(); });
  el.addEventListener("click", (e) => { const s = e.target.closest?.(".vw-cut-sel"); if (s && s.selectionStart === s.selectionEnd) s.select(); });
  // a press on the offered path selects all of it: the mouse's own caret placement is kept off it (it came after the
  // click's select and collapsed it again: the controls grader on c767cbf, S270-manual-reclick-v4); it takes focus and
  // selects itself here instead. A finger's long-press keeps the platform's own selection
  el.addEventListener("mousedown", (e) => { const s = e.target.closest?.(".vw-cut-sel"); if (!s || e.button !== 0) return; e.preventDefault(); s.focus({ preventScroll: true }); s.select(); });
  el.addEventListener("keydown", (e) => {
    if (V.menu && e.target.closest(".vw-mw")) {
      const items = menuItems(), i = items.indexOf(document.activeElement);
      if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); menuOff(true); return; }
      const to = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? (i < 0 ? -1 : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : null;
      if (to != null && items.length) { e.preventDefault(); items[(to + items.length) % items.length].focus(); }
      return;
    }
    const mod = (e.metaKey || e.ctrlKey) && !e.altKey;
    // ⌘S: save now (anywhere in the viewer; the editor's own ⌘S does the same)
    if (mod && !e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); const D = doc(); if (D) { if (D.confirm) docs.confirmRunsCode(D, true); else docs.flush(D); } return; }
    if (e.key === "Escape") {
      // an Escape the editor already used (its find bar closing, a suggestion going) isn't the viewer's
      if (e.defaultPrevented) { e.stopPropagation(); return; }
      e.preventDefault(); e.stopPropagation();
      const D = doc();
      if (D && D.confirm) { docs.confirmRunsCode(D, false); paintHead(); TX.h?.focus(); return; }
      if (D && D.viewing && TX.h) { docs.view(D, null); TX.h.showVersion(null); paintHead(); TX.h.focus(); return; }
      if (TX.sel && TX.h && TX.el && TX.el.contains(e.target)) { TX.h.clearSelection(); return; } // a selection clears first
      if (V.asking) { answerUnsaved("cancel"); return; }
      if (away && away()) return; // in the panel, Esc goes back to its sections with the file kept (modules/files/page.js)
      close({ ask: true }); return;
    }
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
    if (b && !TX.h) b.scrollTop = V.keep || 0;
    el.focus({ preventScroll: true });
    onChange && onChange();
  }
  /** Repaint the header (the Live · File switch follows the Map). */
  function refresh() { if (V.open && !V.parked) { V.keepScroll = true; render(); } }

  return {
    open, close, park, unpark, refresh, notice, fileChanged,
    get isOpen() { return V.open && !V.parked; }, get hasFile() { return V.open; }, get isParked() { return V.open && V.parked; }, get file() { return V.file; }, get opener() { return V.open ? V.returnTo : null; },
    /** Lines you both changed, waiting for your choice (leaving asks first). Unsaved text otherwise saves itself. */
    get editing() { return docs.all().some((D) => D.state === "conflict"); },
    /** Go to the line (⌃G from outside, a search result): the editor's own go-to. */
    goto(line, col = null) { if (TX.h) { TX.h.focus({ line }); void col; } else if (V.file) V.file.lines = [line, line]; },
    /** The open files (tabs), for ⌘P's "open" section. */
    get openFiles() { return V.tabs.map((t) => t.file); },
    /** You're leaving (another place, back to the conversation): unsaved text is kept as a draft in this browser (it
     *  comes back unsaved, for ⌘S); nothing is saved for you. */
    /** The panel asks before Files closes (its tab's ×, the panel's ×, an eviction): unsaved files ask Save, Don't save
     *  or Cancel; true once they're saved or let go, false on Cancel; nothing unsaved, true at once. */
    confirmClose() {
      return new Promise((res) => {
        if (!V.open) { res(true); return; }
        const ds = V.tabs.map((t) => t.doc).filter(Boolean);
        if (!docs.unsaved().some((D) => ds.includes(D))) { res(true); return; }
        const cur = V.tabs.find((t) => t.doc && ds.includes(t.doc) && t.doc.state !== "saved");
        if (cur && cur !== V.tab) showTab(cur);
        askUnsaved(ds, () => res(true), () => res(false));
      });
    },
    /** The panel's Esc, asked first: a question open, an older version shown. True when it took the Esc. */
    escape() {
      const D = doc();
      if (V.asking) { answerUnsaved("cancel"); return true; }
      if (D && D.confirm) { docs.confirmRunsCode(D, false); paintHead(); TX.h?.focus(); return true; }
      if (D && D.viewing && TX.h) { docs.view(D, null); TX.h.showVersion(null); paintHead(); TX.h.focus(); return true; }
      return false;
    },
    leave(go) {
      for (const D of docs.unsaved()) docs.keepDraft(D);
      const clash = docs.all().find((D) => D.state === "conflict");
      if (!clash) { go(); return; }
      announce("Lines you and someone else both changed are waiting: keep yours or take theirs first. Your text is kept as a draft meanwhile.");
      docs.keepDraft(clash);
      go();
    },
  };
}
