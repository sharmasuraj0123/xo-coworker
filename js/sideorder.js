// projects at work or needing you on top; it changes only while you're off the sidebar, after a while at work or idle
export function createCalmOrder({ join = 30000, leave = 60000 } = {}) {
  let top = new Set();
  const since = new Map(), idle = new Map();
  function order(rows, now, { first = false, held = false } = {}) {
    const ids = new Set(rows.map((r) => r.id));
    for (const m of [since, idle]) for (const id of m.keys()) if (!ids.has(id)) m.delete(id);
    const want = new Set();
    let next = null;
    const soon = (at) => { const ms = Math.max(0, at - now); if (next == null || ms < next) next = ms; };
    for (const r of rows) {
      if (r.active) { idle.delete(r.id); if (!since.has(r.id)) since.set(r.id, now); }
      else { since.delete(r.id); if (top.has(r.id) && !idle.has(r.id)) idle.set(r.id, now); if (!top.has(r.id)) idle.delete(r.id); }
      let up;
      if (first) up = r.active;
      else if (top.has(r.id)) { up = r.active || now - idle.get(r.id) < leave; if (up && !r.active) soon(idle.get(r.id) + leave); }
      else { up = r.urgent || (r.active && now - since.get(r.id) >= join); if (!up && r.active) soon(since.get(r.id) + join); }
      if (up) want.add(r.id);
    }
    const same = want.size === top.size && [...want].every((id) => top.has(id));
    if (!same && (first || !held)) top = want;
    if (top !== want) for (const id of [...top]) if (!ids.has(id)) top.delete(id);
    return { top: rows.filter((r) => top.has(r.id)).map((r) => r.id), pending: !same && held && !first, next };
  }
  return { order };
}
