// The space between an icon and its label is one token, --gap-icon, wherever an icon sits beside words; the Now
// strip's chips lead with one icon (their state), so nothing doubles that space before the title.
// The owner, 19 Nov 13:20Z: "the gap between icon and thread in the top bar has increased" (0a0fcfa4 had put the
// agent's mark between the chip's state glyph and its title: 8 + 16 + 8 px where 8 had been).
//   node tests/icon-gap.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = read("css/tokens.css"), app = read("css/app.css"), diffs = read("css/diffs.css"), js = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
let failed = 0;
const t = (name, fn) => { try { fn(); console.log(`  ok  ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n${e.message}`); } };

t("the icon gap is one token on the space scale", () => {
  assert.match(tokens, /--gap-icon:var\(--s-2\);/);
});
t("every icon beside its label takes it: the Now chip, an agent's mark, a header list's glyph, the truth line, a spinner", () => {
  assert.match(app, /\.nw\{[^}]*gap:var\(--gap-icon\)/);
  assert.match(app, /\.agm-n>\.agm,\.agm\.is-lead\{margin-right:var\(--gap-icon\)\}/);
  assert.match(app, /\.hd-tt>:is\(i:not\(\.agm\),svg\)\{[^}]*margin-right:var\(--gap-icon\)/);
  assert.match(app, /\.iq-truth \.g\{[^}]*margin-right:var\(--gap-icon\)/);
  assert.match(diffs, /\.stage \.cx-none \.spin\{[^}]*margin-right:var\(--gap-icon\)/);
});
t("a Now chip leads with its state alone: the title follows the glyph, the agent is in its tooltip and name", () => {
  const chip = js.slice(js.indexOf('class="nw st-'), js.indexOf('<span class="nw-segs"'));
  assert.ok(chip.length > 0, "the chip's markup");
  assert.match(chip, /<i class="g g-\$\{[^}]*\}" aria-hidden="true"><\/i><b>\$\{esc\(t\.title\)\}<\/b>/, "glyph, then title");
  assert.doesNotMatch(chip, /threadMark\(/, "no second icon before the title");
  assert.match(chip, /title="\$\{esc\(`\$\{t\.title\}\$\{threadAgentWords\(t\)/, "the agent in the tooltip");
  assert.match(chip, /aria-label="\$\{esc\(t\.title\)\}\$\{esc\(threadAgentWords\(t\)\)\}/, "and in its name");
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log("icon-gap: all passed");
