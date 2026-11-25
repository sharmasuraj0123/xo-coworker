import assert from "node:assert/strict";
import { parseHTML } from "linkedom";

const { document, window } = parseHTML('<aside><button data-open-files></button><button data-stg-shell></button><div class="stg-page"></div></aside>');
globalThis.document = document;
globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, addListener() {} });
window.HTMLElement.prototype.getAnimations = () => [];

const { createKernel } = await import("../../core/kernel/index.js");
const { definePlaces } = await import("../places.js");
const { createPages } = await import("../panel/pages.js");

const K = createKernel({ warn: () => {}, log: () => {} });
definePlaces(K);
const el = document.querySelector("aside");
const state = { open: true };
const location = { view: "t:1", project: "p1", thread: "1" };
const log = [];
let closed = false;
let placeless = false;
let allowClose = false;
let closeError = null;
const { createScope } = await import("../../core/kernel/scope.js");
const scope = createScope();
const panel = createPages({
  scope,
  el, S: state, places: K.places, at: () => location, view: () => location.view,
  threads: () => [{ k: "needs", rows: [{}] }], shell: (on) => log.push(["shell", on]),
  nameOf: () => () => "Project", placeless: () => placeless, open: () => { state.open = true; },
  close: () => { panel.dropPages(); state.open = false; closed = true; }, paint: () => panel.reflect(),
});

const filesButton = el.querySelector("[data-open-files]");
const shellButton = el.querySelector("[data-stg-shell]");
const box = (name) => el.querySelector(`[data-pg="${name}"]`);
const mount = (host, at) => { log.push(["mount", at]); return () => log.push(["undo"]); };
const files = {
  title: "Files", mount, async canClose() { if (closeError) throw closeError; return allowClose; },
  onShow: (key, { focus }) => log.push(["show", key, focus]),
  onHide: (key) => log.push(["hide", key]), close: (key) => log.push(["close", key]),
};
panel.page("files", files);
panel.page("files", { ...files, title: "All files" });
assert.equal(K.places.entries("panel.page").filter((entry) => entry.id === "files").length, 1);
assert.equal(K.places.get("panel.page", "files").owner, "xo.shell");

assert.equal(panel.show("files", "p1", { focus: true }), true);
assert.equal(filesButton.getAttribute("aria-pressed"), "true");
assert.equal(box("files").hidden, false);
assert.deepEqual(log.splice(0), [["mount", { ...location, key: "p1" }], ["show", "p1", true]]);
assert.match(panel.titleHtml(), /Back to Threads, Changes and Map, something needs you/);

panel.show("files", "p2");
assert.deepEqual(log.splice(0), [["show", "p2", false]]);
panel.setShell(true);
assert.equal(box("files").hidden, true);
assert.equal(box("shell").hidden, false);
assert.equal(shellButton.getAttribute("aria-pressed"), "true");
assert.match(panel.titleHtml(), /Back to All files/);
assert.deepEqual(log.splice(0), [["hide", "p2"], ["shell", true]]);
panel.back();
assert.equal(box("files").hidden, false);
assert.equal(box("shell").hidden, true);
assert.deepEqual(log.splice(0), [["shell", false], ["show", "p2", false]]);

assert.equal(await panel.requestClose(), false);
assert.equal(closed, false);
assert.equal(box("files").hidden, false);
const failures = [];
const oldReporter = globalThis.reportError;
globalThis.reportError = (error) => failures.push(error);
try {
  closeError = new Error("close guard failed");
  assert.equal(await panel.requestClose(), false);
  assert.equal(closed, false);
  assert.equal(box("files").hidden, false);
  assert.deepEqual(failures, [closeError]);
} finally {
  closeError = null;
  globalThis.reportError = oldReporter;
}
allowClose = true;
assert.equal(await panel.requestClose(), true);
assert.equal(closed, true);
assert.deepEqual(log.splice(0), [["hide", "p2"], ["close", "p2"]]);
assert.equal(filesButton.getAttribute("aria-pressed"), "false");
assert.equal(box("files").hidden, true);

const off = K.places.contribute("panel.page", { id: "dev.word:outline", title: "Outline", mount }, "xo.apps-host");
assert.equal(panel.show("dev.word:outline", "one", { at: { full: true } }), true);
assert.deepEqual(log.splice(0), [["mount", { ...location, full: true, key: "one" }]]);
assert.match(panel.titleHtml(), />Outline<\/b>/);
off();
assert.equal(box("dev.word:outline") === null, true);
assert.equal(panel.titleHtml(), "");
assert.deepEqual(log.splice(0), [["undo"]]);

placeless = true;
assert.equal(panel.show("files"), false);
assert.equal(box("files").hidden, true);
scope.dispose();
assert.equal(scope.size, 0);
console.log("panel pages: one page, shell Back, close confirmation, and kernel registration");
