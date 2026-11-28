// @ts-check

import assert from "node:assert/strict";
import { sheet } from "../../../tests/lib/cascade.mjs";

const css = sheet(new URL("../automations.css", import.meta.url));
const held = [...css.matchAll(/\.au-row>:not\(([^)]*)\)\{([^}]*)\}/g)].filter(([, , d]) => /(^|;)position:/.test(d));
assert.ok(held.length, "a row's parts sit above its open button");
for (const [, kept] of held) assert.match(kept, /\.au-menu/, "the ••• menu floats under its button, out of the row's grid");
assert.match(css, /\.au-menu\{position:absolute;right:0;top:/);
assert.match(css, /\.au-intro\+\.au-list\{margin-top:var\(--s-4\)\}/, "a tab's intro stands a step above its list, as approved");
assert.match(css, /\.au-what\{[^}]*-webkit-line-clamp:2[^}]*overflow:hidden/, "a found run's words stop at two lines");
assert.match(css, /\.au-form \.au-bar b\{/, "every form's bar names it the same way");
const select = sheet(new URL("../../../core/ui/components/xo-select.css", import.meta.url));
assert.match(select, /\.dd-t\{flex:0 0 auto;max-width:100%;/, "a row's name stays whole; its description gives way");
assert.match(css, /\.au-kv \.au-chip\{[^}]*--dd-fill:var\(--fill-clear\);--dd-line:var\(--fill-clear\)\}/,
  "a row's choice is plain text in both themes; the light theme's fill reads these, not background:none");
assert.doesNotMatch(css, /\.au-kv \.au-chip \.dd-btn\{[^}]*background:none/, "which would also take away its hover");
const phone = css.slice(css.indexOf("@media (max-width:760px){"));
assert.match(phone, /\.au-list\.is-plain \.au-tile\{display:grid\}/, "on a phone an agent row keeps its icon, not a bare name");
assert.match(phone, /\.au-top\{display:contents\}/, "on a phone the intro takes the full width, not a column beside the button");
assert.match(phone, /\.au-mode\{grid-row:1;grid-column:1;/, "the page switch and the create button share the top line");
assert.match(phone, /\.au-cta span\{display:none\}/, "where create is its + alone, a touch target wide");
assert.match(css, /\.au-row>:is\(button,[^)]*\)\{pointer-events:auto\}/, "a button in a row, like Bring in, takes its click");
console.log("row-css: ok");
