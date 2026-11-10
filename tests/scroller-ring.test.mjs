// A scroller of controls keeps the focus ring's room inside it (the create-project grader on 427f41c, C047: the runs
// strip, overflow-x:auto, clipped a focused chip's ring on three sides, only its right 2 px showing). A box that
// scrolls one way clips the other too, so the ring, 4 px outside a control, is cut unless the control draws its ring
// inside itself or the scroller pads it with the ring's room (--ring-room). Every horizontal scroller is listed: what
// it holds, and how the ring stays whole. A new one fails here until it's placed.
//   node tests/scroller-ring.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const R = new URL("../", import.meta.url);
const read = (f) => readFileSync(new URL(f, R), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const css = readdirSync(new URL("css/", R)).filter((f) => f.endsWith(".css")).map((f) => [f, read(`css/${f}`)]);
const all = css.map((x) => x[1]).join("\n");
const base = read("css/base.css"), fnd = read("css/foundation.css"), tokens = read("css/tokens.css");
const ring = base.match(/(^|\n):focus-visible\{outline:(\d+)px solid var\(--focus\);outline-offset:(\d+)px\}/);
const ext = +ring[2] + +ring[3], room = +tokens.match(/--ring-room:(\d+)px/)[1];
const inset = (fnd.match(/:is\(([^)]*)\):focus-visible\{outline-offset:-2px\}/) || [])[1] || "";
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

// each scroller: what it holds, and how the ring stays whole ("room": padded by --ring-room; "inset": its controls
// draw the ring inside themselves; "text": it holds text, no control)
const SCROLLERS = {
  ".rn-strip": ["room", "the running sub-agents' chips"],
  ".now": ["inset:.nw", "the Now strip's chips (.nw draw an inset ring)"],
  ".shd-tabs": ["inset:.shd-tab", "a shell's tabs"],
  ".stg-tabs": ["inset:.stg-tab", "the stage's tabs"],
  ".set-nav": ["inset:.set-nav button", "Settings' rail on a phone"],
  ".md-code pre": ["text", "a code block"],
  ".md-table": ["text", "a table in a message"],
  ".chg pre": ["text", "a change's text"],
  ".vw-src": ["text", "a file's source"],
};

t("the ring's room covers the ring (2 px, 2 px out)", () => assert.ok(room >= ext, `${room} ≥ ${ext}`));
t("every horizontal scroller is placed: padded with the ring's room, its controls' ring inset, or text only", () => {
  const found = new Set();
  for (const [, c] of css) for (const m of c.matchAll(/([^{}]+)\{([^{}]*overflow-x:(?:auto|scroll)[^{}]*)\}/g)) found.add(m[1].trim().replace(/^.*?\s*(?=\.)/, (x) => (x.startsWith(".") ? x : "")));
  const unplaced = [...found].filter((sel) => !Object.keys(SCROLLERS).some((k) => sel === k || sel.endsWith(" " + k)));
  assert.deepEqual(unplaced, [], `scrollers to place: ${unplaced.join(", ")}`);
});
t("each holds the ring as listed", () => {
  for (const [sel, [how, what]] of Object.entries(SCROLLERS)) {
    if (how === "room") assert.match(all, new RegExp(`${sel.replace(/\./g, "\\.")}\\{[^}]*padding:var\\(--ring-room\\);[^}]*overflow-x:auto`), `${sel} (${what}): padded with the ring's room`);
    else if (how.startsWith("inset:")) assert.ok(inset.split(",").map((x) => x.trim()).includes(how.slice(6)), `${sel} (${what}): ${how.slice(6)} draws an inset ring`);
  }
});
t("the runs strip gives the room back in its margin: its chips sit where they did (8 px under the head's line)", () => {
  assert.match(all, /\.rn-strip\{display:flex;gap:6px;margin:calc\(8px - var\(--ring-room\)\) calc\(-1 \* var\(--ring-room\)\) calc\(-1 \* var\(--ring-room\)\);padding:var\(--ring-room\);overflow-x:auto;/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
