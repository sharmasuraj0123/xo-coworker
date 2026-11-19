// @ts-check

// ARIA text snapshots compared with goldens in e2e/snapshots; UPDATE=1 writes them instead.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

/** No trailing spaces, one final newline, no run-specific port. @param {string} text */
export function normalise(text) {
  return String(text).replace(/https?:\/\/127\.0\.0\.1:\d+/g, "http://e2e").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").replace(/\n*$/, "\n");
}

/** A line diff by LCS: "  same", "- golden only", "+ page only". @param {string} a @param {string} b */
export function diffLines(a, b) {
  const A = a.split("\n"), B = b.split("\n");
  const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { out.push(`  ${A[i]}`); i++; j++; }
    else if (i < n && (j === m || L[i + 1][j] >= L[i][j + 1])) out.push(`- ${A[i++]}`);
    else out.push(`+ ${B[j++]}`);
  }
  return out;
}

/** The changed lines with `context` lines around them; "…" marks what is left out. @param {string[]} lines */
export function trimDiff(lines, context = 2) {
  /** @type {Set<number>} */
  const keep = new Set();
  lines.forEach((l, k) => { if (!l.startsWith("  ")) for (let d = -context; d <= context; d++) keep.add(k + d); });
  const out = [];
  let last = -1;
  lines.forEach((l, k) => { if (!keep.has(k)) return; if (k > last + 1) out.push("…"); out.push(l); last = k; });
  if (last < lines.length - 1) out.push("…");
  return out.join("\n");
}

/** @param {{ariaSnapshot: () => Promise<string>}} locator @param {string} file @returns {Promise<{ok: boolean, written?: boolean, diff?: string, text: string}>} */
export async function compareAria(locator, file, { update = process.env.UPDATE === "1" } = {}) {
  const text = normalise(await locator.ariaSnapshot());
  if (update) {
    const was = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (was !== text) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); }
    return { ok: true, written: was !== text, text };
  }
  if (!existsSync(file)) return { ok: false, diff: `no golden at ${file}: run with UPDATE=1, then review it`, text };
  const want = normalise(readFileSync(file, "utf8"));
  if (want === text) return { ok: true, text };
  return { ok: false, diff: trimDiff(diffLines(want.trimEnd(), text.trimEnd())), text };
}
