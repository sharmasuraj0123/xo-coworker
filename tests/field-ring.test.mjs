// A field inside a box shows the one focus ring on its box: a box whose field has its own ring turned off (outline:none
// for the box's look) has nothing but a border shift to show focus, too faint (the controls grader on 8aa58d3, C053:
// the message box, 1 px of border 48→60 in dark). The census: every box whose input or textarea turns its ring off is
// one the shared rule draws the ring on.
//   node tests/field-ring.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cssNames } from "./lib/sources.mjs";
const css = cssNames().map((f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
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
// a field with its own border shows focus as one edge, on its border: the base ring stood 2 px outside it, two borders
// with the page between (the owner, 11 Nov 08:00Z, Create XO Project)
t("every bordered field (text inputs, textareas, selects, the dropdown's button) draws its focus on its own edge, not 2 px out", () => {
  assert.match(css, /:is\(input:not\(\[type=checkbox\],\[type=radio\],\[type=range\],\[type=button\],\[type=submit\],\[type=reset\],\[type=file\],\[type=color\],\[type=image\]\),textarea,select,\.dd-btn\):focus-visible\{outline-offset:-1px\}/);
  // and no field rule puts a ring back outside its edge
  const out = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, sel, body]) => !/:has\(/.test(sel) && /(^|[\s,(>])(input|textarea|select)\b[^,]*:focus/.test(sel) && /outline-offset:\s*[1-9]/.test(body)).map(([, sel]) => sel.trim().slice(0, 80));
  assert.deepEqual(out, [], "a field ringed outside its edge");
});
// the file's editor (CodeMirror, modules/files/editor.js) draws no ring, around its box or over it: the caret is the mark (the
// owner, 19 Nov 10:59Z: "this green highlight around the canvas looks horrendous. remove it.")
t("a file you're typing in draws no ring", () => {
  assert.doesNotMatch(css, /#viewer:has\([^)]*cm-focused[^)]*\)::after/, "no ring over the file");
  assert.doesNotMatch(css, /\.vw-body:focus-within\{outline/, "none on its box");
  assert.match(css, /\.vw-doc>\.cm-editor\.cm-focused\{outline:none\}/, "nor CodeMirror's own");
  assert.match(css, /\.vw-body\.vw-doc:focus-visible\{outline:none\}/, "the scroll regions' ring leaves the editor out");
  const ring = readFileSync(new URL("../core/ui/a11y/ring.js", import.meta.url), "utf8");
  assert.match(ring, /classList\.contains\("vw-doc"\)\) return;/, "and ring.js draws none over it");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
