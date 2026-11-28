// @ts-check

import { esc } from "../../core/platform/index.js";
import { api } from "../../core/platform/api.js";
import { ICON } from "../../core/ui/icons/names.js";
import { fileIcon } from "../../core/ui/icons/fileicons.js";
import { byWords } from "./documents.js";
import { mount as mountEditor } from "./editor.js";

/** @import { ViewerFile, ViewerTextDependencies } from "./viewer-types.d.ts" */

/** @param {ViewerTextDependencies} deps */
export function createViewerText({ el, V, TX, docs, doc, isMd, ask, inRegion, announce, threadTitle, paintHead }) {
  function textBody() {
    if (!TX.el) { TX.el = document.createElement("div"); TX.el.className = "vw-body vw-file vw-doc"; TX.el.tabIndex = -1; }
    return TX.el;
  }
  function dropText() {
    TX.gen++;
    if (TX.h) { TX.h.destroy(); TX.h = null; }
    TX.key = null; TX.sel = null; closeAsk(true);
    if (TX.el) TX.el.replaceChildren();
  }
  async function drawText() {
    const D = doc();
    if (!D) return;
    const page = isMd() && V.textMode !== "source";
    const key = `${D.key}|${page ? "page" : "src"}`;
    if (TX.key === key && TX.h) return;
    if (TX.h && TX.key && TX.key.split("|").slice(0, -1).join("|") === D.key) { TX.h.setPage(page); TX.key = key; return; }
    const again = TX.el && TX.el.querySelector(":scope > .vw-empty [data-vw-retry]");
    if (!again) dropText();
    else { TX.gen++; if (TX.h) { TX.h.destroy(); TX.h = null; } }
    TX.key = key;
    const my = TX.gen, host = textBody(), f = /** @type {ViewerFile} */ (V.file);
    if (again) {
      const box = /** @type {HTMLElement} */ (again.closest(".vw-empty")), words = box.querySelector("p");
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
      inRegion(host, () => { for (const x of host.querySelectorAll(":scope > .vw-empty")) x.remove(); });
      if (D.state === "conflict") h.showMerge();
      if (D.viewing) h.showVersion(/** @type {string | null} */ (D.viewing.text));
      else if (V.showChanges) showChangesNow();
      if (f.lines) { const [a, b] = f.lines; h.select(a, b); }
      if (el.contains(document.activeElement) || document.activeElement === document.body || V.focusText) { V.focusText = false; h.focus(); }
    } catch (err) {
      if (my !== TX.gen) return;
      TX.key = null;
      console.error(err);
      inRegion(host, () => { host.innerHTML = `<div class="vw-empty"><p>Couldn't show this file.</p><p><button type="button" class="vw-cut-dl" data-vw-retry>Try again</button></p></div>`; });
    }
  }
  function showChangesNow() {
    const D = doc();
    if (!TX.h || !D) return;
    const n = D.versions.length, prev = n > 1 ? D.versions[n - 2] : null;
    TX.h.showChanges(V.showChanges && prev && prev.text != null ? prev.text : null);
  }
  /** @param {number} dir */
  async function stepVersion(dir) {
    const D = doc();
    if (!D || !TX.h) return;
    const n = D.versions.length, at = D.viewing ? D.versions.indexOf(D.viewing) : n - 1;
    let to = Math.min(n - 1, Math.max(0, at + dir));
    if (to === at || to < 0 || to > n - 1) return;
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

  /** @param {{a: number, b: number} | null} l */
  function openAsk(l) {
    const f = /** @type {ViewerFile} */ (V.file);
    if (!l || !ask) return;
    const to = ask.target(f);
    if (!to) return;
    if (ask.compose && ask.compose(f, l.a, l.b)) return;
    TX.asking = { a: l.a, b: l.b };
    let q = /** @type {HTMLFormElement | null} */ (el.querySelector(":scope > .xd-q"));
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
      /** @type {Element} */ (el.querySelector(":scope > .vw-verbar") || el.querySelector(":scope > .vw-top")).after(q);
    }
    const ref = /** @type {HTMLElement} */ (q.querySelector(".xd-ref"));
    ref.innerHTML = `${fileIcon(/** @type {string} */ (f.name || f.path))}<span>${esc(f.name || f.path)} · ${l.a === l.b ? `line ${l.a}` : `lines ${l.a}–${l.b}`}</span>`;
    const toLabel = /** @type {HTMLElement} */ (q.querySelector(".xd-to"));
    toLabel.innerHTML = `To <b>${esc(to)}</b>`;
    /** @type {HTMLTextAreaElement} */ (q.querySelector(".xd-in")).focus({ preventScroll: true });
  }
  function closeAsk(quiet = false) {
    const q = el.querySelector(":scope > .xd-q");
    const had = !!TX.asking;
    TX.asking = false;
    if (q) q.remove();
    if (had && !quiet && TX.h) TX.h.focus();
  }
  function sendAsk() {
    const q = el.querySelector(":scope > .xd-q"), t = q && /** @type {HTMLTextAreaElement} */ (q.querySelector(".xd-in")).value.trim();
    if (!t || !TX.asking) return;
    if (/** @type {NonNullable<typeof ask>} */ (ask).send(/** @type {ViewerFile} */ (V.file), TX.asking.a, TX.asking.b, t)) { closeAsk(); if (TX.h) TX.h.clearSelection(); }
  }


  return { textBody, dropText, drawText, showChangesNow, stepVersion };
}
