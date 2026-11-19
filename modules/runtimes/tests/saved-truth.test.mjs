// "Saved" means XO holds what the field shows: receipts say it only beside exactly what was taken; drawn in tests/browser/settings.test.cjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
const RT = await import("../settings.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("a receipt says Saved only beside what XO took", () => {
  const R = RT.receipts(60_000, () => {});
  assert.equal(typeof R.says, "function", "receipts(…).says(field, now)");
  R.set("preferences", "Preference A");
  assert.equal(R.says("preferences", "Preference A"), true, "the field shows what XO holds");
  assert.equal(R.says("preferences", "Preference B"), false, "a newer draft is not what XO holds");
  assert.equal(R.says("default", "Preference A"), false, "another field");
  R.set("allowed", ["codex", "claude_code"]);
  assert.equal(R.says("allowed", ["codex", "claude_code"]), true, "a list, by its value");
  assert.equal(R.says("allowed", ["codex"]), false);
  R.set("preferences", null);
  assert.equal(R.says("preferences", null), true, "cleared: Saved beside the empty field");
});
const src = readFileSync(new URL("../settings.js", import.meta.url), "utf8");
t("every field's note asks it with what the field shows; a save's receipt holds what it sent", () => {
  assert.ok(/R\.saved\.says\(f, fieldNow\(f\)\) \? `<span class="rt-saved" role="status">Saved<\/span>`/.test(src), "the note");
  assert.ok(!/R\.saved\.field === f/.test(src), "never by the field alone");
  assert.ok(/const fieldNow = \(f\) => \(f === "preferences" && R\.pref != null \? \(R\.pref\.trim\(\) \|\| null\) : shown\(\)\[f\]\)/.test(src), "the preference's draft while there is one, else the defaults as drawn");
  assert.ok(/R\.saved\.set\(field, next\[field\]\)/.test(src), "the receipt holds what was sent");
});
t("a draft left while another save was out goes in its turn (not while you're typing in it), decided as that save settles", () => {
  assert.ok(src.includes("if (isPending(POLICY)) return;"), "while a save is out, a draft waits: no flag set on the way");
  assert.ok(!/R\.later/.test(src), "no flag that outlives the draft it was about (S098 on e55c2d8: A out, B left, A typed back and left; the flag stayed, and a refused A was sent again)");
  const i = src.indexOf("async function put("), put = src.slice(i, src.indexOf("\n  }\n", i));
  assert.ok(put.includes("const draft = R.pref == null ? undefined : (R.pref.trim() || null);"), "the draft as the page holds it, when the save settles");
  assert.ok(put.includes("if (draft !== undefined && draft !== (next.preferences ?? null) && !typing) savePref();"), "only one that differs from what this save sent, and not while you're typing in it");
  assert.ok(/addEventListener\("focusout", \((?:\/\*\* @type \{any\} \*\/ )?e\) => \{ if \(e\.target\.matches\("\[data-rtd-pref\]"\)\) savePref\(\); \}\)/.test(src), "leaving the field saves it");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
