// @ts-check

// Where a thread works and where a path sits in it: a thread's folder, a target inside or outside it, the paths a command names.

/** A thread's folder: its absolute root and, inside the project, the relative base the tree route takes. @param {{ project?: string, worktree?: string, cwd?: string } | null | undefined} t @returns {import("./types").Folder | null} */
export function folderOf(t) {
  if (!t || !t.project) return null;
  const wt = String(t.worktree || "").replace(/\/+$/, "");
  if (wt) {
    const i = wt.indexOf("/.xo/worktrees/");
    const sub = i < 0 ? "" : wt.slice(i + 1);
    return /^\.xo\/worktrees\/[^/]+$/.test(sub) ? { root: wt, base: sub, project: t.project, projectRoot: wt.slice(0, i) } : null;
  }
  const cwd = String(t.cwd || "").replace(/\/+$/, "");
  return cwd && cwd.split("/").pop() === t.project ? { root: cwd, base: "", project: t.project, projectRoot: cwd } : null;
}

/** A row's target, relative to `root` ({rel}), or outside it ({abs}). @param {string | null | undefined} root @param {string | null | undefined} target @returns {import("./types").Place | null} */
export function placeOf(root, target) {
  let p = String(target || "").replace(/\\/g, "/");
  if (!p) return null;
  if (p.startsWith("/")) {
    if (root && p.startsWith(root + "/")) p = p.slice(root.length + 1);
    else return { abs: p };
  }
  p = p.replace(/^(\.\/)+/, "");
  if (!p || p.split("/").some((s) => s === ".." || s === "")) return { abs: /** @type {string} */ (target) };
  return { rel: p };
}

/** A path with "." and ".." resolved; null if it climbs above its start. @param {string} p */
function norm(p) {
  /** @type {string[]} */
  const out = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") { if (!out.length) return null; out.pop(); } else out.push(seg);
  }
  return (p.startsWith("/") ? "/" : "") + out.join("/");
}

/** The files and folders a shell command names inside `root`, in order; `cd` moves the start, a glob counts as its folder. @param {string | null | undefined} cmd @param {string | null | undefined} root @returns {string[]} */
export function pathsInCommand(cmd, root) {
  /** @type {string[]} */
  const out = [];
  let cwd = root || "";
  for (const part of String(cmd || "").split(/&&|\|\||;|\||\n/)) {
    const words = (part.trim().match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^["']|["']$/g, ""));
    if (!words.length) continue;
    if (words[0] === "cd") {
      const d = words[1];
      if (d && !d.startsWith("-")) { const n = norm(d.startsWith("/") ? d : `${cwd}/${d}`); if (n) cwd = n; }
      continue;
    }
    for (const w of words.slice(1)) {
      if (!w || w.length > 240 || w.startsWith("-") || w.includes("://") || /[\\^$#|<>(){}=;'"`\s]/.test(w)) continue;
      if (!(w.includes("/") || /\.[A-Za-z0-9]{1,8}$/.test(w))) continue;
      if (/^s([\/#|]).*\1.*\1[gimp]*$/.test(w)) continue; // a sed expression, not a path
      let p = w.replace(/[,:]+$/, "");
      const g = p.search(/[*?[]/);
      if (g >= 0) p = p.slice(0, g).replace(/\/[^/]*$/, "");
      if (!p) continue;
      const abs = norm(p.startsWith("/") ? p : cwd ? `${cwd}/${p}` : p);
      if (!abs) continue;
      const pl = placeOf(root, abs);
      if (pl && pl.rel != null) out.push(pl.rel);
    }
  }
  return out;
}
