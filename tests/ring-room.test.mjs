// The ring has room wherever focus brings a control into view (the create-project grader on 65e84b7, S111/S112:
// Settings › Routing's Keep it and Disconnect brought flush with the scroller's foot, by Tab and when focus landed by
// itself, and 3.56 px of the ring cut off). Layout, not a smaller ring: every control keeps the ring's room clear as
// its scroll-margin, which the browser's own scrollIntoView (a Tab, Settings' focusOn) keeps, and so does the focus
// rule (js/focusview.js room()). Checked from the source; the drawn ring is the settings case "S111 S112 the ring
// has room at the foot".
//   node tests/ring-room.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const R = new URL("../", import.meta.url);
const read = (f) => readFileSync(new URL(f, R), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const base = read("css/base.css"), tokens = read("css/tokens.css"), fv = readFileSync(new URL("js/focusview.js", R), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the ring's room is a token at least as wide as the ring takes outside a control", () => {
  const ring = base.match(/(^|\n):focus-visible\{outline:(\d+)px solid var\(--focus\);outline-offset:(\d+)px\}/);
  assert.ok(ring, "the one ring");
  const room = tokens.match(/--ring-room:(\d+)px/);
  assert.ok(room, "--ring-room");
  assert.ok(+room[1] >= +ring[2] + +ring[3], `${room[1]} px ≥ the ring's ${ring[2]} + its ${ring[3]} px gap`);
});
t("every control keeps it clear as its scroll-margin (zero specificity, controls only)", () => {
  assert.match(base, /:where\(a\[href\],button,input,select,textarea,summary,xo-select,\[tabindex\]:not\(\[tabindex="-1"\]\),\[contenteditable="true"\]\)\{scroll-margin:var\(--ring-room\)\}/);
});
t("the focus rule keeps it too, when it brings a control in and when a redraw brings one whole", () => {
  assert.match(fv, /export function room\(el, win = window\)/, "room(): the control's scroll-margin");
  for (const f of ["bring", "bringWhole"]) {
    const i = fv.indexOf(`export function ${f}(`), b = fv.slice(i, fv.indexOf("\n}\n", i));
    assert.match(b, /const m = room\(el, win\);/, `${f} reads it`);
    assert.match(b, /m\.t[\s\S]*m\.b[\s\S]*m\.l[\s\S]*m\.r|m\.t[\s\S]*m\.b/, `${f} keeps it clear`);
  }
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
