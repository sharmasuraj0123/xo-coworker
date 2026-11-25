// @ts-check
import { folderOf } from "./places.js";

/** @import { FileLocation, ScopeThread, FileScope as FilesScope } from "./file-scope-types" */

/** @typedef {{ threads?: readonly (ScopeThread | null)[], project(id: string): string }} FileScopeContext */

/** @param {FileLocation | null | undefined} f @param {FileScopeContext} deps @returns {FilesScope | null} */
export function fileScope(f, { threads, project }) {
  if (!f || !f.project || !f.rel) return null;
  const m = /^(\.xo\/worktrees\/[^/]+)\//.exec(String(f.rel));
  if (!m) return { key: `${f.project}|`, project: f.project, base: "", label: project(f.project), sub: "" };
  const t = (threads || []).find((x) => x && x.project === f.project && String(x.worktree || "").replace(/\/+$/, "").endsWith(`/${m[1]}`));
  return { key: `${f.project}|${m[1]}`, project: f.project, base: m[1], label: project(f.project),
    sub: t?.branch || "its worktree", tid: t?.id };
}

/** @param {FilesScope | null | undefined} scope @param {FileLocation | null | undefined} f */
export function localIn(scope, f) {
  if (!scope || !scope.project || !f || f.project !== scope.project || !f.rel) return null;
  const rel = String(f.rel);
  if (scope.base) return rel.startsWith(scope.base + "/") ? rel.slice(scope.base.length + 1) : null;
  return rel.startsWith(".xo/") ? null : rel;
}

/** @typedef {{ thread(id: string): ScopeThread | null | undefined, project(id: string): string }} ViewScopeContext */

/** @param {string | null | undefined} view @param {ViewScopeContext} context @returns {FilesScope} */
export function scopeOf(view, { thread, project }) {
  if (view && view.startsWith("t:")) {
    const t = thread(view.slice(2));
    const f = t && folderOf(t);
    if (f) return { key: `${f.project}|${f.base}`, project: f.project, base: f.base, label: project(f.project),
      sub: f.base ? t.branch || "its worktree" : "", tid: t.id };
    if (t?.project && t.project !== "workspace") return {
       key: `${t.project}|`, project: t.project, base: "", label: project(t.project), sub: "" };
  }
  if (view && view.startsWith("p:")) return {
    key: `${view.slice(2)}|`, project: view.slice(2), base: "", label: project(view.slice(2)), sub: "" };
  return { key: "all" };
}
