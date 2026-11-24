// A project's empty page ("What should get done in…?") sits in the middle of the room (the owner, 19 Nov 14:21Z:
// "shouldn't this be in center?"). Its own margin:auto centres it (css/app.css .m-start); the conversation's rhythm
// (core/ui/markdown/rich.css, 16 around every row of #msgs, 0 above the first) is for messages and must not reach it, or the
// page sits at the top. Measured: margin-top 0 → 184.5 px each side at 1440×900.
//   node tests/start-centred.test.mjs
import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { readFileSync } from "node:fs";
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const app = sheet(new URL("../css/app.css", import.meta.url)), rich = read("core/ui/markdown/rich.css");
assert.match(app, /\.m-start\{display:flex;flex-direction:column;align-items:center;gap:16px;margin:auto 0;/);
assert.match(app, /\.column:has\(\.m-start,\.m-load\),\.msgs:has\(> \.m-start,> \.m-load\)\{display:flex;flex:1 0 auto;flex-direction:column\}/);
// a conversation on its way: the pack's spinner in the middle of that same room, only once it takes a moment
assert.match(app, /\.m-load\{display:grid;place-items:center;flex:1;[^}]*animation:hs-in var\(--d-in\) var\(--ease\) var\(--d-wait\) both\}/);
assert.match(app, /\.spin\.is-load\{[^}]*mask:var\(--mask-load\);[^}]*steps\(8\)\}/);
assert.match(read("core/ui/tokens.css"), /--mask-load:url\(\/core\/ui\/icons\/source\/xo\/n-people-status-and-time\/spinner\.svg\)/);
const js = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
assert.match(js, /\{ load: "Loading the thread" \}/);
assert.match(js, /m\.load \? `<div class="m-load" role="status"><i class="spin is-load" aria-hidden="true"><\/i><span class="sr-only">/);
assert.match(rich, /:root:not\(\[data-msgx\]\) :is\(#msgs,#tmsgs\)>:not\(\.m-start\)\{margin-block:var\(--s-4\)\}/);
assert.match(rich, /:root:not\(\[data-msgx\]\) :is\(#msgs,#tmsgs\)>:first-child:not\(\.m-start\)\{margin-top:0\}/);
// no other rule of the conversation sets a margin on every row of #msgs
for (const css of [rich, read("modules/conversation/msgx.css"), app]) assert.doesNotMatch(css, /:is\(#msgs,#tmsgs\) ?> ?(\*|:first-child)\{[^}]*margin/);
console.log("start-centred: ok");
