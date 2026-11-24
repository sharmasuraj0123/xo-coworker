// @ts-check

// Since you left: what happened in a project's threads while you were away, grouped by what you'd act on first, and when you last looked.

import { gitState } from "../../core/services/git-state.js";
import { DAY_MS, formatDate, startOfDay } from "../../core/platform/time.js";
import { count, plural } from "../../core/platform/words.js";

/** @import {Thread, CatchUpOptions, CatchUpItem} from "./model-types" */

export const AWAY_MS = 8 * 3600 * 1000;
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

/** @param {Thread} t */
export function didLine(t) {
  const sum = String(t.summary || "").replace(/\s+/g, " ").trim();
  if (sum) return sum;
  const h = firstSentence(t.happened);
  if (h) return h;
  const items = (t.checklist && t.checklist.items) || [];
  const done = items.filter((i) => i.state === "done");
  return done.length ? firstSentence(done[done.length - 1].text) : "";
}
/** Plain words from an agent's markdown, up to the end of its first sentence. @param {unknown} md */
export function firstSentence(md) {
  const s = String(md || "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(s);
  return m && m[1].length >= 12 ? m[1] : s;
}

/** @template {Thread} T @param {T[]} threads @param {CatchUpOptions} [opts] */
export function catchUp(threads, { since = NaN, needing = new Set(), trees = new Map() } = {}) {
  /** @type {Map<string, CatchUpItem<T>[]>} */
  const by = new Map(GROUPS.map((g) => [g.id, []]));
  for (const t of threads) {
    const needs = needing.has(t.id);
    if (!needs && !(t.lastAt > since)) continue;
    const git = gitState(trees.get(t.id), t.git || null);
    let g;
    if (needs) g = "needs";
    else if (t.state === "failed") g = "stopped";
    // running work is "still going", a resolved thread's too: the same truth as the sidebar's busy count
    else if (OPEN.has(t.state ?? "") || t.busy === true) g = "going";
    else if (git.group === "unsaved" || git.group === "unpushed" || git.group === "unmerged" || git.group === "shipped") g = git.group;
    else g = "finished";
    by.get(g)?.push({ t, line: didLine(t), git });
  }
  /** @type {(typeof GROUPS[number] & { items: CatchUpItem<T>[] })[]} */
  const groups = [];
  /** @type {Record<string, number>} */
  const counts = {};
  for (const G of GROUPS) {
    const items = (by.get(G.id) ?? []).sort((a, b) => b.t.lastAt - a.t.lastAt);
    counts[G.id] = items.length;
    if (items.length) groups.push({ ...G, items });
  }
  return { groups, counts, total: groups.reduce((s, g) => s + g.items.length, 0) };
}

/** The sentence a colleague would say: "3 finished, 1 not pushed. Nothing needs you." @param {Record<string, number> | null | undefined} counts */
export function headline(counts) {
  /** @type {Record<string, number>} */
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
  const tail = c.needs ? `${c.needs} ${plural(c.needs, "needs", "need")} you.` : "Nothing needs you.";
  return { lead, tail };
}

/** "3 days", "11 hours": how long you were away, for the card's label. @param {number} since @param {number} [now] */
export function awayWord(since, now = Date.now()) {
  const h = Math.max(0, (now - since) / 3600000);
  if (h < 36) return count(Math.max(1, Math.round(h)), "hour");
  return count(Math.round(h / 24), "day");
}

/** The day you left, said the way people say it: "this morning", "yesterday", "Friday", "Oct 28". @param {number} since @param {number} [now] */
export function sinceWord(since, now = Date.now()) {
  const d = new Date(since), n = new Date(now);
  const days = Math.round((startOfDay(n) - startOfDay(d)) / DAY_MS);
  if (days <= 0) return d.getHours() < 12 ? "this morning" : d.getHours() < 18 ? "this afternoon" : "this evening";
  if (days === 1) return "yesterday";
  return formatDate(d, days < 7 ? "fullWeekday" : "monthDay");
}

/** When you last looked, per place ("home", "p:<project>"), kept in a store with get/set (localStorage). @param {Pick<Storage, "getItem" | "setItem">} store @param {string} [key] */
export function createSeen(store, key = "xo-seen") {
  const read = () => { try { return JSON.parse(store.getItem(key) || "{}") || {}; } catch { return {}; } };
  let all = read();
  return {
    /** @param {string} place @returns {number | null} */
    get: (place) => all[place] ?? null,
    /** @param {string} place @param {number} [at] */
    mark(place, at = Date.now()) {
      all = { ...read(), [place]: at };
      try { store.setItem(key, JSON.stringify(all)); } catch { return; }
    },
  };
}
