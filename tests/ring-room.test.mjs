// The ring has room wherever focus brings a control into view (the create-project grader on 65e84b7, S111/S112:
// Settings › Routing's Keep it and Disconnect brought flush with the scroller's foot, by Tab and when focus landed by
// itself, and 3.56 px of the ring cut off). Layout, not a smaller ring: every control keeps the ring's room clear as
// its scroll-margin, which the browser's own scrollIntoView (a Tab, Settings' focusOn) keeps, and so does the focus
// rule (js/focusview.js: room(), ringOf(), decoration(): a checkbox's label and its ring too, C115). Checked from the
// source; the drawn ring is the settings case "S111 S112 the ring has room at the foot".
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
t("the focus rule keeps it too, measuring all that focus draws: the control as seen, its room, the ring past whoever draws it", () => {
  assert.match(fv, /export function room\(el, win = window\)/, "room(): the control's scroll-margin");
  assert.match(fv, /export function ringOf\(el, win = window\)/, "ringOf(): the control's own ring, or its label's or field box's");
  const d = fv.slice(fv.indexOf("export function decoration("), fv.indexOf("\n}\n", fv.indexOf("export function decoration(")));
  assert.match(d, /const s = seen\(el\), m = room\(el, win\), g = ringOf\(el, win\), e = g\.ext;/, "decoration(): seen, room and ring");
  const b = fv.slice(fv.indexOf("export function bring("), fv.indexOf("\n}\n", fv.indexOf("export function bring(")));
  assert.match(b, /shift\(sc\.getBoundingClientRect\(\), decoration\(el, win\), r\)/, "bring() shows the whole decoration");
  assert.match(fv, /export function bringWhole\(el, win = window\) \{\n  const b = bring\(el, win\);/, "bringWhole() is bring()");
});
// a box that clips at its edge can't be scrolled (the focus rule moves scrollers only), so a row of controls at such an
// edge keeps the ring's room in its own height (the controls grader on e55c2d8, C092: on a phone the file's head was 40
// with its 36 px controls, and the viewer clips: a focused Copied lost its ring's top)
t("on a phone the file's head holds its controls and their whole ring", () => {
  const phone = read("css/phone.css"), app = read("css/app.css"), ring = base.match(/(^|\n):focus-visible\{outline:(\d+)px solid var\(--focus\);outline-offset:(\d+)px\}/);
  const reach = +ring[2] + +ring[3];
  assert.equal(+(tokens.match(/--ring-reach:(\d+)px/) || [])[1], reach, "--ring-reach is the ring's own reach");
  const btn = +(app.match(/@media \(max-width:760px\)\{[\s\S]*?\.vw-x,\.vw-btn\{min-height:(\d+)px\}/) || [])[1];
  assert.equal(btn, 40, "the phone's file buttons: 40");
  assert.match(phone, /\.vw-top\{--vw-head:calc\(40px \+ 2 \* var\(--ring-reach\) \+ 1px\);height:var\(--vw-head\)\}/, "the head: the buttons, the ring each side, its 1 px rule");
  assert.match(phone, /\.viewer:not\(\.stage \.viewer\) \.vw-top\{height:calc\(var\(--vw-head\) \+ env\(safe-area-inset-top, 0px\)\)/, "and a full-screen file's, with the notch");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
