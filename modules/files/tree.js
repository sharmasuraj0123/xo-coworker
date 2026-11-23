// @ts-check

import { esc, rank, marked } from "../../core/platform/index.js";
import { ICON } from "../../core/ui/icons/names.js";
import { redraw } from "../../core/ui/redraw.js";
import { fileIcon } from "../../core/ui/icons/fileicons.js";
import { countsHtml } from "../../core/ui/components/counts.js";
import { parentOf } from "./scope.js";
import { dot, marksOf, touched } from "./marks.js";
import { dkey } from "./folder-reads.js";

/** @import { FolderRead, FileRow } from "./folder-reads.js" */

/** @import { Touch } from "./marks.js" */

/** @import { TreeDependencies, TreeState, TreeContext, TreeGroup, CachedElement, ProjectScope } from "./tree-types.d.ts" */

const CH = ICON.right;
const BACK = ICON.back;
const NEW_IC = ICON.fileNew;
const TOUCHED = 6;

/** @param {number | null | undefined} n */
const size = (n) => (n == null ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** @param {TreeDependencies} deps */
export function createFilesTree({ F, M, NW, dirs, load, paths, folded, setOf, ops, world, viewer, changes, isBusy, placeNew, moreAt, base }) {
  /** @type {TreeState} */
  const T = { key: null, groups: new Map(), on: null, q: null, changed: 0 }; // groups: folder → {el, sig, open (child groups drawn)}

  /** @param {ProjectScope} s @param {string} local @param {FolderRead | undefined} d @param {ReturnType<typeof marksOf>} marks @param {string} q @param {((p: string) => string) | null} [inner] */
  function rowsHtml(s, local, d, marks, q, inner = null) {
    const depth = local ? local.split("/").length : 0;
    if (d && d.state === "loading" && d.retry) return `<p class="fl-note is-pending" style="--d:${depth}" role="status"><i class="spin" aria-hidden="true"></i>Reading again… <button type="button" class="fl-link" data-fl-retry="${esc(local)}" aria-busy="true" aria-disabled="true">Try again</button></p>`;
    if (!d || (d.state === "loading" && !d.dirs)) return `<p class="fl-note" style="--d:${depth}"><i class="spin" aria-hidden="true"></i>Reading…</p>`;
    if (d.state === "error") return `<p class="fl-note is-err" style="--d:${depth}">${esc(d.error)} <button type="button" class="fl-link" data-fl-retry="${esc(local)}">Try again</button></p>`;
    const open = setOf(s.key);
    const drag = ops(s) ? ' draggable="true"' : "";
    let h = "";
    for (const x of /** @type {FileRow[]} */ (d.dirs)) {
      const on = open.has(x.path);
      if (q && !x.name.toLowerCase().includes(q) && !on) continue;
      h += `<button type="button" class="fl-r is-dir${on ? " is-open" : ""}" style="--d:${depth}"${drag} data-fl-dir="${esc(x.path)}" aria-expanded="${on}"><span class="fl-c">${CH}</span><span class="fl-n">${esc(x.name)}</span>${marks.dirs.has(x.path) ? `<span class="fl-who w-${marks.dirs.get(x.path)}"><i></i></span>` : ""}</button>`;
      if (on && inner) h += `<div class="fl-g" data-fl-g="${esc(x.path)}" data-own>${inner(x.path)}</div>`;
    }
    for (const x of /** @type {FileRow[]} */ (d.files)) {
      if (q && !x.name.toLowerCase().includes(q)) continue;
      const m = marks.files.get(x.path);
      h += `<button type="button" class="fl-r" style="--d:${depth}"${drag} data-fl-file="${esc(x.path)}" data-fl-bytes="${x.bytes ?? ""}" title="${esc(x.path)}"><span class="fl-c fl-i">${fileIcon(x.name)}</span><span class="fl-n">${esc(x.name)}</span>${m ? dot(m) : ""}<span class="fl-sz">${esc(size(x.bytes))}</span></button>`;
    }
    if (!/** @type {FileRow[]} */ (d.dirs).length && !/** @type {FileRow[]} */ (d.files).length) h += `<p class="fl-note" style="--d:${depth}">Empty</p>`;
    return h;
  }

  /** A folder's row, opened or closed in place. @param {HTMLElement} el @param {string} p @param {boolean} on */
  function flip(el, p, on) {
    const b = el.querySelector(`:scope > [data-fl-dir="${CSS.escape(p)}"]`);
    if (b) { b.classList.toggle("is-open", on); b.setAttribute("aria-expanded", String(on)); }
    return b;
  }
  /** @param {string} p */
  const group = (p) => {
    let g = T.groups.get(p);
    if (!g) { const el = document.createElement("div"); el.className = "fl-g"; el.dataset.flG = p; el.setAttribute("data-own", ""); T.groups.set(p, g = { el, sig: null, open: new Set() }); }
    return g;
  };

  /** @param {FolderRead | undefined} d @param {string} local @param {TreeContext} ctx */
  const sigOf = (d, local, ctx) => `${d ? d.v : 0}|${ctx.marks.sig.get(local) || ""}|${ctx.q}|${ctx.q ? (ctx.openIn.get(local) || []).join("\n") : ""}`;
  /** The row that had focus, found again after its rows were drawn anew. @param {HTMLElement | null} had @param {HTMLElement} root */
  function refocus(had, root) {
    if (!had) return;
    if (had.isConnected) { had.focus({ preventScroll: true }); return; }
    const k = had.dataset.flDir != null ? `[data-fl-dir="${CSS.escape(had.dataset.flDir)}"]` : had.dataset.flFile != null ? `[data-fl-file="${CSS.escape(had.dataset.flFile)}"]` : null;
    (/** @type {HTMLElement | null} */ (k && root.querySelector(k)))?.focus({ preventScroll: true });
  }

  /** The whole tree in one go: on a new place, and when the search changes (every folder's rows do). @param {ProjectScope} s @param {TreeContext} ctx */
  function drawAll(s, ctx) {
    const root = /** @type {TreeGroup} */ (T.groups.get("")).el, made = new Map();
    const a = /** @type {HTMLElement | null} */ (document.activeElement), had = a && root.contains(a) ? a : null;
    /** @param {string} p @returns {string} */
    const inner = (p) => {
      const d = dirs.get(dkey(s, p)), g = { el: /** @type {HTMLElement} */ (/** @type {unknown} */ (null)), sig: sigOf(d, p, ctx), open: /** @type {Set<string>} */ (new Set()) };
      made.set(p, g);
      return rowsHtml(s, p, d, ctx.marks, ctx.q, (c) => { g.open.add(c); return inner(c); });
    };
    root.innerHTML = inner("");
    made.get("").el = root;
    for (const el of /** @type {NodeListOf<HTMLElement & {dataset: {flG: string}}>} */ (root.querySelectorAll(".fl-g"))) made.get(el.dataset.flG).el = el;
    T.groups = made;
    refocus(had, root);
  }

  /** @param {ProjectScope} s */
  function drawFound(s) {
    const root = /** @type {TreeGroup} */ (T.groups.get("")).el;
    const e = /** @type {NonNullable<TreeDependencies["paths"]>} */ (paths).of({ project: s.project, base: s.base || "" });
    const all = e.paths || [];
    const hits = rank(all, F.q, 200);
    const rows = hits.map((m) => {
      const name = base(m.path), at = m.path.length - name.length, dir = m.path.slice(0, Math.max(0, at - 1));
      return `<button type="button" class="fl-r is-found" style="--d:0" data-fl-file="${esc(m.path)}" title="${esc(m.path)}"><span class="fl-c fl-i">${fileIcon(name)}</span>` +
        `<span class="fl-n">${marked(name, m.hits.filter((h) => h >= at).map((h) => h - at), esc)}</span><span class="fl-sz">${marked(dir, m.hits.filter((h) => h < dir.length), esc)}</span></button>`;
    }).join("");
    const note = e.state === "loading" ? `<p class="fl-note" role="status"><i class="spin" aria-hidden="true"></i>Reading the files… ${all.length ? `${all.length} so far` : ""}</p>`
      : e.state === "error" ? `<p class="fl-note is-err" role="status">Couldn't read the files here.</p>`
      : !hits.length ? `<p class="fl-note" role="status">No file matches “${esc(F.q.trim())}”</p>`
      : e.truncated ? `<p class="fl-note">Among the first ${all.length} files</p>` : "";
    const a = /** @type {HTMLElement | null} */ (document.activeElement), had = a && root.contains(a) ? a : null;
    redraw(root, rows + note);
    T.groups = new Map([["", /** @type {TreeGroup} */ (T.groups.get(""))]]);
    refocus(had, root);
  }

  /** Bring a folder's group up to date, then the open folders inside it. @param {ProjectScope} s @param {string} local @param {TreeGroup} g @param {TreeContext} ctx */
  function sync(s, local, g, ctx) {
    const d = dirs.get(dkey(s, local));
    const sig = sigOf(d, local, ctx);
    if (g.sig !== sig) {
      const a = /** @type {HTMLElement | null} */ (document.activeElement), had = a && g.el.contains(a) ? a : null;
      redraw(g.el, rowsHtml(s, local, d, ctx.marks, ctx.q));
      g.sig = sig;
      refocus(had, g.el);
    }
    const open = new Set();
    for (const p of ctx.openIn.get(local) || []) {
      const b = flip(g.el, p, true);
      if (!b) continue;
      const c = group(p), at = b.nextElementSibling === M.btn ? /** @type {HTMLElement} */ (M.btn) : b;
      if (at.nextElementSibling !== c.el) at.after(c.el);
      if (!dirs.has(dkey(s, p))) load(s, p);
      open.add(p);
    }
    for (const p of g.open) if (!open.has(p)) { flip(g.el, p, false); T.groups.get(p)?.el.remove(); }
    g.open = open;
    for (const p of open) sync(s, p, /** @type {TreeGroup} */ (T.groups.get(p)), ctx);
  }

  /** @param {ProjectScope} s */
  function headHtml(s) {
    return `<div class="fl-crumb">${F.pick || (F.follow && F.viewKey === "all") ? `<button type="button" class="fl-up" data-fl-unpick title="Your projects">${BACK}</button>` : ""}<b>${esc(s.label)}</b>${s.sub ? `<small title="${s.base ? "A thread's own worktree: its branch" : ""}">${esc(s.sub)}</small>` : ""}</div>` +
      `<div class="fl-find"><label class="fl-q"><span class="sr-only">Find a file</span>${ICON.search}<input data-fl-q placeholder="Find a file" autocomplete="off" spellcheck="false"></label>` +
      `<button type="button" class="fl-add" data-fl-new="" title="New file" aria-label="New file in ${esc(s.label || "this folder")}">${NEW_IC}</button></div>`;
  }
  /** @param {ProjectScope} s @param {Touch[]} tl */
  function secHtml(s, tl) {
    const cs = changes && s.key === F.viewKey ? changes.of(F.view) : null;
    if (cs && cs.state === "ok" && !cs.files.size) { return ""; }
    if (cs && cs.state === "ok") {
      const live = /** @type {NonNullable<TreeDependencies["changes"]>} */ (changes).activity(F.view).live;
      if (folded(s, "changed")) return secHead(s, "changed", `Changed ${s.base ? "in this thread" : "here"}`, cs.files.size) + secHead(s, "all", "All files");
      return secHead(s, "changed", `Changed ${s.base ? "in this thread" : "here"}`, cs.files.size) + [...cs.files.values()].map((f) => {
        const rel = s.base ? `${s.base}/${f.path}` : f.path, on = viewer.hasFile && viewer.file && viewer.file.rel === rel && viewer.file.show === "changes";
        return `<button type="button" class="fl-r is-touch${on ? " is-on" : ""}" style="--d:0" data-fl-change="${esc(rel)}" title="${esc(f.path)}"><span class="fl-c fl-i">${fileIcon(f.path)}</span><span class="fl-n">${esc(f.path)}</span>${live.has(f.path) ? `<span class="fl-who w-live"><i></i>editing now</span>` : f.binary ? "" : countsHtml(f)}</button>`;
      }).join("") + secHead(s, "all", "All files");
    }
    const top = tl.slice(0, TOUCHED);
    if (!top.length) return "";
    return secHead(s, "changed", "Touched by agents", top.length) + (folded(s, "changed") ? "" : top.map((x) => `<button type="button" class="fl-r is-touch" style="--d:0" data-fl-touch="${esc(x.rel)}" title="${esc(`${x.path} · ${x.who}`)}"><span class="fl-c fl-i">${fileIcon(x.path)}</span><span class="fl-n">${esc(x.path)}</span>${dot(x, true)}</button>`).join("")) + secHead(s, "all", "All files");
  }
  /** @param {ProjectScope} s @param {string} part @param {string} words @param {number | null} [n] */
  const secHead = (s, part, words, n = null) => {
    const open = !folded(s, part);
    return `<button type="button" class="fl-sec" data-fl-sec="${part}" aria-expanded="${open}" title="${open ? "Fold" : "Show"} ${esc(words.toLowerCase())}"><span class="fl-c" aria-hidden="true">${CH}</span><span class="fl-sec-t">${esc(words)}</span>${!open && n != null ? `<span class="fl-sec-n">${n}</span>` : ""}</button>`;
  };
  const pickHtml = () => `<div class="fl-head"><div class="fl-crumb"><b>Projects</b></div></div><div class="fl-list">` +
    (world.state.projects || []).filter((p) => p && p.id !== "workspace").map((p) => `<button type="button" class="fl-r is-dir" style="--d:0" data-fl-pick="${esc(p.id)}"><span class="fl-c">${CH}</span><span class="fl-n">${esc(p.name || p.id)}</span>${world.state.threads.some((t) => t.project === p.id && isBusy(t)) ? `<span class="fl-who w-live" title="Agents at work"><i></i></span>` : ""}</button>`).join("") + `</div>`;
  /** @param {CachedElement} node @param {string} html */
  const put = (node, html) => { if (node._h !== html) { node.innerHTML = html; node._h = html; return true; } return false; };

  /** @param {ProjectScope} s @param {CachedElement} tree */
  function paintTree(s, tree) {
    if (s.key === "all") {
      if (T.key !== "all") { T.key = "all"; T.groups = new Map(); T.on = null; tree._h = null; }
      put(tree, pickHtml());
      return;
    }
    if (T.key !== s.key || !tree.firstElementChild) {
      tree.innerHTML = `<div class="fl-head"></div><div class="fl-list"><div class="fl-secs"></div><div class="fl-g" data-fl-g=""></div></div>`;
      tree._h = null; T.key = s.key; T.on = null; T.q = null;
      T.groups = new Map([["", { el: /** @type {HTMLElement} */ (tree.querySelector(".fl-list > .fl-g")), sig: null, open: new Set() }]]);
    }
    const head = /** @type {CachedElement} */ (tree.querySelector(".fl-head"));
    const qi = /** @type {HTMLInputElement} */ (head.querySelector("[data-fl-q]")), typing = qi && document.activeElement === qi ? /** @type {[number, number]} */ ([qi.selectionStart, qi.selectionEnd]) : null;
    if (put(head, headHtml(s)) && typing) { const q2 = /** @type {HTMLInputElement} */ (head.querySelector("[data-fl-q]")); q2.value = F.q; q2.focus(); q2.setSelectionRange(...typing); }
    const q = /** @type {HTMLInputElement} */ (head.querySelector("[data-fl-q]"));
    if (q.value !== F.q) q.value = F.q;
    const tl = touched(s, world, isBusy);
    const cs = changes && s.key === F.viewKey ? changes.of(F.view) : null;
    T.changed = cs && cs.state === "ok" ? cs.files.size : tl.length;
    const finding = !!(paths && F.q.trim());
    const u = F.undo && (!F.undo.s || F.undo.s.key === s.key) ? F.undo : null;
    const undoNote = u ? (u.err ? `<p class="fl-note is-err" role="alert">${esc(u.err)} <button type="button" class="fl-link" data-fl-undo>OK</button></p>` : `<p class="fl-note" role="status">Deleted ${esc(u.name)} <button type="button" class="fl-link" data-fl-undo>Undo</button></p>`) : "";
    const secs = /** @type {CachedElement} */ (tree.querySelector(".fl-secs")), sh = undoNote + (finding ? "" : secHtml(s, tl));
    const allFolded = !finding && sh.includes('data-fl-sec="all"') && folded(s, "all");
    const rootG = /** @type {HTMLElement | null} */ (tree.querySelector(".fl-list > .fl-g"));
    if (rootG && rootG.hidden !== allFolded) rootG.hidden = allFolded;
    if (secs._h !== sh) { redraw(secs, sh); secs._h = sh; }
    const open = setOf(s.key), openIn = new Map();
    for (const p of open) { const at = parentOf(p); if (!openIn.has(at)) openIn.set(at, []); openIn.get(at).push(p); }
    const ctx = { marks: marksOf(tl), open, openIn, q: F.q.trim().toLowerCase() };
    const naming = NW.el && NW.el.contains(document.activeElement) ? NW.el.querySelector("input") : null;
    const onMore = !!M.btn && document.activeElement === M.btn;
    const sel = naming ? /** @type {[number, number]} */ ([naming.selectionStart, naming.selectionEnd]) : null;
    if (finding) { drawFound(s); T.q = ctx.q; }
    else if (T.q !== ctx.q) { drawAll(s, ctx); T.q = ctx.q; } else sync(s, "", /** @type {TreeGroup} */ (T.groups.get("")), ctx);
    placeNew();
    if (naming && naming.isConnected && document.activeElement !== naming) { naming.focus({ preventScroll: true }); naming.setSelectionRange(.../** @type {[number, number]} */ (sel)); }
    if (M.row) { const r = M.row.isConnected ? M.row : rowOf(/** @type {string} */ (M.row.dataset.flDir)); moreAt(r); if (onMore && r) /** @type {HTMLElement} */ (M.btn).focus({ preventScroll: true }); }
    const g = F.sel != null ? T.groups.get(parentOf(F.sel)) : null;
    const want = g ? g.el.querySelector(`:scope > [data-fl-file="${CSS.escape(/** @type {string} */ (F.sel))}"]`) : null;
    if (T.on !== want) T.on?.classList.remove("is-on");
    want?.classList.add("is-on");
    T.on = want;
  }

  const rowOf = (/** @type {string} */ p) => /** @type {HTMLElement | null} */ (T.groups.get(parentOf(p))?.el.querySelector(`:scope > [data-fl-dir="${CSS.escape(p)}"]`) || null);
  return { T, paintTree, rowOf };
}
