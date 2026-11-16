// The picker's parts are keyed, so its redraw keeps each whatever comes and goes before it (the create-project grader
// on 0e75a32, S071, 12/12: choosing a project's runtime under Runtime, routing sent the change and recorded its Undo,
// but focus fell to the page). js/redraw.js keeps a node by its key (id, data-key, data- hooks) and matches the rest
// by tag, in order. A runtime chosen clears the model list ("Reading the models…" in its place), so the unkeyed parts
// after it were matched to the wrong old ones: the runtime row was drawn anew, and the Claude Code you'd pressed went.
//   node tests/picker-keys.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/intel.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("every part that can come and go has its key: the reading line, the models, thinking, the folded part, runtime, routing", () => {
  for (const [what, re] of [
    ["the reading line", /<p class="iq-rl" data-key="reading">/],
    ["the models", /<div class="iq-list" data-key="models" role="radiogroup"/],
    ["thinking", /<div class="iq-route iq-depth" data-key="depth" role="radiogroup"/],
    ["the folded part", /<div class="iq-moreb" data-key="more">/],
    ["runtime", /<div class="iq-sec iq-rts" data-key="rts">/],
    ["routing", /<div class="iq-sec" data-key="route"><p class="iq-lab" id="iq-ro-l">Who routes a new message/],
  ]) assert.match(src, re, what);
});
t("the full picker's render draws in place, with redraw, never by replacing its HTML", () => {
  const r = src.slice(src.indexOf("  function render() {"), src.indexOf("  const CHECK ="));
  assert.match(r, /redraw\(pop, html\);/);
  assert.doesNotMatch(r, /pop\.innerHTML\s*=/);
});
t("no unkeyed section is drawn after the part that comes and goes: every iq-sec, iq-list and iq-moreb div has a key", () => {
  const r = src.slice(src.indexOf("  function runtimeHtml(s) {"), src.indexOf("  const CHECK ="));
  const unkeyed = [...r.matchAll(/<div class="(iq-sec[^"]*|iq-list|iq-moreb|iq-route iq-depth)"(?![^>]*(data-key|id=))/g)].map((m) => m[1]);
  assert.deepEqual(unkeyed, [], `unkeyed: ${unkeyed.join(", ")}`);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
