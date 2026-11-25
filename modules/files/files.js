// @ts-check
import { redraw } from "../../core/ui/redraw.js";
import { createScope } from "../../core/kernel/scope.js";
import { esc, copyText, COPY_REFUSED, space } from "../../core/platform/index.js";
import { ICON } from "../../core/ui/icons/names.js";
import { scopeOf, fileScope, localIn } from "../../core/services/file-scope.js";
import { parentOf } from "./scope.js";
import { touched } from "./marks.js";
import { createFilesTree } from "./tree.js";
import { apiRel, createFolderReads } from "./folder-reads.js";
import { createFileOperations } from "./operations.js";
import { wireFileDrag } from "./drag.js";
import { createFilesMenu } from "./menu-elements.js";
import { createSectionFolds } from "./section-folds.js";
import { fileIcon } from "../../core/ui/icons/fileicons.js";
import { pointerFollows } from "../../core/ui/a11y/keynav.js";

/** @import { FileLocation, FileScope as FilesScope } from "../../core/services/file-scope-types" */

/** @import { FilesDependencies, FilesState, MenuState } from "./files-types.d.ts" */

/** @import { OperationDependencies } from "./operation-types.d.ts" */

const WIDE = 600;
export const FILES_ICON = ICON.folder;
const CHANGED_IC = ICON.changes;
/** @param {string | null | undefined} p */
const base = (p) => /** @type {string} */ (String(p || "").split("/").pop());
/** @param {FilesDependencies} deps */
export function createFiles({ world, viewer, isBusy, PROJ, go, changes = null, onFold = null, paths = null }) {
  /** @type {FilesState} */
  const F = {
    host: null, view: "home", scope: { key: "all" }, pick: null, shown: false,
    open: new Map(),
    sel: null,
    fileView: false,
    auto: false,
    follow: null,
    viewKey: "all",
    q: "", wide: false,
    folded: false,
  };
  /** @type {ReturnType<typeof createScope> | undefined} */
  let mounted;
  /** @param {string} k */
  const setOf = (k) => { if (!F.open.has(k)) F.open.set(k, new Set()); return /** @type {Set<string>} */ (F.open.get(k)); };
  const { dirs, load } = createFolderReads(paint);
  const { folded, setFolded } = createSectionFolds();
  function paint() {
    if (!F.host || !F.shown) return;
    const s = F.scope;
    const a = /** @type {HTMLElement | null} */ (document.activeElement), retryOf = a && F.host.contains(a) ? a.dataset.flRetry : undefined;
    paintTree(s, /** @type {HTMLElement} */ (F.host.querySelector(".fl-tree")));
    const has = viewer.hasFile;
    const lay = /** @type {HTMLElement} */ (F.host.querySelector(".fl"));
    lay.classList.toggle("is-wide", F.wide);
    const treeFocus = lay.querySelector(".fl-tree")?.contains(document.activeElement) ? document.activeElement : null;
    lay.classList.toggle("is-folded", F.folded && F.wide && has);
    const n = s.key === "all" ? 0 : T.changed;
    const rb = /** @type {HTMLElement} */ (lay.querySelector('[data-fl-rail="changes"]'));
    rb.title = n ? `Changed ${s.base ? "in this thread" : "here"}: ${n.toLocaleString()} file${n === 1 ? "" : "s"}` : "Changed here: nothing yet";
    /** @type {HTMLElement} */ (rb.querySelector("em")).hidden = !n;
    lay.classList.toggle("is-file", !F.wide && has && F.fileView);
    if (treeFocus && !treeFocus.getClientRects().length) { const v = document.getElementById("viewer"); if (v && !v.hidden && v.getClientRects().length) v.focus({ preventScroll: true }); }
    lay.classList.toggle("has-file", has);
    const bar = F.host.querySelector(".fl-bar");
    const bh = has && !F.wide ? `<button type="button" class="fl-back" data-fl-back>${ICON.back}<span>${esc(s.key === "all" ? "Projects" : s.label || "Files")}</span></button>` : "";
    redraw(bar, bh);
    if (retryOf != null && !/** @type {HTMLElement} */ (a).isConnected) {
      const target = F.host.querySelector(`[data-fl-retry="${CSS.escape(retryOf)}"]`) || (retryOf ? rowOf(retryOf) : F.host.querySelector("[data-fl-new]"));
      /** @type {HTMLElement | null} */ (target)?.focus({ preventScroll: true });
    }
  }
  /** @param {string | null} sel */
  function landIn(sel) {
    const host = /** @type {HTMLElement} */ (F.host);
    if (sel && host.querySelector(sel)) /** @type {HTMLElement} */ (host.querySelector(sel)).focus({ preventScroll: true });
    else /** @type {HTMLElement | null} */ (host.querySelector(".fl-tree [data-fl-unpick], .fl-tree .fl-r"))?.focus({ preventScroll: true });
  }
  /** @param {FilesScope} s @param {string} local @param {HTMLElement} from @param {number | null} bytes */
  function openFile(s, local, from, bytes = null) {
    F.sel = local; F.fileView = true; F.auto = false;
    viewer.open({ path: local, name: base(local), bytes, project: s.project, rel: apiRel(s, local) }, from);
    paint();
  }
  async function frontPage() {
    const s = F.scope, scope = mounted;
    if (!F.wide || !s.project || viewer.hasFile) return;
    const d = await load(s, "");
    if (scope?.signal.aborted || F.scope.key !== s.key || viewer.hasFile || !d || d.state !== "ok") return;
    const r = /** @type {import("./folder-reads.js").FileRow[]} */ (d.files).find((x) => /^readme\.(md|mdx|markdown|txt)$/i.test(x.name)) || null;
    if (!r) return;
    F.sel = r.path; F.auto = true;
    viewer.open({ path: r.path, name: r.name, bytes: r.bytes, project: s.project, rel: apiRel(s, r.path) }, null);
  }
  /** @param {FileLocation | null | undefined} f */
  async function reveal(f) {
    if (!f) return;
    if (localIn(F.scope, f) == null) {
      const fs = fileScope(f, { threads: world.state.threads, project: (id) => PROJ(id) });
      if (fs && localIn(fs, f) != null) { F.follow = fs; setScope(F.view); }
    }
    const s = F.scope, scope = mounted;
    const local = localIn(s, f);
    F.sel = local; F.fileView = true;
    if (local == null) { paint(); return; }
    const open = setOf(s.key);
    const chain = [];
    for (let p = parentOf(local); p; p = parentOf(p)) chain.unshift(p);
    for (const p of chain) open.add(p);
    paint();
    for (const p of ["", ...chain]) { await load(s, p); if (scope?.signal.aborted || F.scope.key !== s.key) return; }
    scope?.frame(() => F.host && /** @type {HTMLElement} */ (F.host).querySelector(".fl-r.is-on")?.scrollIntoView({ block: "nearest" }));
  }
  /** @param {string} view */
  function setScope(view) {
    if (view !== F.view) F.follow = null;
    F.view = view;
    let s = scopeOf(view, { thread: (id) => world.thread(id), project: (id) => PROJ(id) });
    F.viewKey = s.key;
    if (F.follow) s = F.follow;
    else if (s.key === "all" && F.pick) s = { key: `${F.pick}|`, project: F.pick, base: "", label: PROJ(F.pick), sub: "" };
    if (s.key !== F.scope.key) {
      F.scope = s; F.q = ""; F.sel = null;
      if (s.project) load(s, "");
      return true;
    }
    F.scope = s;
    return false;
  }
  /** @param {boolean} on */
  function fold(on, { mine = false } = {}) {
    if (F.folded === !!on) return;
    F.folded = !!on;
    paint();
    if (mine && onFold) onFold(F.folded);
  }
  /** @param {string} part */
  function unfoldTo(part) {
    fold(false, { mine: true });
    const tree = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (F.host).querySelector(".fl-tree")), list = /** @type {HTMLElement | null} */ (tree.querySelector(".fl-list"));
    if (part === "find") { /** @type {HTMLInputElement | null} */ (tree.querySelector("[data-fl-q]"))?.focus(); return; }
    const which = part === "all" ? "all" : "changed";
    if (F.scope && F.scope.project && folded(F.scope, which)) { setFolded(F.scope, which, false); paint(); }
    const secs = [...tree.querySelectorAll(".fl-sec")];
    const at = part === "all" ? tree.querySelector('[data-fl-sec="all"]') : secs[0];
    if (list) list.scrollTop = at && part === "all" ? /** @type {HTMLElement} */ (at).offsetTop - list.offsetTop : 0;
    const target = part === "all" ? tree.querySelector(".fl-g .fl-r") : tree.querySelector(".fl-secs .fl-r") || tree.querySelector(".fl-r");
    /** @type {HTMLElement | null} */ (target)?.focus({ preventScroll: true });
  }
  /** @type {MenuState} */
  const M = { btn: null, row: null, menu: null, from: null, dir: null };
  /** @param {FilesScope} s @param {string} p */
  const canMake = (s, p) => !!s.project && !(!s.base && (p === ".xo" || p.startsWith(".xo/")));
  /** @param {FilesScope | null} s */
  const ops = (s) => !!(paths && s && s.project && paths.of({ project: s.project, base: s.base || "" }).via === "paths");
  /** @param {HTMLElement | null} row */
  const pathOfRow = (row) => (row ? row.dataset.flDir ?? row.dataset.flFile ?? null : null);
  /** @param {HTMLElement | null} row */
  function moreAt(row) {
    const b = M.btn;
    if (!b || (row === M.row && (!row || b.previousElementSibling === row))) { if (row && b) { row.classList.add("has-more"); b.style.top = `${row.offsetTop}px`; } return; }
    M.row?.classList.remove("has-more");
    if (!row || !canMake(F.scope, /** @type {string} */ (pathOfRow(row)))) { M.row = null; b.remove(); return; }
    M.row = row;
    row.classList.add("has-more");
    row.after(b);
    b.style.top = `${row.offsetTop}px`;
    b.dataset.flMore = /** @type {string} */ (pathOfRow(row));
    b.dataset.flKind = row.dataset.flDir != null ? "dir" : "file";
    b.setAttribute("aria-label", `More for ${base(/** @type {string} */ (pathOfRow(row)))}`);
  }
  /** @param {HTMLElement} btn */
  function openMenu(btn) {
    const m = /** @type {HTMLElement} */ (M.menu);
    M.from = btn; M.dir = btn.dataset.flMore; M.kind = btn.dataset.flKind || "dir";
    const can = ops(F.scope), dir = M.kind === "dir";
    m.innerHTML = (dir ? `<button type="button" role="menuitem" data-fl-mk>${ICON.fileNew}<span>New file</span></button>` : "") +
      (dir && can ? `<button type="button" role="menuitem" data-fl-mkdir>${ICON.folder}<span>New folder</span></button>` : "") +
      (can ? `<button type="button" role="menuitem" data-fl-rn><span>Rename or move…</span><kbd>F2</kbd></button><button type="button" role="menuitem" data-fl-del><span>Delete</span></button>` : "") +
      `<button type="button" role="menuitem" data-fl-cp>${ICON.copy}<span>Copy path</span></button>`;
    m.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    const r = btn.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    const edge = space("--s-2"), gap = space("--s-1");
    m.style.left = `${Math.max(edge, Math.min(innerWidth - w - edge, r.right - w))}px`;
    m.style.top = `${r.bottom + gap + h > innerHeight - edge ? r.top - gap - h : r.bottom + gap}px`;
    /** @type {HTMLButtonElement} */ (m.querySelector("button")).focus();
  }
  function closeMenu(back = false) {
    if (!M.menu || /** @type {HTMLElement} */ (M.menu).hidden) return;
    /** @type {HTMLElement} */ (M.menu).hidden = true;
    M.from?.setAttribute("aria-expanded", "false");
    if (back && M.from && M.from.isConnected) M.from.focus({ preventScroll: true });
  }
  /** @param {HTMLElement} m @param {ReturnType<typeof createScope>} scope */
  function wireMenu(m, scope) {
    scope.listen(m, "click", (e) => {
      if (/** @type {HTMLInputElement} */ (e.target).closest("[data-fl-mk]")) { closeMenu(); startNew(/** @type {string} */ (M.dir)); return; }
      if (/** @type {HTMLInputElement} */ (e.target).closest("[data-fl-mkdir]")) { closeMenu(); startNew(/** @type {string} */ (M.dir), "folder"); return; }
      if (/** @type {HTMLInputElement} */ (e.target).closest("[data-fl-rn]")) { closeMenu(); startNew(parentOf(/** @type {string} */ (M.dir)), "rename", /** @type {string} */ (M.dir)); return; }
      if (/** @type {HTMLInputElement} */ (e.target).closest("[data-fl-del]")) { closeMenu(); remove(/** @type {string} */ (M.dir), /** @type {string} */ (M.kind)); return; }
      const cp = /** @type {HTMLElement | null} */ (/** @type {HTMLInputElement} */ (e.target).closest("[data-fl-cp]"));
      if (cp) { copyText(/** @type {string} */ (M.dir)).then((ok) => { if (scope.signal.aborted) return; if (ok) { cp.innerHTML = `${ICON.check}<span>Copied</span>`; scope.timeout(() => closeMenu(true), 600); } else { cp.innerHTML = `<span>Couldn't copy here</span>`; cp.title = COPY_REFUSED; } }); }
    });
    scope.listen(m, "keydown", (event) => {
      const e = /** @type {KeyboardEvent} */ (event);
      const items = [...m.querySelectorAll("button")], i = items.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(true); return; }
      if (e.key === "Tab") { closeMenu(true); e.preventDefault(); return; }
      const to = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : null;
      if (to == null) return;
      e.preventDefault();
      items[(to + items.length) % items.length].focus();
    });
    scope.listen(document, "pointerdown", (e) => { if (!m.hidden && !m.contains(/** @type {Node} */ (e.target)) && e.target !== M.from && !M.from?.contains(/** @type {Node} */ (e.target))) closeMenu(); }, true);
  }
  /** @type {OperationDependencies["NW"]} */
  const NW = { key: null, dir: null, el: null, busy: false, confirm: false, mode: "file", from: null };
  const { T, paintTree, rowOf } = createFilesTree({
    F, M, NW, dirs, load, paths, folded, setOf, ops, world, viewer, changes, isBusy, placeNew: () => placeNew(), moreAt, base,
  });
  const { startNew, endNew, placeNew, nameSay, sayNew, makeNew, moveTo, remove, undoRemove } = createFileOperations({
    F, NW, dirs, load, paths, changes, viewer, setOf, paint, groups: () => T.groups, rowOf, base, canMake, folderIcon: ICON.folder,
  });
  /** @param {HTMLElement} host @param {ReturnType<typeof createScope>} scope */
  function wire(host, scope) {
    scope.listen(host, "click", (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      const rl = /** @type {HTMLElement | null} */ (t.closest("[data-fl-rail]"));
      if (rl) { unfoldTo(/** @type {string} */ (rl.dataset.flRail)); return; }
      const mb = /** @type {HTMLElement | null} */ (t.closest("[data-fl-more]"));
      if (mb) { if (/** @type {HTMLElement} */ (M.menu).hidden || M.from !== mb) openMenu(mb); else closeMenu(true); return; }
      if (t.closest("[data-fl-new]")) { startNew(""); return; }
      const sec = /** @type {HTMLElement | null} */ (t.closest("[data-fl-sec]"));
      if (sec) { const part = /** @type {string} */ (sec.dataset.flSec); setFolded(F.scope, part, !folded(F.scope, part)); paint(); /** @type {HTMLElement | null} */ (host.querySelector(`[data-fl-sec="${part}"]`))?.focus({ preventScroll: true }); return; }
      if (t.closest("[data-fl-undo]")) { if (F.undo && F.undo.editId) undoRemove(); else { F.undo = null; paint(); } return; }
      const dirB = /** @type {HTMLElement | null} */ (t.closest("[data-fl-dir]"));
      if (dirB) {
        const p = /** @type {string} */ (dirB.dataset.flDir), open = setOf(F.scope.key);
        if (open.has(p)) open.delete(p); else { open.add(p); load(F.scope, p); }
        paint(); return;
      }
      const fb = /** @type {HTMLElement | null} */ (t.closest("[data-fl-file]"));
      if (fb) { openFile(F.scope, /** @type {string} */ (fb.dataset.flFile), fb, fb.dataset.flBytes === "" ? null : Number(fb.dataset.flBytes)); return; }
      const cg = /** @type {HTMLElement | null} */ (t.closest("[data-fl-change]"));
      if (cg) {
        const rel = /** @type {string} */ (cg.dataset.flChange), s = F.scope;
        F.fileView = true; F.auto = false; F.sel = null;
        viewer.open({ path: rel, name: base(rel), project: s.project, rel, show: "changes" }, cg); paint(); return;
      }
      const tc = /** @type {HTMLElement | null} */ (t.closest("[data-fl-touch]"));
      if (tc) {
        const rel = /** @type {string} */ (tc.dataset.flTouch), s = F.scope;
        F.fileView = true; F.auto = false; F.sel = localIn(s, { project: s.project, rel });
        viewer.open({ path: rel, name: base(rel), project: s.project, rel }, tc); paint(); return;
      }
      const pk = /** @type {HTMLElement | null} */ (t.closest("[data-fl-pick]"));
      if (pk) { F.pick = /** @type {string} */ (pk.dataset.flPick); F.follow = null; setScope(F.view); paint(); landIn(null); frontPage(); return; }
      if (t.closest("[data-fl-unpick]")) { const was = F.pick; F.pick = null; F.follow = null; viewer.close({ restore: false }); setScope(F.view); paint(); landIn(was ? `[data-fl-pick="${CSS.escape(was)}"]` : null); return; }
      const rt = /** @type {HTMLElement | null} */ (t.closest("[data-fl-retry]"));
      if (rt) {
        if (rt.getAttribute("aria-busy") === "true") return;
        load(F.scope, /** @type {string} */ (rt.dataset.flRetry), { again: true });
        paint();
        return;
      }
      if (t.closest("[data-fl-back]")) { F.fileView = false; if (!F.wide) viewer.close({ restore: false }); paint(); /** @type {HTMLElement | null} */ (host.querySelector(".fl-r.is-on, .fl-r"))?.focus({ preventScroll: true }); }
    });
    scope.listen(host, "input", (e) => {
      if (/** @type {HTMLInputElement} */ (e.target).matches("[data-fl-q]")) { F.q = /** @type {HTMLInputElement} */ (e.target).value; paint(); return; }
      if (/** @type {HTMLInputElement} */ (e.target).matches("[data-fl-name]") && NW.el && NW.mode === "file") {
        const n = /** @type {HTMLInputElement} */ (e.target).value.trim();
        /** @type {HTMLElement} */ (NW.el.querySelector(".fl-i")).innerHTML = fileIcon(n);
        sayNew(nameSay(F.scope, /** @type {string} */ (NW.dir), n));
      }
    });
    /** @param {HTMLElement | null} x */
    const folderRow = (x) => (x && x.matches && (x.matches(".fl-g > .fl-r.is-dir") || (ops(F.scope) && x.matches(".fl-g > .fl-r[data-fl-file]:not(.is-found)"))) ? x : null);
    scope.listen(host, "pointerover", (e) => {
      if (!/** @type {HTMLElement} */ (M.menu).hidden || /** @type {HTMLInputElement} */ (e.target).closest(".fl-more")) return;
      const r = /** @type {HTMLElement | null} */ (/** @type {HTMLInputElement} */ (e.target).closest(".fl-r"));
      if (r) moreAt(folderRow(r) || folderRow(/** @type {HTMLElement | null} */ (document.activeElement)));
    });
    scope.listen(host, "pointerout", (event) => {
      const e = /** @type {PointerEvent} */ (event);
      if (!/** @type {HTMLElement} */ (M.menu).hidden || (e.relatedTarget && /** @type {HTMLElement} */ (e.relatedTarget).closest && /** @type {HTMLElement} */ (e.relatedTarget).closest(".fl-list"))) return;
      if (!/** @type {HTMLInputElement} */ (e.target).closest || !/** @type {HTMLInputElement} */ (e.target).closest(".fl-list")) return;
      moreAt(folderRow(/** @type {HTMLElement | null} */ (document.activeElement)) || (document.activeElement === M.btn ? M.row : null));
    });
    scope.listen(host, "focusin", (e) => {
      const r = folderRow(/** @type {HTMLElement} */ (e.target));
      if (r) moreAt(r);
      else if (e.target !== M.btn) moreAt(null);
    });
    scope.listen(host, "focusout", (e) => {
      if (/** @type {HTMLInputElement} */ (e.target).matches("[data-fl-name]") && NW.el && !NW.busy && !/** @type {HTMLInputElement} */ (e.target).value.trim()) scope.timeout(() => { if (NW.el && !NW.el.contains(/** @type {HTMLElement | null} */ (document.activeElement)) && !/** @type {HTMLInputElement} */ (NW.el.querySelector("input")).value.trim()) endNew(); }, 0);
    });
    scope.listen(host, "scroll", () => closeMenu(), true);
    wireFileDrag(host, () => ops(F.scope) ? F.scope.key : null, pathOfRow, base, moveTo, scope);
    scope.listen(host, "keydown", (event) => {
      const e = /** @type {KeyboardEvent} */ (event);
      if (/** @type {HTMLInputElement} */ (e.target).matches("[data-fl-name]")) {
        if (e.key === "Enter") { e.preventDefault(); makeNew(); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); endNew({ focus: true }); }
        return;
      }
      if ((e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) && folderRow(/** @type {HTMLElement | null} */ (document.activeElement))) {
        e.preventDefault(); moreAt(/** @type {HTMLElement} */ (document.activeElement)); if (M.row) openMenu(/** @type {HTMLButtonElement} */ (M.btn)); return;
      }
      if (e.key === "F2" && folderRow(/** @type {HTMLElement | null} */ (document.activeElement)) && ops(F.scope)) { e.preventDefault(); const p = pathOfRow(/** @type {HTMLElement | null} */ (document.activeElement)); startNew(parentOf(/** @type {string} */ (p)), "rename", p); return; }
      if ((e.key === "Delete" || (e.metaKey && e.key === "Backspace")) && folderRow(/** @type {HTMLElement | null} */ (document.activeElement)) && ops(F.scope)) { e.preventDefault(); const r = /** @type {HTMLElement} */ (document.activeElement); remove(/** @type {string} */ (pathOfRow(r)), r.dataset.flDir != null ? "dir" : "file"); return; }
      if (e.key === "Escape" && /** @type {HTMLInputElement} */ (e.target).matches("[data-fl-q]") && /** @type {HTMLInputElement} */ (e.target).value) { e.preventDefault(); e.stopPropagation(); F.q = ""; /** @type {HTMLInputElement} */ (e.target).value = ""; paint(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const rows = [.../** @type {NodeListOf<HTMLElement>} */ (host.querySelectorAll(".fl-tree .fl-r"))];
      const i = rows.indexOf(/** @type {HTMLElement} */ (document.activeElement));
      if (i < 0 && !/** @type {HTMLInputElement} */ (e.target).matches("[data-fl-q]")) return;
      e.preventDefault();
      rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
    });
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(() => {
        if (scope.signal.aborted) return;
        const w = host.getBoundingClientRect().width >= WIDE;
        if (w !== F.wide) { F.wide = w; paint(); if (w) frontPage(); }
      });
      scope.observe(observer);
      observer.observe(host);
    }
  }
  return {
    pathsChanged() { if (F.q.trim()) paint(); },
    /** @param {HTMLElement} host */
    mount(host, scope = createScope()) {
      mounted?.dispose();
      mounted = scope;
      F.host = host;
      const vw = document.getElementById("viewer");
      const home = document.createComment("viewer");
      vw?.before(home);
      scope.effect(() => () => { if (vw) home.replaceWith(vw); });
      host.innerHTML = `<div class="fl"><nav class="fl-rail" aria-label="Files, folded"><button type="button" class="fl-rb" data-fl-rail="changes">${CHANGED_IC}<em hidden></em></button><button type="button" class="fl-rb" data-fl-rail="all" title="All files">${ICON.folder}</button><button type="button" class="fl-rb" data-fl-rail="find" title="Find a file">${ICON.search}</button></nav>` +
        `<div class="fl-tree"></div><div class="fl-split" role="separator" aria-orientation="vertical" aria-label="Resize the file tree" title="Drag to resize · double-click for the default" tabindex="0"></div><div class="fl-pv"><div class="fl-bar"></div><div class="fl-view"></div><p class="fl-empty">Pick a file to read it here.</p></div></div>`;
      if (vw) /** @type {HTMLElement} */ (host.querySelector(".fl-view")).appendChild(vw);
      const { button, menu } = createFilesMenu();
      M.btn = button;
      M.menu = menu;
      document.body.appendChild(menu);
      scope.effect(() => () => {
        closeMenu(); moreAt(null); menu.remove();
        F.host = M.btn = M.menu = M.from = M.dir = NW.el = null;
        F.shown = false;
        mounted = undefined;
      });
      wireMenu(menu, scope);
      scope.effect(() => pointerFollows(menu));
      wire(host, scope);
      return scope.dispose;
    },
    /** @param {string} view */
    show(view) {
      F.shown = true;
      F.wide = /** @type {HTMLElement} */ (F.host).getBoundingClientRect().width >= WIDE;
      setScope(view);
      paint();
      frontPage();
    },
    hide() { F.shown = false; },
    /** @param {string} view */
    render(view) {
      if (!F.shown) return;
      if (setScope(view)) { if (F.auto || !viewer.hasFile) { if (viewer.hasFile) viewer.close({ restore: false }); F.fileView = false; } frontPage(); }
      if (!viewer.hasFile) { F.sel = null; F.fileView = false; }
      paint();
    },
    reveal,
    /** @param {FileLocation} f */
    async reread(f) {
      const scope = mounted, s = F.scope, local = localIn(s, f);
      if (!scope || local == null) return;
      const dir = parentOf(local);
      await load(s, dir, { again: true });
      if (scope.signal.aborted || F.scope.key !== s.key || (document.activeElement && document.activeElement !== document.body)) return;
      const target = dir ? rowOf(dir) : /** @type {HTMLElement} */ (F.host).querySelector("[data-fl-new]");
      /** @type {HTMLElement | null} */ (target)?.focus({ preventScroll: true });
    },
    /** @param {string} view */
    changes(view) {
      const s = scopeOf(view, { thread: (id) => world.thread(id), project: (id) => PROJ(id) });
      return s.project ? touched(s, world, isBusy) : [];
    },
    fold,
    /** @param {boolean} on */
    list(on) { if (F.wide || !viewer.hasFile) return false; F.fileView = !on; paint(); return true; },
    get listing() { return !F.wide && viewer.hasFile && !F.fileView; },
    get folded() { return F.folded; },
    get wide() { return F.wide; },
    get auto() { return F.auto; },
    get place() { return F.shown && F.scope.project ? { label: F.scope.label, sub: F.scope.sub || "" } : null; },
  };
}
