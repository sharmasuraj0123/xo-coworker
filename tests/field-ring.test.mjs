// A field the keyboard is in shows the one ring (the controls grader on 9d1f71b, C030 Find a loaded file and S069 the new
// file's name, all four cells: focus showed only as a darker edge). Checked from the CSS: every field whose own outline
// is taken away shows the ring on its box (a box holding a borderless search field) or on itself, the base ring's 2 px
// of the focus colour. The drawn ring is the flows case "C030/S069".
//   node tests/field-ring.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../css/", import.meta.url);
const all = readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(f, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("Files' Find and the new file's name, and the other search boxes, show the one ring", () => {
  const rule = /:is\(\.fl-q,\.all-q,\.ar-q,\.side-find\):has\(input:focus-visible\),\.fl-new-r input:focus-visible\{outline:2px solid var\(--focus\);outline-offset:1px\}/;
  assert.ok(rule.test(all), "the one rule");
  assert.ok(/:focus-visible\{outline:2px solid var\(--focus\);outline-offset:2px\}/.test(all), "the base ring it matches");
});
t("each search box it names holds a field whose own outline is taken away (so the box must show it)", () => {
  for (const box of ["fl-q", "all-q", "ar-q"]) assert.ok(new RegExp(`\\.${box} input\\{[^}]*outline:none`).test(all), `.${box} input has outline:none`);
  assert.ok(/\.fl-new-r input\{[^}]*outline:none/.test(all), ".fl-new-r input has outline:none");
  assert.ok(/#pf-in\{[^}]*outline:none/.test(all), "the sidebar's Find a project (#pf-in, in .side-find) has outline:none (C007)");
});
// the boxed text fields (a form's .field: Shape's JSON, a model's key and name, Routing's preference, Create XO
// Project's; Launchpad's .lp-in; a shell's name .shd-in; a note to the agent, .c-note textarea): the base ring, never
// taken away. Their focus was a 1 px edge of 2.4–2.5:1 and a halo fainter still (the create-project grader on 4d33649,
// C108, all four cells; the same rule in the other three). The ring (2 px of the focus colour, 3.2:1 on white, 6.1:1 on
// #171717) changes no layout. One shared rule darkens the edge when typed in; no halo beside the ring
const FIELDS = [".field input", ".field textarea", ".lp-in", ".shd-in", ".c-note textarea"];
const rules = [...all.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
const names = (r, f) => r.sel.split(",").some((x) => { const y = x.replace(/:root\[data-theme="light"\]\s*/, "").replace(/^:is\(|\)$/g, "").trim(); return y === f || y.startsWith(f + ":") || y.startsWith(f + "::") || y.startsWith(f + ".") || y.endsWith(" " + f) || y.includes(" " + f + ":") || new RegExp(`:is\\([^)]*${f.replace(/[.]/g, "\\.")}`).test(x); });
t("a boxed text field keeps the base ring: nothing takes its outline away", () => {
  for (const f of FIELDS) {
    const mine = rules.filter((r) => names(r, f));
    assert.ok(mine.length, `${f}: its rules are found`);
    assert.deepEqual(mine.filter((r) => /outline:\s*(none|0)\b/.test(r.body)).map((r) => r.sel), [], `${f}: rules that take its outline away`);
  }
});
t("no halo stands beside the ring: no field's focus draws a box-shadow", () => {
  for (const f of FIELDS) assert.deepEqual(rules.filter((r) => names(r, f) && /:focus/.test(r.sel) && /box-shadow:/.test(r.body)).map((r) => r.sel), [], `${f}: focus rules with a halo`);
});
t("one shared rule darkens the edge when any of them is typed in", () => {
  assert.ok(rules.some((r) => r.sel === ":is(.field input,.field textarea,.lp-in,.shd-in,.c-note textarea):focus" && /border-color:var\(--line-hover\)/.test(r.body)), "the shared focus rule");
  for (const f of FIELDS) assert.deepEqual(rules.filter((r) => names(r, f) && /:focus\b/.test(r.sel) && !r.sel.startsWith(":is(") && !r.sel.startsWith(":root") && !/is-bad/.test(r.sel)).map((r) => r.sel), [], `${f}: a focus rule of its own`);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
