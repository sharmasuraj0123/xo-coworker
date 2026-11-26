// @ts-check
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dom } from "../../../tests/lib/dom.mjs";
import { declarationsFor } from "../../../tests/lib/css-snapshot.mjs";
import { flattenStyles } from "../../../tools/conformance/css-flatten.mjs";
import { resolvedStyles } from "../../../tools/conformance/css-resolve.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const { declarations } = resolvedStyles(flattenStyles(root));
const { document } = await dom(`
  <section><div class="msgs"><div class="m m-you"><div class="bubble">Main</div></div></div></section>
  <section><div class="msgs"><div class="m m-you"><div class="bubble">Side</div></div></div></section>
  <section><div class="m m-you"><div class="bubble">Outside</div></div></section>`);
const touch = declarations.filter((entry) => entry.property === "touch-action" && entry.value === "pan-y");
for (const rule of touch) {
  const selector = rule.context.at(-1)?.selector;
  if (!selector) continue;
  assert.ok(![...document.querySelectorAll(selector)].some((el) => el.textContent === "Outside"));
}
const applied = new Set(touch.flatMap(({ context }) => [...document.querySelectorAll(context.at(-1).selector)]));
assert.deepEqual([...applied].map((el) => el.textContent), ["Main", "Side"]);

const pill = declarations.filter((entry) => entry.context.at(-1)?.selector ===
  ":root[data-msgx] .m-turn.is-live.is-folded .mx-work");
assert.equal(pill.find(({ property }) => property === "width")?.value, "fit-content");
const line = declarations.filter((entry) => entry.context.at(-1)?.selector === ".mx-wl");
assert.equal(line.find(({ property }) => property === "text-overflow")?.value, "ellipsis");

const waves = declarationsFor((selector) => /^:root\[data-msgx\] /.test(selector), "animation")
  .filter(({ value }) => /\bmx-(shimmer|await|doing)\b/.test(value));
assert.equal(waves.length, 4);
for (const { value } of waves) assert.match(value, /\bmx-(shimmer|await|doing) var\(--d-loop\)/);

const flash = declarations.filter((entry) => /\.mx-flash/.test(entry.context.at(-1)?.selector ?? ""));
assert.ok(!flash.some(({ property }) => property === "box-shadow"), "the reply flash draws no halo that spills onto the action row");
const decl = (selector, property) => declarations.find((entry) => entry.context.at(-1)?.selector === selector && entry.property === property)?.value;
assert.ok(!flash.some(({ property }) => property === "bottom"), "the reply flash keeps the same margin on every side");
assert.match(decl(".m.mx-flash::before", "inset") ?? "", /^calc\(-1 \* var\(--mx-gap\b/, "the flash's margin is the gap above the action row");
assert.match(decl(":root:not([data-msgx]) .mx-actrow", "top") ?? "", /^calc\(100% \+ var\(--mx-gap\)\)$/, "the action row starts below the flash, so a pressed button never lights on it");
