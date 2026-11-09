// The quiet text link used as a control (.fl-link: Files' and Runs' Try again) is a whole target wherever it's used,
// and a read that's still on its way never wears the error's colour. A rendered check found both (Astra S061 on
// 2354917: Files' Retry 54 × 16 px at 390, and red while it read again); the browser suites measure them, this
// keeps the declarations and the markup from going again. No browser.
//   node tests/links-css.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sheet = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
// app.css, then phone.css, which loads last (a phone rule in app.css's own phone block lost to the base rule after it)
const css = sheet("app.css") + "\n" + sheet("phone.css"), phoneCss = sheet("phone.css");
const files = readFileSync(new URL("../js/files.js", import.meta.url), "utf8");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// every block declaring exactly this selector, top level or inside an @media block
const rules = (sel) => [...css.matchAll(new RegExp(`(?:^|[}{;])\\s*${esc(sel)}\\s*\\{([^}]*)\\}`, "g"))].map((m) => m[1]);
const px = (decl, prop) => { const m = new RegExp(`(?:^|;)\\s*${prop}:\\s*(\\d+(?:\\.\\d+)?)px`).exec(decl); return m ? +m[1] : null; };

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

t("S061/S238: .fl-link is a whole target in one rule, wherever it's used (never a rule scoped to one place)", () => {
  const all = rules(".fl-link");
  assert.ok(all.length, ".fl-link is declared");
  const base = all.find((d) => /text-decoration:\s*underline/.test(d)); // its own rule (the phone's only raises the height)
  assert.ok(base && /min-height/.test(base), ".fl-link's own rule has a minimum target height");
  assert.ok(px(base, "min-height") >= 32, `at least 32 px tall (${px(base, "min-height")})`);
  assert.match(base, /white-space:\s*nowrap/, "its words on one line");
  assert.match(base, /flex:\s*none/, "never squeezed by the words beside it");
  assert.match(base, /display:\s*inline-flex/, "its height is its target's");
  assert.ok(all.some((d) => px(d, "min-height") >= 36), "on a phone, at least 36 px (as the other controls there)");
  assert.match(phoneCss, /@media\s*\(max-width:\s*760px\)\s*\{[^@]*\.fl-link\{min-height:36px\}/, "and that phone rule is in phone.css, after the base rule, so it wins");
  assert.equal(rules(".rn-none .fl-link").length + rules(".fl-note .fl-link").length, 0, "no second, place-scoped size rule");
});
t("S061: the line with Try again wraps rather than squeezing it (Files' note and Runs' line)", () => {
  for (const sel of [".fl-note", ".rn-none"]) assert.match(rules(sel).join(";"), /flex-wrap:\s*wrap/, `${sel} wraps`);
});
t("S061: Files' 'Reading again…' is a status, not an error: no is-err on the pending line", () => {
  const pending = /<p class="([^"]*is-pending[^"]*)"/.exec(files);
  assert.ok(pending, "the pending line is drawn");
  assert.doesNotMatch(pending[1], /\bis-err\b/, `its classes: ${pending[1]}`);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
