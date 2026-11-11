// The ring has room wherever focus brings a control into view (the create-project grader on 65e84b7, S111/S112:
// Settings › Routing's Keep it and Disconnect brought flush with the scroller's foot, by Tab and when focus landed by
// itself, and 3.56 px of the ring cut off). Layout, not a smaller ring: every control keeps the ring's room clear as
// its scroll-margin, which the browser's own scrollIntoView (a Tab, Settings' focusOn) keeps, and so does the focus
// rule (js/focusview.js: room(), ringsOf(), decoration(): a checkbox's label and its ring too, C115). Checked from the
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
  assert.match(fv, /export function ringsOf\(el, win = window\)/, "ringsOf(): the control's own ring and its label's or field box's, every one");
  const d = fv.slice(fv.indexOf("export function decoration("), fv.indexOf("\n}\n", fv.indexOf("export function decoration(")));
  assert.match(d, /const s = seen\(el\), m = room\(el, win\)/, "decoration(): the control as seen, its room");
  assert.match(d, /for \(const g of ringsOf\(el, win\)\)/, "and every ring drawn for it");
  const b = fv.slice(fv.indexOf("export function bring("), fv.indexOf("\n}\n", fv.indexOf("export function bring(")));
  assert.match(b, /shift\(sc\.getBoundingClientRect\(\), decoration\(el, win\), r\)/, "bring() shows the whole decoration");
  assert.match(fv, /export function bringWhole\(el, win = window\) \{\n  const b = bring\(el, win\);/, "bringWhole() is bring()");
});
// a box that clips at its edge can't be scrolled (the focus rule moves scrollers only), so a row of controls at such an
// edge keeps the ring's room in its own height (the controls grader on e55c2d8, C092: on a phone the file's head was 40
// with its 36 px controls, and the viewer clips: a focused Copied lost its ring's top)
t("on a phone the file's head stays 40, its buttons fill it, and their ring is drawn inside them, whole", () => {
  const phone = read("css/phone.css"), app = read("css/app.css");
  const btn = +(app.match(/@media \(max-width:760px\)\{[\s\S]*?\.vw-x,\.vw-btn\{min-height:(\d+)px\}/) || [])[1];
  assert.equal(btn, 40, "the phone's file buttons: 40");
  assert.match(phone, /\.viewer:not\(\.stage \.viewer\) \.vw-top\{height:calc\(40px \+ env\(safe-area-inset-top, 0px\)\)/, "the head: 40, on the grid, with the notch");
  assert.match(read("css/panel.css"), /\.vw-top\{height:40px;[^}]*border-bottom:0;box-shadow:inset 0 -1px 0 var\(--line-faint\);/, "its rule inside it, at every width: its content is the whole 40");
  assert.match(phone, /\.vw-top :focus-visible\{outline-offset:-2px;outline-color:var\(--ring-in,var\(--focus\)\)\}/, "the ring inside its controls: 2 px of the focus colour, inset");
});
// on a desktop too: a 40 px bar's controls are 32, so the ring's room above and below them is the bar's 8 px less its
// rule. A rule drawn as a border took 1 of it, and where the bar meets a box that clips, a focused control's ring lost
// half a pixel (the controls grader on f93345a and 0f51890, C092 at 1440: Copied's ring cut 0.5 by .viewer)
t("a 40 px bar holds a 32 px control and its whole ring: 4 + 32 + 4, its rule drawn inside it, never a border", () => {
  const ring = base.match(/(^|\n):focus-visible\{outline:(\d+)px solid var\(--focus\);outline-offset:(\d+)px\}/);
  const ext = +ring[2] + +ring[3], ctl = +tokens.match(/--h-ctl:(\d+)px/)[1];
  assert.ok((40 - ctl) / 2 >= ext, `(40 − ${ctl}) / 2 ≥ the ring's ${ext}`);
  const css = ["app.css", "panel.css", "fileview.css", "diffs.css", "launchpad.css", "media.css", "msgx.css", "artifacts.css", "shape.css", "side.css", "dropdown.css", "links.css", "foundation.css"].map((f) => [f, read(`css/${f}`)]);
  const bars = [];
  // a row that is itself the control (the stage's agent rows, buttons 40 tall) holds no control: its ring is its own
  const ROWS = new Set([".ag-r"]);
  for (const [f, c] of css) for (const m of c.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (ROWS.has(m[1].trim())) continue;
    if (/(^|;)\s*(min-)?height:(40px|var\(--h-lg\))/.test(m[2]) && /(^|;)\s*border-(bottom|top):1px/.test(m[2])) bars.push(`${f}: ${m[1].trim()}`);
  }
  assert.deepEqual(bars, [], `40 px bars whose rule takes a pixel of their room:\n  ${bars.join("\n  ")}`);
  for (const sel of ["\\.vw-top", "\\.fv-h", "body\\.chat-docked \\.chead", "\\.shd-bar"]) assert.match(css.map((x) => x[1]).join("\n"), new RegExp(`${sel}\\{[^}]*box-shadow:inset 0 -1px 0 var\\(--line-faint\\)`), `${sel}: its rule inside it`);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
