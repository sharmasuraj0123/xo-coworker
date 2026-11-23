// @ts-check

import { esc } from "../../core/platform/index.js";
import { api } from "../../core/platform/api.js";
import { fileIcon } from "../../core/ui/icons/fileicons.js";
import { apiRel, dkey } from "./folder-reads.js";
import { newFileSay, parentOf, RUNS_SAY } from "./scope.js";

/** @import { FilesScope } from "./scope.js" */

/** @import { FolderRead } from "./folder-reads.js" */

/** @import { ProjectScope } from "./tree-types.d.ts" */

/** @import { FileError, NameFeedback, NameMode, OperationDependencies } from "./operation-types.d.ts" */

/** @param {OperationDependencies} deps */
export function createFileOperations({ F, NW, dirs, load, paths, changes, viewer, setOf, paint, groups, rowOf, base, canMake, folderIcon }) {
  /** @param {string} dir @param {NameMode} mode @param {string | null} from */
  function startNew(dir, mode = "file", from = null) {
    const s = /** @type {ProjectScope} */ (F.scope);
    if (!canMake(s, dir)) return;
    endNew();
    if (dir) { setOf(s.key).add(dir); load(s, dir); }
    const depth = dir ? dir.split("/").length : 0;
    const el = document.createElement("div");
    el.className = "fl-new"; el.setAttribute("data-own", ""); // the tree's own: a redraw of its folder leaves it first
    const what = mode === "rename" ? `New name or path for ${esc(base(from))}` : mode === "folder" ? `Name of the new folder in ${esc(dir ? base(dir) : s.label || "this folder")}` : `Name of the new file in ${esc(dir ? base(dir) : s.label || "this folder")}`;
    el.innerHTML = `<div class="fl-new-r" style="--d:${depth}"><span class="fl-c fl-i">${mode === "folder" ? folderIcon : fileIcon(mode === "rename" ? base(from) : "")}</span><input data-fl-name aria-label="${what}" placeholder="${mode === "folder" ? "Folder name" : mode === "rename" ? "New name, or a path to move it" : "Name, e.g. notes.md"}" autocomplete="off" spellcheck="false" maxlength="1024"></div>` +
      `<p class="fl-new-say" style="--d:${depth}" role="status" hidden></p>`;
    Object.assign(NW, { key: s.key, dir, el, busy: false, confirm: false, mode, from });
    F.q = ""; // a search could hide the folder it goes in
    paint();
    const inp = /** @type {HTMLInputElement} */ (el.querySelector("input"));
    if (mode === "rename") inp.value = base(from);
    inp.focus({ preventScroll: true });
    if (mode === "rename") { const dot = inp.value.lastIndexOf("."); inp.setSelectionRange(0, dot > 0 ? dot : inp.value.length); }
    el.scrollIntoView({ block: "nearest" });
  }
  function endNew({ focus = false } = {}) {
    if (!NW.el) return;
    const dir = NW.dir;
    NW.el.remove();
    Object.assign(NW, { key: null, dir: null, el: null, busy: false, confirm: false, mode: "file", from: null });
    if (focus) (dir ? rowOf(dir) : /** @type {HTMLElement | null} */ (F.host.querySelector("[data-fl-new]")))?.focus({ preventScroll: true });
  }
  function placeNew() {
    if (!NW.el) return;
    const g = NW.key === F.scope.key ? groups().get(/** @type {string} */ (NW.dir)) : null;
    if (!g || !g.el.isConnected) { endNew(); return; }
    if (g.el.firstElementChild !== NW.el) g.el.prepend(NW.el);
  }
  /** @param {FilesScope} s @param {string} dir @param {string} n @returns {NameFeedback | null} */
  function nameSay(s, dir, n) {
    const d = dirs.get(dkey(s, dir));
    return newFileSay(n, dir, d && d.state === "ok" ? /** @type {Required<Pick<FolderRead, "files" | "dirs">>} */ (d) : null, NW.confirm);
  }
  /** @param {NameFeedback | null} say */
  function sayNew(say) {
    const el = /** @type {HTMLElement} */ (NW.el);
    const p = /** @type {HTMLElement} */ (el.querySelector(".fl-new-say")), inp = /** @type {HTMLInputElement} */ (el.querySelector("input"));
    p.hidden = !say;
    p.className = `fl-new-say${say && say.err ? " is-err" : ""}`;
    p.textContent = say ? say.words : "";
    p.title = say ? say.why || say.words : "";
    inp.setAttribute("aria-invalid", String(!!(say && say.err)));
  }
  /** @param {FileError} err @param {string} n */
  const makeWords = (err, n) => {
    const c = err.code, st = err.status;
    if (st === 409 && c === "file_exists") return `${n} is already here`;
    if (st === 404 && c === "folder_not_found") return "This folder isn't there any more";
    if (st === 403 && c === "read_only_place") return "XO keeps this folder";
    if (st === 403 && c === "outside_project") return "A link leads out of the project";
    if (st === 403) return "Making files isn't allowed here";
    if (st === 503 && c === "writer_key_missing") return "XO Space hasn't enabled saving yet";
    if (st === 400) return "A file can't be called that";
    return err.message || "Couldn't make the file";
  };
  async function makeNew() {
    if (!NW.el || NW.busy) return;
    if (NW.mode !== "file") return makeOther();
    const s = /** @type {ProjectScope} */ (F.scope), dir = /** @type {string} */ (NW.dir), inp = /** @type {HTMLInputElement} */ (/** @type {HTMLElement} */ (NW.el).querySelector("input")), n = inp.value.trim();
    const say = n ? nameSay(s, dir, n) : { err: true, words: "Give it a name" };
    if (say && say.err) { sayNew(say); return; }
    const local = dir ? `${dir}/${n}` : n, rel = apiRel(s, local);
    NW.busy = true; inp.readOnly = true; sayNew({ words: "Making it…" });
    const mine = NW.el;
    try {
      const r = await api.saveProjectFile(s.project, rel, "", null, say && say.runs ? "runs_code" : null);
      if (F.scope.key !== s.key) return;
      if (NW.el !== mine) { if (changes && changes.saved) changes.saved(s.project, rel); await load(s, dir, { again: true }); paint(); return; }
      endNew({ focus: true });
      if (changes && changes.saved) changes.saved(s.project, rel);
      await load(s, dir, { again: true });
      if (F.scope.key !== s.key) return;
      if (NW.el) { paint(); return; }
      F.sel = local; F.fileView = true; F.auto = false;
      paint();
      viewer.open({ path: local, name: n, bytes: 0, project: s.project, rel, created: r.edit_id || true }, F.host.querySelector(`.fl-g [data-fl-file="${CSS.escape(local)}"]`));
    } catch (cause) {
      const err = /** @type {FileError} */ (cause);
      if (!NW.el || NW.el !== mine || F.scope.key !== s.key) return;
      NW.busy = false; inp.readOnly = false;
      if (err.status === 428) { NW.confirm = true; sayNew(RUNS_SAY); }
      else { sayNew({ err: true, words: makeWords(err, n) }); if (err.status === 409) load(s, dir, { again: true }); }
      inp.focus({ preventScroll: true });
    }
  }

  async function makeOther() {
    const s = /** @type {ProjectScope} */ (F.scope), dir = /** @type {string} */ (NW.dir), inp = /** @type {HTMLInputElement} */ (/** @type {HTMLElement} */ (NW.el).querySelector("input")), n = inp.value.trim().replace(/^\/+|\/+$/g, "");
    if (!n || n.split("/").some((x) => !x || x === "." || x === "..")) { sayNew({ err: true, words: n ? "A name can't be that" : "Give it a name" }); return; }
    const local = NW.mode === "rename" && n.includes("/") ? n : dir ? `${dir}/${n}` : n;
    if (NW.mode === "rename" && local === NW.from) { endNew({ focus: true }); return; }
    const mine = NW.el, mode = NW.mode, from = /** @type {string} */ (NW.from);
    NW.busy = true; inp.readOnly = true; sayNew({ words: mode === "folder" ? "Making it…" : "Moving it…" });
    try {
      if (mode === "folder") await api.mkdirProject(s.project, apiRel(s, local));
      else await api.renameProjectFile(s.project, apiRel(s, from), apiRel(s, local), NW.confirm ? "runs_code" : null);
      if (NW.el !== mine) return;
      endNew();
      if (changes && changes.saved) changes.saved(s.project, apiRel(s, local));
      if (mode === "rename") { const was = parentOf(from); if (was !== dir) await load(s, was, { again: true }); /** @type {NonNullable<OperationDependencies["paths"]>} */ (paths).changed({ project: s.project, base: s.base || "" }, { kind: "rename", path: local, old_path: from }); }
      for (let p = parentOf(local); ; p = parentOf(p)) { if (p) setOf(s.key).add(p); if (!p) break; }
      await load(s, parentOf(local), { again: true });
      await load(s, dir, { again: true });
      paint();
      /** @type {unknown} */ (rowOf(local)?.focus({ preventScroll: true })) || /** @type {HTMLElement | null} */ (F.host.querySelector(`.fl-g [data-fl-file="${CSS.escape(local)}"]`))?.focus({ preventScroll: true });
    } catch (cause) {
      const err = /** @type {FileError} */ (cause);
      if (NW.el !== mine) return;
      NW.busy = false; inp.readOnly = false;
      if (err.status === 428) { NW.confirm = true; sayNew(RUNS_SAY); }
      else sayNew({ err: true, words: err.status === 409 ? `${base(local)} is already there` : err.status === 404 ? "It isn't there any more" : makeWords(err, n) });
      inp.focus({ preventScroll: true });
    }
  }
  /** @param {string} from @param {string} local */
  async function moveTo(from, local) {
    const s = /** @type {ProjectScope} */ (F.scope);
    try {
      await api.renameProjectFile(s.project, apiRel(s, from), apiRel(s, local));
      /** @type {NonNullable<OperationDependencies["paths"]>} */ (paths).changed({ project: s.project, base: s.base || "" }, { kind: "rename", path: local, old_path: from });
      if (parentOf(local)) setOf(s.key).add(parentOf(local));
      await load(s, parentOf(from), { again: true });
      await load(s, parentOf(local), { again: true });
      F.undo = null;
      paint();
    } catch (cause) {
      const err = /** @type {FileError} */ (cause);
      F.undo = { err: err.status === 409 ? `${base(local)} is already there` : err.status === 428 ? "Git or an agent runs what's there: move it from a shell, or ask the agent" : err.status === 403 ? "XO keeps that folder: nothing moves into it" : err.message || "Couldn't move it", name: base(from) };
      paint();
    }
  }
  /** @param {string} local @param {string} kind */
  async function remove(local, kind) {
    const s = /** @type {ProjectScope} */ (F.scope);
    try {
      const r = await api.deleteProjectFile(s.project, apiRel(s, local));
      F.undo = { editId: r.edit_id, name: base(local), local, s };
      if (kind === "dir") setOf(s.key).delete(local);
      /** @type {NonNullable<OperationDependencies["paths"]>} */ (paths).changed({ project: s.project, base: s.base || "" }, { kind: "delete", path: local });
      await load(s, parentOf(local), { again: true });
      paint();
      /** @type {HTMLElement | null} */ (F.host.querySelector("[data-fl-undo]"))?.focus({ preventScroll: true });
    } catch (cause) {
      const err = /** @type {FileError} */ (cause);
      F.undo = { err: err.status === 428 ? "Git or an agent runs what's in it: delete it from a shell, or ask the agent" : err.status === 403 ? "XO keeps this: it can't be deleted here" : err.message || "Couldn't delete it", name: base(local) };
      paint();
    }
  }
  async function undoRemove() {
    const u = F.undo;
    if (!u || !u.editId) { F.undo = null; paint(); return; }
    F.undo = null;
    try { await api.undoProjectEdit(/** @type {ProjectScope} */ (u.s).project, u.editId); } catch (cause) { const err = /** @type {FileError} */ (cause); F.undo = { err: err.status === 409 ? `Something called ${u.name} is there now` : err.message || "Couldn't bring it back", name: u.name }; }
    /** @type {NonNullable<OperationDependencies["paths"]>} */ (paths).changed({ project: /** @type {ProjectScope} */ (u.s).project, base: /** @type {ProjectScope} */ (u.s).base || "" }, { kind: "create", path: /** @type {string} */ (u.local) });
    await load(/** @type {FilesScope} */ (u.s), parentOf(/** @type {string} */ (u.local)), { again: true });
    paint();
  }

  return { startNew, endNew, placeNew, nameSay, sayNew, makeNew, moveTo, remove, undoRemove };
}
