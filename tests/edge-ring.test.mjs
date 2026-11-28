import assert from "node:assert/strict";
import { dom } from "./lib/dom.mjs";
import harness from "./browser/harness.cjs";

const { document } = await dom('<input id="file-search">');
const field = document.querySelector("input");
Object.assign(globalThis, {
  innerWidth: 800, innerHeight: 600,
  requestAnimationFrame: fn => fn(0),
  getComputedStyle: () => ({ outlineStyle: "solid", outlineOffset: "1px", outlineWidth: "2px" }),
});
Object.defineProperty(document.documentElement, "clientWidth", { value: 800 });
let y = 0;
field.getBoundingClientRect = () => ({ left: 20, right: 120, top: y, bottom: y + 30, width: 100, height: 30 });
const page = { evaluate: (fn, arg) => fn(arg) };
const sweep = () => harness.ringClips(page, "File in the panel");
assert.deepEqual((await sweep()).cut, ["File in the panel: input#file-search at the screen's edge: top"]);
y = 4;
assert.deepEqual((await sweep()).cut, []);
