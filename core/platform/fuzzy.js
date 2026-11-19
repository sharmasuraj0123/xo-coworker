// @ts-check

// Quick Open's matching, as fzf's: letters in order; starts, separators, capitals, runs and the file's own name score higher.

const SEP = new Set(["/", "\\", "_", "-", ".", " "]);

/** @typedef {{ score: number, hits: number[] }} Match */

/** One path against a query, or null; every space-separated word must match, and one with "/" spans the whole path. @param {string} path @param {string | null | undefined} query @returns {Match | null} */
export function score(path, query) {
  const q = String(query || "").trim();
  if (!q) return { score: 0, hits: [] };
  const words = q.split(/\s+/).filter(Boolean);
  let total = 0;
  const hits = [];
  for (const w of words) {
    const m = scoreWord(path, w);
    if (!m) return null;
    total += m.score;
    hits.push(...m.hits);
  }
  return { score: total - path.length * 0.01, hits: [...new Set(hits)].sort((a, b) => a - b) };
}

/** @param {string} path @param {string} w @returns {Match | null} */
function scoreWord(path, w) {
  const slash = path.lastIndexOf("/");
  const nameStart = slash + 1;
  // try the name alone first (a better match when it's there), then the whole path
  const inName = w.includes("/") ? null : best(path, w, nameStart);
  const whole = best(path, w, 0);
  if (inName && (!whole || inName.score + 8 >= whole.score)) return { score: inName.score + 8, hits: inName.hits };
  return whole;
}

/** The best in-order match of w in path from `from`, by a small dynamic programme over positions. @param {string} path @param {string} w @param {number} from @returns {Match | null} */
function best(path, w, from) {
  const P = path, lp = P.toLowerCase(), lw = w.toLowerCase();
  const n = P.length, m = lw.length;
  if (m > n - from) return null;
  // quick reject: every letter, in order
  let j = 0;
  for (let i = from; i < n && j < m; i++) if (lp[i] === lw[j]) j++;
  if (j < m) return null;
  // dp[k][i]: best score with query letters 0..k matched, letter k at position i
  const NEG = -1e9;
  let prev = new Float64Array(n).fill(NEG);
  const back = [];
  for (let k = 0; k < m; k++) {
    const cur = new Float64Array(n).fill(NEG);
    const from_ = new Int32Array(n).fill(-1);
    let runBest = NEG, runAt = -1;
    for (let i = from; i < n; i++) {
      // the best previous match strictly before i
      if (k > 0 && i - 1 >= from && prev[i - 1] > runBest) { runBest = prev[i - 1]; runAt = i - 1; }
      if (lp[i] !== lw[k]) continue;
      const bonus = charBonus(P, i, from) + (P[i] === w[k] ? 0.5 : 0);
      if (k === 0) { cur[i] = bonus + (i === from ? 4 : 0) - (i - from) * 0.05; continue; }
      // consecutive with the previous letter: a run
      const run = prev[i - 1] > NEG ? prev[i - 1] + bonus + 5 : NEG;
      const gap = runBest > NEG ? runBest + bonus - Math.min(3, (i - runAt - 1) * 0.2) : NEG;
      if (run >= gap && run > NEG) { cur[i] = run; from_[i] = i - 1; }
      else if (gap > NEG) { cur[i] = gap; from_[i] = runAt; }
    }
    back.push(from_);
    prev = cur;
  }
  let end = -1, s = NEG;
  for (let i = from; i < n; i++) if (prev[i] > s) { s = prev[i]; end = i; }
  if (end < 0) return null;
  const hits = new Array(m);
  for (let k = m - 1, i = end; k >= 0; k--) { hits[k] = i; i = back[k][i]; }
  return { score: s, hits };
}

/** @param {string} P @param {number} i @param {number} from */
function charBonus(P, i, from) {
  if (i === from) return 6;
  const c = P[i], p = P[i - 1];
  if (SEP.has(p)) return p === "/" ? 6 : 4;
  if (c >= "A" && c <= "Z" && p >= "a" && p <= "z") return 4; // camelCase
  return 0;
}

/** The paths that match, best first, at most `limit`; without a query, the order given. @param {string[]} paths @param {string | null | undefined} query @returns {(Match & { path: string })[]} */
export function rank(paths, query, limit = 50) {
  const q = String(query || "").trim();
  if (!q) return paths.slice(0, limit).map((path) => ({ path, score: 0, hits: [] }));
  const out = [];
  for (const path of paths) {
    const m = score(path, q);
    if (m) out.push({ path, score: m.score, hits: m.hits });
  }
  out.sort((a, b) => b.score - a.score || a.path.length - b.path.length || (a.path < b.path ? -1 : 1));
  return out.slice(0, limit);
}

/** A path with its matched characters wrapped in <b>, escaped by `esc`. @param {string} path @param {number[] | null | undefined} hits @param {(s: string) => string} esc */
export function marked(path, hits, esc) {
  if (!hits || !hits.length) return esc(path);
  const set = new Set(hits);
  let out = "", run = "", on = false;
  for (let i = 0; i < path.length; i++) {
    const h = set.has(i);
    if (h !== on) { out += on ? `<b>${esc(run)}</b>` : esc(run); run = ""; on = h; }
    run += path[i];
  }
  return out + (on ? `<b>${esc(run)}</b>` : esc(run));
}

/** "file.js:120" or "file.js:120:4" in a Quick Open query: {query, line, col}. @param {string | null | undefined} q */
export function lineOf(q) {
  const m = /** @type {RegExpExecArray} */ (/^(.*?)(?::(\d+))?(?::(\d+))?\s*$/.exec(String(q || "")));
  return { query: m[1], line: m[2] ? +m[2] : null, col: m[3] ? +m[3] : null };
}
