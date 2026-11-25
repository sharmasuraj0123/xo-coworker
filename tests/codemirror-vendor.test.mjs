import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startSpace } from "../e2e/lib/space.mjs";
import { dom } from "./lib/dom.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VENDOR_PATH = "vendor/codemirror";
const VENDOR = join(ROOT, VENDOR_PATH);
const manifest = JSON.parse(readFileSync(join(VENDOR, "manifest.json"), "utf8"));

let passed = 0;
const t = async (name, fn) => {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n    " + e.message); process.exitCode = 1; }
};

await t("the vendored files match the pinned CodeMirror 6 inventory", () => {
  assert.equal(manifest.package, "codemirror");
  assert.equal(manifest.esbuild, "0.28.2");
  assert.equal(manifest.pinned["@codemirror/state"], "6.7.6");
  for (const [p, v] of Object.entries(manifest.pinned)) assert.equal(manifest.bundled[p], v, `${p} bundled at ${manifest.bundled[p]}, pinned ${v}`);
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f !== "manifest.json") files.push(relative(VENDOR, p).split("\\").join("/")); } };
  walk(VENDOR);
  assert.deepEqual(files.sort(), Object.keys(manifest.files).sort(), "files on disk and in manifest.json differ: rerun tools/codemirror/vendor.mjs");
  for (const f of files) assert.ok(/^(cm\.js|merge\.js|LICENSES\.md|c\/[\w-]+\.js)$/.test(f), `${f}: unexpected file`);
});

await t("every CodeMirror asset has its pinned SHA-256", async () => {
  const space = await startSpace({ root: ROOT });
  try {
    for (const [path, expected] of Object.entries(manifest.files)) {
      const response = await fetch(`${space.base}/${VENDOR_PATH}/${path}`);
      assert.equal(response.status, 200, path);
      const actual = createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex");
      assert.equal(actual, expected, `${path} changed since it was vendored`);
    }
  } finally {
    await space.close();
  }
});

const loaded = new Set();
const prefix = pathToFileURL(VENDOR + "/").href;
const configuration = new URL("../modules/files/editor-extensions.js", import.meta.url).href;
const hooks = registerHooks({
  load(href, context, next) {
    if (href === configuration) loaded.add("editor-extensions.js");
    if (href.startsWith(prefix)) loaded.add(href.slice(prefix.length));
    return next(href, context);
  },
});
await import("../modules/files/viewer.js");
const { loadCM, loadMerge, mount, prefetch } = await import("../modules/files/editor.js");
const eager = [...loaded];
prefetch();
const prefetchStarted = loaded.has("cm.js");
const cm = await loadCM();
const prefetched = [...loaded].sort();
loaded.clear();

await t("mounting a file loads and applies the editor configuration", async () => {
  const { document, window } = await dom("<section id=editor></section>");
  const host = document.querySelector("#editor");
  const { MutationObserver, requestAnimationFrame, cancelAnimationFrame } = globalThis;
  Object.assign(globalThis, {
    MutationObserver: window.MutationObserver,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
  });
  document.getSelection = () => null;
  document.hasFocus = () => false;
  const doc = { state: "readonly" };
  const docs = { textOf: () => "file contents", attach() {} };
  const loadLanguage = cm.LanguageDescription.prototype.load;
  const { reportError } = globalThis;
  let handle;
  try {
    handle = await mount(host, { docs, doc, name: "note" });
    assert.equal(handle.view.state.doc.toString(), "file contents");
    assert.equal(handle.view.contentDOM.getAttribute("contenteditable"), "false");
    assert.deepEqual([...loaded], ["editor-extensions.js"]);
    handle.destroy();
    const failure = new Error("Language bundle unavailable");
    const reported = [];
    globalThis.reportError = (error) => reported.push(error);
    let hold = Promise.withResolvers();
    cm.LanguageDescription.prototype.load = () => hold.promise;
    handle = await mount(host, { docs, doc: { state: "readonly" }, name: "note.py" });
    hold.reject(failure);
    await new Promise(setImmediate);
    assert.deepEqual(reported, [failure]);
    handle.destroy();
    hold = Promise.withResolvers();
    handle = await mount(host, { docs, doc: { state: "readonly" }, name: "note.py" });
    handle.destroy();
    hold.reject(failure);
    await new Promise(setImmediate);
    assert.deepEqual(reported, [failure], "a retired editor publishes no language error");

    let attached;
    handle = await mount(host, {
      docs: { ...docs, attach: (_doc, editorHooks) => { attached = editorHooks; } },
      doc: { state: "readonly" },
    });
    const { setTimeout, clearTimeout } = globalThis;
    const tintTimer = Symbol("tint");
    let scheduled = false, cancelled = false;
    globalThis.setTimeout = (fn, delay, ...args) => {
      if (delay !== 2400) return setTimeout(fn, delay, ...args);
      scheduled = true;
      return tintTimer;
    };
    globalThis.clearTimeout = (id) => {
      if (id === tintTimer) cancelled = true;
      else clearTimeout(id);
    };
    try {
      attached.apply({ from: 0, to: 0, insert: "Edited " }, { lines: [{ from: 1, to: 1 }] });
      assert.equal(scheduled, true);
      handle.destroy();
      assert.equal(cancelled, true, "retiring the editor cancels the tint timer");
    } finally {
      Object.assign(globalThis, { setTimeout, clearTimeout });
    }
  } finally {
    handle?.destroy();
    cm.LanguageDescription.prototype.load = loadLanguage;
    Object.assign(globalThis, { MutationObserver, requestAnimationFrame, cancelAnimationFrame, reportError });
  }
  assert.equal(host.childElementCount, 0);
});

loaded.clear();
const merge = await loadMerge();
hooks.deregister();

await t("viewer startup defers CodeMirror and its configuration, and prefetch starts CodeMirror alone", () => {
  assert.deepEqual(eager, []);
  assert.equal(prefetchStarted, true);
  assert.deepEqual(prefetched, manifest.initial["cm.js"]);
  assert.deepEqual([...loaded], ["merge.js"]);
  assert.ok(manifest.initial["merge.js"].every((file) => file === "merge.js" || prefetched.includes(file)));
});

await t("editor configuration keeps page attributes, read-only state and the save and ask keys", async () => {
  const { createEditorConfiguration } = await import("../modules/files/editor-extensions.js");
  const asks = [];
  let saves = 0;
  const { prepareExtensions } = createEditorConfiguration(cm, { onAsk: (lines) => asks.push(lines) });
  const extensions = prepareExtensions({
    name: "note.md", isMd: true, page: true, pageExt: [], onUpdate() {},
    onSave() { saves++; },
  });
  const state = cm.EditorState.create({ doc: "first\nsecond", selection: { anchor: 0, head: 8 }, extensions: extensions(true) });
  assert.equal(state.facet(cm.EditorState.readOnly), true);
  assert.equal(state.facet(cm.EditorView.editable), false);
  assert.deepEqual(state.facet(cm.EditorView.contentAttributes).find((attrs) => attrs["aria-label"]), {
    "aria-label": "note.md, as a page", spellcheck: "false",
  });
  const bindings = state.facet(cm.keymap).flat();
  const save = bindings.find(({ key }) => key === "Mod-s");
  assert.equal(save.preventDefault, true);
  assert.equal(save.run({ state }), true);
  assert.equal(saves, 1);
  assert.equal(bindings.find(({ key }) => key === "Mod-l").run({ state }), true);
  assert.deepEqual(asks, [{ a: 1, b: 2 }]);
});

await t("a selection paints the shared selection fill, outranking CodeMirror's own focused default", async () => {
  const { createEditorConfiguration } = await import("../modules/files/editor-extensions.js");
  const { prepareExtensions } = createEditorConfiguration(cm, {});
  const rules = [];
  const walk = (ext) => {
    if (Array.isArray(ext)) ext.forEach(walk);
    else if (ext && Array.isArray(ext.value?.rules)) rules.push(...ext.value.rules);
    else if (ext?.inner) walk(ext.inner);
  };
  walk(prepareExtensions({ name: "a.md", isMd: true, page: true, pageExt: [], onUpdate() {} })(false));
  const focused = rules.find((rule) => /\.cm-focused > \.cm-scroller > \.cm-selectionLayer \.cm-selectionBackground[,{ ]/.test(rule));
  assert.ok(focused, "the focused selection rule matches CodeMirror's own focused selector");
  assert.ok(focused.includes("background-color: var(--fill-selection)"), focused);
});

await t("cm.js and merge.js export exactly the names the manifest lists", () => {
  assert.deepEqual(Object.keys(cm).sort(), manifest.exports["cm.js"]);
  assert.deepEqual(Object.keys(merge).sort(), manifest.exports["merge.js"]);
  for (const n of ["EditorState", "EditorView", "keymap", "defaultKeymap", "history", "searchKeymap", "syntaxHighlighting",
    "LanguageSupport", "LanguageDescription", "autocompletion", "markdown", "markdownLanguage", "markdownKeymap",
    "commonmarkLanguage", "insertNewlineContinueMarkup", "deleteMarkupBackward", "tags", "styleTags",
    "classHighlighter", "highlightTree", "Tree", "NodeProp", "languages"]) assert.ok(n in cm, `cm.js has no ${n}`);
  for (const n of ["MergeView", "unifiedMergeView", "getChunks", "acceptChunk", "rejectChunk", "goToNextChunk", "goToPreviousChunk"]) assert.ok(n in merge, `merge.js has no ${n}`);
  assert.equal(cm.Line, cm.EditorState.create({ doc: "x" }).doc.line(1).constructor, "Line is @codemirror/state's");
});

await t("merge.js's extensions work in a state made by cm.js (same @codemirror/state instance)", () => {
  const state = cm.EditorState.create({ doc: "a\nb\nc", extensions: [cm.markdown(), merge.unifiedMergeView({ original: "a\nB\nc" })] });
  const chunks = merge.getChunks(state);
  assert.ok(chunks && chunks.chunks.length === 1, "unifiedMergeView found no chunk");
  const next = state.update({ changes: { from: 0, insert: "# " } }).state;
  assert.equal(next.doc.toString(), "# a\nb\nc");
  assert.match(cm.syntaxTree(next).toString(), /^Document\(ATXHeading1/);
});

await t("languages: Python loads lazily from its own chunk and parses", async () => {
  const py = cm.languages.find((l) => l.name === "Python");
  assert.ok(py, "no Python in languages");
  const support = await py.load();
  assert.ok(support instanceof cm.LanguageSupport, "Python's load() isn't a LanguageSupport from cm.js");
  const st = cm.EditorState.create({ doc: "def f(x):\n  return x\n", extensions: [support] });
  assert.match(cm.ensureSyntaxTree(st, st.doc.length, 5000).toString(), /^Script\(FunctionDefinition/);
  assert.ok(!manifest.initial["cm.js"].some((f) => /python/i.test(f)), "Python is in cm.js's first load");
  assert.ok(Object.keys(manifest.files).some((f) => /^c\/.*python/i.test(f)), "no lazy Python chunk");
  assert.equal(cm.LanguageDescription.matchFilename(cm.languages, "main.rs")?.name, "Rust");
});

await t("every bundled package carries its licence", () => {
  const lic = readFileSync(join(VENDOR, "LICENSES.md"), "utf8");
  for (const p of Object.keys(manifest.bundled)) assert.ok(lic.includes(`## ${p}@${manifest.bundled[p]} `), `${p} has no licence entry`);
  for (const p of Object.keys(manifest.pinned)) assert.ok(p in manifest.bundled, `${p} is pinned but isn't bundled`);
});

console.log(`\n${passed} passed`);
