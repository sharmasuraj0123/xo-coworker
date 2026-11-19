// The panel's pages are the kernel's panel.page entries: registered through it, read from it, replaced on a second register.
import assert from "node:assert/strict";

globalThis.matchMedia = () => /** @type {any} */ ({ matches: false, addEventListener() {}, addListener() {} });
const { createKernel } = await import("../../core/kernel/index.js");
const { definePlaces } = await import("../places.js");
const { createPages } = await import("../panel/pages.js");

const K = createKernel({ warn: () => {}, log: () => {} });
definePlaces(K);
const S = { h: {} };
const noop = () => {};
const shell = /** @type {any} */ (noop);
const P = createPages({ el: {}, S, places: K.places, at: () => ({}), view: () => "home", threads: null, shell, nameOf: () => () => "", open: noop, close: noop, setFull: noop, apply: noop, paint: noop, onChange: noop });

assert.equal(K.places.get("panel.page", "shell")?.title(), "Shell", "the shell page is contributed when the panel has shells");
const files = { title: () => "Files", single: true, mount: noop };
P.page("files", files);
assert.equal(K.places.get("panel.page", "files").title(), "Files");
assert.equal(K.places.get("panel.page", "files").owner, "xo.shell");
assert.equal(P.PAGES.get("files").single, true, "the panel reads its pages from the place");
P.page("files", { ...files, title: () => "Files again" });
assert.equal(K.places.entries("panel.page").filter((/** @type {any} */ e) => e.id === "files").length, 1, "a second register replaces, never throws");
assert.equal(P.PAGES.get("files").title(), "Files again");
assert.equal(P.PAGES.get("nothing"), undefined);
assert.deepEqual(S.tabs, [], "no tabs until a page shows");
console.log("ok panel pages: through the kernel's panel.page");

// a page from a place entry (an app's): its title and icon may be plain strings, its mount gets where it is and returns its undo
{
  const made = [];
  const node = () => { const n = { dataset: {}, hidden: false, children: [], append(c) { this.children.push(c); }, remove() { n.removed = true; }, classList: { toggle() {}, remove() {} } }; made.push(n); return n; };
  globalThis.document = /** @type {any} */ ({ createElement: node });
  const host = node(), el = { dataset: {}, classList: { toggle() {}, remove() {} }, querySelector: (s) => (s === ".stg-page" ? host : null), contains: () => false };
  const K2 = createKernel({ warn: () => {}, log: () => {} });
  definePlaces(K2);
  const S2 = { h: {}, open: true, full: false };
  const P2 = createPages({ el, S: S2, places: K2.places, at: () => ({ view: "t:1", project: "p1", thread: "1" }), view: () => "t:1", threads: null, shell: null, nameOf: () => () => "", open: noop, close: noop, setFull: noop, apply: noop, paint: noop, onChange: noop });
  const seen = [];
  let undone = 0;
  K2.places.contribute("panel.page", { id: "dev.word:outline", title: "Outline", icon: "plug", mount: (box, at) => { seen.push(at); return () => { undone++; }; } }, "xo.apps-host");
  assert.equal(P2.show("dev.word:outline", "dev.word:outline", { focus: true, at: { full: true } }), true);
  assert.deepEqual(seen, [{ view: "t:1", project: "p1", thread: "1", full: true, key: "dev.word:outline" }], "mount gets the panel's place, what the opener said, and the tab's key");
  assert.deepEqual(P2.pages().map((t) => t.title), ["Outline"], "a plain string title");
  assert.equal(await P2.closeTab("dev.word:outline"), true);
  assert.equal(undone, 1, "closing the tab runs the undo its mount gave");
  // an app turned off: its entry goes, and so do its tab, its box and its view, without asking
  const fulls = [];
  const S3 = { h: {}, open: true, full: false };
  const K3 = createKernel({ warn: () => {}, log: () => {} });
  definePlaces(K3);
  const P3 = createPages({ el, S: S3, places: K3.places, at: () => ({ project: "p1" }), view: () => "t:1", threads: null, shell: null, nameOf: () => () => "", open: noop, close: noop, setFull: (on) => { fulls.push(on); S3.full = on; }, apply: noop, paint: noop, onChange: noop });
  const off = K3.places.contribute("panel.page", { id: "dev.word:big", title: "Big", mount: () => () => { undone++; } }, "xo.apps-host");
  P3.show("dev.word:big", "dev.word:big", { at: { full: true } });
  assert.deepEqual(fulls, [true], "an app asking for full size gets it");
  const before = undone;
  off();
  assert.equal(undone, before + 1, "its view's undo ran");
  assert.deepEqual(S3.tabs.map((t) => t.name), [], "its tab went");
  assert.equal(S3.page, null);
  P3.page("thread", { title: (key) => `Thread ${key}`, single: true, mount: noop });
  P3.show("thread", "t42");
  assert.deepEqual(P3.pages().map((t) => t.title), ["Thread t42"], "a single page's title is for the key it shows, as its tab says");
  await P3.closeTab("thread");
  P3.page("files", { title: () => "Files", single: true, mount: noop });
  P3.show("files");
  P3.page("files", { title: () => "Files again", single: true, mount: noop });
  assert.deepEqual(S3.tabs.map((t) => t.name), ["files"], "registering a page again keeps its open tab");
  delete globalThis.document;
}
console.log("ok panel pages: place entries host as pages");
