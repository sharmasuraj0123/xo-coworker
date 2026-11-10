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

// each scroll box: what it holds, and how a focused control's ring stays whole at its edges ("room": the box's padding,
// or that of the one named, gives the ring's room on every side; "inset": its controls draw their ring inside them;
// "inner": the content inside it carries its own room; "text": it holds text or one field, no control)
const SCROLLERS = {
  ".rn-strip": ["room", "the running sub-agents' chips (C047)"],
  ".projects": ["room", "the sidebar's projects (C008: 2 px above the first row cut its ring)"],
  ".mp-legend": ["room", "the Map's agents (none above the first row cut its ring)"],
  ".c-body": ["room", "a decision card's body"], ".all-list": ["room", "All threads"], ".jump-list": ["room", "Jump's list"],
  ".keys-cols": ["room", "Settings › Keyboard"], ".set-body": ["room", "Settings' page"], ".set-page": ["room", "a Settings page on a phone"],
  ".rn-body": ["room", "Runs' sheet"], ".shd-list": ["room", "Shells' list"], ".dd-menu": ["room", "a dropdown's options"],
  ".cs-pop": ["room:.iq-pop", "the new chat's settings (an .iq-pop)"],
  ".now": ["inset:.nw", "the Now strip's chips"], ".shd-tabs": ["inset:.shd-tab", "a shell's tabs"], ".stg-tabs": ["inset:.stg-tab", "the stage's tabs"],
  ".set-nav": ["inset:.set-nav button", "Settings' rail"], ".fl-list": ["inset:.fl-r", "Files' tree"], ".iq-list": ["inset:.iq-row", "the picker's models"],
  ".syl-b": ["inset:.syl-ln", "a record's lines"], ".stage .cx-list": ["inset:.cx-r", "the changes list"],
  ".md-body": ["inset:.md-from", "Made's cards (their ring a layer inside them, C013; their from line and pin inset)"],
  ".fr-b": ["inset:.ag-r", "the stage's frames (agents and changes rows, inset)"], ".stage .ch-old": ["inset:.ch-r", "a change's older lines"],
  ".home": ["inner", "Home: its .hm column carries the room"], ".arts": ["inner", "Artifacts: its column carries the room"],
  ".scroller": ["inner", "the conversation: its column and the bubbles carry the room"], ".dlg": ["inner", "a dialog: its sections are padded"],
  ".card.is-dock.is-one .card-in": ["inner", "the docked decision: its body (16 px) and actions (12 px) are padded"],
  ".md-code pre": ["text", "a code block"], ".md-table": ["text", "a table in a message"], ".chg pre": ["text", "a change's text"],
  ".vw-src": ["text", "a file's source"], ".vw-body": ["text", "a file's body"], ".stage .cx-pd": ["text", "a change's diff"],
  ".composer textarea.is-capped": ["text", "the message box itself"], ".shp-jb .shp-ta": ["text", "the shape's JSON field"],
  ".tb-out": ["text", "a step's output"], ":root:root .ckbar.is-open .ck-b>ol": ["text", "a phone's checklist: its steps are words"],
};
const padOf = (sel) => { const m = all.match(new RegExp(`(?:^|[}\\n])\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{[^}]*?(?:^|;)padding:([^;}]+)`)); return m ? m[1].trim() : null; };
const px4 = (v) => { const p = v.split(/\s+(?![^(]*\))/).map((x) => (x === "var(--ring-room)" ? room : /^(\d+)px$/.test(x) ? +x.slice(0, -2) : x === "0" ? 0 : NaN)); return [p[0], p[1] ?? p[0], p[2] ?? p[0], p[3] ?? p[1] ?? p[0]]; };

t("the ring's room covers the ring (2 px, 2 px out)", () => assert.ok(room >= ext, `${room} ≥ ${ext}`));
t("every scroll box is placed, either axis: padded with the ring's room, its controls' ring inset, its content padded, or text only", () => {
  const found = new Set();
  for (const [, c] of css) for (const m of c.matchAll(/([^{}]+)\{([^{}]*overflow(?:-[xy])?:(?:auto|scroll)[^{}]*)\}/g)) found.add(m[1].trim().split("\n").pop().trim());
  const unplaced = [...found].filter((sel) => !(sel in SCROLLERS));
  assert.deepEqual(unplaced, [], `scroll boxes to place: ${unplaced.join(" | ")}`);
});
t("each holds the ring as listed: a padded one by at least the ring on every side, an inset one's controls inside", () => {
  for (const [sel, [how, what]] of Object.entries(SCROLLERS)) {
    if (how.startsWith("room")) {
      const via = how.split(":")[1] || sel, v = padOf(via);
      assert.ok(v, `${sel} (${what}): its padding (${via})`);
      const p = px4(v);
      assert.ok(p.every((x) => x >= ext), `${sel} (${what}): padding ${v} gives the ring ${ext} px on every side`);
    } else if (how.startsWith("inset:")) {
      const k = how.slice(6);
      const own = new RegExp(`${k.replace(/\./g, "\\.")}[^{]*:focus-visible[^{]*\\{[^}]*outline-offset:-2px|${k.replace(/\./g, "\\.")}:focus-visible\\)`).test(all);
      assert.ok(inset.split(",").map((x) => x.trim()).includes(k) || own || /\.md-it:has\(\.md-open:focus-visible\)::after/.test(all) && k === ".md-from", `${sel} (${what}): ${k} draws its ring inside it`);
    }
  }
});
t("the runs strip gives the room back in its margin: its chips sit where they did (8 px under the head's line)", () => {
  assert.match(all, /\.rn-strip\{display:flex;gap:6px;margin:calc\(8px - var\(--ring-room\)\) calc\(-1 \* var\(--ring-room\)\) calc\(-1 \* var\(--ring-room\)\);padding:var\(--ring-room\);overflow-x:auto;/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
