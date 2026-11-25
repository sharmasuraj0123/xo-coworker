// @ts-check

/** @param {readonly {emoji: string, by?: string | null}[] | null | undefined} reactions */
export function reactionGroups(reactions) {
  /** @type {Map<string, {emoji: string, count: number, by: string[]}>} */
  const by = new Map();
  for (const r of reactions || []) {
    const g = by.get(r.emoji) || { emoji: r.emoji, count: 0, by: [] };
    g.count++;
    if (r.by && !g.by.includes(r.by)) g.by.push(r.by);
    by.set(r.emoji, g);
  }
  return [...by.values()];
}


/** @param {{loaded?: boolean, all?: boolean} | null} h @param {readonly ({seq?: number | null} | null)[]} rows */
export function pageFloor(h, rows) {
  if (!h || !h.loaded || h.all) return null;
  let floor = null;
  for (const r of rows || []) if (r && r.seq != null && (floor == null || r.seq < floor)) floor = r.seq;
  return floor;
}

/** @param {{who?: string, seq?: number | null, at: number, turn?: {lastSeq?: number}} | null} item @param {number | null} floor @param {number | null} [floorAt] */
export function inPage(item, floor, floorAt = null) {
  if (floor == null || !item || item.who === "hist") return true;
  if (item.seq == null) return floorAt == null || !(item.at < floorAt);
  const s = item.who === "turn" && item.turn ? (item.turn.lastSeq ?? item.seq) : item.seq;
  return s >= floor;
}

/** @param {{who?: string, id?: string, seq?: number | null} | null} m @param {{status?: string, seq?: number | null, wakes?: string[]} | null} turn */
export function waitsForTurn(m, turn) {
  return !!(turn && turn.status === "running" && m && m.who === "you" && m.id && m.seq != null && turn.seq != null &&
    m.seq > turn.seq && !(turn.wakes || []).includes(`msg:${m.id}`));
}

/** @typedef {{who: string, id: string, text: string, files?: readonly unknown[], at: number}} EchoRow */

/** @param {readonly (EchoRow & {merged?: boolean, status?: string})[]} locals @param {readonly EchoRow[]} rows @param {Set<string>} [taken] */
export function echoes(locals, rows, taken = new Set()) {
  const out = new Map();
  const free = rows.filter((r) => r.who === "you" && !taken.has(r.id));
  for (const m of locals) {
    if (m.merged || m.status === "failed" || m.who !== "you") continue;
    const i = free.findIndex((r) => r.text === m.text && (r.files || []).length === (m.files || []).length && r.at >= m.at - 60000);
    if (i < 0) continue;
    out.set(m.id, free[i].id);
    free.splice(i, 1);
  }
  return out;
}


/** @param {{ by?: string | null, reason?: string | null } | null | undefined} stop */
export function stopWords(stop) {
  if (!stop) return "";
  const who = stop.by === "you" ? "Stopped by you" : stop.by === "workspace" ? "Stopped by the workspace coordinator" : stop.by === "coordinator" ? "Stopped by the coordinator" : "Stopped";
  return stop.reason ? `${who} · ${stop.reason}` : who;
}

/** @param {readonly {id: string, who: string}[]} msgs @param {Iterable<string>} threadIds */
export function threadAnchors(msgs, threadIds) {
  const ids = new Set(threadIds);
  const on = new Map();
  const alone = new Set();
  msgs.forEach((m, i) => {
    if (!ids.has(m.id)) return;
    let at = null;
    for (let j = i + 1; j < Math.min(msgs.length, i + 4); j++) {
      const n = msgs[j];
      if (ids.has(n.id)) break;
      if (n.who === "coord") { at = n.id; break; }
    }
    if (at) on.set(at, [...(on.get(at) || []), m.id]);
    else alone.add(m.id);
  });
  return { on, alone };
}

/** @param {string | null} text @param {readonly {id: string, name?: string}[] | null} projects */
export function parseTarget(text, projects) {
  const prose = String(text || "").replace(/```[\s\S]*?(?:```|$)/g, " ").replace(/`[^`\n]*`/g, " ");
  const re = /(^|\s)@([\w.-]+)/g;
  for (let m; (m = re.exec(prose)); ) {
    const word = m[2].replace(/[.-]+$/, "");
    const q = word.toLowerCase();
    const p = q && (projects || []).find((x) => x.id.toLowerCase() === q || String(x.name || "").toLowerCase() === q);
    if (p) return { pid: p.id, token: word };
  }
  return { pid: null, token: null };
}

/** @param {string | null} text @param {string | null} token */
export function stripTarget(text, token) {
  if (!token) return String(text || "").trim();
  const re = new RegExp(`(^|\\s)@${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![.-]*\\w)\\s?`);
  return String(text || "").replace(re, "$1").trim();
}

/** @template {{at: number}} Prompt @template {{at: string, wakes?: unknown[], origin?: string}} Turn @param {readonly Prompt[]} prompts @param {readonly Turn[]} turns @returns {({kind: "you", m: Prompt} | {kind: "turn", t: Turn})[]} */
export function chatOrder(prompts, turns) {
  const mine = prompts.map((m, i) => ({ m, i })).sort((a, b) => a.m.at - b.m.at || a.i - b.i);
  const taken = new Set();
  /** @param {Turn} t */
  const start = (t) => Date.parse(t && t.at) || 0;
  const groups = turns.map((t, k) => {
    const n = (t.wakes || []).filter((w) => String(w).startsWith("msg:prompt:")).length || (t.origin === "person" ? 1 : 0);
    const lo = k ? start(turns[k - 1]) : -Infinity;
    const hi = k + 1 < turns.length ? start(turns[k + 1]) : Infinity;
    const at = start(t);
    const free = mine.filter((x) => !taken.has(x) && x.m.at >= lo && x.m.at < hi);
    const after = free.filter((x) => x.m.at >= at);
    const before = free.filter((x) => x.m.at < at);
    const pick = n ? (after.length ? after.slice(0, n) : before.slice(-1).concat(after.slice(0, n - 1))) : [];
    for (const x of pick) taken.add(x);
    return /** @type {{at: number, k: number, t: Turn, got: Prompt[], m?: undefined}} */ ({ at, k, t, got: pick.map((x) => x.m) });
  });
  /** @type {{at: number, m: Prompt, t?: undefined, k?: undefined, got?: undefined}[]} */
  const loose = mine.filter((x) => !taken.has(x)).map((x) => ({ at: x.m.at, m: x.m }));
  const all = [...loose, ...groups].sort((a, b) => a.at - b.at || (a.t ? 1 : 0) - (b.t ? 1 : 0) || (a.k ?? 0) - (b.k ?? 0));
  /** @type {({kind: "you", m: Prompt} | {kind: "turn", t: Turn})[]} */
  const out = [];
  for (const x of all) {
    if (!x.t) { out.push({ kind: "you", m: (/** @type {{m: Prompt}} */ (x)).m }); continue; }
    if ((/** @type {Prompt[]} */ (x.got))[0]) out.push({ kind: "you", m: (/** @type {Prompt[]} */ (x.got))[0] });
    out.push({ kind: "turn", t: x.t });
    for (const m of (/** @type {Prompt[]} */ (x.got)).slice(1)) out.push({ kind: "you", m });
  }
  return out;
}
