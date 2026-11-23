// Every file in a place, as a flat list of paths (⌘P, the tree's Find): Space's GET /coworker/xo-projects/{id}/paths
// (git ls-files -co --exclude-standard, worktree-aware; SPACE-CONTRACT.md §4.6) when it has it, otherwise walked
// from /tree a folder at a time in the background, skipping what nobody searches (.git, node_modules…). Kept per
// place and refreshed when files come and go (Space's file.version create/delete/rename), never on a keystroke.

import { missingRoute } from "./api.js";

const SKIP = new Set([".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".next", ".cache", ".xo"]);
const WALK_MAX = 20000; // paths walked from /tree before it stops (says so: truncated)
const WALK_PARALLEL = 4;

/**
 * Paths for places. api: {projectPaths?(project, {worktree, stamp}), projectTree(project, rel)}. A place is
 * {project, base} (base: "" or ".xo/worktrees/<name>"). onChange(place) when a place's list grows or changes.
 */
export function createPaths({ api, onChange = () => {} }) {
  const P = new Map(); // key → {state: "idle"|"loading"|"ok"|"error", paths: [], truncated, stamp, via, gen}
  let routeMissing = false;
  const keyOf = (pl) => `${pl.project}|${pl.base || ""}`;
  const entry = (pl) => { const k = keyOf(pl); if (!P.has(k)) P.set(k, { state: "idle", paths: [], truncated: false, stamp: null, via: null, gen: 0 }); return P.get(k); };

  async function load(pl, { force = false } = {}) {
    const e = entry(pl);
    if (e.state === "loading" || (e.state === "ok" && !force)) return e;
    const my = ++e.gen;
    e.state = "loading";
    const worktree = pl.base ? pl.base.split("/").pop() : null;
    if (!routeMissing && api.projectPaths) {
      try {
        const r = await api.projectPaths(pl.project, { worktree, stamp: force ? e.stamp : null });
        if (my !== e.gen) return e;
        if (!r.unchanged) Object.assign(e, { paths: r.paths || [], truncated: !!r.truncated, stamp: r.stamp || null });
        Object.assign(e, { state: "ok", via: "paths" });
        onChange(pl);
        return e;
      } catch (err) {
        // a Space without the route answers a bare 404 (no code); the route's own 404s say what isn't there
        if (missingRoute(err)) routeMissing = true;
        else { e.state = "error"; onChange(pl); return e; }
      }
    }
    // today's Space: walk /tree, folder by folder, several at once; the list fills as it goes
    e.via = "tree"; e.paths = []; e.truncated = false;
    const queue = [""], out = [];
    let shown = 0;
    const one = async () => {
      while (queue.length && my === e.gen) {
        const rel = queue.shift();
        let d;
        try { d = await api.projectTree(pl.project, [pl.base, rel].filter(Boolean).join("/")); } catch { continue; }
        for (const f of d.files || []) out.push(rel ? `${rel}/${f.name}` : f.name);
        for (const x of d.dirs || []) if (!SKIP.has(x.name)) queue.push(rel ? `${rel}/${x.name}` : x.name);
        if (out.length >= WALK_MAX) { e.truncated = true; queue.length = 0; }
        if (out.length - shown > 500) { shown = out.length; e.paths = out.slice().sort(); onChange(pl); }
      }
    };
    await Promise.all(Array.from({ length: WALK_PARALLEL }, one));
    if (my !== e.gen) return e;
    e.paths = out.sort(); e.state = "ok";
    onChange(pl);
    return e;
  }

  return {
    /** The place's paths as far as they're known: {state, paths, truncated, via}; starts reading when idle. */
    of(pl) { const e = entry(pl); if (e.state === "idle") load(pl); return e; },
    load,
    /** A file came, went or moved in a place (Space's events): the list changes in place, and is read again later. */
    changed(pl, { kind, path, old_path }) {
      const e = P.get(keyOf(pl));
      if (!e || e.state !== "ok") return;
      const has = (p) => e.paths.includes(p);
      if (kind === "create" && path && !has(path)) e.paths = [...e.paths, path].sort();
      else if (kind === "delete" && path) e.paths = e.paths.filter((p) => p !== path);
      else if (kind === "rename" && path) e.paths = [...e.paths.filter((p) => p !== old_path && p !== path), path].sort();
      else return;
      onChange(pl);
    },
    /** Forget a place (its list is read again next time). */
    drop(pl) { P.delete(keyOf(pl)); },
    get routeMissing() { return routeMissing; },
  };
}
