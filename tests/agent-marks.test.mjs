// @ts-check

import assert from "node:assert/strict";
import { rtMark, rtName } from "../core/services/runtimes.js";
import { ORIGIN, sourcePath } from "../tools/conformance/css-publication.mjs";
import { resolveValue, valuesFor } from "./lib/css-snapshot.mjs";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

t("each runtime its company's mark; Codex is OpenAI's", () => {
  const mark = (/** @type {string} */ n) => (rtMark(n) || "").match(/agm-(\w+)/)?.[1] ?? null;
  assert.equal(mark("claude_code"), "claude");
  assert.equal(mark("codex"), "openai");
  assert.equal(mark("antigravity"), "antigravity");
  assert.equal(mark("cursor"), "cursor");
  assert.equal(mark("grok_build"), "grok");
  assert.equal(mark("something_new"), null);
});
t("alone, the mark says its name (role img, aria-label, title)", () => {
  assert.equal(rtMark("codex"), '<i class="agm agm-openai" role="img" aria-label="Codex" title="Codex"></i>');
});
t("with its name, the name is the words and the mark is decoration", () => {
  assert.equal(rtMark("claude_code", { withName: true }), '<span class="agm-n"><i class="agm agm-claude" aria-hidden="true"></i>Claude Code</span>');
});
t("leading a title, the mark keeps a mark's gap before the words (is-lead)", () => {
  assert.equal(rtMark("antigravity", { lead: true }), '<i class="agm agm-antigravity is-lead" role="img" aria-label="Antigravity" title="Antigravity"></i>');
});
t("a runtime without a mark: null, so its name stays text", () => {
  assert.equal(rtMark("other"), null);
  assert.equal(rtName("other"), "other");
});
t("every mark is a local file the stylesheet draws", () => {
  const masks = ["openai", "cursor", "grok"];
  for (const mark of ["claude", "antigravity", ...masks]) {
    const properties = masks.includes(mark) ? ["-webkit-mask", "mask"] : ["background-image"];
    for (const property of properties) {
      const values = valuesFor(`.agm-${mark}`, property);
      assert.equal(values.length, 1);
      const url = /^url\("([^"]+)"\)/.exec(String(values[0]))?.[1];
      assert.ok(url, `${mark} ${property} has a published URL`);
      const file = sourcePath(new URL(url, ORIGIN));
      assert.equal(file, `/vendor/agent-marks/${mark}.svg`, `${mark} ${property}`);
    }
  }
  for (const mark of masks) assert.deepEqual(valuesFor(`.agm-${mark}`, "background-color"), ["currentColor"]);
});
t("a mark centres on its words' capitals at the one icon size, and a picker's choice never squeezes below its mark and name", () => {
  const icon = resolveValue("var(--ic)");
  assert.deepEqual(valuesFor(".agm", "width"), [icon]);
  assert.deepEqual(valuesFor(".agm", "height"), [icon]);
  assert.deepEqual(valuesFor(".agm", "vertical-align"), [resolveValue("calc(var(--cap-mid) - var(--ic) / 2)")]);
  assert.ok(!valuesFor(".iq-route button", "min-width").includes("0"));
  assert.deepEqual(valuesFor(".iq-route button", "white-space"), ["nowrap"]);
});
console.log(`\n${passed} passed`);
