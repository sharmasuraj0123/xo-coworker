// Back from a page clears the head: the sections' head is empty, and the region cache must not mistake its reset for that
//   node tests/stage-head-back.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const stage = readFileSync(new URL("../js/stage.js", import.meta.url), "utf8");

const setLine = stage.match(/const set = \(k, node, html\) => \{[^\n]*\};/)[0];
const pc = stage.slice(stage.indexOf("  function pageChanged("), stage.indexOf("\n  }\n", stage.indexOf("  function pageChanged(")));
const reset = pc.match(/\n\s*([^\n]*?); paint\(\);/)[1];
const init = stage.match(/const S = \{[^\n]*?\};/)[0].replace(/^const S = /, "(").replace(/;$/, ")");

const run = new Function("drawn", `
  const S = ${init};
  const redraw = (node, html) => { drawn.push(html); };
  ${setLine}
  set("head", null, '<button class="pg-back"></button><b class="stg-name">A thread</b>');
  ${reset};
  set("head", null, "");
  return drawn;`);
const drawn = run([]);
assert.equal(drawn.length, 2, "going back to the sections redraws the head");
assert.equal(drawn[1] === "", true, "the head drawn on return is the sections' empty one");
assert.match(stage, /if \(!S\.page\) return "";/);
console.log("stage-head-back: ok");
