// Your edit and an agent's, merged (Files › Edit, design-research/2026-11-vision/pierre row 10). When a save
// finds the file changed since you started (Space's 409 file_changed), the two versions are merged against
// the one you started from: a change only one side made is taken as it is; where both changed the same lines
// differently, the place is marked as git marks a conflict, for Pierre's merge view, where you choose Keep
// yours · Take the agent's · Keep both. Nothing is ever dropped silently. Pure; line endings are kept as they
// are, each line with its own.

/** Lines with their own endings ("a\r\n", "b\n", a last one without). */
export const linesOf = (t) => String(t).match(/[^\n]*\n|[^\n]+$/g) || [];

/**
 * The blocks of lines that turn a into b (Myers' diff on whole lines): [{aStart, aEnd, bStart, bEnd}], in
 * order, a[aStart..aEnd) replaced by b[bStart..bEnd).
 */
export function changes(a, b) {
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  const N = ea - s, M = eb - s;
  if (!N && !M) return [];
  if (!N || !M) return [{ aStart: s, aEnd: ea, bStart: s, bEnd: eb }];
  const A = (i) => a[s + i], B = (j) => b[s + j];
  const max = N + M, off = max + 1, trace = [];
  const v = new Int32Array(2 * max + 3);
  search: for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < N && y < M && A(x) === B(y)) { x++; y++; }
      v[off + k] = x;
      if (x >= N && y >= M) break search;
    }
  }
  // back from the end: the matched lines, then the gaps between them are the changes
  const same = [];
  let x = N, y = M;
  for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d--) {
    const t = trace[d], k = x - y;
    const pk = k === -d || (k !== d && t[off + k - 1] < t[off + k + 1]) ? k + 1 : k - 1;
    const px = Math.max(0, t[off + pk]), py = px - pk;
    while (x > px && y > py) { x--; y--; same.push([x, y]); }
    x = px; y = py;
  }
  same.reverse();
  const out = [];
  let ai = 0, bi = 0;
  for (const [mx, my] of [...same, [N, M]]) {
    if (mx > ai || my > bi) out.push({ aStart: s + ai, aEnd: s + mx, bStart: s + bi, bEnd: s + my });
    ai = mx + 1; bi = my + 1;
  }
  return out;
}

/**
 * base: the file when you started editing; ours: yours; theirs: the agent's (what's there now). Returns
 * {text, conflicts}: the merged text, with each place both changed differently marked as git marks one
 * (<<<<<<< yours, =======, >>>>>>> the agent's), and how many such places there are.
 */
export function merge3(base, ours, theirs, { mine = "yours", other = "the agent's" } = {}) {
  const O = linesOf(base), A = linesOf(ours), B = linesOf(theirs);
  const eol = (String(theirs).match(/\r\n/g) || []).length > (String(theirs).match(/(?<!\r)\n/g) || []).length ? "\r\n" : "\n";
  const blocks = [...changes(O, A).map((c) => ({ ...c, side: A })), ...changes(O, B).map((c) => ({ ...c, side: B }))]
    .sort((p, q) => p.aStart - q.aStart || p.aEnd - q.aEnd);
  // places: blocks that overlap in the base, either side's, are one place; so are lines added at the very
  // place the other side changed (an edit of the line next to another's edit is two places: both are kept)
  const places = [];
  for (const c of blocks) {
    const g = places[places.length - 1];
    if (g && (c.aStart < g.end || (c.aStart === g.end && (c.aStart === c.aEnd || g.start === g.end)))) { g.blocks.push(c); g.end = Math.max(g.end, c.aEnd); }
    else places.push({ start: c.aStart, end: c.aEnd, blocks: [c] });
  }
  const side = (g, X) => { // the place's base lines with one side's changes made
    const out = [];
    let at = g.start;
    for (const c of g.blocks.filter((b) => b.side === X)) { out.push(...O.slice(at, c.aStart), ...X.slice(c.bStart, c.bEnd)); at = c.aEnd; }
    return out.concat(O.slice(at, g.end));
  };
  const ended = (ls) => (ls.length && !ls[ls.length - 1].endsWith("\n") ? [...ls.slice(0, -1), ls[ls.length - 1] + eol] : ls);
  const out = [];
  let at = 0, conflicts = 0;
  for (const g of places) {
    out.push(...O.slice(at, g.start));
    const hasA = g.blocks.some((c) => c.side === A), hasB = g.blocks.some((c) => c.side === B);
    const a = side(g, A), b = side(g, B);
    if (!hasB) out.push(...a);
    else if (!hasA || a.join("") === b.join("")) out.push(...b);
    else {
      conflicts++;
      out.push(`<<<<<<< ${mine}${eol}`, ...ended(a), `=======${eol}`, ...ended(b), `>>>>>>> ${other}${eol}`);
    }
    at = g.end;
  }
  out.push(...O.slice(at));
  return { text: out.join(""), conflicts };
}
