// What a place changed (js/changes.js) and the panel's Changes (js/changesframe.js): which place a view
// reads, when it reads it again (once per finished agent edit, never per frame), the chips' mapping from an
// agent's absolute path, a patch left out of the list, Space without the route, and Following's rules.
// Fake fetch, no network, no browser.
//   node tests/changes.test.mjs
import assert from "node:assert/strict";

globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.requestIdleCallback = (fn) => setTimeout(() => fn({ timeRemaining: () => 0 }), 0);
const calls = [];
let reply = () => ({ status: 404, body: { detail: "Not Found" } });
globalThis.fetch = async (url) => {
  const u = new URL(url, "http://x");
  calls.push(u.pathname + u.search);
  const r = reply(u);
  return { ok: r.status < 300, status: r.status, statusText: "", type: "basic", text: async () => JSON.stringify(r.body) };
};
const { scopeOf, activityIn, createChanges, lineRef, fileRef } = await import("../js/changes.js");
const { choose, newestHunkLine, countsHtml } = await import("../js/changesframe.js");
const { createTurns } = await import("../js/blocks.js");

let passed = 0;
const t = async (name, fn) => {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const WT = "/w/p/.xo/worktrees/thread-a";
const threads = [
  { id: "a", project: "p", title: "A", worktree: WT, sessionId: "s1" },
  { id: "b", project: "p", title: "B", cwd: "/w/p", sessionId: "s2" },
];
const row = (i, kind, target, status = "ok") => ({ call_id: "c" + i, kind, target, status, line: `${kind} ${target}` });
function store(turns) {
  const T = createTurns();
  let seq = 0;
  for (const tu of turns) {
    const env = (extra) => ({ seq: ++seq, ts: "2026-11-05T13:00:00Z", session_id: tu.session || "s1", turn_id: tu.id, ...extra });
    T.apply({ type: "turn.started", envelope: env({ data: {} }) });
    T.apply({ type: "block.started", envelope: env({ data: { block: { id: tu.id + ":g", type: "activity", rows: tu.rows } } }) });
    if (tu.done) {
      T.apply({ type: "block.finished", envelope: env({ data: { block: { id: tu.id + ":g", type: "activity", done: true, rows: tu.rows } } }) });
      T.apply({ type: "turn.finished", envelope: env({ data: { status: "finished" } }) });
    }
  }
  return T;
}
const world = (turns) => ({ state: { threads, turns }, thread: (id) => threads.find((x) => x.id === id) || null });
const patch = (path, lines) => `diff --git a/${path} b/${path}\nindex 1111111..2222222 100644\n--- a/${path}\n+++ b/${path}\n${lines}`;

await t("a view's place: a thread's own worktree, a project's checkout, nothing elsewhere", () => {
  const w = world(null);
  assert.deepEqual(scopeOf("t:a", w), { key: "p|.xo/worktrees/thread-a", project: "p", worktree: "thread-a", root: WT, tid: "a" });
  assert.deepEqual(scopeOf("p:p", w), { key: "p|", project: "p", worktree: null, root: null });
  assert.equal(scopeOf("home", w), null);
  assert.equal(scopeOf("t:nope", w), null);
});

await t("what agents are doing there: finished edits sign it, the running one is live, the last edit is known", () => {
  const T = store([
    { id: "u1", done: true, rows: [row(1, "read", WT + "/README.md"), row(2, "edit_file", WT + "/js/a.js"), row(3, "edit_file", WT + "/js/b.js", "error")] },
    { id: "u2", done: false, rows: [row(4, "create_file", WT + "/js/c.js"), row(5, "edit_file", WT + "/css/d.css", "running")] },
    { id: "v1", done: true, session: "s2", rows: [row(6, "edit_file", "/w/p/js/z.js")] },
  ]);
  const a = activityIn(scopeOf("t:a", world(T)), threads, T);
  assert.equal(a.sig, "2");            // a.js and c.js finished; the failed one and the running one don't count
  assert.equal(a.busy, true);
  assert.deepEqual([...a.live], ["css/d.css"]);
  assert.equal(a.last, "css/d.css");   // the newest edit, running or done
  const b = activityIn(scopeOf("p:p", world(T)), threads, T);
  assert.equal(b.sig, "1");            // the project's checkout: thread b's edit only
  assert.equal(b.last, "js/z.js");
});

await t("Space without /changes: one read, then the place says so and today's list stays", async () => {
  calls.length = 0;
  reply = () => ({ status: 404, body: { detail: "Not Found" } });
  const C = createChanges({ world: world(store([])), onChange() {} });
  C.sync("t:a");
  await tick(5);
  assert.equal(C.of("t:a").state, "unsupported");
  C.sync("t:a"); C.sync("t:a");
  await tick(5);
  assert.equal(calls.length, 1, calls.join("\n"));
});

await t("a project that isn't a git repository, or a thread whose worktree is gone: what agents touched, not an error", async () => {
  calls.length = 0;
  reply = (u) => (u.searchParams.get("worktree")
    ? { status: 404, body: { detail: { code: "worktree_not_found", message: "There is no such worktree in this project." } } }
    : { status: 404, body: { detail: { code: "not_a_repository", message: "This project isn't a git repository." } } });
  const C = createChanges({ world: world(store([])), onChange() {} });
  C.sync("t:a"); C.sync("p:p");
  await tick(10);
  assert.equal(C.of("t:a").state, "unsupported");   // this thread's worktree is gone
  assert.equal(C.of("p:p").state, "unsupported");   // the project isn't a repository: every place in it
  const before = calls.length;
  C.sync("p:p"); C.sync("t:b");
  await tick(10);
  assert.equal(calls.length, before, "a project that isn't a repository isn't asked again");
  // git older than 2.40 on Space's machine: no place can say what changed, so the same list, not an error
  reply = () => ({ status: 501, body: { detail: { code: "git_too_old", message: "Space's git is older than 2.40." } } });
  const G = createChanges({ world: world(store([])), onChange() {} });
  G.sync("t:a"); G.sync("p:p");
  await tick(10);
  assert.equal(G.of("t:a").state, "unsupported");
  assert.equal(G.of("p:p").state, "unsupported");
  // anything else is an error said in Space's own words
  reply = () => ({ status: 500, body: { detail: { code: "internal", message: "Space broke." } } });
  const D = createChanges({ world: world(store([])), onChange() {} });
  D.sync("t:a");
  await tick(10);
  assert.equal(D.of("t:a").state, "error");
  assert.equal(D.of("t:a").err, "Space broke.");
});

await t("a place is read on opening, and once more per finished edit (not per render), one read at a time", async () => {
  calls.length = 0;
  const T = store([{ id: "u1", done: true, rows: [row(1, "edit_file", WT + "/js/a.js")] }]);
  reply = (u) => ({ status: 200, body: { root: ".xo/worktrees/thread-a", base_commit: "b0", computed_at: String(calls.length), files: [
    { path: "js/a.js", status: "modified", additions: 2, deletions: 1, binary: false, patch: patch("js/a.js", "@@ -1,2 +1,3 @@\n a\n-b\n+B\n+c\n") },
    { path: "big.json", status: "modified", additions: 9000, deletions: 0, binary: false, patch: null, patch_omitted: "response_budget" },
    { path: "logo.png", status: "added", additions: null, deletions: null, binary: true, patch: null, patch_omitted: "binary" },
  ].filter((f) => !u.searchParams.get("path") || f.path === u.searchParams.get("path")).map((f) => (u.searchParams.get("path") && f.path === "big.json" ? { ...f, patch: patch("big.json", "@@ -1 +1 @@\n-x\n+y\n"), patch_omitted: null } : f)) } });
  let changed = 0;
  const W = world(T);
  const C = createChanges({ world: W, onChange() { changed++; } });
  for (let i = 0; i < 5; i++) C.sync("t:a");   // five renders: one read
  await tick(10);
  assert.equal(calls.filter((c) => c.startsWith("/api/xo-projects/p/changes")).length, 1);
  assert.match(calls[0], /worktree=thread-a/);
  const p = C.of("t:a");
  assert.equal(p.state, "ok");
  assert.deepEqual(p.total, { add: 9002, del: 1 });
  assert.ok(changed >= 1);
  // an edit finishes: one more read, after a quiet moment
  T.apply({ type: "turn.started", envelope: { seq: 99, ts: "x", session_id: "s1", turn_id: "u9", data: {} } });
  T.apply({ type: "block.started", envelope: { seq: 100, ts: "x", session_id: "s1", turn_id: "u9", data: { block: { id: "u9:g", type: "activity", rows: [row(9, "edit_file", WT + "/js/a.js")] } } } });
  T.apply({ type: "block.finished", envelope: { seq: 101, ts: "x", session_id: "s1", turn_id: "u9", data: { block: { id: "u9:g", type: "activity", done: true, rows: [row(9, "edit_file", WT + "/js/a.js")] } } } });
  for (let i = 0; i < 5; i++) C.sync("t:a");
  await tick(400);
  assert.equal(calls.filter((c) => /\/changes\?worktree=thread-a$/.test(c)).length, 2, calls.join("\n"));
  // a chip's absolute path finds its file; a path outside the place, or unchanged, doesn't
  assert.equal(C.forTarget("t:a", WT + "/js/a.js").file.additions, 2);
  assert.equal(C.forTarget("t:a", "/opt/elsewhere/a.js"), null);
  assert.equal(C.forTarget("t:a", WT + "/js/same.js"), null);
  // a project path (Files) finds it too, with the commit its change is against
  const at = C.at("p", ".xo/worktrees/thread-a/js/a.js");
  assert.equal(at.path, "js/a.js"); assert.equal(at.base, "b0"); assert.equal(at.scope.worktree, "thread-a");
  assert.equal(C.at("p", "js/a.js"), null);
  // patches: the list's; one left out of the list is read on its own (once); a binary has none
  assert.match(await C.patch("t:a", "js/a.js"), /^diff --git/);
  const big = await C.patch("t:a", "big.json");
  assert.match(big, /\+y/);
  await C.patch("t:a", "big.json");
  assert.equal(calls.filter((c) => /path=big\.json/.test(c)).length, 1);
  assert.equal(await C.patch("t:a", "logo.png"), null);
});

await t("Following: the file the agent changed last; touched, it stays put and an edit waits as the pill", () => {
  const paths = ["css/a.css", "js/b.js", "js/c.js"];
  const st = { follow: true, sel: null, pill: null, sig: null };
  choose(st, paths, { sig: "3", last: "js/b.js" });
  assert.equal(st.sel, "js/b.js"); assert.equal(st.pill, null);
  choose(st, paths, { sig: "4", last: "js/c.js" });
  assert.equal(st.sel, "js/c.js");                 // following moves with the agent
  st.follow = false; st.sel = "css/a.css";          // you picked a file
  choose(st, paths, { sig: "4", last: "js/c.js" });
  assert.equal(st.sel, "css/a.css"); assert.equal(st.pill, null);
  choose(st, paths, { sig: "5", last: "js/b.js" }); // an edit while you read: the pill, no jump
  assert.equal(st.sel, "css/a.css"); assert.equal(st.pill, "js/b.js");
  choose(st, ["js/b.js"], { sig: "5", last: "js/b.js" }); // your file's change was undone: the first that's left
  assert.equal(st.sel, "js/b.js");
  st.follow = true;                                  // you sent a message: following again, the pill goes
  choose(st, paths, { sig: "6", last: "js/c.js" });
  assert.equal(st.sel, "js/c.js"); assert.equal(st.pill, null);
  const none = choose({ follow: true, sel: "x", pill: null, sig: null }, [], { sig: "0", last: null });
  assert.equal(none.sel, null);
});

await t("the newest hunk: the first hunk the new patch has that the old one didn't, at its first changed line", () => {
  const a = "diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1,3 +1,3 @@\n x\n-y\n+Y\n@@ -10,3 +10,4 @@\n p\n q\n+r\n s\n";
  const b = a.replace("+r\n", "+R\n");
  assert.equal(newestHunkLine(a, b), 12);
  assert.equal(newestHunkLine(a, a), null);
  assert.equal(newestHunkLine("", a), 2);
});

await t("counts read +n −n, and say nothing for a side with none", () => {
  assert.match(countsHtml({ additions: 5, deletions: 8 }), /\+5<\/b><b class="xd-d">−8/);
  assert.doesNotMatch(countsHtml({ additions: 3, deletions: 0 }), /−/);
  assert.equal(countsHtml(null), "");
  assert.equal(countsHtml({ additions: null, deletions: null }), "");
});

await t("a question about lines: \"path:a-b\", a blank line, the question; nothing else reads as one", () => {
  assert.deepEqual(lineRef("js/follow.js:36-43\n\nWhy only the real bottom?"), { path: "js/follow.js", a: 36, b: 43, rest: "Why only the real bottom?" });
  assert.deepEqual(lineRef("Makefile:7\n\nwhat runs here?\nand here"), { path: "Makefile", a: 7, b: 7, rest: "what runs here?\nand here" });
  assert.equal(lineRef("js/a.js:9-3\n\nbackwards"), null);
  assert.equal(lineRef("js/a.js:36-43 no blank line"), null);
  // a whole file (Ask about this): its own marker, whatever the path looks like; never guessed from a first line
  assert.deepEqual(fileRef("File: README.md\n\nwhat is this for?"), { path: "README.md", rest: "what is this for?" });
  assert.deepEqual(fileRef("File: Makefile\n\nwhat runs?"), { path: "Makefile", rest: "what runs?" });
  assert.deepEqual(fileRef("File: LICENSE\n\nwhich one?"), { path: "LICENSE", rest: "which one?" });
  assert.deepEqual(fileRef("File: docs/my notes.md\n\nspaces too"), { path: "docs/my notes.md", rest: "spaces too" });
  assert.equal(fileRef("README.md\n\nno marker, no capsule"), null);
  assert.equal(fileRef("e.g.\n\nthis"), null);
  assert.equal(fileRef("Hello\n\nthere"), null);
  assert.equal(lineRef("Note: 12 things\n\nhi"), null);
  assert.equal(lineRef("see js/a.js:3\n\nmid-sentence"), null);
  assert.equal(lineRef(""), null);
});

console.log(`\n${passed} passed`);
