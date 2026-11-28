// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { parse, stringify } from "css-what";
import { cmp, context, covers, lost, mediaHolds, px, shrunk, spec } from "./lib/cascade.mjs";
import { declarationsFor, publishedRules, stylesheetRows } from "./lib/css-snapshot.mjs";
import { tokens } from "./lib/tokens.mjs";

const root = new URL("./lib/x.mjs", import.meta.url);
const phoneWidth = 390;

const tokenOverrides = stylesheetRows.filter((row) =>
  row.context.length === 3 && row.context[0].params === "tokens" && row.context[1].at === "media"
    && mediaHolds("@media " + row.context[1].params, phoneWidth) && row.context[2].selector === ":root"
    && row.property?.startsWith("--") && /^\d+(?:\.\d+)?px$/.test(row.value));
const phoneTokens = { ...tokens, ...Object.fromEntries(tokenOverrides.map((row) => [row.property, parseFloat(row.value)])) };
const compactContext = ':root[data-density="compact"] :is(.main,.sheet,.iq-pop)';
const compactTokens = { ...phoneTokens };
for (const key of ["--h-row", "--h-ctl"]) {
  const [declaration] = declarationsFor(compactContext, key);
  compactTokens[key] = px(declaration?.value, phoneTokens) ?? NaN;
}

test("phone declarations retain priority over desktop declarations at 390px", () => {
  assert.deepEqual(lost(root).filter((loss) => loss.how === "all"), []);
});

const compactDimensions = [
  { selector: ".target", property: "height", normal: 36, compact: 24 },
  { selector: ".hd-r", property: "min-height", normal: 40, compact: 32 },
];
const compactSelector = (selector) => `[data-density="compact"] ${selector}`;

// Match compound arms while ranking the original selector's specificity.
function expandCompoundIs(selector) {
  if (!selector.includes(":is(")) return [selector];
  let variants = [[]];
  for (const token of parse(selector)[0]) {
    const arms = token.type === "pseudo" && token.name === "is" && Array.isArray(token.data)
      && token.data.every(arm => arm.every(part => part.type === "attribute"))
      ? token.data : [[token]];
    variants = variants.flatMap(prefix => arms.map(arm => [...prefix, ...arm]));
  }
  return variants.map(arm => stringify([arm]));
}

function winningValue(selector, property, values) {
  const candidates = publishedRules()
    .filter(rule => context(rule, phoneWidth).active && !context(rule, phoneWidth).cond)
    .filter(rule => expandCompoundIs(rule.sel).some(arm => covers(arm, selector)))
    .flatMap(rule => rule.declarations.filter(row => row.p === property).map(row => ({ rule, row })));
  const winner = candidates.sort((a, b) => Number(a.row.imp) - Number(b.row.imp)
    || cmp(spec(a.rule.sel), spec(b.rule.sel)) || a.rule.n - b.rule.n).at(-1);
  return px(winner?.row.v, values);
}

test("phone sizes and targets retain their floor in more specific contexts", () => {
  const losses = shrunk(root, phoneTokens).filter(({ A, B, da }) =>
    !compactDimensions.some(({ selector, property }) => A.sel === selector
      && B.sel === compactSelector(selector) && da.p === property));
  assert.deepEqual(losses, []);
});

test("the compact cascade preserves the existing handled-row minimum and target height", () => {
  for (const { selector, property, normal, compact } of compactDimensions) {
    assert.equal(winningValue(selector, property, phoneTokens), normal, selector);
    assert.equal(winningValue(compactSelector(selector), property, compactTokens), compact, selector);
  }
});
