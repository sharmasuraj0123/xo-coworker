import * as K from "../../core/platform/keys.js";
import { pointerFollows } from "../../core/ui/a11y/keynav.js";

export function bindViewerEvents({
  el, V, TX, DF, docs, doc, ask, away, chg, close, closeTab, copy, diffBody, drawDiff, drawText, download,
  dropImage, headFocus, isMd, load, localPath, menuItems, menuOff, onChange, paintHead, render, showChangesNow,
  showTab, shown, showsDiff, stepVersion, announce, answerUnsaved, jump,
}) {
  el.addEventListener("click", (e) => {
    const fromMenu = V.menu && !!e.target.closest(".vw-menu") && !e.target.closest(".vw-menu a");
    act(e);
    if (!fromMenu || !V.open) return;
    if (el.querySelector(".vw-menu") && !V.menu) paintHead();
    const a = document.activeElement;
    if (!a || a === document.body || (el.contains(a) && !a.getClientRects().length)) (shown(el, "[data-vw-more]") || headFocus(false)).focus({ preventScroll: true });
  });
  el.addEventListener("dblclick", (e) => {
    const tb = e.target.closest("[data-vw-tab]");
    if (tb) { const t = V.tabs[+tb.dataset.vwTab]; if (t && t.preview) { t.preview = false; paintHead(); } }
  });
  function act(e) {
    if (e.target.closest("[data-vw-more]")) {
      if (V.busy) return;
      V.menu = !V.menu; paintHead();
      (V.menu ? menuItems()[0] : el.querySelector("[data-vw-more]"))?.focus({ preventScroll: true });
      return;
    }
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
    if (e.target.closest('[data-vw-retry][aria-busy="true"]')) return;
    if (e.target.closest("[data-vw-retry]")) { TX.key = null; drawText(); return; }
    if (e.target.closest("[data-vw-diff-retry]")) { const c = chg(); if (!c) return; diffBody().focus({ preventScroll: true }); drawDiff(c, { again: true }); return; }
    if (e.target.closest("[data-vw-split]")) { V.split = !V.split; if (DF.handle) DF.handle.split(V.split); render(); return; }
    const m = e.target.closest("[data-vw-mode]");
    if (m) {
      const mode = m.dataset.vwMode;
      if (V.file.image || (V.data && V.data.kind === "image")) { V.imgMode = mode; render(); return; }
      if (mode === "page" || (mode === "source" && isMd())) { V.textMode = mode; if (TX.h) { TX.h.setPage(mode === "page"); TX.key = `${doc().key}|${mode === "page" ? "page" : "src"}`; TX.el?.classList.toggle("is-page", mode === "page"); paintHead(); } else render(); return; }
      V.mode = mode; render(); return;
    }
    if (e.target.closest(".vw-img img")) { V.imgMode = V.imgMode === "actual" ? "preview" : "actual"; render(); return; }
    if (e.target.closest("[data-vw-copy]")) { const D = doc(); copy(D ? docs.textOf(D) : String(V.data.content)); return; }
    if (e.target.closest("[data-vw-copy-path]")) { copy(V.file.rel ? localPath() : V.file.path, "path"); return; }
    if (e.target.closest("[data-vw-askfile]")) { ask.file(V.file); return; }
    if (e.target.closest("[data-vw-download]")) download();
  }
  el.addEventListener("load", (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !V.data || V.data.kind !== "image" || V.dims) return;
    V.dims = { w: img.naturalWidth, h: img.naturalHeight };
    paintHead();
  }, true);
  el.addEventListener("error", (e) => {
    if (!(e.target instanceof HTMLImageElement) || !V.data || V.data.kind !== "image") return;
    V.error = "This image couldn't be shown: the file may be damaged or in a format this browser can't read.";
    dropImage(); V.data = null;
    render();
  }, true);
  addEventListener("pagehide", () => { for (const D of docs.unsaved()) docs.keepDraft(D); });
  addEventListener("beforeunload", (e) => { const lost = docs.unsaved().filter((D) => D.state === "conflict" || !docs.keepDraft(D)); if (lost.length) { e.preventDefault(); e.returnValue = ""; } });
  document.addEventListener("pointerdown", (e) => { if (V.menu && !(e.target.closest && e.target.closest(".vw-mw"))) menuOff(); }, true);
  document.addEventListener("visibilitychange", () => { if (document.hidden) for (const D of docs.unsaved()) docs.keepDraft(D); });
  pointerFollows(el);
  el.addEventListener("focusin", (e) => { if (e.target.matches?.(".vw-cut-sel")) e.target.select(); });
  el.addEventListener("click", (e) => { const s = e.target.closest?.(".vw-cut-sel"); if (s && s.selectionStart === s.selectionEnd) s.select(); });
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
    if (mod && !e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); const D = doc(); if (D) { if (D.confirm) docs.confirmRunsCode(D, true); else docs.flush(D); } return; }
    if (e.key === "Escape") {
      if (e.defaultPrevented) { e.stopPropagation(); return; }
      e.preventDefault(); e.stopPropagation();
      const D = doc();
      if (D && D.confirm) { docs.confirmRunsCode(D, false); paintHead(); TX.h?.focus(); return; }
      if (D && D.viewing && TX.h) { docs.view(D, null); TX.h.showVersion(null); paintHead(); TX.h.focus(); return; }
      if (TX.sel && TX.h && TX.el && TX.el.contains(e.target)) { TX.h.clearSelection(); return; }
      if (V.asking) { answerUnsaved("cancel"); return; }
      if (away && away()) return;
      close({ ask: true }); return;
    }
    if (!showsDiff() || !DF.el || e.target.closest("input, textarea, [contenteditable]")) return;
    const dir = K.is(e, "nextChange") ? 1 : K.is(e, "prevChange") ? -1 : 0;
    if (dir) { e.preventDefault(); jump(DF.el, dir); }
  });

}
