// @ts-check

import assert from "node:assert/strict";
import { sheet } from "../../../tests/lib/cascade.mjs";

const css = sheet(new URL("../automations.css", import.meta.url));
const held = [...css.matchAll(/\.au-row>:not\(([^)]*)\)\{([^}]*)\}/g)].filter(([, , d]) => /(^|;)position:/.test(d));
assert.ok(held.length, "a row's parts sit above its open button");
for (const [, kept] of held) assert.match(kept, /\.au-menu/, "the ••• menu floats under its button, out of the row's grid");
assert.match(css, /\.au-menu\{position:absolute;right:0;top:/);
console.log("row-css: ok");
