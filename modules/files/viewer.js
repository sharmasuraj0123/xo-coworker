// @ts-check

import { esc, isImagePath } from "../../core/platform/index.js";
import { ICON } from "../../core/ui/icons/names.js";
import { usable } from "../../core/ui/a11y/focus.js";
import { api } from "../../core/platform/api.js";
import { kindOf } from "../../core/services/media/attachment-rules.js";
import { createDocs } from "./documents.js";
import { prefetch as prefetchEditor } from "./editor.js";
import { RUNS } from "./scope.js";
import { createViewerHead, size } from "./viewer-head.js";
import { createViewerText } from "./viewer-text.js";
import { createViewerReads } from "./viewer-reads.js";
import { bindViewerEvents } from "./viewer-events.js";
import { createViewerDiff } from "./viewer-diff.js";

/** @import { BusyState, OpenFile, ViewerData, ViewerDocument, ViewerFile, ViewerOptions, ViewerRenderers, ViewerState, ViewerTab, ViewerTextState } from "./viewer-types.d.ts" */

/** @param {string | undefined} s */
const bytes = (s) => new TextEncoder().encode(s).length;

/** @param {ViewerOptions} options @param {ViewerRenderers} renderers */
export function createFileViewer({ announce, onChange, tabs, changes = null, ask = null, edits = null, away = null, home = null, threadTitle = () => null, opened = null, closed = null }, { $, diff, jump, isImageChange, drawImageChange }) {
  const el = /** @type {HTMLElement} */ ($("#viewer"));
  const COPY_SAYS_MS = 150;

  /** @type {ViewerState} */
  const V = { open: false, parked: false, file: null, data: null, error: null, loading: false, mode: "preview", textMode: "page", imgMode: "preview", returnTo: null, gen: 0, copied: false, dims: null, busy: null, saveError: null, show: "file", split: false, menu: false, tabs: [], showChanges: false };
  const chg = () => (changes && V.file && V.file.project && V.file.rel ? changes.at(V.file.project, V.file.rel) : null);
  const showsDiff = () => V.show === "changes" && !!chg();
  /** @type {ViewerTextState} */
  const TX = { el: null, h: null, key: null, gen: 0, sel: null, asking: false, q: null };
  const store = (() => { try { return localStorage; } catch { return null; } })();
  const docs = createDocs({ api, store, onChange: (d, what) => docChanged(d, what) });
  const doc = () => (V.data && V.data.doc) || null;
  const showsText = () => {
    const d = V.data;
    if (!V.open || V.loading || V.error || V.why || !d || typeof d.content !== "string" || showsDiff()) return false;
    if (d.kind === "html") return V.mode === "source";
    return d.kind !== "image" && d.kind !== "pdf";
  };
  const isMd = () => !!(V.data && V.data.kind === "markdown");

  function dropImage() {
    if (V.data && V.data.url && !V.data.remote) URL.revokeObjectURL(V.data.url);
  }

  const canSave = () => !!(/** @type {OpenFile} */ (V.file).project && /** @type {OpenFile} */ (V.file).rel);

  async function download() {
    if (V.busy) return;
    const f = /** @type {Required<Pick<ViewerFile, "project" | "rel">> & ViewerFile} */ (V.file);
    V.busy = { kind: "download", shown: true }; V.copied = false; V.saveError = null; redrawKeep();
    try {
      const url = URL.createObjectURL(await api.projectDownload(f.project, f.rel));
      const a = Object.assign(document.createElement("a"), { href: url, download: f.name || "file" });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      if (f === V.file) V.saveError = /** @type {{message?: string}} */ (err).message || "Couldn't download this file.";
    }
    if (f !== V.file) return;
    V.busy = null; redrawKeep();
  }

  const inMore = () => !!(document.activeElement && document.activeElement.closest && document.activeElement.closest(".vw-mw"));
  function redrawKeep() {
    const on = inMore();
    V.keepScroll = true; render();
    if (on) /** @type {HTMLElement | null} */ (el.querySelector("[data-vw-more]"))?.focus({ preventScroll: true });
  }

  const localPath = () => String(/** @type {ViewerFile} */ (V.file).rel || "").replace(/^\.xo\/worktrees\/[^/]+\//, "");
  const runsCode = () => !!(V.file && V.file.project && V.file.rel && (V.data && V.data.place ? V.data.place === "runs_code" : RUNS.test(localPath())));

  const { head, tabsHtml, verBar, paintHead, headFocus, hookOf, shown, menuItems, menuOff } = createViewerHead({
    V, TX, el, doc, canSave, chg, showsDiff, showsText, runsCode, ask, threadTitle,
  });

  /** @param {(ViewerDocument | null)[]} list @param {() => void} then @param {(() => void) | null} cancel */
  function askUnsaved(list, then, cancel = null) {
    const ds = list.filter((D) => D && (D.state === "dirty" || D.state === "error" || D.state === "conflict" || D.state === "deleted"));
    if (!ds.length) { then(); return; }
    if (V.asking && V.asking.cancel) V.asking.cancel();
    V.asking = { docs: /** @type {ViewerDocument[]} */ (ds), then, cancel };
    paintHead();
    /** @type {HTMLElement | null} */ (el.querySelector('[data-vw-unsaved="save"]'))?.focus({ preventScroll: true });
  }
  /** @param {string | undefined} how */
  async function answerUnsaved(how) {
    const A = V.asking;
    V.asking = null;
    if (!A || how === "cancel") { A?.cancel?.(); paintHead(); TX.h?.focus(); return; }
    if (how === "discard") { for (const D of A.docs) docs.discard(D); A.then(); return; }
    await Promise.all(A.docs.map((D) => docs.flush(D)));
    if (A.docs.every((D) => D.state === "saved")) A.then(); else { A.cancel?.(); paintHead(); }
  }

  /** @param {ViewerDocument} d @param {string} what */
  function docChanged(d, what) {
    if (!V.open) return;
    if (what === "saved") { edits && edits.saved && edits.saved({ project: d.project, rel: d.rel }); flashSaved(d); }
    if (d !== doc()) { if (what === "state" || what === "saved") paintHead(); return; }
    if (what === "conflict" && TX.h) { TX.h.showMerge(); announce(`${/** @type {ViewerFile} */ (V.file).name} changed while you were typing. Where you both changed the same lines, keep yours or take theirs.`); }
    if (what === "applied" && d.state === "saved") announce(`${/** @type {ViewerFile} */ (V.file).name} changed: the new version is in.`);
    if (what === "state" && TX.h) TX.h.refresh();
    if (what === "confirm" && d.confirm) { paintHead(); /** @type {HTMLElement | null} */ (el.querySelector("[data-vw-confirm]"))?.focus({ preventScroll: true }); return; }
    if (what === "state" && d.state === "dirty") { const t = V.tabs.find((x) => x.doc === d); if (t && t.preview) t.preview = false; }
    paintHead();
  }
  let flashT = 0;
  /** @param {ViewerDocument} d */
  function flashSaved(d) {
    if (d !== doc()) return;
    V.savedFlash = d; clearTimeout(flashT);
    flashT = setTimeout(() => { if (V.savedFlash === d) { V.savedFlash = null; if (V.open) paintHead(); } }, 1600);
  }

  function body() {
    if (V.why) return `<div class="vw-empty"><p>${esc(V.why)}</p><p class="vw-path"><code>${esc(/** @type {ViewerFile} */ (V.file).path)}</code><button type="button" class="btn vw-path-copy" data-vw-copy-path${V.busy ? ` aria-disabled="true"${V.busy.kind === "copy" ? ' aria-busy="true"' : ""}` : ""}>${ICON.copy}<span>${V.copied ? "Copied" : V.busy && V.busy.kind === "copy" && V.busy.shown ? "Copying…" : "Copy the path"}</span></button></p></div>`;
    if (V.loading) return `<p class="vw-empty"><i class="spin" aria-hidden="true"></i> Reading the file…</p>`;
    if (V.error) return `<div class="vw-empty"><p>${esc(V.error)}</p></div>`;
    const d = /** @type {ViewerData} */ (V.data);
    if (d.kind === "image") {
      const actual = V.imgMode === "actual";
      return `<div class="vw-img${actual ? " is-actual" : ""}"><img src="${esc(d.url)}" alt="${esc(/** @type {ViewerFile} */ (V.file).name || "Image")}" draggable="false" title="${actual ? "Fit to the panel" : "Show at actual size"}"></div>`;
    }
    if (d.kind === "pdf") return `<iframe class="vw-frame vw-pdf" src="${esc(d.url)}" title="${esc(/** @type {ViewerFile} */ (V.file).name || "PDF")}" referrerpolicy="no-referrer"></iframe>`;
    const text = String(d.content ?? "");
    const cut = cutHtml();
    if (d.kind === "html" && V.mode === "preview") return cut + `<iframe class="vw-frame" sandbox="allow-scripts" referrerpolicy="no-referrer" title="${esc(/** @type {ViewerFile} */ (V.file).name || "HTML preview")}" srcdoc="${esc(d.doc ? docs.textOf(d.doc) : text)}"></iframe>`;
    return cut;
  }
  function cutHtml() {
    const d = V.data;
    if (!d || !d.truncated) return "";
    return `<p class="vw-cut">${ICON.clock}<span>Showing the first ${esc(size(bytes(d.content)))} of ${esc(size(d.size_bytes))}. The rest isn't shown.</span>${canSave() ? `<button type="button" class="vw-cut-dl" data-vw-download${V.busy ? ` aria-disabled="true"${V.busy.kind === "download" ? ' aria-busy="true"' : ""}` : ""}>Download the whole file</button>` : ""}</p>`;
  }

  const { DF, diffBody, dropDiff, drawDiff } = createViewerDiff({
    V: /** @type {Parameters<typeof createViewerDiff>[0]["V"]} */ (V), currentChange: () => V.open && showsDiff() ? chg() : null, changes: /** @type {NonNullable<typeof changes>} */ (changes), diff,
    isImageChange, drawImageChange, canSave, inRegion,
  });

  /** @param {HTMLElement} host @param {() => void} change */
  function inRegion(host, change) {
    const a = document.activeElement, inside = !!a && a !== host && host.contains(a);
    const hook = inside ? hookOf(a) : "";
    change();
    if (!inside) return;
    const now = document.activeElement;
    if (now && now !== document.body && host.contains(now) && now.getClientRects().length) return;
    const same = hook && /** @type {HTMLElement | null} */ (host.querySelector(hook));
    (same && same.getClientRects().length && !same.matches('[aria-busy="true"]') ? same : host).focus({ preventScroll: true });
  }

  const { textBody, dropText, drawText, showChangesNow, stepVersion } = createViewerText({
    el, V, TX, docs, doc, isMd, ask, inRegion, announce, threadTitle, paintHead,
  });

  function render() {
    const ae = /** @type {HTMLElement | null} */ (document.activeElement);
    let was = null;
    const fromMenu = !!(ae && ae.closest && ae.closest(".vw-menu"));
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
  const above = () => {
    const cut = /** @type {{text: string, select?: string}} */ (V.saveError && (typeof V.saveError === "string" ? { text: V.saveError } : V.saveError));
    const D = doc(), err = D && (D.state === "error" || D.state === "deleted") && D.err ? D.err : null;
    return (tabs ? tabs() : "") + tabsHtml() + head() + verBar() +
      (V.saveError ? `<p class="vw-cut" role="alert">${ICON.warn}<span>${esc(cut.text)}</span>${cut.select ? `<input class="vw-cut-sel" data-vw-cut-sel readonly value="${esc(cut.select)}" aria-label="The path, to copy" spellcheck="false">` : ""}</p>` : "") +
      (err && !showsDiff() ? `<p class="vw-cut xd-errline" role="alert">${ICON.warn}<span>${esc(err)}</span>${/** @type {ViewerDocument} */ (D).state === "deleted" ? `<button type="button" class="vw-cut-dl" data-vw-saveagain>Save it again</button>` : `<button type="button" class="vw-cut-dl" data-vw-saveagain>Try again</button>`}</p>` : "");
  };
  function renderNow() {
    if (!V.open) return;
    const asking = el.querySelector(":scope > .xd-q");
    if (showsText()) {
      const host = textBody();
      if (DF.handle || DF.key) dropDiff();
      el.innerHTML = above() + cutHtml() + `<i data-vw-file hidden></i>`;
      /** @type {Element} */ (el.querySelector("[data-vw-file]")).replaceWith(host);
      if (asking) /** @type {Element} */ (el.querySelector(":scope > .vw-verbar") || el.querySelector(":scope > .vw-top")).after(asking);
      drawText();
      return;
    }
    if (TX.h || TX.key) dropText();
    if (showsDiff()) {
      const host = diffBody(), top = host.scrollTop;
      el.innerHTML = above() + `<i data-vw-diff hidden></i>`;
      /** @type {Element} */ (el.querySelector("[data-vw-diff]")).replaceWith(host);
      host.scrollTop = top;
      drawDiff(/** @type {NonNullable<ReturnType<typeof chg>>} */ (chg()));
      return;
    }
    if (DF.handle || DF.key) dropDiff();
    const keep = el.querySelector(".vw-body")?.scrollTop || 0;
    const framed = V.data && ((V.data.kind === "html" && V.mode === "preview") || V.data.kind === "pdf");
    el.innerHTML = above() + `<div class="vw-body${framed ? " is-frame" : ""}" tabindex="0">${body()}</div>`;
    if (V.keepScroll) /** @type {HTMLElement} */ (el.querySelector(".vw-body")).scrollTop = keep;
    V.keepScroll = false;
  }

  const { load, notice, fileChanged } = createViewerReads({
    V, docs, doc, changes, dropImage, render, announce, paintHead,
  });

  /** @param {ViewerFile | null} a @param {ViewerFile | null} b */
  const sameFile = (a, b) => !!a && !!b && (a.project && a.rel ? a.project === b.project && a.rel === b.rel : a.att && b.att ? a.att.chat === b.att.chat && a.att.id === b.att.id : a === b);
  /** @param {ViewerTab} t */
  function releaseTab(t) {
    if (t.doc) { docs.release(t.doc); t.doc = null; }
    if (t.data && t.data.url && !t.data.remote) URL.revokeObjectURL(t.data.url);
  }
  /** @param {ViewerTab} t */
  function showTab(t) {
    dropText();
    V.gen++;
    V.tab = t; V.file = t.file;
    Object.assign(V, { data: t.data || null, dims: null, error: null, why: t.file.why || null, imgMode: "preview", copied: false, busy: null, saveError: null, menu: false, showChanges: false });
    V.show = t.file.show === "changes" ? "changes" : "file";
    dropDiff(); if (DF.el) DF.el.scrollTop = 0;
    if (V.why) render(); else if (showsDiff()) { V.loading = false; render(); } else if (t.data) { V.loading = false; render(); } else load();
  }

  /** @param {ViewerFile} f @param {Element | null} [from] */
  function open(f, from) {
    const was = V.open;
    if (V.parked) { V.parked = false; el.hidden = false; }
    const file = { ...f, where: f.rel || f.path || "", image: f.att ? kindOf(f.type || "") === "image" : f.local == null && isImagePath(f.rel || f.path || f.name) };
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
    opened && opened(/** @type {ViewerFile} */ (V.file), { focus: !!from || !!f.created || !!f.lines });
    onChange && onChange();
  }
  /** @param {number} i */
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
    if (ask) { const ds = V.tabs.map((t) => t.doc).filter(Boolean); askUnsaved(ds, () => close({ restore })); if (V.asking) return; }
    for (const D of docs.unsaved()) docs.keepDraft(D);
    V.open = false; V.parked = false; V.gen++;
    const a = document.activeElement, lost = !a || a === document.body || el.contains(a);
    dropText(); dropDiff();
    for (const t of V.tabs) releaseTab(t);
    V.tabs = []; V.tab = null; V.data = null;
    el.hidden = true; el.innerHTML = "";
    document.body.classList.remove("viewer-open");
    const back = V.returnTo;
    V.returnTo = null;
    if (restore) {
      const to = [back, likeOf(back)].find(usable) || (lost && home ? home() : null);
      /** @type {HTMLElement | null} */ (to)?.focus({ preventScroll: true });
    }
    closed && closed();
    onChange && onChange();
  }
  /** @param {Element | null} b */
  function likeOf(b) {
    if (!b || !b.getAttribute || b.isConnected) return null;
    for (const at of ["data-file", "data-cx", "data-node", "data-made-file", "data-k"]) {
      const v = b.getAttribute(at);
      if (v != null) return [...document.querySelectorAll(`${b.tagName}[${at}="${CSS.escape(v)}"]`)].find(usable) || null;
    }
    return b.id ? document.getElementById(b.id) : null;
  }

  /** @param {string} text */
  async function copy(text, what = "contents") {
    if (V.busy) return;

    /** @type {BusyState} */
    const busy = V.busy = { kind: "copy", shown: false }, file = V.file;
    V.copied = false; // a new copy clears the previous success state
    const slow = setTimeout(() => { if (V.busy === busy) { busy.shown = true; redrawKeep(); } }, COPY_SAYS_MS);
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      const ta = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
      ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
      const back = /** @type {HTMLElement | null} */ (document.activeElement);
      el.appendChild(ta); ta.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove(); back && back.focus && back.focus({ preventScroll: true });
    }
    clearTimeout(slow);
    if (V.busy !== busy || V.file !== file) return;
    V.busy = null;
    if (!ok) {
      V.saveError = what === "path"
        ? { text: "Couldn't copy the path: the browser didn't allow it here. Here it is to copy:", select: text }
        : "Couldn't copy: the browser didn't allow it here. Select the text and copy it, or download the file.";
      redrawKeep(); announce(what === "path" ? "Couldn't copy the path." : "Couldn't copy."); return;
    }
    V.copied = busy; V.saveError = null;
    redrawKeep();
    announce("Copied.");
    setTimeout(() => { if (V.copied === busy) { V.copied = false; redrawKeep(); } }, 1400);
  }

  bindViewerEvents({
    el, V, TX, DF, docs, doc, ask, away, chg, close, closeTab, copy, diffBody, drawDiff, drawText, download,
    dropImage, headFocus, isMd, load, localPath, menuItems, menuOff, onChange, paintHead, render, showChangesNow,
    showTab, shown, showsDiff, stepVersion, announce, answerUnsaved, jump,
  });

  function park() {
    if (!V.open || V.parked) return;
    V.keep = /** @type {HTMLElement | null} */ (el.querySelector(".vw-body"))?.scrollTop || 0;
    V.parked = true; el.hidden = true;
    document.body.classList.remove("viewer-open");
    onChange && onChange();
  }
  function unpark() {
    if (!V.open || !V.parked) return;
    V.parked = false; el.hidden = false;
    document.body.classList.add("viewer-open");
    render();
    const b = /** @type {HTMLElement | null} */ (el.querySelector(".vw-body"));
    if (b && !TX.h) b.scrollTop = V.keep || 0;
    el.focus({ preventScroll: true });
    onChange && onChange();
  }
  function refresh() { if (V.open && !V.parked) { V.keepScroll = true; render(); } }

  return {
    open, close, park, unpark, refresh, notice, fileChanged,
    get isOpen() { return V.open && !V.parked; }, get hasFile() { return V.open; }, get isParked() { return V.open && V.parked; }, get file() { return V.file; }, get opener() { return V.open ? V.returnTo : null; },
    get editing() { return docs.all().some((D) => D.state === "conflict"); },
    /** @param {number} line @param {number | null} col */
    goto(line, col = null) { if (TX.h) { TX.h.focus({ line }); void col; } else if (V.file) V.file.lines = [line, line]; },
    get openFiles() { return V.tabs.map((t) => t.file); },
    /** @returns {Promise<boolean>} */
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
    escape() {
      const D = doc();
      if (V.asking) { answerUnsaved("cancel"); return true; }
      if (D && D.confirm) { docs.confirmRunsCode(D, false); paintHead(); TX.h?.focus(); return true; }
      if (D && D.viewing && TX.h) { docs.view(D, null); TX.h.showVersion(null); paintHead(); TX.h.focus(); return true; }
      return false;
    },
    /** @param {() => void} go */
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
