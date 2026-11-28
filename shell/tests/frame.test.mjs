import assert from "node:assert/strict";
import { dom } from "../../tests/lib/dom.mjs";

const { document } = await dom('<div id="app"><main id="main"><section id="home"></section><div id="dock"></div></main></div>');
await import("../frame.js");

assert.equal(Boolean(document.querySelector('#all, [aria-labelledby="all-h"]')), false, "The retired All Threads dialog is absent from the shell");
assert.ok(document.querySelector('#keys[role="dialog"]'), "The shell still mounts its other dialogs");
