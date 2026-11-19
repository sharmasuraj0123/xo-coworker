// The coordinator speaks in its violet in every view: the bubbles' colour (its name in violet over the label's grey,
// a violet ring round its mark) is two tokens, and the chat view uses the same two on every coordinator message,
// its own, a note it sends a thread, and one of its messages relayed into a thread.
// The owner, 19 Nov 14:31Z: "can we keep the purple accent for coordinator's message as it was in the bubble chat work?"
//   node tests/coord-colour.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = read("css/tokens.css"), msgx = read("css/msgx.css"), rich = read("css/rich.css"), js = read("js/app.js");
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
t("every coordinator message is marked: its own, a note to a thread, one relayed into a thread", () => {
  assert.match(js, /<div class="m m-them\$\{m\.who === "coord" \|\| m\.coord \? " m-coord" : ""\}/);
  assert.match(js, /who: "coord", text: n\.text, name: n\.from === "workspace"/, "a coordinator's note to a thread is the coordinator's");
  assert.match(js, /\{ name: who\(m\.role\), role: "passed on", coord: true \}/, "a coordinator's message relayed into a thread");
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log("coord-colour: all passed");
