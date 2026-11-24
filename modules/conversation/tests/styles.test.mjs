// @ts-check
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dom } from "../../../tests/lib/dom.mjs";
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
