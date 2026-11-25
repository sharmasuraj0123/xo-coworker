// @ts-check

/** Paths whose contents Git or an agent may run. */
export const RUNS = /^(?:\.git|\.claude|\.codex|\.agents)(?:\/|$)|^\.mcp\.json$/i;

export const RUNS_SAY = { runs: true, words: "Runs code: Enter makes it anyway", why: "Git or an agent runs what a file here says" };

/** @param {string} p */
export const parentOf = (p) => { const i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); };
/** @param {string} n @param {string} dir @param {{files: {name: string}[], dirs: {name: string}[]} | null | undefined} d */
export function newFileSay(n, dir, d, confirm = false) {
  if (!n) return null;
  if (/[/\\]/.test(n)) return { err: true, words: "A name only: no folders" };
  if (n === "." || n === ".." || n.includes("\0")) return { err: true, words: "A file can't be called that" };
  if (d && d.files.some((x) => x.name === n)) return { err: true, words: `${n} is already here` };
  if (d && d.dirs.some((x) => x.name === n)) return { err: true, words: `There's a folder called ${n} here` };
  return confirm || RUNS.test(dir ? `${dir}/${n}` : n) ? RUNS_SAY : null;
}
