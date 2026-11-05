// What a place changed, from Space (design-research/2026-11-vision/pierre): a thread's worktree against where
// its branch left the default branch, uncommitted work included; a project's own checkout against its HEAD.
// GET /api/xo-projects/{p}/changes[?worktree=<name>] gives every file with its +/− counts and git's patch.
//
// It's read when a place opens, and again after each edit an agent finishes there (one read per tool call,
// never per keystroke): the turns the stream already brings say when (an edit row turning done). One read
// in flight per place; edits that land meanwhile get one more read after it. The patches warm the diff
// library while the browser is idle (js/diffview.js prefetch), so the first click draws at once.
//
// Until Space has the route (a bare 404), places say "unsupported" and the UI keeps today's list.
//
// app.js calls: sync (every render), of, entry, forTarget, patch, activity.

import { api } from "./api.js";
import { folderOf, placeOf } from "./map.js";
import { prefetch } from "./diffview.js";

const EDITS = new Set(["create_file", "edit_file", "delete_file"]);
const QUIET = 250; // ms: edits that finish together are read once

/** The place a view's changes come from: {key, project, worktree (its folder name) | null, root, tid?}. */
export function scopeOf(view, world) {
  if (view && view.startsWith("t:")) {
    const t = world.thread(view.slice(2));
    const f = t && folderOf(t);
    if (f) return { key: `${f.project}|${f.base}`, project: f.project, worktree: f.base ? f.base.split("/").pop() : null, root: f.root, tid: t.id };
    return null;
  }
  if (view && view.startsWith("p:")) return { key: `${view.slice(2)}|`, project: view.slice(2), worktree: null, root: null };
  return null;
}

/**
 * What agents are doing to files in a scope, from the turns on hand: sig (changes when an edit finishes),
 * busy, live (paths being edited right now), last (the path an agent edited last), by path relative to the
 * scope's root. Pure.
 */
export function activityIn(scope, threads, turns) {
  const out = { sig: "", busy: false, live: new Set(), last: null };
  if (!scope || !turns) return out;
  let done = 0, seq = 0, lastSeq = -1;
  for (const t of threads) {
    if (!t || !t.sessionId) continue;
    const f = folderOf(t);
    if (!f || `${f.project}|${f.base}` !== scope.key) continue;
    for (const tu of turns.list((x) => x.session === t.sessionId)) {
      const running = tu.status === "running";
      if (running) out.busy = true;
      for (const b of turns.blocksOf(tu)) {
        if (b.type !== "activity") continue;
        for (const r of b.rows || []) {
          seq++;
          if (!EDITS.has(r.kind) || !r.target) continue;
          const at = placeOf(f.root, r.target);
          if (!at || at.rel == null) continue;
          const on = running && r.status === "running";
          if (on) out.live.add(at.rel);
          if (r.status === "ok") done++;
          if ((on || r.status === "ok") && seq > lastSeq) { lastSeq = seq; out.last = at.rel; }
        }
      }
    }
  }
  out.sig = `${done}`;
  return out;
}

export function createChanges({ world, onChange }) {
  const P = new Map();     // scope key → {state, data, files: Map(path → file), total, sig, inflight, again, timer, err}
  const NO = new Set();    // projects whose Space has no /changes yet
  let memo = null;         // this render's activity: {k, a}
  const one = new Map();   // `${key}|${path}|${computed_at}` → Promise(patch) for files the list sent without one

  const placeOf_ = (key) => { if (!P.has(key)) P.set(key, { state: "idle", data: null, files: new Map(), total: { add: 0, del: 0 }, sig: null, inflight: false, again: false, timer: 0 }); return P.get(key); };

  async function read(s, p) {
    if (p.inflight) { p.again = true; return; }
    p.inflight = true; p.again = false;
    if (p.state === "idle") p.state = "loading";
    try {
      const d = await api.projectChanges(s.project, s.worktree ? { worktree: s.worktree } : {});
      const files = new Map();
      let add = 0, del = 0;
      for (const f of d.files || []) { files.set(f.path, f); add += f.additions || 0; del += f.deletions || 0; }
      Object.assign(p, { state: "ok", data: d, files, total: { add, del }, err: null });
      // the library and each language's patterns get ready while the browser is idle
      prefetch([...files.values()].filter((f) => f.patch).slice(0, 12).map((f) => ({ path: f.path, patch: f.patch })));
    } catch (err) {
      if (err.status === 404 && err.code === "http_404") { NO.add(s.project); p.state = "unsupported"; }
      else if (p.state !== "ok") { p.state = "error"; p.err = err.status === 404 ? "This folder isn't there any more." : err.message || "Couldn't read what changed."; }
    }
    p.inflight = false;
    onChange && onChange();
    if (p.again) read(s, p);
  }

  function patchIn(s, path) {
    const p = s && P.get(s.key), f = p && p.files.get(path);
    if (!f) return Promise.resolve(null);
    if (f.patch) return Promise.resolve(f.patch);
    if (f.patch_omitted !== "response_budget") return Promise.resolve(null);
    const k = `${s.key}|${path}|${p.data.computed_at}`;
    if (!one.has(k)) one.set(k, api.projectChanges(s.project, { ...(s.worktree ? { worktree: s.worktree } : {}), path }).then((d) => (d.files || []).find((x) => x.path === path)?.patch || null).catch((e) => { one.delete(k); throw e; }));
    return one.get(k);
  }

  return {
    /** Every render: read a place when it opens and after each edit an agent finishes there. */
    sync(view) {
      const s = scopeOf(view, world);
      memo = null;
      if (!s || NO.has(s.project)) return;
      const p = placeOf_(s.key);
      const a = this.activity(view);
      if (p.sig === a.sig && p.state !== "idle") return;
      const first = p.sig == null;
      p.sig = a.sig;
      clearTimeout(p.timer);
      if (first) read(s, p);
      else p.timer = setTimeout(() => read(s, p), QUIET);
    },
    /** A view's changes: {state: idle|loading|ok|error|unsupported, files, total, data, err}, or null. */
    of(view) {
      const s = scopeOf(view, world);
      if (!s) return null;
      if (NO.has(s.project)) return { state: "unsupported", files: new Map(), total: { add: 0, del: 0 } };
      return placeOf_(s.key);
    },
    /** One file's entry in a view's changes, by its path in the place. */
    entry(view, path) { const p = this.of(view); return p && p.state === "ok" ? p.files.get(path) || null : null; },
    /** A file an agent's step names (absolute, or relative to the place), as {path, file} when it changed. */
    forTarget(view, target) {
      const s = scopeOf(view, world), p = this.of(view);
      if (!s || !p || p.state !== "ok") return null;
      const at = s.root ? placeOf(s.root, target) : { rel: String(target || "").replace(/^\.\//, "") };
      const rel = at && at.rel;
      return rel && p.files.has(rel) ? { path: rel, file: p.files.get(rel) } : null;
    },
    /** git's patch for one file in a view's place: the list's, or read on its own when the list left it out. */
    patch(view, path) { return patchIn(scopeOf(view, world), path); },
    /**
     * A project file (its project-relative path, a worktree's included) in its place's changes: {scope, path,
     * file, base} (base: the commit its change is against), or null when that place didn't change it.
     */
    at(project, rel) {
      const m = /^(\.xo\/worktrees\/[^/]+)\/(.+)$/.exec(String(rel || ""));
      const base = m ? m[1] : "", path = m ? m[2] : String(rel || "");
      const key = `${project}|${base}`, p = P.get(key);
      if (!p || p.state !== "ok" || !p.files.has(path)) return null;
      return { scope: { key, project, worktree: base ? base.split("/").pop() : null, base }, path, file: p.files.get(path), base: p.data.base_commit };
    },
    patchAt(c) { return patchIn(c.scope, c.path); },
    /** What agents are doing in a view's place right now (see activityIn); worked out once per render. */
    activity(view) {
      const s = scopeOf(view, world), k = s ? s.key : "";
      if (!memo || memo.k !== k) memo = { k, a: activityIn(s, world.state.threads, world.state.turns) };
      return memo.a;
    },
    scope: (view) => scopeOf(view, world),
  };
}
