// @ts-check

import { esc } from "../../core/platform/index.js";
import { api } from "../../core/platform/api.js";

/** @import { ChangeFile, ChangesApi, DiffHandle, DiffOptions, HttpError, Scope } from "../../core/services/change-types.d.ts" */

/** @typedef {{scope: Scope, path: string, base: string, file: ChangeFile}} FileChange */

/** @typedef {{el: HTMLElement | null, handle: DiffHandle | null, img: {drop(): void} | null, key: string | null, gen: number, ask: number, reading: string | null, failed: string | null, pend?: string | null}} DiffState */

/** @typedef {{V: {file: {project: string, rel: string} | null, split: boolean}, currentChange: () => FileChange | null, changes: {patchAt: (change: FileChange) => Promise<string | null>, read: ChangesApi}, diff: (host: HTMLElement, patch: string, options: DiffOptions) => Promise<DiffHandle>, isImageChange: (file: ChangeFile) => boolean, drawImageChange: (host: HTMLElement, options: {project: string, rel: string, file: ChangeFile, read: ChangesApi, at: string | null}) => {drop(): void}, canSave: () => boolean, inRegion: (host: HTMLElement, change: () => void) => void }} DiffDependencies */

/** @param {DiffDependencies} deps */
export function createViewerDiff({ V, currentChange, changes, diff, isImageChange, drawImageChange, canSave, inRegion }) {
  /** @type {DiffState} */
  const DF = { el: null, handle: null, img: null, key: null, gen: 0, ask: 0, reading: null, failed: null };

  /** The diff body: one element, kept (with Pierre's drawing in it) while the head around it redraws. */
  function diffBody() {
    if (!DF.el) { DF.el = document.createElement("div"); DF.el.className = "vw-body vw-diff"; DF.el.tabIndex = 0; }
    return DF.el;
  }
  function dropDiff() { DF.gen++; if (DF.handle) { DF.handle.destroy(); DF.handle = null; } if (DF.img) { DF.img.drop(); DF.img = null; } DF.key = null; DF.pend = null; DF.reading = null; }
  /** Both whole versions, for "N unmodified lines" (read only when you unfold them). */
  async function bothSides(/** @type {FileChange} */ c, /** @type {{name: string, prevName?: string}} */ fd) {
    const f = /** @type {NonNullable<DiffDependencies["V"]["file"]>} */ (V.file), oldRel = (c.scope.base ? `${c.scope.base}/` : "") + (c.file.old_path || c.path);
    const [o, n] = await Promise.all([
      c.file.status === "added" ? null : api.projectFile(f.project, oldRel, { commit: c.base, path: c.file.old_path || c.path }),
      c.file.status === "deleted" ? null : api.projectFile(f.project, f.rel),
    ]);
    if ((o && o.truncated) || (n && n.truncated)) throw new Error("too large to unfold");
    return { oldFile: o ? { name: fd.prevName || fd.name, contents: o.content } : null, newFile: n ? { name: fd.name, contents: n.content } : null };
  }
  async function drawDiff(/** @type {FileChange} */ c, { again = false } = {}) {
    const host = diffBody(), at = `${c.scope.key}|${c.path}|`, ask = ++DF.ask;
    const ours = (/** @type {string | null | undefined} */ k) => !!k && k.startsWith(at);
    if (!again && DF.key === `${at}none:error:${c.file.version || ""}`) return; // (a newer version is read afresh)
    if ((again || (!ours(DF.key) && !ours(DF.pend))) && DF.reading !== at) {
      if (DF.handle) { DF.handle.destroy(); DF.handle = null; }
      if (DF.img) { DF.img.drop(); DF.img = null; }
      DF.key = null; DF.pend = null;
      const redo = DF.failed === at && host.querySelector(":scope > .vw-empty [data-vw-diff-redraw]");
      DF.failed = null;
      if (redo) {
        const box = /** @type {Element} */ (redo.closest(".vw-empty")), words = box.querySelector("p");
        box.setAttribute("role", "status");
        if (words) words.textContent = "Drawing this diff…";
        redo.setAttribute("aria-busy", "true"); redo.setAttribute("aria-disabled", "true"); redo.textContent = "Trying again…";
      } else inRegion(host, () => { host.innerHTML = `<p class="vw-empty" role="status"><i class="spin" aria-hidden="true"></i> Reading the change…</p>`; });
      DF.reading = at;
    }
    /** @type {HttpError | null} */
    let readErr = null;
    const patch = await changes.patchAt(c).catch((err) => { readErr = err; return null; });
    const now = currentChange();
    if (ask !== DF.ask || !now || `${now.scope.key}|${now.path}|` !== at) return;
    const key = `${at}${patch ? patch.length + ":" + patch.slice(-64) : `none:${readErr ? `error:${c.file.version || ""}` : c.file.version || ""}`}`;
    if (DF.key === key || DF.pend === key) return; // drawn (a drawing, or its words), or on its way
    DF.pend = key; DF.reading = null;
    const my = ++DF.gen;
    if (!patch) {
      dropDiff();
      if (isImageChange(c.file) && /** @type {NonNullable<DiffDependencies["V"]["file"]>} */ (V.file).project && /** @type {NonNullable<DiffDependencies["V"]["file"]>} */ (V.file).rel) {
        DF.img = drawImageChange(host, { project: /** @type {NonNullable<DiffDependencies["V"]["file"]>} */ (V.file).project, rel: /** @type {NonNullable<DiffDependencies["V"]["file"]>} */ (V.file).rel, file: c.file, read: changes.read, at: c.base || null });
        DF.key = key;
        return;
      }
      if (readErr) {
        inRegion(host, () => { host.innerHTML = `<div class="vw-empty" role="alert"><p>Couldn't read this change${/** @type {HttpError} */ (readErr).message ? `: ${esc(/** @type {HttpError} */ (readErr).message)}` : ""}.</p><p><button type="button" class="vw-cut-dl" data-vw-diff-retry>Try again</button></p></div>`; });
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
        if (!host.querySelector(':scope > .vw-empty [data-vw-diff-redraw][aria-busy="true"]')) inRegion(host, () => host.replaceChildren());
        const h = await diff(host, patch, { path: c.path, wrap: true, split: V.split, loadFiles: (fd) => bothSides(c, fd) });
        if (my !== DF.gen) { h.destroy(); return; }
        DF.handle = h;
        inRegion(host, () => { for (const x of host.querySelectorAll(":scope > .vw-empty")) x.remove(); });
      }
      DF.key = key;
    } catch {
      if (my !== DF.gen) return;
      dropDiff(); // (clears pend: Try again draws afresh)
      DF.failed = at;
      inRegion(host, () => { host.innerHTML = `<div class="vw-empty"><p>Couldn't draw this diff.</p><p><button type="button" class="vw-cut-dl" data-vw-diff-redraw data-vw-show="changes">Try again</button></p></div>`; });
    }
  }

  return { DF, diffBody, dropDiff, drawDiff };
}
