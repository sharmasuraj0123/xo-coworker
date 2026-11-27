// @ts-check
import { count } from "../platform/words.js";

export const GIT_ICON = { unsaved: "edit", unpushed: "cloud-upload", unmerged: "pull-request", shipped: "merge" };

// A thread's git state in words, from Space's stored state; a tree Space hasn't reported is not known.

/** @param {import("./git-state-types").BranchGit | null | undefined} g @returns {{ group: "unsaved" | "unpushed" | "unmerged" | "shipped" | "saved" | "none", word: string, n: number, url?: string | null }} */
export function gitState(g) {
  const tree = g && g.tree && g.tree.exists ? g.tree : null;
  const changes = tree ? (tree.changed || 0) + (tree.untracked || 0) : 0;
  if (changes) return { group: "unsaved", word: `${count(changes, "change")} not committed`, n: changes };
  if (g) {
    const pr = g.pr && g.pr.number ? `PR #${g.pr.number}` : "";
    if (g.merged) return { group: "shipped", word: pr ? `merged · ${pr}` : "merged", n: 0, url: g.pr && g.pr.url };
    if (g.commits === 0) return { group: "saved", word: "", n: 0 };
    const unpushed = g.unpushed ?? (g.upstream ? null : g.commits);
    if (unpushed) return { group: "unpushed", word: `${count(unpushed, "commit")} not pushed`, n: unpushed };
    if (g.upstream && g.upstream.pushed !== false && !g.upstream.gone) {
      if (g.pr && g.pr.state && String(g.pr.state).toLowerCase() === "open") return { group: "unmerged", word: `${pr}${g.pr.draft ? " draft" : ""} open`, n: 0, url: g.pr.url };
      return { group: "unmerged", word: "pushed, no PR", n: 0 };
    }
  }
  if (!tree) return { group: "none", word: "", n: 0 };
  if (tree.local_commits) return { group: "unpushed", word: `${count(tree.local_commits, "commit")} not pushed`, n: tree.local_commits };
  return { group: "saved", word: "", n: 0 };
}
