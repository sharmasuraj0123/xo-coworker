import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hopNotes } from "../js/timeline.js";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const js = read("js/app.js"), rich = read("core/ui/markdown/rich.css").replace(/\/\*[\s\S]*?\*\//g, "");
let failed = 0;
const t = (name, fn) => { try { fn(); console.log(`  ok  ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n${e.message}`); } };

const body = js.slice(js.indexOf("function msgItemsOf("), js.indexOf("\n}\n", js.indexOf("function msgItemsOf(")));

t("only a thread names its speakers", () => {
  assert.match(body, /const named = !!convThread\(conv\);/);
  assert.match(body, /const anon = !named \|\| spoke === name \|\| under;\n\s*spoke = name;/);
  assert.match(body, /\$\{anon \? " m-anon" : ""\}/);
});
t("you, the agent's turn and a new day each reset who spoke last", () => {
  assert.match(body, /if \(m\.who === "you"\) \{\n\s*spoke = "you";/);
  assert.match(body, /spoke = nameOf\(conv, "agent"\)\[0\];\n\s*html = `<div class="m m-them m-turn/);
  assert.match(body, /day = d; prev = null; above = null; spoke = null; \}/);
});
t("the rule, run: a thread names the coordinator once, then the agent once after its turn", () => {
  const seq = [["you", "you"], ["coord", "c"], ["coord", "c"], ["turn", "a"], ["agent", "a"], ["coord", "c"]];
  const run = (named) => { let spoke = null; return seq.map(([who, name]) => { if (who === "you" || who === "turn") { spoke = name; return null; } const anon = !named || spoke === name; spoke = name; return anon; }).filter((x) => x !== null); };
  assert.deepEqual(run(true), [false, true, true, false]);
  assert.deepEqual(run(false), [true, true, true, true]);
});
t("the chat view hides an unnamed speaker's mark and name line; the bubbles keep their own", () => {
  assert.match(rich, /:root:not\(\[data-msgx\]\) \.m-anon>\.av,:root:not\(\[data-msgx\]\) \.m-anon>\.mb>\.mh\{display:none\}/);
});

t("words under the line that introduces them are one exchange: no name line, 8 under the line", () => {
  const th = { id: "T" };
  const hops = [
    { id: "q", thread_ts: "T", from_role: "thread", to_role: "project-coordinator", kind: "ask", note: "Is :3000 free?", created_at: "2026-11-21T07:00:00Z" },
    { id: "a", thread_ts: "T", from_role: "project-coordinator", to_role: "thread", kind: "answer", note: "Yes.", cause: "q", created_at: "2026-11-21T07:01:00Z" },
  ];
  const [q, a] = hopNotes(th, hops);
  assert.equal(a.cause, "q");
  assert.equal(q.dir, "up");
  const app = read("js/app.js");
  assert.match(app, /who: "asked", text: n\.text, hop: n\.id/);
  assert.match(app, /role: n\.kind, cause: n\.cause/);
  assert.match(app, /const under = !!\(above && \(\(m\.cause && above\.who === "asked" && above\.hop === m\.cause\) \|\| \(m\.lead && above\.key === m\.lead\)\)\);/);
  assert.match(app, /prev = above = m;/, "a turn that draws nothing leaves the line above as it was");
  assert.match(app, /prev = null; above = null; spoke = null;/, "a new day breaks an exchange");
  assert.match(app, /x\.who === "coord" && !x\.lead && x\.key\.startsWith\("hopn:"\) && x\.seq > c\.seq && x\.at - c\.at >= 0 && x\.at - c\.at < 10000/, "a note already delivered by one steer is never another's");
  assert.match(app, /x\.ctl\.action === "steer" && x\.seq != null\)\.sort\(\(a, b\) => a\.seq - b\.seq\)/, "steers pair in order");
  assert.match(app, /prev\.who === m\.who && prev\.name === m\.name/, "the Workspace coordinator after the project's is a new speaker");
  assert.match(rich, /\.ev\.is-lead\{margin-bottom:var\(--s-2\)\}/);
  assert.doesNotMatch(rich, /:has\(\+\.m-under\)/, "marked when drawn, never found with :has()");
  assert.match(rich, /\.ev\+\.m\.m-under\{margin-top:var\(--s-2\)\}/);
});

t("the pairing, run: an answer pairs only with the question right above it that it answers", () => {
  const pair = (seq) => { let above = null; return seq.flatMap((m) => { if (m.empty) return []; const u = m.who === "coord" ? !!(above && ((m.cause && above.who === "asked" && above.hop === m.cause) || (m.lead && above.key === m.lead))) : null; above = m; return u === null ? [] : [u]; }); };
  const Q = { who: "asked", hop: "q", key: "hopn:q" }, S = { who: "control", key: "ctl:1" };
  assert.deepEqual(pair([Q, { who: "coord", cause: "q" }]), [true]);
  assert.deepEqual(pair([Q, { who: "turn", empty: true }, { who: "coord", cause: "q" }]), [true]);
  assert.deepEqual(pair([Q, { who: "agent" }, { who: "coord", cause: "q" }]), [false]);
  assert.deepEqual(pair([Q, { who: "coord", cause: "other" }]), [false]);
  assert.deepEqual(pair([S, { who: "coord", lead: "ctl:1" }]), [true]);
  assert.deepEqual(pair([S, { who: "coord" }]), [false]);
});


if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log("speaker-names: all passed");
