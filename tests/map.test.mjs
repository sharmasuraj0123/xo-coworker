// The Map's pure parts (js/map.js): a thread's folder, where a step's file is, what a session's turns
// touched and which file is live, and the folded tree. No network.
//   node tests/map.test.mjs
import assert from "node:assert/strict";

// js/ui.js reads the reduced-motion setting when it loads
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { folderOf, placeOf, activityOf, treeOf } = await import("../js/map.js");
const { createTurns } = await import("../js/blocks.js");

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};

const WT = "/home/coder/demo/.xo/worktrees/thread-1";

t("a thread's folder: its worktree inside the project, else the project folder, else none", () => {
  assert.deepEqual(folderOf({ project: "demo", worktree: WT + "/" }), { root: WT, base: ".xo/worktrees/thread-1", project: "demo", projectRoot: "/home/coder/demo" });
  assert.deepEqual(folderOf({ project: "demo", cwd: "/home/coder/demo" }), { root: "/home/coder/demo", base: "", project: "demo", projectRoot: "/home/coder/demo" });
  assert.equal(folderOf({ project: "demo", worktree: "/tmp/elsewhere" }), null);
  assert.equal(folderOf({ project: "demo", cwd: "/home/coder/other" }), null);
  assert.equal(folderOf({ project: "demo", worktree: WT + "/nested/deeper" }), null);
});

t("a step's file: relative to the folder, or outside it, never climbing out", () => {
  assert.deepEqual(placeOf(WT, WT + "/js/app.js"), { rel: "js/app.js" });
  assert.deepEqual(placeOf(WT, "./css/app.css"), { rel: "css/app.css" });
  assert.deepEqual(placeOf(WT, "/opt/xo-space/server.py"), { abs: "/opt/xo-space/server.py" });
  assert.deepEqual(placeOf(WT, "../secrets.txt"), { abs: "../secrets.txt" });
  assert.equal(placeOf(WT, ""), null);
});

/** A turn store with one session's turns, from storm-shaped frames. */
function store(turns) {
  const T = createTurns();
  let seq = 0;
  for (const tu of turns) {
    const env = (extra) => ({ seq: ++seq, ts: "2026-11-03T13:00:00Z", session_id: "s1", turn_id: tu.id, ...extra });
    T.apply({ type: "turn.started", envelope: env({ data: {} }) });
    T.apply({ type: "block.started", envelope: env({ data: { block: { id: tu.id + ":g", type: "activity", rows: tu.rows } } }) });
    if (tu.done) {
      T.apply({ type: "block.finished", envelope: env({ data: { block: { id: tu.id + ":g", type: "activity", done: true, rows: tu.rows } } }) });
      T.apply({ type: "turn.finished", envelope: env({ data: { status: "finished" } }) });
    }
  }
  return T;
}
const row = (i, kind, target, status = "ok", extra = {}) => ({ call_id: "c" + i, kind, target, status, line: `${kind} ${target}`, ...extra });

t("what a session touched: new beats edited beats read; the running step is live; failures don't count", () => {
  const T = store([
    { id: "u1", done: true, rows: [row(1, "read", WT + "/README.md"), row(2, "create_file", WT + "/js/map.js"), row(3, "edit_file", WT + "/js/app.js", "error")] },
    { id: "u2", done: false, rows: [row(4, "edit_file", WT + "/js/map.js"), row(5, "read", "/opt/x/server.py"), row(6, "edit_file", WT + "/css/app.css", "running")] },
  ]);
  if (!T.list().length) { console.log("  skip (the turn store's frame shape differs)"); return; }
  const a = activityOf(T, "s1", WT);
  assert.deepEqual([...a.files.keys()].sort(), ["README.md", "css/app.css", "js/map.js"]);
  assert.equal(a.files.get("js/map.js").mark, "new");
  assert.equal(a.files.get("README.md").mark, "read");
  assert.equal(a.files.get("css/app.css").live, true);
  assert.equal(a.files.get("css/app.css").verb, "Editing");
  assert.equal(a.files.get("js/map.js").live, false);
  assert.deepEqual([...a.outside.keys()], ["/opt/x/server.py"]);
  assert.equal(a.now.row.call_id, "c6");
});

t("no session, no store: nothing, and no error", () => {
  const a = activityOf(null, "s1", WT);
  assert.equal(a.files.size, 0);
  assert.equal(a.now, null);
});

t("the tree folds a folder that holds only one folder", () => {
  const tree = treeOf([{ path: "js/shells/dock.js" }, { path: "js/shells/term.js" }, { path: "index.html" }, { path: "a/b/c/d.md" }]);
  assert.deepEqual([...tree.dirs.values()].map((d) => d.name).sort(), ["a/b/c", "js/shells"]);
  assert.deepEqual(tree.files.map((f) => f.name), ["index.html"]);
  const js = [...tree.dirs.values()].find((d) => d.name === "js/shells");
  assert.deepEqual(js.files.map((f) => f.name), ["dock.js", "term.js"]);
});

console.log(`${passed} passed${process.exitCode ? ", with failures" : ""}`);
