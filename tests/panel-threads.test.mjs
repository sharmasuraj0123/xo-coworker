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
assert.match(stage, /class="fr-ib" data-tg-find aria-controls="fr-body-agents" title="Filter threads \(\/\)"/, "its head's search filters here, in place");
assert.doesNotMatch(stage, /data-switch/, "no sheet from the panel");
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
// the Threads control beside Deploy (the owner, 19 Nov 14:16Z / 14:20Z picked A): "Threads" and how many, the working
// arc and its number, the needs-you mark and its number; one 32 control (.tw-act) among the actions; opens Threads
assert.match(app, /class="tw-act th-ctl" data-stage-open aria-controls="stage" title="\$\{esc\(words\)\}: open them in the panel"/);
assert.match(app, /\$\{ICON\.threadOne\}<span class="th-w">Threads<\/span><span class="th-n">\$\{n\}<\/span>\$\{live\}/);
assert.match(app, /g-working" aria-hidden="true"><\/i><span class="pj-k">\$\{by\.working\}/);
assert.match(app, /g-needs_reply" aria-hidden="true"><\/i><span class="pj-k">\$\{by\.needs\}/);
assert.match(app, /\(pv \? S\.hdrCtl \+ LP\.button\(v, STAGE\.launchOpen\) : ""\) \+ STAGE\.button\(v\)/, "before Deploy and the panel's toggle");
assert.doesNotMatch(app, /xo-hdr-opt/, "the exploration switch is gone");
const appCss = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
const th = appCss.slice(appCss.indexOf("── The project header's Threads control"));
assert.ok(th.length > 200, "the block is there");
assert.doesNotMatch(th.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\b1px solid\b/g, "").replace(/@container top \([^)]*\)/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b/, "tokens only");
assert.match(app, /<span class="tw-t is-one"><h1 id="conv-title"/);
assert.match(app, /else if \(e\.target\.closest\?\.\("\[data-stage-open\]"\)\) STAGE\.threads\(\)/, "the header's Threads shows Threads, open or not");

// with the panel open, the header's Threads still answers: Shell and Launchpad give way, Threads unfolds, focus lands
// on its first thread and its head glows (the owner, 19 Nov 14:50Z: "clicking on threads doesn't do anything")
const stg = readFileSync(new URL("../js/stage.js", import.meta.url), "utf8");
const thFn = stg.slice(stg.indexOf("    threads() {"), stg.indexOf("    },", stg.indexOf("    threads() {")));
assert.match(thFn, /if \(S\.page\) sections\(\{ paint: false \}\);\s*S\.lp = false; fr\.agents\.folded = false;\s*open\(\{ focus: false \}\);/);
assert.match(thFn, /\(b\.querySelector\("\.tg-box \[data-go\]"\) \|\| el\.querySelector\('\[data-fr-fold="agents"\]'\)\)\?\.focus/);
assert.match(thFn, /f\.classList\.add\("is-flash"\)/);

// one count (the owner, 19 Nov 14:50Z: 35 in the header, 73 in the panel): every thread of the project, by state;
// the header and the panel's head both say it; the coordinator's row isn't a thread
const cf = app.slice(app.indexOf("function threadCounts("), app.indexOf("\n}\n", app.indexOf("function threadCounts(")) + 2);
const threadCounts = new Function("world", "threadState", `${cf}; return threadCounts;`)(
  { state: { threads: [{ project: "p", s: "working" }, { project: "p", s: "done" }, { project: "p", s: "done" }, { project: "q", s: "waiting" }, { project: "p", s: "waiting" }] } },
  (t) => t.s);
assert.deepEqual(threadCounts("p", []), { all: 4, needs: 0, working: 1, waiting: 1, done: 2 });
assert.match(app, /const by = threadCounts\(pid, needs\);/);
assert.match(app, /S\.hdrCtl = threadsCtl\(by\.all, by\);/);
assert.match(stg, /tg\.reduce\(\(n, x\) => n \+ x\.rows\.filter\(\(r\) => !r\.coord\)\.length, 0\)/, "the panel's head counts threads, not the coordinator");
assert.match(app, /const ts = world\.state\.threads\.filter\(\(t\) => t\.project === pid\)\.sort/, "the panel lists every thread of the project");
assert.doesNotMatch(app, /class="all-btn th-btn"/, "the header's Threads button moved into the panel");

// the group heads: tokens only (a 1 px line aside)
const block = css.slice(css.indexOf("── Threads (the frame that was Agents)"), ((css.indexOf("/* ──", css.indexOf("── Threads (the frame that was Agents)") + 4) + 1) || css.length + 1) - 1);
assert.ok(block.length > 100);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\b1px solid\b/g, "").replace(/@media \([^)]*\)/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b/, "no literal sizes");

// Threads above Changes (the owner, 19 Nov 13:42Z): the order, the lines between, the rail; files arriving open Changes
assert.match(stage, /const ORDER = \["agents", "changes", "map"\];/);
assert.ok(stage.indexOf('frame("agents", "Threads"') < stage.indexOf('frame("changes", "Changes"'), "Threads is drawn first");
assert.match(stage, /gutter\("agents", "changes"\)/); assert.match(stage, /gutter\("changes", "map"\)/);
assert.match(stage, /if \(S\.chEmpty === true && !empty && fr\.changes\.folded\) \{ fr\.changes\.folded = false; persist\(\); \}/);

// the agent's mark, quiet: under the row's time, small, in the panel and in All threads alike
{ const a = stage.indexOf('<span class="ag-tm"><span class="ag-when">'), b = stage.indexOf('<span class="ag-mk">${r.mark}</span>'); assert.ok(a > 0 && b > a, "the mark sits under the time, in the right column"); }
assert.doesNotMatch(stage, /<b>\$\{r\.mark/, "not before the title");
assert.match(app, /<span class="ar-a"><span>\$\{esc\(short\(t\.lastAt\)\)\}<\/span>\$\{threadMark\(t\) \? `<span class="ar-mk">/);
assert.doesNotMatch(app, /<span class="ar-tl">\$\{threadMark/, "not before All threads' title");
assert.match(readFileSync(new URL("../core/ui/tokens.css", import.meta.url), "utf8"), /--mark-sm:var\(--s-3\);/);
assert.match(css, /\.stage \.ag-mk \.agm\{width:var\(--mark-sm\);height:var\(--mark-sm\)/);

console.log("panel-threads: ok");
