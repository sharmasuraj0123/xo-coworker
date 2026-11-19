// Finding a file by a few letters (js/fuzzy.js) and every file in a place (js/paths.js: Space's /paths, or a walk
// of /tree on today's Space). Pure; Space is a stand-in.
//   node tests/quickopen.test.mjs
import assert from "node:assert/strict";
import { score, rank, marked, lineOf } from "../js/fuzzy.js";
import { createPaths } from "../js/paths.js";

let passed = 0;
const queue = [];
const t = (name, fn) => queue.push([name, fn]);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const PATHS = ["js/app.js", "js/viewer.js", "js/vendor/pierre-diffs/edit.js", "css/app.css", "tests/viewer-hooks.test.mjs", "README.md", "design-research/2026-11-vision/canvas-editing/PLAN.md", "js/filesview.js", "js/files.js"];

t("letters in order match; out of order don't", () => {
  assert.ok(score("js/viewer.js", "vwr"));
  assert.equal(score("js/viewer.js", "rwv"), null);
  assert.equal(score("js/app.js", "zz"), null);
});

t("the file's own name beats a folder that happens to match; a start beats a middle", () => {
  const r = rank(PATHS, "app").map((x) => x.path);
  assert.equal(r[0], "js/app.js");
  assert.ok(r.indexOf("css/app.css") < r.indexOf("js/vendor/pierre-diffs/edit.js") || !r.includes("js/vendor/pierre-diffs/edit.js"));
  assert.equal(rank(PATHS, "viewer")[0].path, "js/viewer.js");
  assert.equal(rank(PATHS, "files")[0].path, "js/files.js", "the shorter, exact name first");
});

t("initials and separators: fv finds filesview, plan finds PLAN.md; words match in any order", () => {
  assert.equal(rank(PATHS, "fv")[0].path, "js/filesview.js");
  assert.equal(rank(PATHS, "plan")[0].path, "design-research/2026-11-vision/canvas-editing/PLAN.md");
  assert.equal(rank(PATHS, "hooks viewer")[0].path, "tests/viewer-hooks.test.mjs");
  assert.equal(rank(PATHS, "js/edit")[0].path, "js/vendor/pierre-diffs/edit.js", "a slash matches across folders");
});

t("hits mark the matched letters, escaped", () => {
  const m = rank(["a<b>/x.js"], "x")[0];
  assert.equal(marked(m.path, m.hits, esc), "a&lt;b&gt;/<b>x</b>.js");
});

t("a query can end in :line or :line:col", () => {
  assert.deepEqual(lineOf("app.js:120"), { query: "app.js", line: 120, col: null });
  assert.deepEqual(lineOf("viewer:12:4"), { query: "viewer", line: 12, col: 4 });
  assert.deepEqual(lineOf("plain"), { query: "plain", line: null, col: null });
});

t("10,000 paths rank in well under a frame budget per key", () => {
  const many = Array.from({ length: 10000 }, (_, i) => `src/module${i % 97}/part${i}/file${i}.ts`);
  const t0 = performance.now();
  rank(many, "mod5file12");
  const ms = performance.now() - t0;
  assert.ok(ms < 150, `took ${ms.toFixed(1)} ms`);
});

t("paths: Space's /paths when it has it, worktree-aware", async () => {
  const calls = [];
  const api = { projectPaths: async (p, o) => { calls.push(o); return { paths: ["a.js", "b/c.md"], truncated: false, stamp: "s1" }; }, projectTree: async () => { throw new Error("not used"); } };
  const P = createPaths({ api });
  const e = await P.load({ project: "p", base: ".xo/worktrees/t1" });
  assert.deepEqual(e.paths, ["a.js", "b/c.md"]);
  assert.equal(calls[0].worktree, "t1");
  assert.equal(e.via, "paths");
});

t("paths on today's Space: /paths is missing, so /tree is walked, skipping .git and node_modules", async () => {
  const tree = { "": { dirs: [{ name: "js" }, { name: "node_modules" }, { name: ".git" }], files: [{ name: "README.md" }] }, js: { dirs: [{ name: "vendor" }], files: [{ name: "app.js" }] }, "js/vendor": { dirs: [], files: [{ name: "x.js" }] } };
  const asked = [];
  // a bare 404 (no code): a Space without the route
  const api = { projectPaths: async () => { throw Object.assign(new Error("Not Found"), { status: 404, code: "http_404" }); }, projectTree: async (p, rel) => { asked.push(rel); return tree[rel] || { dirs: [], files: [] }; } };
  const P = createPaths({ api });
  const e = await P.load({ project: "p", base: "" });
  assert.deepEqual(e.paths, ["README.md", "js/app.js", "js/vendor/x.js"]);
  assert.ok(!asked.includes("node_modules") && !asked.includes(".git"));
  assert.ok(P.routeMissing, "/paths isn't asked again");
  P.changed({ project: "p", base: "" }, { kind: "create", path: "js/new.js" });
  assert.ok(e.paths.includes("js/new.js"));
  P.changed({ project: "p", base: "" }, { kind: "rename", path: "js/renamed.js", old_path: "js/new.js" });
  assert.ok(e.paths.includes("js/renamed.js") && !e.paths.includes("js/new.js"));
  P.changed({ project: "p", base: "" }, { kind: "delete", path: "README.md" });
  assert.ok(!e.paths.includes("README.md"));
});

t("a 404 with a code is the route's own answer, not a Space without the route", async () => {
  const api = { projectPaths: async () => { throw Object.assign(new Error("gone"), { status: 404, code: "project_not_found" }); }, projectTree: async () => ({ dirs: [], files: [] }) };
  const P = createPaths({ api });
  const e = await P.load({ project: "p", base: "" });
  assert.equal(e.state, "error");
  assert.equal(P.routeMissing, false);
});

for (const [name, fn] of queue) {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
}
console.log(`${passed}/${queue.length} passed`);
