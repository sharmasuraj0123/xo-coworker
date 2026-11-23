// @ts-check

export const JOIN_MS = 10000, LEAVE_MS = 60000;
export function createCalmOrder({ join = JOIN_MS, leave = LEAVE_MS } = {}) {
  /** @type {Set<string>} */
  let top = new Set();
  /** @type {Map<string, number>} */
  const since = new Map(), idle = new Map();
  /** @param {{ id: string, active: boolean, urgent?: boolean }[]} rows @param {number} now */
  function order(rows, now, { first = false, held = false } = {}) {
    const ids = new Set(rows.map((r) => r.id));
    for (const m of [since, idle]) for (const id of m.keys()) if (!ids.has(id)) m.delete(id);
    /** @type {Set<string>} */
    const want = new Set();
    /** @type {number | null} */
    let next = null;
    /** @param {number} at */
    const soon = (at) => { const ms = Math.max(0, at - now); if (next == null || ms < next) next = ms; };
    for (const r of rows) {
      if (r.active) { idle.delete(r.id); if (!since.has(r.id)) since.set(r.id, now); }
      else { since.delete(r.id); if (top.has(r.id) && !idle.has(r.id)) idle.set(r.id, now); if (!top.has(r.id)) idle.delete(r.id); }
      let up;
      if (first) up = r.active;
      else if (top.has(r.id)) { up = r.active || now - /** @type {number} */ (idle.get(r.id)) < leave; if (up && !r.active) soon(/** @type {number} */ (idle.get(r.id)) + leave); }
      else { up = r.urgent || (r.active && now - /** @type {number} */ (since.get(r.id)) >= join); if (!up && r.active) soon(/** @type {number} */ (since.get(r.id)) + join); }
      if (up) want.add(r.id);
    }
    const same = want.size === top.size && [...want].every((id) => top.has(id));
    if (!same && (first || !held)) top = want;
    if (top !== want) for (const id of [...top]) if (!ids.has(id)) top.delete(id);
    return { top: rows.filter((r) => top.has(r.id)).map((r) => r.id), pending: !same && held && !first, next };
  }
  return { order };
}
