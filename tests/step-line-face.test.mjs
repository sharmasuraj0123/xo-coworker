// A step's line reads in the row's face: a sub-agent's title is words, not code; a file target stays code.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { stepLineHtml, turnHtml } = await import("../js/turnview.js");
const sub = stepLineHtml("Sub-agent: `Read-only regression review`", "subagent");
assert.equal(sub, "Sub-agent: Read-only regression review");
assert.equal(stepLineHtml("Sub-agent: `<b>`", "subagent").includes("<b>"), false, "the title is escaped");
assert.match(stepLineHtml("Edited `app.py`", "edit_file"), /<code[^>]*>app\.py<\/code>/);
const turn = { id: "t", status: "finished", at: "2026-11-23T18:00:00Z" };
const step = { kind: "subagent", status: "ok", line: "Sub-agent: `Read-only regression review`", call_id: "agent-call" };
const block = { id: "work", done: true, type: "activity", rows: [step] };
const expanded = turnHtml(turn, [block], { open: { work: true } });
assert.match(expanded, /<span class="tb-rl">Sub-agent: Read-only regression review<\/span>/);
assert.match(expanded, /data-run-call="agent-call"/);
const map = readFileSync(new URL("../js/map.js", import.meta.url), "utf8");
assert.match(map, /stepLineHtml\(commsText\(ag\.now\.line\) \|\| ag\.now\.tool \|\| "Working", ag\.now\.kind\)/);
console.log("step-line-face: ok");
