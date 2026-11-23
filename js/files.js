// Files: the panel's file browser, and the one place a file opens. The idea is
// xo-swarm's org-mode browser (app/org/[orgId]/_components/ProjectFileTree.tsx): a tree read a folder
// at a time, the README as the project's front page, the file beside the tree when there's room and
// one at a time when there isn't. Ours on top: what the agents touched, marked where it is.
//
// What it shows follows the view: a thread, its own worktree (its branch); a project, its folder;
// Home, the Workspace and Chats, your projects to pick from. It writes one thing: a new file (a folder's
// ⋯ › New file, or the head's New file), through Space's guarded save, which makes it only if nothing has
// that name yet. The new file opens in the viewer, being edited, with "Created · Undo" at its foot.
//
// The file itself is the viewer (js/viewer.js), moved in here. A file opened from anywhere (a chip in
// a turn, Made, the Map) comes forward in Files, shown in its folder when it's in the one on screen.
//
// What it reads: GET /api/xo-projects/<project>/tree (one level per call: dirs and files with size and
// time), the file routes the viewer reads, and the turns the stream already brings (activityOf, the
// Map's pure reader of a session's file steps).
//
// stage.js calls: mount, show, hide, render, reveal, count.

import { esc, copyText, COPY_REFUSED, space } from "../core/platform/index.js";
import { ICON } from "./ui.js";
import { scopeOf, fileScope, localIn, parentOf } from "../modules/files/scope.js";
import { touched } from "../modules/files/marks.js";
import { createFilesTree } from "../modules/files/tree.js";
import { apiRel, createFolderReads } from "../modules/files/folder-reads.js";
import { createFileOperations } from "../modules/files/operations.js";
import { createSectionFolds } from "../modules/files/section-folds.js";
import { fileIcon, folderIcon } from "./fileicons.js";
import { pointerFollows } from "./keynav.js";

export { scopeOf, fileScope, localIn, newFileSay } from "../modules/files/scope.js";

const WIDE = 600;       // the panel's width from which tree and file sit side by side (the panel goes to 720)

export const FILES_ICON = ICON.folder;
const BACK = ICON.back;
const CHANGED_IC = ICON.changes;
const MORE_IC = ICON.more;
const NEW_IC = ICON.fileNew;
const FOLDER_IC = ICON.folder;

const base = (p) => String(p || "").split("/").pop();

export function createFiles({ world, viewer, isBusy, PROJ, go, changes = null, onFold = null, paths = null }) {
  const F = {
    host: null, view: "home", scope: { key: "all" }, pick: null, shown: false,
    open: new Map(),     // scope key → Set of open folders (paths inside the scope)
    sel: null,           // the file shown, inside the scope (null: none, or one from elsewhere)
    fileView: false,     // narrow: the file is in front of the tree
    auto: false,         // the README was opened by us, not by you
    follow: null,        // the folder of a file opened from elsewhere (Artifacts, another thread): shown until you leave
    viewKey: "all",      // the scope the view itself gives
    q: "", wide: false,
    folded: false,       // beside a file, the tree folded to its rail (its fold button, ⌘B; modules/files/page.js keeps it)
  };
  const setOf = (k) => { if (!F.open.has(k)) F.open.set(k, new Set()); return F.open.get(k); };
  const { dirs, load } = createFolderReads(paint);

  const { folded, setFolded } = createSectionFolds();

  function paint() {
    if (!F.host || !F.shown) return;
    const s = F.scope;
    // a Try again replaced by its folder's reading (or its rows) hands focus to that folder: its contract
    // (Astra S061); rows themselves keep focus through a redraw in sync() (refocus)
    const a = document.activeElement, retryOf = a && F.host.contains(a) ? a.dataset.flRetry : undefined;
    paintTree(s, F.host.querySelector(".fl-tree"));
    const has = viewer.hasFile;
    const lay = F.host.querySelector(".fl");
    lay.classList.toggle("is-wide", F.wide);
    const treeFocus = lay.querySelector(".fl-tree")?.contains(document.activeElement) ? document.activeElement : null;
    lay.classList.toggle("is-folded", F.folded && F.wide && has);
    // the folded tree's Changed: a mark when this place changed something; how many is in its title
    const n = s.key === "all" ? 0 : T.changed;
    const rb = lay.querySelector('[data-fl-rail="changes"]');
    rb.title = n ? `Changed ${s.base ? "in this thread" : "here"}: ${n.toLocaleString()} file${n === 1 ? "" : "s"}` : "Changed here: nothing yet";
    rb.querySelector("em").hidden = !n;
    lay.classList.toggle("is-file", !F.wide && has && F.fileView);
    // the file takes the tree's place (narrow), or the tree folds beside it (wide): a row that had focus is hidden
    // with the tree, so the file, shown now, takes focus in the same step and focus never passes through the page
    // (Astra C033)
    if (treeFocus && !treeFocus.getClientRects().length) { const v = document.getElementById("viewer"); if (v && !v.hidden && v.getClientRects().length) v.focus({ preventScroll: true }); }
    lay.classList.toggle("has-file", has);
    const bar = F.host.querySelector(".fl-bar");
    const bh = has && !F.wide ? `<button type="button" class="fl-back" data-fl-back>${BACK}<span>${esc(s.key === "all" ? "Projects" : s.label || "Files")}</span></button>` : "";
    if (bar._h !== bh) { bar.innerHTML = bh; bar._h = bh; }
    // S061's named destinations once the read settles: Try again again if it failed again; a folder that read,
    // its own row; the project's top that read (even empty), its New file
    if (retryOf != null && !a.isConnected) (F.host.querySelector(`[data-fl-retry="${CSS.escape(retryOf)}"]`) || (retryOf ? rowOf(retryOf) : F.host.querySelector("[data-fl-new]")))?.focus({ preventScroll: true });
  }
  /** Where focus goes when the place itself changes (a project picked, or left): its contract. */
  function landIn(sel) { (sel && F.host.querySelector(sel)) ? F.host.querySelector(sel).focus({ preventScroll: true }) : F.host.querySelector(".fl-tree [data-fl-unpick], .fl-tree .fl-r")?.focus({ preventScroll: true }); }

  // ── opening ───────────────────────────────────────────────────────────────
  function openFile(s, local, from, bytes = null) {
    F.sel = local; F.fileView = true; F.auto = false;
    viewer.open({ path: local, name: base(local), bytes, project: s.project, rel: apiRel(s, local) }, from);
    // the viewer takes focus as Files lays out for the file (paint: the tree folds or gives way to it)
    paint();
  }
  /** Wide, nothing chosen: the README is the front page, as GitHub shows one. */
  async function frontPage() {
    const s = F.scope;
    if (!F.wide || !s.project || viewer.hasFile) return;
    const d = await load(s, "");
    if (F.scope.key !== s.key || viewer.hasFile || !d || d.state !== "ok") return; // (another place: by its key, see reveal)
    const r = d.files.find((x) => /^readme\.(md|mdx|markdown|txt)$/i.test(x.name)) || null;
    if (!r) return;
    F.sel = r.path; F.auto = true;
    viewer.open({ path: r.path, name: r.name, bytes: r.bytes, project: s.project, rel: apiRel(s, r.path) }, null);
  }
  /** The viewer opened a file (from anywhere): show it, and find it in the tree when it's in this folder. */
  async function reveal(f) {
    if (!f) return;
    // a file from outside this folder: the tree goes to its folder, so it can be found and highlighted
    if (localIn(F.scope, f) == null) {
      const fs = fileScope(f, { threads: world.state.threads, project: (id) => PROJ(id) });
      if (fs && localIn(fs, f) != null) { F.follow = fs; setScope(F.view); }
    }
    const s = F.scope;
    const local = localIn(s, f);
    F.sel = local; F.fileView = true;
    if (local == null) { paint(); return; }
    const open = setOf(s.key);
    const chain = [];
    for (let p = parentOf(local); p; p = parentOf(p)) chain.unshift(p);
    for (const p of chain) open.add(p);
    paint();
    // each folder down to it is read, one after another, while the place is the same. The place is its key: every
    // render gives F.scope a new object (setScope), so a check by identity stopped after the first read and left the
    // folders below open with nothing read, "Reading…" for good until a click closed and opened them again (the owner,
    // 19 Nov: a folder stuck on Reading until clicked again)
    for (const p of ["", ...chain]) { await load(s, p); if (F.scope.key !== s.key) return; }
    requestAnimationFrame(() => F.host && F.host.querySelector(`.fl-r.is-on`)?.scrollIntoView({ block: "nearest" }));
  }

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

  // ── folded to a rail (beside a file) ─────────────────────────────────────
  /** Fold or open the tree; `onFold` (modules/files/page.js) hears it when it was you. */
  function fold(on, { mine = false } = {}) {
    if (F.folded === !!on) return;
    F.folded = !!on;
    paint();
    if (mine && onFold) onFold(F.folded);
  }
  /** A rail icon: the tree opens on that section (Changed, All files, or Find with its field focused). */
  function unfoldTo(part) {
    fold(false, { mine: true });
    const tree = F.host.querySelector(".fl-tree"), list = tree.querySelector(".fl-list");
    if (part === "find") { tree.querySelector("[data-fl-q]")?.focus(); return; }
    // the section asked for opens if it was folded
    const which = part === "all" ? "all" : "changed";
    if (F.scope && F.scope.project && folded(F.scope, which)) { setFolded(F.scope, which, false); paint(); }
    const secs = [...tree.querySelectorAll(".fl-sec")];
    const at = part === "all" ? tree.querySelector('[data-fl-sec="all"]') : secs[0];
    if (list) list.scrollTop = at && part === "all" ? at.offsetTop - list.offsetTop : 0;
    (part === "all" ? tree.querySelector(".fl-g .fl-r") : tree.querySelector(".fl-secs .fl-r") || tree.querySelector(".fl-r"))?.focus({ preventScroll: true });
  }

  // ── a folder's ⋯ ──────────────────────────────────────────────────────────
  // One ⋯ for the whole tree: it sits on the folder under the pointer or with focus, right after its row (so
  // Tab reaches it from the row; Shift-F10 opens it too), and opens a small menu: New file, Copy path.
  // Nowhere XO keeps (a project's .xo/): Space refuses a write there.
  const M = { btn: null, row: null, menu: null, from: null, dir: null };
  const canMake = (s, p) => !!s.project && !(!s.base && (p === ".xo" || p.startsWith(".xo/")));
  /** Space can rename, move and delete here (its /paths answered: the newer Space, SPACE-CONTRACT.md §4.3–4.6). */
  const ops = (s) => !!(paths && s && s.project && paths.of({ project: s.project, base: s.base || "" }).via === "paths");
  const pathOfRow = (row) => (row ? row.dataset.flDir ?? row.dataset.flFile ?? null : null);
  function moreAt(row) {
    const b = M.btn;
    // (the same row, its folder's rows redrawn in place: its has-more is the tree's, so it's put back)
    if (!b || (row === M.row && (!row || b.previousElementSibling === row))) { if (row && b) { row.classList.add("has-more"); b.style.top = `${row.offsetTop}px`; } return; }
    M.row?.classList.remove("has-more");
    if (!row || !canMake(F.scope, pathOfRow(row))) { M.row = null; b.remove(); return; }
    M.row = row;
    row.classList.add("has-more");
    row.after(b);
    b.style.top = `${row.offsetTop}px`;
    b.dataset.flMore = pathOfRow(row);
    b.dataset.flKind = row.dataset.flDir != null ? "dir" : "file";
    b.setAttribute("aria-label", `More for ${base(pathOfRow(row))}`);
  }
  function openMenu(btn) {
    const m = M.menu;
    M.from = btn; M.dir = btn.dataset.flMore; M.kind = btn.dataset.flKind || "dir";
    const can = ops(F.scope), dir = M.kind === "dir";
    m.innerHTML = (dir ? `<button type="button" role="menuitem" data-fl-mk>${NEW_IC}<span>New file</span></button>` : "") +
      (dir && can ? `<button type="button" role="menuitem" data-fl-mkdir>${FOLDER_IC}<span>New folder</span></button>` : "") +
      (can ? `<button type="button" role="menuitem" data-fl-rn><span>Rename or move…</span><kbd>F2</kbd></button><button type="button" role="menuitem" data-fl-del><span>Delete</span></button>` : "") +
      `<button type="button" role="menuitem" data-fl-cp>${ICON.copy}<span>Copy path</span></button>`;
    m.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    const r = btn.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    // the window's edge keeps --s-2, the row --s-1 (they were 8 and 4 written here)
    const edge = space("--s-2"), gap = space("--s-1");
    m.style.left = `${Math.max(edge, Math.min(innerWidth - w - edge, r.right - w))}px`;
    m.style.top = `${r.bottom + gap + h > innerHeight - edge ? r.top - gap - h : r.bottom + gap}px`;
    m.querySelector("button").focus();
  }
  function closeMenu(back = false) {
    if (!M.menu || M.menu.hidden) return;
    M.menu.hidden = true;
    M.from?.setAttribute("aria-expanded", "false");
    if (back && M.from && M.from.isConnected) M.from.focus({ preventScroll: true });
  }
  function wireMenu(m) {
    m.addEventListener("click", (e) => {
      if (e.target.closest("[data-fl-mk]")) { closeMenu(); startNew(M.dir); return; }
      if (e.target.closest("[data-fl-mkdir]")) { closeMenu(); startNew(M.dir, "folder"); return; }
      if (e.target.closest("[data-fl-rn]")) { closeMenu(); startNew(parentOf(M.dir), "rename", M.dir); return; }
      if (e.target.closest("[data-fl-del]")) { closeMenu(); remove(M.dir, M.kind); return; }
      const cp = e.target.closest("[data-fl-cp]");
      // "Copied" only once the path is on the clipboard; refused, the item says so and the menu stays
      if (cp) { copyText(M.dir).then((ok) => { if (ok) { cp.innerHTML = `${ICON.check}<span>Copied</span>`; setTimeout(() => closeMenu(true), 600); } else { cp.innerHTML = `<span>Couldn't copy here</span>`; cp.title = COPY_REFUSED; } }); }
    });
    m.addEventListener("keydown", (e) => {
      const items = [...m.querySelectorAll("button")], i = items.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(true); return; }
      if (e.key === "Tab") { closeMenu(true); e.preventDefault(); return; }
      const to = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : null;
      if (to == null) return;
      e.preventDefault();
      items[(to + items.length) % items.length].focus();
    });
    document.addEventListener("pointerdown", (e) => { if (!m.hidden && !m.contains(e.target) && e.target !== M.from && !M.from?.contains(e.target)) closeMenu(); }, true);
  }

  const NW = { key: null, dir: null, el: null, busy: false, confirm: false, mode: "file", from: null };
  const { T, paintTree, rowOf } = createFilesTree({
    F, M, NW, dirs, load, paths, folded, setOf, ops, world, viewer, changes, isBusy, placeNew: () => placeNew(), moreAt, base,
  });
  const { startNew, endNew, placeNew, nameSay, sayNew, makeNew, moveTo, remove, undoRemove } = createFileOperations({
    F, NW, dirs, load, paths, changes, viewer, setOf, paint, groups: () => T.groups, rowOf, base, canMake, folderIcon: FOLDER_IC,
  });

  // ── input ─────────────────────────────────────────────────────────────────
  function wire(host) {
    host.addEventListener("click", (e) => {
      const t = e.target;
      const rl = t.closest("[data-fl-rail]");
      if (rl) { unfoldTo(rl.dataset.flRail); return; }
      const mb = t.closest("[data-fl-more]");
      if (mb) { if (M.menu.hidden || M.from !== mb) openMenu(mb); else closeMenu(true); return; }
      if (t.closest("[data-fl-new]")) { startNew(""); return; }
      const sec = t.closest("[data-fl-sec]");
      if (sec) { const part = sec.dataset.flSec; setFolded(F.scope, part, !folded(F.scope, part)); paint(); host.querySelector(`[data-fl-sec="${part}"]`)?.focus({ preventScroll: true }); return; }
      if (t.closest("[data-fl-undo]")) { if (F.undo && F.undo.editId) undoRemove(); else { F.undo = null; paint(); } return; }
      const dirB = t.closest("[data-fl-dir]");
      if (dirB) {
        const p = dirB.dataset.flDir, open = setOf(F.scope.key);
        if (open.has(p)) open.delete(p); else { open.add(p); load(F.scope, p); }
        paint(); return;
      }
      const fb = t.closest("[data-fl-file]");
      if (fb) { openFile(F.scope, fb.dataset.flFile, fb, fb.dataset.flBytes === "" ? null : Number(fb.dataset.flBytes)); return; }
      const cg = t.closest("[data-fl-change]");
      if (cg) {
        const rel = cg.dataset.flChange, s = F.scope;
        F.fileView = true; F.auto = false; F.sel = null;
        viewer.open({ path: rel, name: base(rel), project: s.project, rel, show: "changes" }, cg); paint(); return;
      }
      const tc = t.closest("[data-fl-touch]");
      if (tc) {
        const rel = tc.dataset.flTouch, s = F.scope;
        F.fileView = true; F.auto = false; F.sel = localIn(s, { project: s.project, rel });
        // as a row of the tree does: the file takes focus as Files lays out for it (S064)
        viewer.open({ path: rel, name: base(rel), project: s.project, rel }, tc); paint(); return;
      }
      const pk = t.closest("[data-fl-pick]");
      if (pk) { F.pick = pk.dataset.flPick; F.follow = null; setScope(F.view); paint(); landIn(null); frontPage(); return; }
      if (t.closest("[data-fl-unpick]")) { const was = F.pick; F.pick = null; F.follow = null; viewer.close({ restore: false }); setScope(F.view); paint(); landIn(was ? `[data-fl-pick="${CSS.escape(was)}"]` : null); return; }
      const rt = t.closest("[data-fl-retry]");
      if (rt) {
        if (rt.getAttribute("aria-busy") === "true") return; // already reading again
        load(F.scope, rt.dataset.flRetry, { again: true });
        paint(); // "Reading again…" the moment it's pressed, in place, not when the answer comes (Astra S061)
        return;
      }
      if (t.closest("[data-fl-back]")) { F.fileView = false; if (!F.wide) viewer.close({ restore: false }); paint(); host.querySelector(".fl-r.is-on, .fl-r")?.focus({ preventScroll: true }); }
    });
    host.addEventListener("input", (e) => {
      if (e.target.matches("[data-fl-q]")) { F.q = e.target.value; paint(); return; }
      if (e.target.matches("[data-fl-name]") && NW.el && NW.mode === "file") {
        const n = e.target.value.trim();
        NW.el.querySelector(".fl-i").innerHTML = fileIcon(n);
        sayNew(nameSay(F.scope, NW.dir, n));
      }
    });
    // the ⋯ comes to the folder under the pointer, or the one with focus
    const folderRow = (x) => (x && x.matches && (x.matches(".fl-g > .fl-r.is-dir") || (ops(F.scope) && x.matches(".fl-g > .fl-r[data-fl-file]:not(.is-found)"))) ? x : null);
    host.addEventListener("pointerover", (e) => {
      if (!M.menu.hidden || e.target.closest(".fl-more")) return;
      const r = e.target.closest(".fl-r");
      if (r) moreAt(folderRow(r) || folderRow(document.activeElement));
    });
    host.addEventListener("pointerout", (e) => {
      if (!M.menu.hidden || (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".fl-list"))) return;
      if (!e.target.closest || !e.target.closest(".fl-list")) return;
      moreAt(folderRow(document.activeElement) || (document.activeElement === M.btn ? M.row : null));
    });
    host.addEventListener("focusin", (e) => {
      const r = folderRow(e.target);
      if (r) moreAt(r);
      else if (e.target !== M.btn) moreAt(null);
    });
    host.addEventListener("focusout", (e) => {
      if (e.target.matches("[data-fl-name]") && NW.el && !NW.busy && !e.target.value.trim()) setTimeout(() => { if (NW.el && !NW.el.contains(document.activeElement) && !NW.el.querySelector("input").value.trim()) endNew(); });
    });
    host.addEventListener("scroll", () => closeMenu(), true);
    // ── moving by dragging: a file or folder onto a folder (or the list's empty space: the place's top) ──
    let dragging = null;
    const dropDir = (t) => { const r = t.closest && t.closest(".fl-g > .fl-r.is-dir"); if (r) return r.dataset.flDir; return t.closest && t.closest(".fl-list") && !t.closest(".fl-r, .fl-secs") ? "" : null; };
    const fits = (to) => dragging && to != null && to !== parentOf(dragging.path) && to !== dragging.path && !to.startsWith(dragging.path + "/");
    let over = null;
    const mark = (el) => { if (over === el) return; over?.classList.remove("is-drop"); over = el; el?.classList.add("is-drop"); };
    host.addEventListener("dragstart", (e) => {
      const r = e.target.closest && e.target.closest(".fl-g > .fl-r[draggable]");
      if (!r || !ops(F.scope)) return;
      dragging = { path: pathOfRow(r), kind: r.dataset.flDir != null ? "dir" : "file" };
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragging.path);
    });
    host.addEventListener("dragover", (e) => {
      const to = dropDir(e.target);
      if (!fits(to)) { mark(null); return; }
      e.preventDefault(); e.dataTransfer.dropEffect = "move";
      mark(to ? e.target.closest(".fl-r") : e.target.closest(".fl-list"));
    });
    host.addEventListener("dragleave", (e) => { if (!host.contains(e.relatedTarget)) mark(null); });
    host.addEventListener("dragend", () => { dragging = null; mark(null); });
    host.addEventListener("drop", (e) => {
      const to = dropDir(e.target), d = dragging;
      mark(null); dragging = null;
      if (!d || !fits(to)) return;
      e.preventDefault();
      moveTo(d.path, to ? `${to}/${base(d.path)}` : base(d.path));
    });
    host.addEventListener("keydown", (e) => {
      if (e.target.matches("[data-fl-name]")) {
        if (e.key === "Enter") { e.preventDefault(); makeNew(); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); endNew({ focus: true }); }
        return;
      }
      if ((e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) && folderRow(document.activeElement)) {
        e.preventDefault(); moreAt(document.activeElement); if (M.row) openMenu(M.btn); return;
      }
      // F2: rename (or move) the row with focus, as VS Code's explorer does
      if (e.key === "F2" && folderRow(document.activeElement) && ops(F.scope)) { e.preventDefault(); const p = pathOfRow(document.activeElement); startNew(parentOf(p), "rename", p); return; }
      if ((e.key === "Delete" || (e.metaKey && e.key === "Backspace")) && folderRow(document.activeElement) && ops(F.scope)) { e.preventDefault(); const r = document.activeElement; remove(pathOfRow(r), r.dataset.flDir != null ? "dir" : "file"); return; }
      if (e.key === "Escape" && e.target.matches("[data-fl-q]") && e.target.value) { e.preventDefault(); e.stopPropagation(); F.q = ""; e.target.value = ""; paint(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const rows = [...host.querySelectorAll(".fl-tree .fl-r")];
      const i = rows.indexOf(document.activeElement);
      if (i < 0 && !e.target.matches("[data-fl-q]")) return;
      e.preventDefault();
      rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
    });
    if (typeof ResizeObserver === "function") new ResizeObserver(() => {
      const w = host.getBoundingClientRect().width >= WIDE;
      if (w !== F.wide) { F.wide = w; paint(); if (w) frontPage(); }
    }).observe(host);
    // no snapping: the list scrolls where you leave it, its end always in reach (it settled every scroll on a 28 px
    // grid its 32 px rows no longer keep, and pulled a scroll to the end back by up to 14 px: the owner, 19 Nov 13:03Z
    // "i am not able to scroll till bottom, its coming back automatically")
  }

  return {
    /** Every file in the place was read further (js/paths.js): Find's list follows. */
    pathsChanged() { if (F.q.trim()) paint(); },
    /** Once: draw inside the Files tab; the viewer moves in beside the tree. */
    mount(host) {
      F.host = host;
      host.innerHTML = `<div class="fl"><nav class="fl-rail" aria-label="Files, folded"><button type="button" class="fl-rb" data-fl-rail="changes">${CHANGED_IC}<em hidden></em></button><button type="button" class="fl-rb" data-fl-rail="all" title="All files">${FOLDER_IC}</button><button type="button" class="fl-rb" data-fl-rail="find" title="Find a file">${ICON.search}</button></nav>` +
        `<div class="fl-tree"></div><div class="fl-split" role="separator" aria-orientation="vertical" aria-label="Resize the file tree" title="Drag to resize · double-click for the default" tabindex="0"></div><div class="fl-pv"><div class="fl-bar"></div><div class="fl-view"></div><p class="fl-empty">Pick a file to read it here.</p></div></div>`;
      const vw = document.getElementById("viewer");
      if (vw) host.querySelector(".fl-view").appendChild(vw);
      M.btn = document.createElement("button");
      M.btn.type = "button"; M.btn.className = "fl-more"; M.btn.title = "More: new, rename, delete, copy path"; M.btn.setAttribute("data-own", "");
      M.btn.setAttribute("aria-haspopup", "menu"); M.btn.setAttribute("aria-expanded", "false");
      M.btn.innerHTML = MORE_IC;
      M.menu = document.createElement("div");
      M.menu.className = "fl-menu"; M.menu.setAttribute("role", "menu"); M.menu.hidden = true;
      document.body.appendChild(M.menu);
      wireMenu(M.menu);
      pointerFollows(M.menu); // the item under the mouse is the active one (C058)
      wire(host);
    },
    show(view) {
      F.shown = true;
      F.wide = F.host.getBoundingClientRect().width >= WIDE;
      setScope(view);
      paint();
      frontPage();
    },
    hide() { F.shown = false; },
    /** Every app render: follow the view (a new scope starts fresh), and the agents' marks. */
    render(view) {
      if (!F.shown) return;
      if (setScope(view)) { if (F.auto || !viewer.hasFile) { if (viewer.hasFile) viewer.close({ restore: false }); F.fileView = false; } frontPage(); }
      if (!viewer.hasFile) { F.sel = null; F.fileView = false; }
      paint();
    },
    reveal,
    /** A file was made or taken away (a new file's Undo): its folder is read again, and focus that had
     *  nowhere to go lands on that folder (or, at the top, on New file). */
    async reread(f) {
      const s = F.scope, local = localIn(s, f);
      if (local == null) return;
      const dir = parentOf(local);
      await load(s, dir, { again: true });
      if (F.scope.key !== s.key || (document.activeElement && document.activeElement !== document.body)) return;
      (dir ? rowOf(dir) : F.host.querySelector("[data-fl-new]"))?.focus({ preventScroll: true });
    },
    /** What agents changed in a view's scope (newest first): {path, rel, project, mark, live, who, tid}. */
    changes(view) {
      const s = scopeOf(view, { thread: (id) => world.thread(id), project: (id) => PROJ(id) });
      return s.project ? touched(s, world, isBusy) : [];
    },
    /** Beside a file: fold the tree to its rail, or open it (mine: you did, so it's kept). */
    fold,
    /** One at a time (a phone): the list in front of the file, or the file again; the file stays open. */
    list(on) { if (F.wide || !viewer.hasFile) return false; F.fileView = !on; paint(); return true; },
    get listing() { return !F.wide && viewer.hasFile && !F.fileView; },
    get folded() { return F.folded; },
    get wide() { return F.wide; },
    /** The file came from you (a click), not from the front page: the panel treats it as yours. */
    get auto() { return F.auto; },
    /** The folder on screen ({label, sub}), or null when it's the list of projects. */
    get place() { return F.shown && F.scope.project ? { label: F.scope.label, sub: F.scope.sub || "" } : null; },
  };
}
