// The panel's Threads (the owner, 19 Nov): the frame that was Agents lists every thread of the place in one
// vocabulary; the Map starts folded, in its Graph; the panel says the place's name; Launchpad shows only when
// the header's Deploy opens it; the project header counts in the same words and opens the panel.
//   node tests/panel-threads.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stage = readFileSync(new URL("../js/stage.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const map = readFileSync(new URL("../js/map.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8");

// the frame
assert.match(stage, /frame\("agents", "Threads"/, "the Agents frame is Threads");
assert.match(stage, /data-switch aria-haspopup="dialog"[^`]*title="Find a thread"/, "its head searches every thread");
assert.match(stage, /const SHOW = \{ needs: Infinity, working: Infinity, waiting: 5, done: 5 \}/);
assert.match(stage, /groups: \{ done: true \}/, "Done is folded at first");
assert.doesNotMatch(stage.replace(/\/\/[^\n]*/g, ""), /Agentic Control Pane/, "the panel says the place, not its old name");

// the Map: folded and Graph at first; a choice you made still wins
assert.match(stage, /map: \{ h: MAP_H, folded: true \}/);
assert.match(stage, /const FR_KEY = "xo-stage-frames-3"/, "fresh frame state, so the new defaults apply");
assert.match(map, /mode: "graph",/);
assert.match(map, /getItem\(MODE_KEY\) === "tree"\) M\.mode = "tree"/);

// Launchpad: only while open
assert.match(stage, /const lpOn = lpCan && S\.lp;\n\s*LPF\.hidden = !lpOn;/);

// one vocabulary: the four words, and how a thread gets one
assert.match(app, /const STATE_WORDS = \{ needs: "Needs you", working: "Working", waiting: "Waiting", done: "Done" \}/);
const fn = app.slice(app.indexOf("function threadState("), app.indexOf("function panelThreads("));
const threadState = new Function("isBusy", `${fn}; return threadState;`)((t) => !!t.busy);
const needs = [{ t: { id: "a" }, admitted: true, group: "now" }];
assert.equal(threadState({ id: "a", state: "working" }, needs), "needs");
assert.equal(threadState({ id: "b", state: "working", busy: true }, needs), "working");
assert.equal(threadState({ id: "c", state: "working" }, needs), "waiting", "an open thread whose agent is idle waits");
for (const s of ["done", "resolved", "failed", "stopped"]) assert.equal(threadState({ id: "d", state: s }, needs), "done", s);
assert.equal(threadState({ id: "e", state: "working", frozen: true }, needs), "done", "a frozen (continued) thread is done");

// the header: the same words, and the counts open the panel
assert.match(app, /data-stage-open title="Open its threads in the panel"/);
assert.match(app, /else if \(e\.target\.closest\?\.\("\[data-stage-open\]"\)\) STAGE\.open\(\)/);
assert.doesNotMatch(app, /class="all-btn th-btn"/, "the header's Threads button moved into the panel");

// the group heads: tokens only (a 1 px line aside)
const block = css.slice(css.indexOf("── Threads (the frame that was Agents)"));
assert.ok(block.length > 100);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b/, "no literal sizes");

console.log("panel-threads: ok");
