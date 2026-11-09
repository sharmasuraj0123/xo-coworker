// "Saved" means XO holds what the field shows (the create-project/Launchpad grader on 9d1f71b, S098: preference A saving,
// B typed, Runtimes left and opened again, A lands: "Saved" stood beside B while XO held A; B was never sent). The
// real receipts (js/rtsettings.js) hold what was taken and say Saved only beside exactly that; then, from the source,
// every field's note asks it with what the field shows, and a draft left while another save was out goes in its turn.
// The drawn sequence is settings.test.cjs "S098 a newer preference typed while one saves".
//   node tests/saved-truth.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
const RT = await import("../js/rtsettings.js");
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
const src = readFileSync(new URL("../js/rtsettings.js", import.meta.url), "utf8");
t("every field's note asks it with what the field shows; a save's receipt holds what it sent", () => {
  assert.ok(/R\.saved\.says\(f, fieldNow\(f\)\) \? `<span class="rt-saved" role="status">Saved<\/span>`/.test(src), "the note");
  assert.ok(!/R\.saved\.field === f/.test(src), "never by the field alone");
  assert.ok(/const fieldNow = \(f\) => \(f === "preferences" && R\.pref != null \? \(R\.pref\.trim\(\) \|\| null\) : shown\(\)\[f\]\)/.test(src), "the preference's draft while there is one, else the defaults as drawn");
  assert.ok(/R\.saved\.set\(field, next\[field\]\)/.test(src), "the receipt holds what was sent");
});
t("a draft left while another save was out goes in its turn (not while you're typing in it)", () => {
  assert.ok(/if \(isPending\(POLICY\)\) \{ if \(\(R\.pref\.trim\(\) \|\| null\) !== \(R\.next \? R\.next\.preferences \?\? null : undefined\)\) R\.later = true; return; \}/.test(src), "it waits, unless it's what's being sent already (S098 on 65e84b7: a refusal became a second send)");
  assert.ok(src.includes('if (R.later) { R.later = false; if (!(document.activeElement && document.activeElement.matches && document.activeElement.matches("[data-rtd-pref]"))) savePref(); }'), "once the save lands, unless you're back in the field");
  assert.ok(/addEventListener\("focusout", \(e\) => \{ if \(e\.target\.matches\("\[data-rtd-pref\]"\)\) savePref\(\); \}\)/.test(src), "leaving the field saves it");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
