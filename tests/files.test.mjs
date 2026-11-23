// Files (js/files.js): which folder a view shows, and where a file the viewer opened sits in it. No network.
//   node tests/files.test.mjs
import assert from "node:assert/strict";
import { deferred, dom, same, settle } from "./lib/dom.mjs";

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
const { window, document } = await dom('<main id="home"></main><aside id="files"></aside><section id="viewer" tabindex="-1" hidden></section>');
const storage = new Map([
  ["xo-home-shape", JSON.stringify({ w: 0, parts: [{ id: "hm-made", n: 2 }] })],
  ["xo-files-secs", JSON.stringify({ p: { all: true } })],
  ["xo-draft:p|docs/index.html", JSON.stringify({ text: "<p>draft</p>", base: "<p>saved</p>", version: "v1" })],
  ["xo-drafts", JSON.stringify({ "p|docs/index.html": 1 })],
]);
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

await import("../js/skeleton.js");
t("Home paints on entry using the stored shape before the app starts", () => {
  assert.ok(document.querySelector("#home h1")?.textContent.trim());
  assert.ok(document.querySelector("#home .hm-date")?.textContent.trim());
  assert.equal(document.querySelectorAll("#hm-made .md-it.is-sk").length, 2);
});

const { api } = await import("../core/platform/api.js");
const { createFiles } = await import("../js/files.js");
const { createViewer } = await import("../js/viewer.js");
const reads = [], saves = [], versionReads = [];
api.projectTree = async (project, path) => {
  reads.push([project, path]);
  return path === "docs"
    ? { files: [{ name: "index.html", relative_path: "docs/index.html" }] }
    : { dirs: [{ name: "docs", relative_path: "docs" }] };
};
api.projectFile = async () => ({ kind: "html", content: "<p>saved</p>", version: "v1", editable: true });
api.projectVersions = async (project, path) => { versionReads.push([project, path]); return { versions: [] }; };
api.saveProjectFile = async (...args) => { saves.push(args); return { version: "v2" }; };
const viewer = createViewer({ announce() {}, onChange() {} });
const files = createFiles({
  world: { state: { turns: [], threads: [], projects: [] }, thread: () => null },
  changes: {
    of: () => ({ state: "ok", files: new Map([["notes.md", { path: "notes.md", binary: true }]]) }),
    activity: () => ({ live: new Set() }),
  },
  viewer, isBusy: () => false, PROJ: (id) => id.toUpperCase(), go() {},
});
const host = document.getElementById("files");
const viewerEl = document.getElementById("viewer");
host.getBoundingClientRect = () => ({ width: 400 });
files.mount(host);
t("Files mounts the existing viewer into its preview", () => {
  same(host.querySelector(".fl-view #viewer"), viewerEl);
});
files.show("p:p");
await settle();
const click = (selector) => host.querySelector(selector).dispatchEvent(new window.Event("click", { bubbles: true }));
t("Files reads the saved project fold and writes the same key when opened", () => {
  assert.equal(host.querySelector('[data-fl-sec="all"]')?.getAttribute("aria-expanded"), "false");
  click('[data-fl-sec="all"]');
  assert.equal(host.querySelector('[data-fl-sec="all"]').getAttribute("aria-expanded"), "true");
  assert.deepEqual(JSON.parse(storage.get("xo-files-secs")), {});
});
const folder = '[data-fl-dir="docs"]';
click(folder);
await settle();
t("Files opens the selected folder and asks for its children", () => {
  assert.equal(host.querySelector(folder).getAttribute("aria-expanded"), "true");
  assert.deepEqual(reads, [["p", ""], ["p", "docs"]]);
});
const fileSelector = '[data-fl-file="docs/index.html"]';
const opener = host.querySelector(fileSelector);
click(fileSelector);
await settle();
t("Picking a file opens the viewer and focuses it", () => {
  assert.equal(viewer.file?.rel, "docs/index.html");
  assert.equal(viewerEl.hidden, false);
  same(document.activeElement, viewerEl);
});
const save = new window.Event("keydown", { bubbles: true, cancelable: true });
Object.assign(save, { key: "s", metaKey: true });
t("A stored draft stays unsaved until Cmd+S saves it against its original version", () => {
  assert.deepEqual(saves, []);
  viewerEl.dispatchEvent(save);
  assert.equal(save.defaultPrevented, true);
  assert.deepEqual(saves.map((args) => args.slice(0, 4)), [["p", "docs/index.html", "<p>draft</p>", "v1"]]);
});
await settle();
t("Closing the viewer returns focus to the row that opened it", () => {
  viewer.close();
  assert.equal(viewerEl.hidden, true);
  same(document.activeElement, opener);
});

const pendingFile = deferred();
api.projectFile = () => pendingFile.promise;
click(fileSelector);
viewer.close({ restore: false });
pendingFile.resolve({ kind: "html", content: "<p>late result</p>", version: "v3" });
await settle();
t("Closing while a read is pending leaves the viewer empty after the response", () => {
  assert.equal(viewer.hasFile, false);
  assert.equal(viewerEl.hidden, true);
  assert.equal(viewerEl.childElementCount, 0);
  assert.deepEqual(versionReads, [["p", "docs/index.html"]], "closed files do not start a late version read");
});

const pendingTree = deferred();
api.projectTree = () => pendingTree.promise;
files.show("p:q");
const treeBefore = host.querySelector(".fl-tree").innerHTML;
files.hide();
files.render("p:p");
pendingTree.resolve({ files: [{ name: "other.html", relative_path: "other.html" }] });
await settle();
t("A hidden Files page ignores renders and shows its loaded rows when brought back", () => {
  assert.equal(host.querySelector(".fl-tree").innerHTML, treeBefore);
  files.show("p:q");
  assert.ok(host.querySelector('[data-fl-file="other.html"]'));
});

console.log(`${passed} passed${process.exitCode ? ", with failures" : ""}`);
