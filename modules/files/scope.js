// @ts-check

import { folderOf } from "../../core/services/places.js";

/** @typedef {import("../../core/services/file-scope-types.d.ts").ScopeThread} ScopeThread */

/** @typedef {import("../../core/services/file-scope-types.d.ts").FileScope} FilesScope */

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

/** Paths whose contents Git or an agent may run. */
export const RUNS = /^(?:\.git|\.claude|\.codex|\.agents)(?:\/|$)|^\.mcp\.json$/i;

export const RUNS_SAY = { runs: true, words: "Runs code: Enter makes it anyway", why: "Git or an agent runs what a file here says" };

/** @param {string} p */
export const parentOf = (p) => { const i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); };
/** @param {string} n @param {string} dir @param {{files: {name: string}[], dirs: {name: string}[]} | null | undefined} d */
export function newFileSay(n, dir, d, confirm = false) {
  if (!n) return null;
  if (/[/\\]/.test(n)) return { err: true, words: "A name only: no folders" };
  if (n === "." || n === ".." || n.includes("\0")) return { err: true, words: "A file can't be called that" };
  if (d && d.files.some((x) => x.name === n)) return { err: true, words: `${n} is already here` };
  if (d && d.dirs.some((x) => x.name === n)) return { err: true, words: `There's a folder called ${n} here` };
  return confirm || RUNS.test(dir ? `${dir}/${n}` : n) ? RUNS_SAY : null;
}
