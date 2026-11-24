// The coordinator speaks in its violet in every view: the bubbles' colour (its name in violet over the label's grey,
// a violet ring round its mark) is two tokens, and the chat view uses the same two on every coordinator message,
// in a thread: a note it sends the thread and one of its messages relayed into it. In its own chat (the project's,
// the Workspace's) it is the one speaking and stays neutral, as in bubbles.
// The owner, 19 Nov 14:31Z: "can we keep the purple accent for coordinator's message as it was in the bubble chat work?"
//   node tests/coord-colour.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = read("core/ui/tokens.css"), msgx = read("modules/conversation/msgx.css"), rich = read("core/ui/markdown/rich.css"), items = read("modules/conversation/message-items.js");
const projection = read("modules/conversation/messages.js");
let failed = 0;
const t = (name, fn) => { try { fn(); console.log(`  ok  ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n${e.message}`); } };

t("the colour is the bubbles' own, said once as tokens on --coord (no new value)", () => {
  assert.match(tokens, /--coord:var\(--violet\);/);
  assert.match(tokens, /--coord-ink:color-mix\(in srgb,var\(--coord\) 72%,var\(--ink-3\)\);/);
  assert.match(tokens, /--coord-ring:color-mix\(in srgb,var\(--coord\) 60%,var\(--line\)\);/);
  assert.doesNotMatch(msgx + rich, /var\(--violet\) (72|60)%/, "no view mixes its own violet");
});
t("bubbles and the chat view both take them", () => {
  assert.match(msgx, /:root\[data-msgx\] :is\(\.mx-coord,\.m-coord\) \.prose>\.mx-name,:root\[data-msgx\] \.m-coord>\.mb>\.mh b\{color:var\(--coord-ink\)\}/);
  assert.match(msgx, /:root\[data-msgx\] :is\(\.mx-coord,\.m-coord\)>\.av\{border-color:var\(--coord-ring\);box-shadow:none\}/);
  assert.match(rich, /:root:not\(\[data-msgx\]\) \.m-coord>\.mb>\.mh b\{color:var\(--coord-ink\)\}/);
  assert.match(rich, /:root:not\(\[data-msgx\]\) \.m-coord>\.av\{border-color:var\(--coord-ring\)\}/);
  // the chat view's name rule comes first, so the coordinator's colour (same specificity) is the one that holds
  assert.ok(rich.indexOf(":root:not([data-msgx]) .m-them>.mb>.mh b{") < rich.indexOf(":root:not([data-msgx]) .m-coord>.mb>.mh b{"));
});
t("only in a thread: a coordinator's note to it and its messages relayed into it; its own chat stays neutral", () => {
  // the owner, 19 Nov 14:46Z: "why is the xo-coordinator purple in the main coordinator chat!?"
  assert.match(items, /<div class="m m-them\$\{\(m\.who === "coord" \|\| m\.coord\) && convThread\(conv\) \? " m-coord" : ""\}/);
  assert.equal((items.match(/" m-coord"/g) || []).length, 1, "nothing else marks a message as the coordinator's");
  // the real decision, run for both places: a project's or the Workspace's chat stays neutral, a thread marks it
  const expr = items.match(/\$\{(\(m\.who === "coord" \|\| m\.coord\) && convThread\(conv\) \? " m-coord" : "")\}/)[1];
  const mark = new Function("m", "conv", "convThread", `return ${expr}`), thread = (c) => (c.startsWith("t:") ? { id: c.slice(2) } : null);
  assert.equal(mark({ who: "coord" }, "p:xo-coworker", thread), "", "the project chat: neutral");
  assert.equal(mark({ who: "coord" }, "ws", thread), "", "the Workspace chat: neutral");
  assert.equal(mark({ who: "coord" }, "t:x", thread), " m-coord", "its note in a thread: violet");
  assert.equal(mark({ who: "agent", coord: true }, "t:x", thread), " m-coord", "its message relayed into a thread: violet");
  assert.equal(mark({ who: "agent" }, "t:x", thread), "", "the thread's own agent: neutral");
  assert.match(projection, /who: "coord", text: n\.text, name: n\.from === "workspace"/, "a coordinator's note to a thread is the coordinator's");
  assert.match(projection, /\{ name: who\(m\.role\), role: "passed on", coord: true \}/, "a coordinator's message relayed into a thread");
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log("coord-colour: all passed");
