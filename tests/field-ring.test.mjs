// A field inside a box shows the one focus ring on its box: a box whose field has its own ring turned off (outline:none
// for the box's look) has nothing but a border shift to show focus, too faint (the controls grader on 8aa58d3, C053:
// the message box, 1 px of border 48→60 in dark). The census: every box whose input or textarea turns its ring off is
// one the shared rule draws the ring on.
//   node tests/field-ring.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const css = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const shared = /:is\(([^)]*)\):has\(:is\(input,textarea\):focus-visible\),\.fl-new-r input:focus-visible\{outline:none\}/.exec(css);
// the owner, 11 Nov 07:52Z: a message or search box draws no ring of its own ("remove the current border of textbox")
t("one rule: no message or search box draws a ring while its field has focus", () => assert.ok(shared, "the shared rule"));
t("every box whose field turns its own ring off is one that rule reaches, and nothing else draws one on a field's box", () => {
  const boxes = shared[1].split(",");
  const ID_BOX = { "#pf-in": ".side-find" };
  const off = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /(^|;)outline:(none|0)(;|$)/.test(m[2]) && /(textarea|input|#pf-in)/.test(m[1].split(",").pop()) && !/:focus/.test(m[1]))
    .map((m) => { const sel = m[1].trim(); const id = Object.keys(ID_BOX).find((k) => sel.endsWith(k)); return id ? ID_BOX[id] : sel.replace(/\s+(textarea|input)[^\s]*$/, "").split(/\s+/).pop(); });
  const missing = [...new Set(off)].filter((b) => !boxes.includes(b) && b !== ".fl-new-r");
  assert.deepEqual(missing, [], `boxes not in the rule: ${missing.join(", ")}`);
  const ringed = [...css.matchAll(/([^{}]*:has\(:is\(input,textarea\):focus-visible\)[^{}]*)\{([^}]*)\}/g)].filter((m) => /outline:\s*[0-9]|outline-color|box-shadow/.test(m[2])).map((m) => m[1].trim());
  assert.deepEqual(ringed, [], "a field's box ringed");
});
// the file editor (Files › Edit): its caret is in Pierre's shadow, so no field of ours turns a ring on; while editing, the
// file's box draws the message box's ring with the caret in it (the owner, 11 Nov 05:42Z)
t("a file being edited draws the message box's ring on its box while the caret is in it", () => {
  // over the file, from its own top: on the box, the file's lines covered it (C120 S231 on fa49c3c)
  assert.match(css, /#viewer\.is-editing:has\(\.vw-body:focus-within\)::after\{content:"";position:absolute;left:0;right:0;bottom:0;top:var\(--vw-body-top,40px\);z-index:4;pointer-events:none;[^}]*box-shadow:inset 0 0 0 2px var\(--ring-in,var\(--focus\)\)\}/);
  assert.doesNotMatch(css, /\.vw-body:focus-within\{outline/, "not on the box the file covers");
  const vw = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
  assert.equal((vw.match(/el\.classList\.toggle\("is-editing", !!ED\.on\);/g) || []).length, 2, "marked as the head is drawn and as the viewer is");
  assert.match(vw, /el\.style\.setProperty\("--vw-body-top", `\$\{b\.offsetTop\}px`\)/, "the file's top read as focus comes in");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
