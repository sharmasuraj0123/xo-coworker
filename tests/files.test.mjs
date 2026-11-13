// Files (js/files.js): which folder a view shows, and where a file the viewer opened sits in it. No network.
//   node tests/files.test.mjs
import assert from "node:assert/strict";

globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { scopeOf, localIn, fileScope, newFileSay } = await import("../js/files.js");

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};
const threads = {
  a: { id: "a", project: "p", title: "A", branch: "xo/thread-a", worktree: "/w/p/.xo/worktrees/thread-a", cwd: "/w/p/.xo/worktrees/thread-a" },
  b: { id: "b", project: "p", title: "B", worktree: null, cwd: "/w/p" },
  c: { id: "c", project: "workspace", title: "C" },
};
const ctx = { thread: (id) => threads[id] || null, project: (id) => id.toUpperCase() };

t("a view's folder: a thread's own worktree, else its project's; a project's; else every project", () => {
  assert.deepEqual(scopeOf("t:a", ctx), { key: "p|.xo/worktrees/thread-a", project: "p", base: ".xo/worktrees/thread-a", label: "P", sub: "xo/thread-a", tid: "a" });
  assert.equal(scopeOf("t:b", ctx).base, "");
  assert.equal(scopeOf("t:b", ctx).project, "p");
  assert.deepEqual(scopeOf("p:p", ctx), { key: "p|", project: "p", base: "", label: "P", sub: "" });
  assert.equal(scopeOf("t:c", ctx).key, "all");
  assert.equal(scopeOf("home", ctx).key, "all");
  assert.equal(scopeOf("ws", ctx).key, "all");
});

t("a file the viewer opened: its path in the folder on screen, or null when it's elsewhere", () => {
  const wt = scopeOf("t:a", ctx), pj = scopeOf("p:p", ctx);
  assert.equal(localIn(wt, { project: "p", rel: ".xo/worktrees/thread-a/js/app.js" }), "js/app.js");
  assert.equal(localIn(wt, { project: "p", rel: "js/app.js" }), null);              // the project's copy, not the thread's
  assert.equal(localIn(pj, { project: "p", rel: "js/app.js" }), "js/app.js");
  assert.equal(localIn(pj, { project: "p", rel: ".xo/worktrees/thread-a/js/app.js" }), null);
  assert.equal(localIn(pj, { project: "q", rel: "js/app.js" }), null);
  assert.equal(localIn(pj, { name: "paste.txt", local: "…" }), null);              // an attachment or a paste
});

t("a file opened from elsewhere (Artifacts): the folder it lives in, so the tree can open to it", () => {
  const c2 = { threads: Object.values(threads), project: ctx.project };
  const w = fileScope({ project: "p", rel: ".xo/worktrees/thread-a/js/app.js" }, c2);
  assert.deepEqual(w, { key: "p|.xo/worktrees/thread-a", project: "p", base: ".xo/worktrees/thread-a", label: "P", sub: "xo/thread-a", tid: "a" });
  assert.equal(localIn(w, { project: "p", rel: ".xo/worktrees/thread-a/js/app.js" }), "js/app.js");
  assert.equal(fileScope({ project: "p", rel: ".xo/worktrees/gone/x.md" }, c2).sub, "its worktree"); // its thread was removed
  assert.deepEqual(fileScope({ project: "p", rel: "README.md" }, c2), { key: "p|", project: "p", base: "", label: "P", sub: "" });
  assert.equal(fileScope({ name: "paste.txt" }, c2), null);
});

t("a new file's name: said under it before Enter (a folder in it, one that's there, one that runs code)", () => {
  const d = { files: [{ name: "app.js" }], dirs: [{ name: "lib" }] };
  assert.equal(newFileSay("", "js", d), null, "nothing typed: nothing said");
  assert.equal(newFileSay("notes.md", "js", d), null);
  assert.equal(newFileSay("x/y.md", "", d).err, true, "Space makes no folders");
  assert.equal(newFileSay("a\\b", "", d).err, true);
  assert.equal(newFileSay("..", "", d).err, true);
  assert.deepEqual(newFileSay("app.js", "js", d), { err: true, words: "app.js is already here" });
  assert.equal(newFileSay("App.js", "js", d), null, "names differ by case on the disk");
  assert.equal(newFileSay("lib", "js", d).err, true, "a folder has that name");
  assert.equal(newFileSay("app.js", "js", null), null, "a folder not read yet: Space says (409 file_exists)");
  assert.equal(newFileSay("settings.json", ".claude", d).runs, true, "runs code: said, and Enter makes it anyway");
  assert.equal(newFileSay(".mcp.json", "", d).runs, true);
  assert.equal(newFileSay("hook", "x", d, true).runs, true, "Space said it runs code (428)");
  assert.equal(newFileSay("settings.json", "docs/.claude", d), null, "only at the top of the place");
});
console.log(`${passed} passed${process.exitCode ? ", with failures" : ""}`);
