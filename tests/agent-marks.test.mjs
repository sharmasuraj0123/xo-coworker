// A runtime's mark (core/services/runtimes.js rtMark, the owner, 19 Nov): Claude Code wears Claude's, Codex OpenAI's, Antigravity
// its own; anything else keeps its name as text. The name is always said: on hover and to a screen reader, or written
// beside the mark where there's room. Pure: node only.
//   node tests/agent-marks.test.mjs
import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { readFileSync, existsSync } from "node:fs";
import { rtMark, markOf, rtName } from "../core/services/runtimes.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

t("each runtime its company's mark; Codex is OpenAI's", () => {
  assert.equal(markOf("claude_code"), "claude");
  assert.equal(markOf("codex"), "openai");
  assert.equal(markOf("antigravity"), "antigravity");
  assert.equal(markOf("something_new"), null);
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
  const css = sheet(new URL("../css/app.css", import.meta.url));
  for (const m of ["claude", "openai", "antigravity"]) {
    assert.ok(existsSync(new URL(`../js/vendor/agent-marks/${m}.svg`, import.meta.url)), m);
    assert.match(css, new RegExp(`\\.agm-${m}\\{[^}]*url\\(\\.\\./js/vendor/agent-marks/${m}\\.svg\\)`), m);
  }
  // OpenAI's Blossom stays in the ink (a mask), never coloured
  assert.match(css, /\.agm-openai\{background-color:currentColor;-webkit-mask:/);
});
t("a mark centres on its words' capitals at the one icon size, and a picker's choice never squeezes below its mark and name", () => {
  const css = sheet(new URL("../css/app.css", import.meta.url));
  assert.match(css, /\.agm\{[^}]*width:var\(--ic\);height:var\(--ic\);vertical-align:calc\(var\(--cap-mid\) - var\(--ic\) \/ 2\)/);
  const btn = css.match(/\.iq-route button\{([^}]*)\}/)[1];
  assert.doesNotMatch(btn, /min-width:0/);
  assert.match(btn, /white-space:nowrap/);
});
console.log(`\n${passed} passed`);
