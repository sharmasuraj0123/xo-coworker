// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { list } from "postcss";
import { templateElements } from "../tools/conformance/templates.mjs";
import { context, px, spec, cmp, covers } from "./lib/cascade.mjs";
import { declarationsFor, publishedRules, resolveValue, tokenValuesFor } from "./lib/css-snapshot.mjs";
import { resolveTokens } from "./lib/tokens.mjs";

const textLinkClasses = [".lk", ".lp-ln", ".cp-link"];
const controls = new Set(), labels = new Set(), links = new Set(), textLinks = new Set();
const inputs = [];
const elements = templateElements(fileURLToPath(new URL("../", import.meta.url)));
for (const element of elements) {
  const classes = Array.from(element.classList, (name) => "." + name).filter((name) => !name.startsWith(".is-"));
  if (element.matches("button,summary,select")) {
    for (const name of classes) if (!/^\.(st|k|m|t|r|e)-/.test(name)) controls.add(name);
  }
  if (element.matches("[role=button],[role=tab],[role=option],[role=menuitem],[role=menuitemradio],[role=switch]")) {
    for (const name of classes) controls.add(name);
  }
  if (element.matches("label:has(>input[type=checkbox],>input[type=radio])")) {
    for (const name of classes) labels.add(name);
  }
  if (element.matches("a")) {
    const inline = classes.filter((name) => textLinkClasses.includes(name));
    for (const name of inline) textLinks.add(name);
    if (!inline.length) for (const name of classes) { links.add(name); controls.add(name); }
  }
  if (element.matches("input")) inputs.push(element);
}

const quietLines = [/\.ar-grid \.md-open$/, /\.pj-s (:is\(button,\.pj-home\))?$/, /\.tw-rt$/];
const published = publishedRules();
const live = published.map((r) => ({ r, c: context(r, 390), s: spec(r.sel) })).filter((entry) => entry.c.active && !entry.c.cond);
const tokens = Object.fromEntries([...tokenValuesFor()].filter(([, value]) => /^\d+(?:\.\d+)?px$/.test(value))
  .map(([property, value]) => [property, Number.parseFloat(value)]));
const localWidth = (value) => px(resolveTokens(value), tokens);
const phone = (row) => row.context.some((scope) => scope.at === "media" && scope.params === "(max-width:760px)");
const matchesFloor = (row) => phone(row) && resolveValue(row.value) === "36px";
const floor = declarationsFor((selector) => selector.startsWith(":where(button,") && selector.includes("a[class]"), "min-height")
  .find(matchesFloor);
const normalizeList = (selector) => selector.replace(/,\s+/g, ",");
const subjectsOf = (row) => normalizeList(row.context.at(-1).selector);
const sharedSelectors = /^:where\((.*)\):where\(:not\((.*)\)\)$/;

test("the phone has one low-specificity height and width floor for controls", () => {
  assert.ok(floor);
  const match = sharedSelectors.exec(subjectsOf(floor));
  assert.ok(match);
  assert.deepEqual(list.comma(match[1]), [
    "button", "[role=button]", "[role=tab]", "[role=option]", "[role=menuitem]", "[role=menuitemradio]",
    "[role=menuitemcheckbox]", "[role=switch]", "summary", "select", "label:has(>input[type=checkbox],>input[type=radio])",
    "a[class]",
  ]);
  assert.ok(declarationsFor(selector => normalizeList(selector) === subjectsOf(floor), "min-width").some(matchesFloor));
});

test("a control's own min or max height preserves the phone floor", () => {
  const bad = [];
  for (const candidate of live) {
    const last = candidate.r.sel.split(/[\s>+~]+/).at(-1);
    if (/::?(before|after)|:(hover|active|focus)/.test(last)) continue;
    if (!(last.match(/\.[\w-]+/g) ?? []).some((name) => controls.has(name)) && !/^(button|summary|select)\b/.test(last)) continue;
    for (const { p, v } of candidate.r.declarations) {
      if (p !== "min-height" && p !== "max-height") continue;
      const height = localWidth(v);
      if (height === null || height >= 36 || quietLines.some((exception) => exception.test(candidate.r.sel))) continue;
      const answer = live.some((other) => {
        if (other === candidate || !covers(other.r.sel, candidate.r.sel)) return false;
        const specificity = cmp(other.s, candidate.s);
        if (specificity < 0 || (specificity === 0 && other.r.n <= candidate.r.n)) return false;
        return other.r.declarations.some((declaration) => {
          if (declaration.p !== p) return false;
          const computed = localWidth(declaration.v);
          return computed === null ? p === "max-height" : computed >= 36;
        });
      });
      if (!answer) bad.push(candidate.r.f + " " + candidate.r.sel + " " + p + " " + v);
    }
  }
  assert.deepEqual(bad, []);
});

test("controls whose labels hide still have a touch-width target", () => {
  const icons = new Set(published.flatMap((rule) => {
    if (!rule.declarations.some((declaration) => declaration.p === "display" && declaration.v === "none")) return [];
    const label = /\.([\w-]+)(?:[.:][\w-]+(?:\([^)]*\))?)*(?: |>)span$/.exec(rule.sel);
    return label ? ["." + label[1]] : [];
  }));
  const squares = declarationsFor((selector) => /^:where\(\.[^)]+\)$/.test(selector), "min-width")
    .find((row) => matchesFloor(row) && subjectsOf(row).includes(".cx-ofi"));
  assert.ok(squares);
  const squareSelectors = list.comma(subjectsOf(squares).slice(7, -1));
  const own = new Map([
    [".top-back", [":root:root .top-back", "width", 40]],
    [".dock-hide", [".dock-hide", "min-width", 36]],
    [".shd-act", [".shd-act", "width", 40]],
    [".vw-more", [".vw-top .vw-more:is(.is-done,.is-busy)", "width", 36]],
  ]);
  const missing = [...icons].filter((selector) => {
    if (squareSelectors.includes(selector)) return false;
    const requirement = own.get(selector);
    return !requirement || !declarationsFor((group) => list.comma(group).includes(requirement[0]), requirement[1]).some((row) =>
      localWidth(row.value) >= requirement[2]);
  });
  assert.deepEqual(missing, []);
  for (const selector of [".xd-runs", ".tw-act", ".lbx-btn", ".vw-btn"]) assert.ok(icons.has(selector), selector);
  for (const selector of [".cx-ofi", ".fl-add"]) assert.ok(squareSelectors.includes(selector), selector);
});

test("checkbox labels are part of the phone floor and stay tall enough", () => {
  assert.ok(floor);
  assert.ok(subjectsOf(floor).includes("label:has(>input[type=checkbox],>input[type=radio])"));
  assert.ok(labels.has(".rt-check"));
  const limits = declarationsFor((selector) => labels.has(selector), "max-height").filter(phone);
  assert.ok(limits.every((row) => localWidth(row.value) === null || localWidth(row.value) >= 36));
});

test("boxed links share the floor and links in sentences are excluded", () => {
  assert.ok(floor);
  const match = sharedSelectors.exec(subjectsOf(floor));
  assert.ok(match);
  const excluded = list.comma(match[2]);
  for (const selector of textLinkClasses) {
    assert.ok(excluded.includes(selector), selector);
    assert.ok(textLinks.has(selector), selector);
  }
  for (const selector of [".lp-b", ".lq-host", ".lp-go", ".lbx-btn"]) {
    assert.ok(links.has(selector), selector);
    assert.ok(!excluded.includes(selector), selector);
  }
  const ownFloors = published.filter((rule) => normalizeList(rule.sel) !== subjectsOf(floor) && /a\.[\w-]+/.test(rule.sel)
    && ["min-width", "min-height"].every((property) =>
      rule.declarations.some((declaration) => declaration.p === property && localWidth(declaration.v) === 36)));
  assert.deepEqual(ownFloors, []);
});

test("a text field has a 36 px floor on itself or its box", () => {
  const types = ["checkbox", "radio", "range", "hidden", "file", "color", "image", "submit", "button", "reset"];
  const boxes = [".fl-q", ".ar-q", ".all-q", ".jump-field"];
  const typeSelectors = types.map((type) => "[type=" + type + "]").join(",");
  const field = ":where(input:not(" + typeSelectors + ")):where(:not(:is(" + boxes.join(",") + ") input))";
  assert.ok(declarationsFor(selector => normalizeList(selector) === field, "min-height").some(matchesFloor));
  const box = ":where(" + boxes.slice(0, -1).concat(".fl-new-r").join(",") + ")";
  assert.ok(declarationsFor(box, "min-height").some(matchesFloor));
  assert.ok(inputs.filter((input) => !types.includes(input.getAttribute("type"))).length >= 15);
});
