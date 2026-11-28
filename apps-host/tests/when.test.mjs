import assert from "node:assert/strict";
import { parseWhen, holds } from "../when.js";

const w = /** @type {any} */ (parseWhen("view == 'thread' && canvas.app == 'dev.x' || view == 'project'"));
assert.equal(holds(w, { view: "thread", "canvas.app": "dev.x" }), true);
assert.equal(holds(w, { view: "thread", "canvas.app": "other" }), false);
assert.equal(holds(w, { view: "project" }), true);
assert.equal(holds(/** @type {any} */ (parseWhen("view != 'home'")), { view: "thread" }), true);
assert.equal(holds(undefined, {}), true);
assert.match(String(parseWhen("view == thread")), /must look like/);
assert.match(String(parseWhen("window.x == 'y'")), /isn't one of/);
assert.match(String(parseWhen("view == 'a'; alert(1)")), /must look like/);
assert.match(String(parseWhen("")), /short text/);
console.log("ok when: a tiny vocabulary, no code");
