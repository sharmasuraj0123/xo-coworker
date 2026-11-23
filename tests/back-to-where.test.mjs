// "Back to where you were" belongs to the trip: the message pressed travels with the click, each visit to a thread
// keeps its own, Back reads only the one it leaves, and a thread opened in the panel ends the offer.
//   node tests/back-to-where.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const go = app.slice(app.indexOf("function go(v, {"), app.indexOf("function returnPill("));
assert.doesNotMatch(app, /S\.opener|opener: \{\}/, "no store guessed from focus");
assert.doesNotMatch(go, /activeElement[^;]*closest\?\.\("\[data-k\]"\)/, "where you left from is never read from focus");
assert.match(app, /const rowIn = \(el\) => el\.closest\("#msgs > \[data-k\]"\)\?\.dataset\.k \|\| null;/);
assert.match(app, /go\(g\.dataset\.go, \{ row: rowIn\(g\) \}\)/, "a card or link in the chat sends its message");
assert.match(app, /go\("t:" \+ tl\.dataset\.thread, \{ row: rowIn\(tl\) \}\)/);
assert.match(go, /if \(v\.startsWith\("t:"\)\) S\.backTo\[v\] = row \? \{ view: S\.view, k: row \} : null;/, "every visit replaces the last one's");
assert.match(go, /const was = back \? S\.backTo\[from\] : null;\n  if \(back\) delete S\.backTo\[from\];/, "read once, by that visit's Back");
assert.match(go, /was && was\.view === v \?/, "only in the chat it was opened from");
const tp = app.slice(app.indexOf("function tpShow("), app.indexOf("function tpShow(") + 200);
assert.match(tp, /if \(TP\.tid !== key\) \{\n    returnPill\(null\);/, "another thread in the panel ends the offer");
// the trip, played through: A from its card, B from elsewhere, Back from each
const S = { view: "p:x", backTo: {} };
const enter = (v, row) => { S.backTo[v] = row ? { view: S.view, k: row } : null; S.view = v; };
const leave = (from, to) => { const was = S.backTo[from]; delete S.backTo[from]; S.view = to; return was && was.view === to ? was.k : null; };
enter("t:A", "cmsg_a"); assert.equal(leave("t:A", "p:x"), "cmsg_a");
enter("t:B", null); assert.equal(leave("t:B", "p:x"), null, "B never offers A's message");
enter("t:A", null); assert.equal(leave("t:A", "p:x"), null, "a later visit to A from elsewhere forgets the first");
enter("t:A", "cmsg_a"); assert.equal(leave("t:A", "p:y"), null, "nor in another chat");
console.log("back-to-where: ok");
