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
const P = createPages({ el: {}, S, places: K.places, view: () => "home", threads: null, shell, nameOf: () => () => "", open: noop, close: noop, setFull: noop, apply: noop, paint: noop, onChange: noop });

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
