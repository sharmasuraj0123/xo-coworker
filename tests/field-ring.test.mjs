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
const shared = /:is\(([^)]*)\):has\(:is\(input,textarea\):focus-visible\),\.fl-new-r input:focus-visible\{outline:2px solid var\(--focus\);outline-offset:1px\}/.exec(css);
t("one rule draws the ring on a field's box while the field has focus", () => assert.ok(shared, "the shared rule"));
t("every box whose field turns its own ring off is one it reaches (the composer, Find a project, Artifacts' search, a change's question)", () => {
  const boxes = shared[1].split(",");
  // a field's rule that turns its outline off: the box is its selector's part before the field (".composer textarea", ".ar-q input"); an id's box is named
  const ID_BOX = { "#pf-in": ".side-find" };
  const off = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /(^|;)outline:(none|0)(;|$)/.test(m[2]) && /(textarea|input|#pf-in)/.test(m[1].split(",").pop()) && !/:focus/.test(m[1]))
    .map((m) => { const sel = m[1].trim(); const id = Object.keys(ID_BOX).find((k) => sel.endsWith(k)); return id ? ID_BOX[id] : sel.replace(/\s+(textarea|input)[^\s]*$/, "").split(/\s+/).pop(); });
  const missing = [...new Set(off)].filter((b) => !boxes.includes(b) && b !== ".fl-new-r"); // Files' new name: its own field takes the ring
  assert.deepEqual(missing, [], `boxes whose field's ring is off, without the box's ring: ${missing.join(", ")}`);
});
// the file editor (Files › Edit): its caret is in Pierre's shadow, so no field of ours turns a ring on; while editing, the
// file's box draws the message box's ring with the caret in it (the owner, 11 Nov 05:42Z)
t("a file being edited draws the message box's ring on its box while the caret is in it", () => {
  assert.match(css, /\.is-editing \.vw-body:focus-within\{outline:2px solid var\(--ring-in,var\(--focus\)\);outline-offset:-2px\}/);
  const vw = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
  assert.equal((vw.match(/el\.classList\.toggle\("is-editing", !!ED\.on\);/g) || []).length, 2, "marked as the head is drawn and as the viewer is");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
