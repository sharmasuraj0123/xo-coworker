// @ts-check

export const GIT_ICON = { unsaved: "edit", unpushed: "cloud-upload", unmerged: "pull-request", shipped: "merge" };

// A thread's git state in words, from its worktree entry (`would_lose`, maybe `git`) or, on a newer backend, its branch's `git` state.

/** @param {number} n @param {string} one @param {string} [many] */
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/** {group, word, n}: unsaved, unpushed, unmerged (pushed, not in the default branch), shipped (merged), saved, or none (nothing known). @param {any} w @param {any} [git] @returns {{ group: "unsaved" | "unpushed" | "unmerged" | "shipped" | "saved" | "none", word: string, n: number, url?: string }} */
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
