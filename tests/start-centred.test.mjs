// A project's empty page ("What should get done in…?") sits in the middle of the room (the owner, 19 Nov 14:21Z:
// "shouldn't this be in center?"). Its own margin:auto centres it (css/app.css .m-start); the conversation's rhythm
// (css/rich.css, 16 around every row of #msgs, 0 above the first) is for messages and must not reach it, or the
// page sits at the top. Measured: margin-top 0 → 184.5 px each side at 1440×900.
//   node tests/start-centred.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const app = read("css/app.css"), rich = read("css/rich.css");
assert.match(app, /\.m-start\{display:flex;flex-direction:column;align-items:center;gap:16px;margin:auto 0;/);
assert.match(app, /\.column:has\(\.m-start\),\.msgs:has\(> \.m-start\)\{display:flex;flex:1 0 auto;flex-direction:column\}/);
assert.match(rich, /:root:not\(\[data-msgx\]\) :is\(#msgs,#tmsgs\)>:not\(\.m-start\)\{margin-block:16px\}/);
assert.match(rich, /:root:not\(\[data-msgx\]\) :is\(#msgs,#tmsgs\)>:first-child:not\(\.m-start\)\{margin-top:0\}/);
// no other rule of the conversation sets a margin on every row of #msgs
for (const css of [rich, read("css/msgx.css"), app]) assert.doesNotMatch(css, /:is\(#msgs,#tmsgs\) ?> ?(\*|:first-child)\{[^}]*margin/);
console.log("start-centred: ok");
