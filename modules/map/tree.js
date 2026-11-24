// @ts-check
import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";
import { fileIcon, folderIcon } from "../../core/ui/icons/fileicons.js";
import { apiRel } from "./folders.js";
import { MAP_ICON } from "./icons.js";
import { PAD } from "./layout.js";

/** @import { FileMark } from "../../core/services/types.d.ts" */

/** @import { Directory, MapFolder } from "./folders-types.d.ts" */

/** @import { MapTreeAgent, TreeDeps, TreeFile, TreeNode, TreeScope } from "./tree-types.d.ts" */

const FILE_CAP = 8, DIR_CAP = 14; // boxes a folder shows before "N more"

/** @param {unknown} p */
const base = (p) => String(p || "").replace(/\/+$/, "").split("/").pop();

/** @param {string} p */
export const parentOf = (p) => { const i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); };

/** @param {Map<string, Set<string>>} m @param {string} key */
export const setOf = (m, key) => { if (!m.has(key)) m.set(key, new Set()); return /** @type {Set<string>} */ (m.get(key)); };

/** @param {TreeDeps} options */
export function createMapTree({ M, world, load, folderAt }) {
  /** @param {TreeScope} scope @param {MapFolder} fold @param {Map<string, FileMark>} marks @param {Set<string>} hot */
  function folderTree(scope, fold, marks, hot, auto = true) {
    const opened = setOf(M.opened, scope.key), closed = setOf(M.closed, scope.key), more = setOf(M.more, scope.key);
    /** @param {Set<string>} set @param {string} p */
    const inside = (set, p) => { for (const h of set) if (h === p || h.startsWith(p + "/")) return true; return false; };
    const marked = new Set(marks.keys());
    // Auto-unfold only while the panel can display the drawing at a readable width.
    const roomy = auto;
    const unfoldMarks = roomy && scope.kind === "thread" && marked.size <= 16;
    const autoSet = setOf(M.autoOpen, scope.key);
    /** A folder an agent visited stays open. @param {string} p */
    const isOpen = (p) => { if (opened.has(p)) return true; if (closed.has(p)) return false; if (roomy && (autoSet.has(p) || inside(hot, p) || (unfoldMarks && inside(marked, p)))) { autoSet.add(p); return true; } return false; };
    /** @param {string} local @returns {TreeNode[]} */
    const kids = (local) => {
      load(fold, local);
      const d = /** @type {(Directory & { dirs: TreeFile[], files: TreeFile[] }) | undefined} */ (folderAt(fold, local));
      if (!d || (d.state === "loading" && !d.dirs)) return [{ id: local + "/…", kind: "note", name: "Reading…" }];
      if (d.state === "error") { M.refs.set(local + "/!", { retry: local, fold }); return [{ id: local + "/!", kind: "note", name: `${d.error} · Try again`, btn: true }]; }
      const all = more.has(local);
      // Keep disk order and retain boxes already shown.
      const seen = setOf(M.shown, scope.key);
      /** @param {TreeFile[]} list @param {number} cap */
      const pick = (list, cap) => {
        if (all || list.length <= cap) return list;
        const must = new Set(list.filter((x) => inside(hot, x.path) || inside(marked, x.path) || seen.has(x.path)).map((x) => x.path));
        let room = cap - must.size;
        return list.filter((x) => must.has(x.path) || (room-- > 0));
      };
      const dirs = d.dirs, files = d.files;
      const sd = pick(dirs, DIR_CAP), sf = pick(files, FILE_CAP);
      for (const x of sd) seen.add(x.path);
      for (const x of sf) seen.add(x.path);
      /** @type {TreeNode[]} */
      const out = [];
      for (const c of sd) {
        const open = isOpen(c.path);
        M.refs.set(c.path, { toggle: c.path, open });
        out.push({ id: c.path, kind: "dir", name: c.name, open, dot: !open && (inside(hot, c.path) ? "hot" : inside(marked, c.path) ? "mark" : ""), children: open ? kids(c.path) : [] });
      }
      for (const f of sf) {
        const m = marks.get(f.path);
        if (!m || m.mark !== "deleted") M.refs.set(f.path, { open: { name: f.name, path: f.path, project: fold.project, rel: apiRel(fold, f.path) } });
        out.push({ id: f.path, kind: "file", name: f.name, mark: m ? m.mark : "" });
      }
      // a deleted file isn't on disk any more, but the diagram still says it went
      for (const [p, m] of marks) if (m.mark === "deleted" && parentOf(p) === local && !d.files.some((f) => f.path === p)) out.push({ id: p, kind: "file", name: base(p), mark: "deleted" });
      const hidden = dirs.length - sd.length + files.length - sf.length;
      if (hidden > 0) { M.refs.set(local + "/+", { more: local }); out.push({ id: local + "/+", kind: "more", name: `${hidden} more` }); }
      if (!out.length) out.push({ id: local + "/∅", kind: "note", name: "Empty" });
      return out;
    };
    const name = (world.project(fold.project) || {}).name || fold.project;
    return { id: "", kind: "root", name, title: scope.kind === "thread" && fold.base ? `${name}, its own worktree` : name, children: kids("") };
  }

  /** @param {MapTreeAgent[]} ags */
  function projectsTree(ags) {
    /** @type {Map<string, MapTreeAgent[]>} */
    const by = new Map();
    for (const a of ags) { const k = a.project || "workspace"; if (!by.has(k)) by.set(k, []); (/** @type {MapTreeAgent[]} */ (by.get(k))).push(a); }
    const ps = world.state.projects.filter((p) => p.kind === "project" || by.has(p.id));
    ps.sort((a, b) => (by.has(b.id) ? 1 : 0) - (by.has(a.id) ? 1 : 0));
    const children = ps.map((p) => {
      const id = "p:" + p.id;
      M.refs.set(id, { go: p.id === "workspace" ? "ws" : id });
      /** @type {Map<string, TreeNode>} */
      const files = new Map();
      for (const a of by.get(p.id) || []) if (a.path && a.fold) {
        const fid = `${id}|${a.fold.base}|${a.path}`;
        if (!files.has(fid)) { files.set(fid, { id: fid, kind: "file", name: a.path.split("/").slice(-2).join("/"), title: a.path }); M.refs.set(fid, { open: { name: base(a.path), path: a.path, project: a.fold.project, rel: apiRel(a.fold, a.path) } }); }
        a.node = fid;
      }
      for (const a of by.get(p.id) || []) if (!a.node) a.node = id;
      return { id, kind: "project", name: p.id === "workspace" ? "Workspace" : p.name || p.id, children: [...files.values()] };
    });
    return { id: "@", kind: "root", name: "Your projects", children };
  }

  /** @param {TreeNode & { x: number, y: number }} n @param {Map<string, string>} at */
  function boxHtml(n, at) {
    const here = at.get(n.id);
    const cls = `dg-n k-${n.kind}${n.mark ? ` m-${n.mark}` : ""}${n.open ? " is-open" : ""}${here ? " is-here" : ""}`;
    const ic = n.kind === "root" ? (M.scope.kind === "all" ? MAP_ICON : M.scope.kind === "thread" ? ICON.branch : ICON.project)
      : n.kind === "project" ? ICON.project : n.kind === "dir" ? folderIcon(n.open)
      : n.kind === "file" ? fileIcon(n.name) : n.kind === "more" ? ICON.plus : n.btn ? ICON.retry : `<i class="spin" aria-hidden="true"></i>`;
    const tail = n.kind === "dir" ? (n.dot ? `<i class="dg-dot d-${n.dot}" aria-hidden="true"></i>` : "") + `<span class="dg-ch" aria-hidden="true">${ICON.chevron}</span>`
      : n.mark && n.mark !== "read" ? `<span class="dg-mk">${n.mark}</span>` : "";
    const style = `left:${n.x + PAD}px;top:${n.y + PAD}px${here ? `;--c:${here}` : ""}`;
    const inner = `<span class="dg-ic">${ic}</span><span class="dg-t">${esc(n.name)}${n.sub ? `<small>${esc(n.sub)}</small>` : ""}</span>${tail}`;
    const clickable = M.refs.has(n.id) || n.kind === "more";
    const label = n.kind === "dir" ? `${n.name}, folder, ${n.open ? "open" : "folded"}` : n.kind === "file" ? `${n.title || n.name}${n.mark && n.mark !== "read" ? `, ${n.mark}` : ""}, open it` : n.name;
    return clickable
      ? `<button type="button" class="${cls}" style="${style}" data-node="${esc(n.id)}" aria-label="${esc(label)}" title="${esc(n.title || n.id || n.name)}"${n.kind === "dir" ? ` aria-expanded="${!!n.open}"` : ""}>${inner}</button>`
      : `<div class="${cls}" style="${style}">${inner}</div>`;
  }
  return { folderTree, projectsTree, boxHtml };
}
