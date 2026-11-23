// @ts-check

import { folderOf } from "../../core/services/places.js";

/** @typedef {{id: string, project?: string, worktree?: string, cwd?: string, branch?: string}} ScopeThread */

/** @typedef {{key: string, project?: string, base?: string, label?: string, sub?: string, tid?: string}} FilesScope */

/** @typedef {{project?: string, rel?: string}} FileLocation */

/** The folder a view shows: {key, project, base (the API path of its root), label, sub} or {key: "all"}. @param {string | null | undefined} view @param {{thread: (id: string) => ScopeThread | null | undefined, project: (id: string) => string}} deps @returns {FilesScope} */
export function scopeOf(view, { thread, project }) {
  if (view && view.startsWith("t:")) {
    const t = thread(view.slice(2));
    const f = t && folderOf(t);
    if (f) return { key: `${f.project}|${f.base}`, project: f.project, base: f.base, label: project(f.project), sub: f.base ? t.branch || "its worktree" : "", tid: t.id };
    if (t && t.project && t.project !== "workspace") return { key: `${t.project}|`, project: t.project, base: "", label: project(t.project), sub: "" };
  }
  if (view && view.startsWith("p:")) return { key: `${view.slice(2)}|`, project: view.slice(2), base: "", label: project(view.slice(2)), sub: "" };
  return { key: "all" };
}

/** The folder a file lives in, as a scope: its thread's worktree when it's in one, else its project. @param {FileLocation | null | undefined} f @param {{threads?: readonly (ScopeThread | null)[], project: (id: string) => string}} deps @returns {FilesScope | null} */
export function fileScope(f, { threads, project }) {
  if (!f || !f.project || !f.rel) return null;
  const m = /^(\.xo\/worktrees\/[^/]+)\//.exec(String(f.rel));
  if (!m) return { key: `${f.project}|`, project: f.project, base: "", label: project(f.project), sub: "" };
  const t = (threads || []).find((x) => x && x.project === f.project && String(x.worktree || "").replace(/\/+$/, "").endsWith(`/${m[1]}`));
  return { key: `${f.project}|${m[1]}`, project: f.project, base: m[1], label: project(f.project), sub: (t && t.branch) || "its worktree", tid: t ? t.id : undefined };
}

/** Where a file the viewer opened sits in a scope: its path inside it, or null when it's elsewhere. @param {FilesScope | null | undefined} scope @param {FileLocation | null | undefined} f */
export function localIn(scope, f) {
  if (!scope || !scope.project || !f || f.project !== scope.project || !f.rel) return null;
  const rel = String(f.rel);
  if (scope.base) return rel.startsWith(scope.base + "/") ? rel.slice(scope.base.length + 1) : null;
  return rel.startsWith(".xo/") ? null : rel;
}

/** Paths whose contents Git or an agent may run. */
export const RUNS = /^(?:\.git|\.claude|\.codex|\.agents)(?:\/|$)|^\.mcp\.json$/i;

export const RUNS_SAY = { runs: true, words: "Runs code: Enter makes it anyway", why: "Git or an agent runs what a file here says" };
/** @param {string} n @param {string} dir @param {{files: {name: string}[], dirs: {name: string}[]} | null | undefined} d */
export function newFileSay(n, dir, d, confirm = false) {
  if (!n) return null;
  if (/[/\\]/.test(n)) return { err: true, words: "A name only: no folders" };
  if (n === "." || n === ".." || n.includes("\0")) return { err: true, words: "A file can't be called that" };
  if (d && d.files.some((x) => x.name === n)) return { err: true, words: `${n} is already here` };
  if (d && d.dirs.some((x) => x.name === n)) return { err: true, words: `There's a folder called ${n} here` };
  return confirm || RUNS.test(dir ? `${dir}/${n}` : n) ? RUNS_SAY : null;
}
