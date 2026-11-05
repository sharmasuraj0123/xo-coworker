// A project's record: what its threads made, and what happened since you last looked
// (design-research/12). Pure: no DOM, no network, no storage; app.js feeds it the world's threads,
// what needs you and the worktrees, and renders what it returns.
//
// Made, for now, is what threads shared (each thread's `outputs`, which storm keeps as they share).
// A thread has no time per file yet, so a file takes its thread's last activity as its time.
// Git words come from two places. A newer backend gives each thread's branch a `git` state (merged
// and its PR, pushed, unpushed commits; on the thread and on `GET /chat/worktrees`), and only then
// does anything here say "shipped". Without it, `would_lose` on the worktrees still tells "not
// saved" (uncommitted or untracked files) and "not pushed" (commits on no other branch, no remote).
// A newer backend also keeps Made itself (`GET /chat/chats/{chat}/made`, see madeFromServer).
//
// Two titles meet on a made item and are kept apart: `title` is the file's own, in plain words (an agent's
// share_files titles, xo-space 8c6bc03; null when none), shown in place of its `name`; `threadTitle` is the
// title of the thread that made it (its "from" link, and what a search also matches).

export const AWAY_MS = 8 * 3600 * 1000;   // away at least this long, and Since you left speaks
const DAY = 86400000;

const EXT = (name) => ((/\.([\w-]+)$/.exec(String(name || "")) || [])[1] || "").toLowerCase();
const IMG = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"]);
const PAGE = new Set(["html", "htm"]);
const DOC = new Set(["md", "markdown", "txt", "pdf", "rtf", "doc", "docx"]);
const DATA = new Set(["json", "jsonl", "csv", "tsv", "yaml", "yml", "toml", "xml"]);

/** A made file's kind: image, page, doc, data or code. */
export function madeKind(f) {
  const type = String(f.type || "");
  const ext = EXT(f.name || f.path);
  if (type.startsWith("image/") || IMG.has(ext)) return "image";
  if (type === "text/html" || PAGE.has(ext)) return "page";
  if (type === "text/markdown" || type === "application/pdf" || DOC.has(ext)) return "doc";
  if (DATA.has(ext) || type === "application/json" || type === "text/csv") return "data";
  return "code";
}
export const KINDS = [["all", "All"], ["doc", "Docs"], ["image", "Images"], ["page", "Pages"], ["code", "Code"], ["data", "Data"], ["link", "Links"], ["branch", "Branches"]];
export const KIND_WORD = { image: "Image", page: "Page", doc: "Document", data: "Data", code: "Code", link: "Link", branch: "Branch" };

/** A file's own title: one line of words, or null (absent, null or blank all mean none). */
const fileTitle = (t) => (typeof t === "string" && t.trim() ? t.replace(/\s+/g, " ").trim() : null);

/** One key per file per thread, stable across reloads (pins are kept by it). */
export const madeKey = (tid, path) => `${tid}|${path}`;

/**
 * Everything the given threads made, newest first: the latest thread's files first and, within a
 * thread, the file it shared last first. Pinned ones are flagged, not moved (the view groups them).
 * A thread's `outputs` carry each file's title when its agent gave one.
 */
export function madeItems(threads, { pins = new Set() } = {}) {
  const out = [];
  const ts = threads.filter((t) => t.outputs && t.outputs.length).slice().sort((a, b) => b.lastAt - a.lastAt);
  for (const t of ts) {
    const files = t.outputs.slice().reverse();
    files.forEach((f, i) => {
      const path = f.path || f.name;
      if (!path) return;
      const key = madeKey(t.id, path);
      out.push({ key, tid: t.id, project: t.project, threadTitle: t.title || "", title: fileTitle(f.title), path, name: f.name || path.split("/").pop(), type: f.type || "", bytes: f.bytes ?? null,
        kind: madeKind(f), at: t.lastAt - i, pinned: pins.has(key) });
    });
  }
  return out;
}

/**
 * Made as the backend keeps it (`GET /chat/chats/{chat}/made` rows), in the same shape as madeItems:
 * files carry where to read them (`project_id`, `relative_path`), links their `url`, branches their
 * `git`, and a file its `title` (null when none). threadTitle(ts) names the thread that made it; project
 * is the chat's project.
 */
export function madeFromServer(rows, { project, threadTitle = () => "" } = {}) {
  return (rows || []).filter((r) => r && r.id).map((r) => {
    const name = r.name || (r.path || r.url || r.git?.branch || "").split("/").filter(Boolean).pop() || "Untitled";
    const kind = r.kind === "link" ? "link" : r.kind === "branch" ? "branch" : r.kind === "image" ? "image" : madeKind({ name, type: r.mime || "" });
    return { key: r.id, id: r.id, server: true, tid: r.thread_ts || null, project, threadTitle: threadTitle(r.thread_ts) || "", title: fileTitle(r.title), path: r.path || r.relative_path || r.url || name, name,
      type: r.mime || "", bytes: r.bytes ?? null, kind, at: Date.parse(r.updated_at || r.created_at) || 0, pinned: !!r.pinned,
      exists: r.exists !== false, url: r.url || null, git: r.git || null, turn: r.turn_id || null,
      fileProject: r.project_id || null, rel: r.relative_path || null };
  }).sort((a, b) => b.at - a.at);
}

/** Narrow made items by kind and words (its title, name and path, and the title of the thread that made it). */
export function filterMade(items, { kind = "all", q = "" } = {}) {
  const w = String(q || "").trim().toLowerCase();
  return items.filter((m) => (kind === "all" || m.kind === kind) && (!w || `${m.title || ""} ${m.name} ${m.path} ${m.threadTitle || ""}`.toLowerCase().includes(w)));
}

/** Made items in the groups the view shows: Pinned, Today, This week, Earlier (empty ones dropped). */
export function madeGroups(items, now = Date.now()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const today = start.getTime();
  const G = [["pinned", "Pinned", []], ["today", "Today", []], ["week", "This week", []], ["earlier", "Earlier", []]];
  for (const m of items) {
    const g = m.pinned ? 0 : m.at >= today ? 1 : m.at >= today - 6 * DAY ? 2 : 3;
    G[g][2].push(m);
  }
  return G.filter((g) => g[2].length).map(([id, label, list]) => ({ id, label, items: list }));
}

// ── the Artifacts page at any size: filter the whole set, draw only what's near the screen ──────────
// It can grow into thousands, so the page lays the gallery out as lines (a group's heading, a row of cards),
// each at a place worked out from the cards' measured size, and draws only the lines near the screen. The
// filters, the counts and the words always see everything.

/**
 * What the Artifacts page shows: the counts per kind within the chosen project, and the whole set filtered by
 * project, kind and words (`total`), grouped (Pinned, Today, This week, Earlier). Filtering never looks at
 * what's drawn: a match far down the list is found all the same.
 */
export function artsView(all, { pid = "", kind = "all", q = "", now = Date.now() } = {}) {
  const inPj = pid ? all.filter((m) => m.project === pid) : all;
  const counts = Object.fromEntries(KINDS.map(([k]) => [k, 0]));
  counts.all = inPj.length;
  for (const m of inPj) if (m.kind in counts) counts[m.kind]++;
  const list = filterMade(inPj, { kind, q });
  return { counts, total: list.length, groups: madeGroups(list, now) };
}

/**
 * The gallery as lines, top to bottom: each group's heading (`headH` tall), then its cards in rows of `cols`
 * (`cardH` tall, `gap` between rows). A row line holds where its cards start in the group (`start`, `n`).
 * `tail` adds a line of stand-in rows at the end (more is still being read). Returns {lines, height}.
 */
export function galleryLines(groups, { cols = 1, cardH, headH, gap = 0, tail = 0 } = {}) {
  const c = Math.max(1, Math.floor(cols));
  const lines = [];
  let y = 0;
  for (const g of groups) {
    lines.push({ key: `h:${g.id}`, kind: "head", y, h: headH, g });
    y += headH;
    const rows = Math.ceil(g.items.length / c);
    for (let r = 0; r < rows; r++) {
      const start = r * c;
      lines.push({ key: `r:${g.id}:${r}`, kind: "row", y, h: cardH, g, start, n: Math.min(c, g.items.length - start) });
      y += cardH + (r < rows - 1 ? gap : 0);
    }
  }
  if (tail > 0) {
    y += lines.length ? gap : 0;
    const h = tail * cardH + (tail - 1) * gap;
    lines.push({ key: "sk", kind: "tail", y, h, rows: tail });
    y += h;
  }
  return { lines, height: y };
}

/** The lines that reach into [lo, hi] (px from the gallery's top), in order. Lines are sorted by y. */
export function linesIn(lines, lo, hi) {
  // the first line that ends at or below lo (binary search), then on while they start above hi
  let a = 0, b = lines.length;
  while (a < b) { const m = (a + b) >> 1; if (lines[m].y + lines[m].h < lo) a = m + 1; else b = m; }
  const out = [];
  for (let i = a; i < lines.length && lines[i].y <= hi; i++) out.push(lines[i]);
  return out;
}

/**
 * A chat's Made rows after reading a page of them (newest first), kept in one list: the page's rows win over
 * older copies of the same id, and rows older than the page (read before, further back) stay. `first`: the page
 * is the newest (a refresh), so a row newer than the page's oldest that the page doesn't hold (it moved, it went)
 * is dropped. `complete`: the page is everything there is (no older page), so nothing else stays.
 */
export function mergeMadeRows(had, page, { first = false, complete = false } = {}) {
  const fresh = (page || []).filter((r) => r && r.id);
  if (complete || !had || !had.length) return fresh;
  const ids = new Set(fresh.map((r) => r.id));
  const at = (r) => r.updated_at || r.created_at || "";
  const oldest = fresh.length ? fresh.reduce((m, r) => (at(r) < m ? at(r) : m), at(fresh[0])) : "";
  const kept = had.filter((r) => !ids.has(r.id) && !(first && fresh.length && at(r) > oldest));
  return [...fresh, ...kept].sort((a, b) => (at(a) < at(b) ? 1 : at(a) > at(b) ? -1 : 0));
}

/**
 * Where the next older page starts. The Space pages Made by `updated_at` alone (`before` is strict), so rows sharing
 * the last row's second would be skipped; asking from one second later reads them again, and mergeMadeRows drops the
 * repeats by id.
 */
export function olderCursor(nextBefore) {
  const t = Date.parse(nextBefore || "");
  return Number.isFinite(t) ? new Date(t + 1000).toISOString().replace(/\.\d{3}Z$/, "Z") : null;
}

const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/**
 * A thread's git state in words: {group, word, n}. w: its worktree entry (`would_lose`, maybe `git`);
 * git: the branch's state from the thread (a newer backend), used when the worktree has none.
 * Groups: unsaved (uncommitted files), unpushed, unmerged (pushed, not in the default branch),
 * shipped (merged), saved (nothing at risk, nothing to ship), none (nothing known).
 */
export function gitState(w, git = null) {
  const tree = w && w.exists !== false && !w.error ? w : null;
  const lost = tree ? tree.would_lose : null;
  const files = lost ? ((lost.changed && lost.changed.count) || 0) + ((lost.untracked && lost.untracked.count) || 0) : 0;
  if (files) return { group: "unsaved", word: `${plural(files, "file")} not committed`, n: files };
  const g = (w && w.git) || git;
  if (g && typeof g === "object") {
    const pr = g.pr && g.pr.number ? `PR #${g.pr.number}` : "";
    if (g.merged) return { group: "shipped", word: pr ? `merged · ${pr}` : "merged", n: 0, url: g.pr && g.pr.url };
    if (g.commits === 0) return { group: "saved", word: "", n: 0 };
    const unpushed = g.unpushed ?? (g.upstream ? null : g.commits);
    if (unpushed) return { group: "unpushed", word: `${plural(unpushed, "commit")} not pushed`, n: unpushed };
    if (g.upstream && g.upstream.pushed !== false && !g.upstream.gone) {
      if (g.pr && g.pr.state && String(g.pr.state).toLowerCase() === "open") return { group: "unmerged", word: `${pr}${g.pr.draft ? " draft" : ""} open`, n: 0, url: g.pr.url };
      return { group: "unmerged", word: "pushed, no PR", n: 0 };
    }
  }
  if (!tree) return { group: "none", word: "", n: 0 };
  if (lost && lost.commits) return { group: "unpushed", word: `${plural(lost.commits, "commit")} not pushed`, n: lost.commits };
  return { group: "saved", word: "", n: 0 };
}

const GROUPS = [
  { id: "needs", label: "Needs you", why: "waiting on your answer", tone: "amber" },
  { id: "unsaved", label: "Not saved", why: "changes no commit holds yet", tone: "amber" },
  { id: "unpushed", label: "Not pushed", why: "commits on its branch only", tone: "blue" },
  { id: "unmerged", label: "Not merged", why: "pushed, not in the main branch yet", tone: "blue" },
  { id: "stopped", label: "Stopped", why: "", tone: "red" },
  { id: "shipped", label: "Shipped", why: "merged", tone: "green" },
  { id: "finished", label: "Finished", why: "", tone: "quiet" },
  { id: "going", label: "Still going", why: "", tone: "quiet" },
];
const OPEN = new Set(["working", "needs_reply", "needs_approval", "paused"]);

/** One sentence for what a thread did: its card's own line, else its last finished step, else nothing. */
export function didLine(t) {
  const sum = String(t.summary || "").replace(/\s+/g, " ").trim();
  if (sum) return sum;
  const h = firstSentence(t.happened);
  if (h) return h;
  const items = (t.checklist && t.checklist.items) || [];
  const done = items.filter((i) => i.state === "done");
  return done.length ? firstSentence(done[done.length - 1].text) : "";
}
/** Plain words from an agent's markdown, up to the end of its first sentence. */
export function firstSentence(md) {
  const s = String(md || "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(s);
  return m && m[1].length >= 12 ? m[1] : s;
}

/**
 * What happened in these threads since `since` (ms): each thread that moved since, or that needs
 * you, in the group you'd act on first. needing: Set of thread ids that need you; trees: Map thread
 * id → worktree entry. Returns {groups: [{id, label, why, tone, items: [{t, line, git}]}], counts, total}.
 */
export function catchUp(threads, { since, needing = new Set(), trees = new Map() } = {}) {
  const by = new Map(GROUPS.map((g) => [g.id, []]));
  for (const t of threads) {
    const needs = needing.has(t.id);
    if (!needs && !(t.lastAt > since)) continue;
    const git = gitState(trees.get(t.id), t.git || null);
    let g;
    if (needs) g = "needs";
    else if (t.state === "failed") g = "stopped";
    else if (OPEN.has(t.state)) g = "going";
    else if (git.group === "unsaved" || git.group === "unpushed" || git.group === "unmerged" || git.group === "shipped") g = git.group;
    else g = "finished";
    by.get(g).push({ t, line: didLine(t), git });
  }
  const groups = [];
  const counts = {};
  for (const G of GROUPS) {
    const items = by.get(G.id).sort((a, b) => b.t.lastAt - a.t.lastAt);
    counts[G.id] = items.length;
    if (items.length) groups.push({ ...G, items });
  }
  return { groups, counts, total: groups.reduce((s, g) => s + g.items.length, 0) };
}

/** The sentence a colleague would say: "3 finished, 1 not pushed. Nothing needs you." */
export function headline(counts) {
  const c = counts || {};
  const parts = [
    c.shipped && `${c.shipped} shipped`,
    c.finished && `${c.finished} finished`,
    c.unmerged && `${c.unmerged} not merged`,
    c.unpushed && `${c.unpushed} not pushed`,
    c.unsaved && `${c.unsaved} not saved`,
    c.stopped && `${c.stopped} stopped`,
    c.going && `${c.going} still going`,
  ].filter(Boolean);
  const lead = parts.length ? parts.join(", ") + "." : "";
  const tail = c.needs ? `${c.needs} need${c.needs === 1 ? "s" : ""} you.` : "Nothing needs you.";
  return { lead, tail };
}

/** "3 days", "11 hours": how long you were away, for the card's label. */
export function awayWord(since, now = Date.now()) {
  const h = Math.max(0, (now - since) / 3600000);
  if (h < 36) return plural(Math.max(1, Math.round(h)), "hour");
  return plural(Math.round(h / 24), "day");
}

/** The day you left, said the way people say it: "this morning", "yesterday", "Friday", "Oct 28". */
export function sinceWord(since, now = Date.now()) {
  const d = new Date(since), n = new Date(now);
  const day0 = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day0(n) - day0(d)) / DAY);
  if (days <= 0) return d.getHours() < 12 ? "this morning" : d.getHours() < 18 ? "this afternoon" : "this evening";
  if (days === 1) return "yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** When you last looked, per place ("home", "p:<project>"), kept in a store with get/set (localStorage). */
export function createSeen(store, key = "xo-seen") {
  const read = () => { try { return JSON.parse(store.getItem(key) || "{}") || {}; } catch { return {}; } };
  let all = read();
  return {
    get: (place) => all[place] ?? null,
    mark(place, at = Date.now()) {
      all = { ...read(), [place]: at };
      try { store.setItem(key, JSON.stringify(all)); } catch { /* private mode */ }
    },
  };
}
