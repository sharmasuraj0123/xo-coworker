// The file viewer (if1 #2): a shared file opens in a panel beside the conversation, like a canvas.
// Markdown renders (markdown.js), other text is coloured code with line numbers (highlight.js), and
// HTML shows in a sandboxed frame with no scripts and no same-origin (Source shows its text), and an
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

const size = (n) => (n == null ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const bytes = (s) => new TextEncoder().encode(s).length;
const extOf = (name) => (/\.([\w-]+)$/.exec(String(name || "")) || [])[1] || "";
const KIND_WORD = { markdown: "Markdown", html: "HTML", text: "Text", code: "Code", json: "JSON" };

const ASK_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.3-4.6A7.5 7.5 0 1 1 20 11.5z"/></svg>';
const SPLIT_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M12 4.5v15"/></svg>';
// the Source toggle's glyph: angle brackets, drawn like the other line icons
const SRC_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 7-5 5 5 5M16 7l5 5-5 5"/></svg>';

/*
 * A text file shows whole through Pierre too (js/diffview.js file: virtualised, coloured in the worker).
 * Select lines (drag across the numbers, or Shift-click) and "Ask about lines 36–43 ⌘L" appears under them;
 * it opens a small composer under those lines (the code moves down for it) that sends to the file's own
 * thread, or the project's coordinator. ask: {target(f) → its name in words, or null when there's nowhere
 * to send; send(f, a, b, text) → true when it went}. lines on a file opened: [a, b] selected and in view.
 */
export function createViewer({ announce, onChange, tabs, changes = null, ask = null }) {
  const el = $("#viewer");
  const V = { open: false, parked: false, file: null, data: null, error: null, loading: false, mode: "preview", returnTo: null, gen: 0, copied: false, dims: null, saving: false, saveError: null, show: "file", split: false };
  // the diff, kept across redraws of the head (Pierre's element moves with its body): {el, handle, key, gen}
  const DF = { el: null, handle: null, key: null, gen: 0 };
  /** This file in its place's changes ({scope, path, file, base}), or null. */
  const chg = () => (changes && V.file && V.file.project && V.file.rel ? changes.at(V.file.project, V.file.rel) : null);
  const showsDiff = () => V.show === "changes" && !!chg();
  // the whole file through Pierre: {el (the scroller), handle, key, pend, gen, sel: {a, b}, asking, q (the composer)}
  const FL = { el: null, handle: null, key: null, pend: null, gen: 0, sel: null, asking: false, q: null };
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

  async function save() {
    if (V.saving) return;
    const f = V.file;
    V.saving = true; V.saveError = null; V.keepScroll = true; render();
    try {
      const url = URL.createObjectURL(await api.projectDownload(f.project, f.rel));
      const a = Object.assign(document.createElement("a"), { href: url, download: f.name || "file" });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      if (f === V.file) V.saveError = err.message || "Couldn't download this file.";
    }
    if (f !== V.file) return;
    V.saving = false; V.keepScroll = true; render();
  }

  function head() {
    const f = V.file, d = V.data;
    const kind = f.att || f.local != null ? typeWord(f.type || "", f.name) : d ? KIND_WORD[d.kind] || (extOf(f.name).toUpperCase() || "Text") : String(f.type || "").split("/").pop() || "";
    // an attachment opens in its own tab too; text has no inline view there, so it downloads
    const tab = f.att ? (kindOf(f.type || "") === "text"
      ? `<a class="vw-btn" href="${esc(attachmentUrl(f.att.chat, f.att.id))}" download="${esc(f.name || "file")}" title="Download" aria-label="Download">${ICON.down}<span>Download</span></a>`
      : `<a class="vw-btn" href="${esc(attachmentUrl(f.att.chat, f.att.id))}" target="_blank" rel="noopener noreferrer" title="Open in a new tab" aria-label="Open in a new tab">${ICON.arrow}<span>New tab</span></a>`)
      : canSave() ? `<button type="button" class="vw-btn" data-vw-save title="Download the whole file" aria-label="Download"${V.saving ? " disabled" : ""}>${ICON.down}<span>${V.saving ? "Downloading…" : "Download"}</span></button>` : "";
    const c = chg(), diffing = showsDiff();
    const meta = diffing ? [] : [kind, V.dims && `${V.dims.w} × ${V.dims.h}`, size(d ? d.size_bytes : f.bytes)].filter(Boolean);
    const canCopy = !diffing && !!(d && typeof d.content === "string");
    // a changed file: what changed, or the whole file (the design's head: name, counts, the switch)
    const show = c ? `<div class="vw-seg" role="group" aria-label="Show"><button type="button" data-vw-show="changes" aria-pressed="${diffing}">Changes</button><button type="button" data-vw-show="file" aria-pressed="${!diffing}">File</button></div>` +
      (diffing ? `<button type="button" class="vw-btn vw-split${V.split ? " is-on" : ""}" data-vw-split aria-pressed="${V.split}" title="${V.split ? "One column" : "Side by side"}" aria-label="Side by side">${SPLIT_IC}</button>` : "") : "";
    const toggle = diffing ? "" : d && (d.kind === "html" || d.kind === "markdown")
      ? `<div class="vw-seg" role="group" aria-label="Show"><button type="button" data-vw-mode="preview" aria-pressed="${V.mode === "preview"}" title="Preview" aria-label="Preview">${ICON.eye}<span>Preview</span></button><button type="button" data-vw-mode="source" aria-pressed="${V.mode === "source"}" title="Source" aria-label="Source">${SRC_IC}<span>Source</span></button></div>`
      : d && d.kind === "image"
        ? `<div class="vw-seg" role="group" aria-label="Size"><button type="button" data-vw-mode="preview" aria-pressed="${V.mode === "preview"}">Fit</button><button type="button" data-vw-mode="actual" aria-pressed="${V.mode === "actual"}" aria-label="Actual size"><span class="vw-wide">Actual size</span><span class="vw-narrow" aria-hidden="true">1:1</span></button></div>`
        : "";
    return `<header class="vw-top"><span class="vw-ic" aria-hidden="true">${fileIcon(f.name || f.path || "")}</span>` +
      `<div class="vw-t"><h2 id="vw-h"${f.where ? ` title="${esc(f.where)}"` : ""}>${esc(f.name || f.path)}</h2>${c && diffing ? countsHtml(c.file) : ""}${meta.length ? `<span class="vw-meta">${esc(meta.join(" · "))}</span>` : ""}</div>` +
      `<div class="vw-acts">${show}${toggle}${tab}` +
      (canCopy ? `<button type="button" class="vw-btn" data-vw-copy title="Copy the contents" aria-label="${V.copied ? "Copied" : "Copy"}">${ICON.copy}<span>${V.copied ? "Copied" : "Copy"}</span></button>` : "") +
      `<button type="button" class="vw-x" data-vw-close aria-label="Close the file" title="Close (Esc)">${ICON.close}</button></div></header>`;
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
    const cut = d.truncated ? `<p class="vw-cut">${ICON.clock}<span>Showing the first ${esc(size(bytes(text)))} of ${esc(size(d.size_bytes))}. The rest isn't previewed.</span>${canSave() ? `<button type="button" class="vw-cut-dl" data-vw-save${V.saving ? " disabled" : ""}>Download the whole file</button>` : ""}</p>` : "";
    let main;
    if (d.kind === "markdown" && V.mode !== "source") main = `<article class="prose vw-md">${renderMarkdown(text)}</article>`;
    else if (d.kind === "html" && V.mode === "preview") main = `<iframe class="vw-frame" sandbox="" referrerpolicy="no-referrer" title="${esc(V.file.name || "HTML preview")}" srcdoc="${esc(text)}"></iframe>`;
    else main = ""; // text and code show through Pierre (render → showsFile)
    return cut + main;
  }

  /** The diff body: one element, kept (with Pierre's drawing in it) while the head around it redraws. */
  function diffBody() {
    if (!DF.el) { DF.el = document.createElement("div"); DF.el.className = "vw-body vw-diff"; DF.el.tabIndex = 0; }
    return DF.el;
  }
  function dropDiff() { DF.gen++; if (DF.handle) { DF.handle.destroy(); DF.handle = null; } DF.key = null; DF.pend = null; }
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
    const key = `${c.scope.key}|${c.path}|${patch ? patch.length + ":" + patch.slice(-64) : "none"}`;
    if ((DF.key === key && DF.handle) || DF.pend === key) return; // drawn, or on its way
    DF.pend = key;
    const my = ++DF.gen;
    if (!patch) {
      dropDiff();
      const why = c.file.binary || c.file.patch_omitted === "binary" ? "Binary file" : c.file.patch_omitted === "submodule" ? "A submodule" : "Too large to show here";
      host.innerHTML = `<div class="vw-empty"><p>${esc(why)}.</p>${canSave() ? `<p><button type="button" class="vw-cut-dl" data-vw-save>Download</button></p>` : ""}</div>`;
      DF.key = key;
      return;
    }
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
      const cut = d.truncated ? `<p class="vw-cut">${ICON.clock}<span>Showing the first ${esc(size(bytes(d.content)))} of ${esc(size(d.size_bytes))}. The rest isn't previewed.</span>${canSave() ? `<button type="button" class="vw-cut-dl" data-vw-save${V.saving ? " disabled" : ""}>Download the whole file</button>` : ""}</p>` : "";
      el.innerHTML = (tabs ? tabs() : "") + head() + cut + `<i data-vw-file hidden></i>`;
      el.querySelector("[data-vw-file]").replaceWith(host);
      host.scrollTop = top;
      drawFile();
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
      V.error = err.status === 404 ? "This file isn't there any more." : err.message || "Couldn't read this file.";
    }
    V.loading = false;
    render();
  }

  /**
   * f: {name, path, type, bytes, project?, rel?, why?} for a shared file, {name, type, bytes, att:
   * {chat, id}} for an attachment, {name, bytes, local: text} for a paste; from: where focus returns.
   */
  function open(f, from) {
    const was = V.open;
    dropImage();
    if (V.parked) { V.parked = false; el.hidden = false; }
    Object.assign(V, { open: true, file: { ...f, where: f.rel || f.path || "", image: f.att ? kindOf(f.type || "") === "image" : f.local == null && isImagePath(f.rel || f.path || f.name) }, data: null, dims: null, error: null, why: f.why || null, mode: V.textMode || "preview", copied: false, saving: false, saveError: null, returnTo: from || (was ? V.returnTo : document.activeElement) });
    if (V.file.image) V.mode = "preview";
    // a changed file asked for as a change (the panel's Open in Files, the tree's Changed section) opens on
    // its diff; any other way in, whole. The diff is drawn from the patch and needs no read of the file.
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
    dropImage(); V.data = null; dropDiff(); dropFile();
    el.hidden = true; el.innerHTML = "";
    document.body.classList.remove("viewer-open");
    const back = V.returnTo;
    V.returnTo = null;
    if (restore && back && back.isConnected) back.focus({ preventScroll: true });
    onChange && onChange();
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); V.copied = true; } catch { announce("Couldn't copy: the browser refused."); return; }
    V.keepScroll = true; render();
    announce("Copied.");
    setTimeout(() => { if (V.copied) { V.copied = false; V.keepScroll = true; render(); } }, 1400);
  }

  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-vw-close]")) { close(); return; }
    const sh = e.target.closest("[data-vw-show]");
    if (sh) { V.show = sh.dataset.vwShow; if (V.show === "file" && !V.data && !V.loading) { load(); return; } V.keepScroll = true; render(); return; }
    if (e.target.closest("[data-vw-ask]")) { openAsk(); return; }
    if (e.target.closest("[data-vw-retry]")) { FL.pend = null; drawFile(); return; }
    if (e.target.closest("[data-vw-split]")) { V.split = !V.split; if (DF.handle) DF.handle.split(V.split); render(); return; }
    const m = e.target.closest("[data-vw-mode]");
    if (m) { V.mode = m.dataset.vwMode; if (V.mode !== "actual") V.textMode = V.mode; render(); return; }
    if (e.target.closest(".vw-img img")) { V.mode = V.mode === "actual" ? "preview" : "actual"; render(); return; }
    if (e.target.closest("[data-vw-copy]")) { copy(String(V.data.content)); return; }
    if (e.target.closest("[data-vw-copy-path]")) { copy(V.file.path); return; }
    if (e.target.closest("[data-vw-save]")) save();
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
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      if (FL.sel && !FL.asking) { FL.sel = null; FL.handle?.select(null); askCapsule(); return; } // a selection clears first
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

  return { open, close, park, unpark, refresh, get isOpen() { return V.open && !V.parked; }, get hasFile() { return V.open; }, get isParked() { return V.open && V.parked; }, get file() { return V.file; } };
}
