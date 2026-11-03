// A project's record (js/record.js): what threads made, and what happened since you last looked.
// Pure; no network.
//   node tests/record.test.mjs
import assert from "node:assert/strict";
import * as R from "../js/record.js";

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};
const NOW = Date.parse("2026-11-03T13:00:00Z");
const H = 3600000;
const th = (id, state, hoursAgo, extra = {}) => ({ id, project: "p", title: id.toUpperCase(), state, lastAt: NOW - hoursAgo * H, checklist: { items: [] }, happened: "", outputs: [], ...extra });
const tree = (lost) => ({ exists: true, error: null, would_lose: lost });
const lost = ({ changed = 0, untracked = 0, commits = 0 } = {}) => ({ changed: { count: changed }, untracked: { count: untracked }, ignored: { count: 0 }, commits });

t("a made file's kind comes from its type, else its name", () => {
  assert.equal(R.madeKind({ type: "image/png", name: "a.png" }), "image");
  assert.equal(R.madeKind({ name: "shot.webp" }), "image");
  assert.equal(R.madeKind({ type: "text/html", name: "x" }), "page");
  assert.equal(R.madeKind({ name: "notes.md" }), "doc");
  assert.equal(R.madeKind({ name: "data.csv" }), "data");
  assert.equal(R.madeKind({ name: "panel.js" }), "code");
});

t("made items: newest thread first, a thread's last share first; pins flagged, keys stable", () => {
  const a = th("a", "done", 30, { outputs: [{ path: "one.md" }, { path: "two.png", type: "image/png", bytes: 9 }] });
  const b = th("b", "working", 1, { outputs: [{ path: "dir/three.html", name: "three.html" }] });
  const c = th("c", "done", 2); // shared nothing
  const items = R.madeItems([a, b, c], { pins: new Set([R.madeKey("a", "one.md")]) });
  assert.deepEqual(items.map((m) => m.name), ["three.html", "two.png", "one.md"]);
  assert.deepEqual(items.map((m) => m.kind), ["page", "image", "doc"]);
  assert.deepEqual(items.map((m) => m.pinned), [false, false, true]);
  assert.equal(items[1].bytes, 9);
  assert.equal(items[0].key, "b|dir/three.html");
});

t("made: filter by kind and words (the thread's title counts); groups drop empty ones", () => {
  const items = R.madeItems([th("a", "done", 200, { outputs: [{ path: "x.md" }, { path: "y.png" }] }), th("b", "done", 1, { outputs: [{ path: "z.md" }] })]);
  assert.deepEqual(R.filterMade(items, { kind: "doc" }).map((m) => m.name), ["z.md", "x.md"]);
  assert.deepEqual(R.filterMade(items, { q: "Y.P" }).map((m) => m.name), ["y.png"]);
  assert.deepEqual(R.filterMade(items, { q: "b" }).map((m) => m.name), ["z.md"]);
  const g = R.madeGroups(items.map((m, i) => (i === 2 ? { ...m, pinned: true } : m)), NOW);
  assert.deepEqual(g.map((x) => x.id), ["pinned", "today", "earlier"]);
});

t("git words from a worktree: uncommitted beats unpushed; ignored files and nothing lost are saved", () => {
  assert.deepEqual(R.gitState(tree(lost({ changed: 2, untracked: 1, commits: 3 }))), { group: "unsaved", word: "3 files not committed", n: 3 });
  assert.deepEqual(R.gitState(tree(lost({ commits: 1 }))), { group: "unpushed", word: "1 commit not pushed", n: 1 });
  assert.equal(R.gitState(tree(lost())).group, "saved");
  assert.equal(R.gitState(tree(null)).group, "saved");
  assert.equal(R.gitState({ exists: false }).group, "none");
  assert.equal(R.gitState(undefined).group, "none");
});

t("since you left: only what moved (or needs you), in the order you'd act on it", () => {
  const since = NOW - 48 * H;
  const threads = [
    th("old", "done", 72),                     // before you left: not mentioned
    th("ask", "needs_reply", 80),              // old, but it needs you
    th("dirty", "done", 5),
    th("ahead", "resolved", 6),
    th("clean", "done", 7),
    th("busy", "working", 1),                  // uncommitted work while working is normal: still going
    th("broke", "failed", 3),
  ];
  const trees = new Map([["dirty", tree(lost({ untracked: 1 }))], ["ahead", tree(lost({ commits: 2 }))], ["busy", tree(lost({ changed: 4 }))]]);
  const cu = R.catchUp(threads, { since, needing: new Set(["ask"]), trees });
  assert.deepEqual(cu.groups.map((g) => [g.id, g.items.map((x) => x.t.id)]), [
    ["needs", ["ask"]], ["unsaved", ["dirty"]], ["unpushed", ["ahead"]], ["stopped", ["broke"]], ["finished", ["clean"]], ["going", ["busy"]],
  ]);
  assert.equal(cu.total, 6);
  assert.equal(cu.groups.find((g) => g.id === "going").items[0].git.word, "4 files not committed");
  assert.equal(R.catchUp([th("old", "done", 72)], { since }).total, 0);
});

t("the headline: what happened, then whether anything needs you", () => {
  assert.deepEqual(R.headline({ finished: 3, unpushed: 1 }), { lead: "3 finished, 1 not pushed.", tail: "Nothing needs you." });
  assert.deepEqual(R.headline({ needs: 2, going: 1 }), { lead: "1 still going.", tail: "2 need you." });
  assert.deepEqual(R.headline({ needs: 1 }), { lead: "", tail: "1 needs you." });
});

t("what a thread did: its card's first sentence as plain words, else its last finished step", () => {
  assert.equal(R.didLine(th("a", "done", 1, { happened: "I researched **DeepSeek Harness (`dsh`)**, from [its repo](http://x). Then more." })), "I researched DeepSeek Harness (dsh), from its repo.");
  assert.equal(R.didLine(th("a", "done", 1, { checklist: { items: [{ state: "done", text: "Read the code" }, { state: "done", text: "Built the panel" }, { state: "todo", text: "Ship" }] } })), "Built the panel");
  assert.equal(R.didLine(th("a", "done", 1)), "");
});

t("how long you were away, and since when, in words", () => {
  assert.equal(R.awayWord(NOW - 9 * H, NOW), "9 hours");
  assert.equal(R.awayWord(NOW - 3 * 24 * H, NOW), "3 days");
  assert.equal(R.sinceWord(NOW - 24 * H, NOW), "yesterday");
  assert.match(R.sinceWord(NOW - 3 * 24 * H, NOW), /^[A-Z][a-z]+day$/);
});

t("seen: per place, kept in the store, survives a fresh read", () => {
  const mem = new Map();
  const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const a = R.createSeen(store);
  assert.equal(a.get("home"), null);
  a.mark("home", 5); a.mark("p:x", 7);
  const b = R.createSeen(store);
  assert.equal(b.get("home"), 5);
  assert.equal(b.get("p:x"), 7);
  const broken = R.createSeen({ getItem: () => "{nope", setItem() { throw new Error("full"); } });
  assert.equal(broken.get("home"), null);
  broken.mark("home", 1); // never throws
});


t("a newer backend's git state: merged says shipped (with its PR); pushed, unpushed and nothing to ship", () => {
  const g = (x) => ({ branch: "b", branch_exists: true, commits: 2, merged: false, upstream: null, unpushed: null, pr: null, ...x });
  assert.deepEqual(R.gitState(null, g({ merged: true, pr: { number: 37, url: "u", state: "MERGED" } })), { group: "shipped", word: "merged · PR #37", n: 0, url: "u" });
  assert.equal(R.gitState(null, g({ merged: true })).word, "merged");
  assert.deepEqual(R.gitState(null, g({ upstream: { pushed: true }, unpushed: 0, pr: { number: 9, state: "OPEN", url: "p" } })), { group: "unmerged", word: "PR #9 open", n: 0, url: "p" });
  assert.equal(R.gitState(null, g({ upstream: { pushed: true }, unpushed: 0 })).word, "pushed, no PR");
  assert.equal(R.gitState(null, g({ upstream: { pushed: true }, unpushed: 3 })).word, "3 commits not pushed");
  assert.equal(R.gitState(null, g({ upstream: null })).word, "2 commits not pushed");    // no upstream: all its own commits
  assert.equal(R.gitState(null, g({ commits: 0 })).group, "saved");
  // uncommitted files still come first, from the worktree; a removed tree keeps its last git state
  assert.equal(R.gitState(tree(lost({ changed: 1 })), g({ merged: true })).group, "unsaved");
  assert.equal(R.gitState({ exists: false, git: g({ merged: true }) }).group, "shipped");
  assert.equal(R.gitState({ ...tree(null), git: g({ merged: true }) }).group, "shipped");
});

t("since you left with git states: shipped and not merged get their own groups, and the headline says so", () => {
  const since = NOW - 48 * H;
  const threads = [th("a", "resolved", 3, { git: { merged: true, commits: 1 } }), th("b", "done", 2, { git: { commits: 1, upstream: { pushed: true }, unpushed: 0 } }), th("c", "done", 1, { summary: "Moved Shells into the foot." })];
  const cu = R.catchUp(threads, { since });
  assert.deepEqual(cu.groups.map((g) => g.id), ["unmerged", "shipped", "finished"]);
  assert.equal(cu.groups[2].items[0].line, "Moved Shells into the foot.");
  assert.deepEqual(R.headline(cu.counts), { lead: "1 shipped, 1 finished, 1 not merged.", tail: "Nothing needs you." });
});

t("made from the backend: its rows in the same shape, links and branches kept, missing fields tolerated", () => {
  const rows = [
    { id: "m1", kind: "file", name: "plan.md", mime: "text/markdown", bytes: 10, thread_ts: "a", updated_at: "2026-11-03T10:00:00Z", pinned: true, exists: true, project_id: "p", relative_path: ".xo/made/thread-a/plan.md", path: "plan.md" },
    { id: "m2", kind: "link", url: "https://github.com/x/y/pull/37", name: "PR #37", thread_ts: "b", created_at: "2026-11-03T12:00:00Z" },
    { id: "m3", kind: "branch", git: { branch: "xo/thread-1", merged: true }, thread_ts: "a", updated_at: "2026-11-03T11:00:00Z", exists: false },
    { kind: "file" },                                         // no id: dropped
  ];
  const items = R.madeFromServer(rows, { project: "p", title: (ts) => ({ a: "Alpha" })[ts] || "" });
  assert.deepEqual(items.map((m) => [m.key, m.kind]), [["m2", "link"], ["m3", "branch"], ["m1", "doc"]]);
  assert.equal(items[0].url, "https://github.com/x/y/pull/37");
  assert.equal(items[1].name, "thread-1");
  assert.equal(items[1].exists, false);
  assert.deepEqual([items[2].pinned, items[2].fileProject, items[2].rel, items[2].title], [true, "p", ".xo/made/thread-a/plan.md", "Alpha"]);
  assert.deepEqual(R.madeFromServer(null), []);
  assert.deepEqual(R.filterMade(items, { kind: "link" }).map((m) => m.key), ["m2"]);
});

console.log(`${passed} passed${process.exitCode ? ", with failures" : ""}`);
