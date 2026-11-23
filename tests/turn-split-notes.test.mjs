// A running turn splits at a coordinator's note or an ask as it does at a message, so work done after one sits below it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { turnSegments } = await import("../js/turnview.js");

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the 21 Nov Chats turn: 6 steps, the steer and its note, 20 steps, the ask and answer, the rest", () => {
  const turn = { seq: 481386, status: "running", at: "2026-11-21T08:50:36Z" };
  const blocks = [];
  for (let i = 0; i < 6; i++) blocks.push({ seq: 481400 + i });
  for (let i = 0; i < 20; i++) blocks.push({ seq: 481950 + i });
  for (let i = 0; i < 30; i++) blocks.push({ seq: 482300 + i });
  const says = [{ seq: 481937, who: "control" }, { seq: 481938, who: "coord" }, { seq: 482206, who: "asked" }, { seq: 482226, who: "coord" }];
  const segs = turnSegments(turn, blocks, says);
  assert.deepEqual(segs.map((s) => s.blocks.length), [6, 20, 30]);
  assert.equal(segs.at(-1).last && segs.at(-1).seq > 482226, true);
});

t("the turn is split after the notes, asks, relays and steers are on the list, and reads them", () => {
  const notes = app.indexOf("for (const n of hopNotes(t, st.hops.values()))"), turns = app.indexOf("for (const sg of turnSegments(tu, blocks, says))");
  assert.equal(notes > 0 && turns > notes, true);
  assert.match(app, /\.concat\(out\.filter\(\(x\) => x\.seq != null && \/\^\(hopn\|relay\|ctl\|hop\):\/\.test\(x\.key\)\)/);
  assert.match(app, /const tail = says\.reduce\(\(a, m\) => \(m\.seq > a \? m\.seq : a\), 0\) \+ 0\.5;/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
