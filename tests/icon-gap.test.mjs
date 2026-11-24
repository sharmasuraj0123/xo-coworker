// The space between an icon and its label is one token, --gap-icon, wherever an icon sits beside words.
// The owner, 19 Nov 13:20Z: "the gap between icon and thread in the top bar has increased" (0a0fcfa4 had put the
// agent's mark between the Now chip's state glyph and its title: 8 + 16 + 8 px where 8 had been). The Now strip
// itself is gone since (8525acc8, the header's Now strip goes): its chip's checks went with it.
//   node tests/icon-gap.test.mjs
import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = read("core/ui/tokens.css"), app = sheet(new URL("../css/app.css", import.meta.url)), diffs = read("css/diffs.css");
let failed = 0;
const t = (name, fn) => { try { fn(); console.log(`  ok  ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n${e.message}`); } };

t("the icon gap is one token on the space scale", () => {
  assert.match(tokens, /--gap-icon:var\(--s-2\);/);
});
t("every icon beside its label takes it: an agent's mark, a header list's glyph, the truth line, a spinner", () => {
  assert.match(app, /\.agm-n>\.agm,\.agm\.is-lead\{margin-right:var\(--gap-icon\)\}/);
  assert.match(app, /\.hd-tt>:is\(i:not\(\.agm\),svg\)\{[^}]*margin-right:var\(--gap-icon\)/);
  assert.match(app, /\.iq-truth \.g\{[^}]*margin-right:var\(--gap-icon\)/);
  assert.match(diffs, /\.stage \.cx-none \.spin\{[^}]*margin-right:var\(--gap-icon\)/);
});
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log("icon-gap: all passed");
