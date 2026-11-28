// @ts-check

import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createTranscriptFolds } from "../transcript-folds.js";

const { document } = await dom('<div id="main"></div><div id="panel"></div>');
const main = document.querySelector("#main");
const panel = document.querySelector("#panel");
const folds = createTranscriptFolds();
const before = folds.open();
folds.toggle("block", { host: panel, restoreFocus: true });
assert.equal(folds.open().block, true);
assert.equal(Object.hasOwn(before, "block"), false, "a redraw's earlier snapshot stays stable");
assert.equal(folds.takeChange(main) === null, true, "another conversation cannot consume the fold's focus change");
const changed = folds.takeChange(panel);
assert.equal(changed?.host === panel, true);
assert.equal(changed?.restoreFocus, true);
assert.equal(folds.takeChange(panel) === null, true, "the focus change is consumed only once");
folds.toggle("block");
assert.equal(folds.open().block, false, "readers share the fold state without requiring a focused opener");
