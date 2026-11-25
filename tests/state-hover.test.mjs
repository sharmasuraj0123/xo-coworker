// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "css-what";
import { templateElements } from "../tools/conformance/templates.mjs";
import { context } from "./lib/cascade.mjs";
import { publishedRules, resolveValue } from "./lib/css-snapshot.mjs";
import { dom, same } from "./lib/dom.mjs";

const rules = publishedRules().filter((rule) => context(rule, 1440).active
  && rule.at.every((condition) => !condition.startsWith("@keyframes ")));
const root = fileURLToPath(new URL("../", import.meta.url));
const hosts = "button,a[href],summary,[role=button],[role=tab],[role=radio],[role=switch],[role=checkbox],"
  + "[role=option],[role=menuitem],[role=menuitemradio],.shd-tabw";
const drawn = templateElements(root);
const controlClasses = new Set(drawn.filter((node) => node.matches(hosts)).flatMap((node) => [...node.classList]));
const drawnClasses = new Set(drawn.flatMap((node) => [...node.classList]));
const alternatives = [".prow", ".nrow", ".dd-row", ".at-list li", ".jump-list li", ".shd-tabw>*", ".shd-tabw.is-edit"];
const states = /^(?:is-)?(?:on|cur|here|sel|active|pinned|current|chosen|picked|selected)$/;
const visual = /^(background(?:-color|-image)?|color|border(?:-color)?|box-shadow|opacity|outline-color|text-decoration-color)$/;
const combiner = new Set(["adjacent", "child", "column-combinator", "descendant", "parent", "sibling"]);

/** @param {import("css-what").Selector[]} selector */
function subject(selector) {
  return selector.slice(selector.findLastIndex(({ type }) => combiner.has(type)) + 1);
}

/** @param {import("css-what").Selector} part */
function chosen(part) {
  if (part.type !== "attribute") return false;
  if (part.name === "class") return part.action === "element" && states.test(part.value);
  if (part.name === "aria-current") return part.value !== "false";
  return /^aria-(?:checked|selected|pressed)$/.test(part.name) && part.value === "true";
}

/** @param {import("css-what").Selector} part */
const className = (part) => part.type === "attribute" && part.name === "class" && part.action === "element" ? part.value : "";
/** @param {import("css-what").Selector} part */
const key = (part) => part.type === "attribute" && part.name === "aria-current" ? "[aria-current]" : stringify([[part]]);
/** @param {import("css-what").Selector | undefined} part @param {string} name */
const args = (part, name) => part?.type === "pseudo" && part.name === name && Array.isArray(part.data) ? part.data : [];

const wash = rules.find(({ sel, declarations }) => sel.startsWith(":where(") && declarations.some(({ p, v }) =>
  p === "background-image" && resolveValue(v) === "linear-gradient(color-mix(in srgb,currentColor 8%,transparent),"
    + "color-mix(in srgb,currentColor 8%,transparent))"));
assert.ok(wash, "the shared hover wash for selected controls is published");
const [hostGroup, stateGroup, hoverGroup] = parse(wash.sel)[0];
const washHosts = new Set(args(hostGroup, "where").map((part) => stringify([part])));
const washStates = new Set(args(stateGroup, "where").flatMap((part) => part.filter(chosen).map(key)));
const exclusion = args(hoverGroup, "where")[0]?.find((part) => part.type === "pseudo" && part.name === "not");
const washExclusions = new Set(args(exclusion, "not").map((part) => stringify([part])));

test("selected controls draw the shared hover wash before the press wash", () => {
  for (const host of parse(hosts)) assert.ok(washHosts.has(stringify([host])), stringify([host]));
  for (const selector of [":disabled", '[aria-disabled="true"]', ...alternatives]) {
    assert.ok(washExclusions.has(stringify(parse(selector))), "the selected wash excludes " + selector);
  }
  const press = rules.find(({ sel, declarations }) => sel.endsWith(":where(:active)")
    && declarations.some(({ p, v }) => p === "background-image" && v === "linear-gradient(var(--press-fill),var(--press-fill))"));
  assert.ok(press && press.n > wash.n, "a press takes priority over the hover wash");
});

test("the shared wash recognizes every styled selected state", () => {
  const active = rules.filter(({ sel, declarations }) => !/::|:(hover|active|focus(?:-visible|-within)?)\b/.test(sel)
    && declarations.some(({ p }) => visual.test(p)));
  const hovered = new Set(rules.filter(({ sel }) => sel.includes(":hover")).flatMap(({ sel }) =>
    parse(sel).flatMap((option) => subject(option).map(className))).filter(Boolean));
  const missing = new Set();
  const silent = new Set();
  const known = new Set();
  for (const rule of active) {
    for (const option of parse(rule.sel)) {
      const parts = subject(option);
      const selected = parts.filter(chosen);
      if (selected.length === 0) continue;
      known.add(rule.sel);
      for (const part of selected) if (!washStates.has(key(part))) missing.add(key(part));
      const own = parts.filter((part) => !chosen(part)).map(className).filter(Boolean);
      if (own.length && !own.some((name) => drawnClasses.has(name))) continue;
      if (/^(button|a|summary)\b|\[role=/.test(stringify([parts])) || own.some((name) => controlClasses.has(name))) continue;
      if (/\.(?:prow|nrow|dd-row|shd-tabw|shd-tab)\b|\.at-list li|\.jump-list li/.test(rule.sel)) continue;
      if (rule.sel === ".vw-tab.is-on") continue;
      if (own.some((name) => hovered.has(name))) silent.add(rule.sel);
    }
  }
  assert.ok(known.size > 60, known.size + " selected-state rules in the census");
  assert.ok(known.has('.cp-mode button[aria-checked="true"]'), "the filter chip uses the shared wash");
  assert.ok([...known].some((selector) => selector.includes(".prow.is-on")), "the sidebar selection is counted");
  assert.deepEqual([...missing].sort(), [], "selected states missing from the shared wash");
  assert.deepEqual([...silent].sort(), [], "hover feedback outside the shared treatment");
});

test("no selected fill or control shorthand overrides the shared feedback", () => {
  const offenders = [];
  for (const { sel, declarations } of rules) {
    if (!declarations.some(({ p, imp }) => imp && /^background(?:-image)?$/.test(p))) continue;
    for (const option of parse(sel)) {
      const parts = subject(option);
      const own = parts.map(className).filter(Boolean);
      const selected = !/:active|:hover/.test(sel) && parts.some(chosen);
      const control = /^button\b/.test(stringify([parts])) || own.some((name) => controlClasses.has(name));
      if (selected || (control && declarations.some(({ p, imp }) => p === "background" && imp))) offenders.push(sel);
    }
  }
  assert.deepEqual(offenders, []);
});

test("the sidebar paints its own selected rows and a shell uses the tab wrapper", () => {
  const sidebar = ":root:root .side :is(.prow.busy,.prow.needs,.prow.is-on,.nrow.is-on):hover";
  assert.ok(rules.some(({ sel, declarations }) => sel === sidebar && declarations.some(({ p, v }) =>
    p === "background-image" && v.startsWith("linear-gradient(color-mix(in srgb,var(--ink) 6%,"))));
  assert.ok(washHosts.has(".shd-tabw"));
  assert.ok(rules.some(({ sel }) => sel.includes(".shd-tabw.is-edit")));
});

test("the selected file tab keeps its wrapper fill when hovered", () => {
  assert.ok(rules.some(({ sel, declarations }) => sel === ".vw-tab.is-on"
    && declarations.some(({ p, v }) => p === "background" && v === "var(--canvas)")));
  assert.ok(rules.some(({ sel, declarations }) => sel === ".vw-tab:not(.is-on):hover"
    && declarations.some(({ p, v }) => p === "background" && v === "var(--hover-fill)")));
  assert.ok(controlClasses.has("vw-tab-b"), "the tab inside the wrapper is a control");
});

test("a select moves one active choice under the pointer and skips disabled choices", async () => {
  const { window, document } = await dom("<main></main>");
  const observed = new Set();
  Object.assign(globalThis, {
    customElements: window.customElements,
    MutationObserver: class {
      observe() { observed.add(this); }
      disconnect() { observed.delete(this); }
      takeRecords() { return []; }
    },
    getComputedStyle: window.getComputedStyle,
    innerHeight: 844,
    innerWidth: 1440,
    removeEventListener: window.removeEventListener.bind(window),
  });
  await import("../core/ui/components/xo-select.js");
  const select = document.createElement("xo-select");
  select.innerHTML = '<option value="a">Alpha</option><option value="b" disabled>Bravo</option><option value="c">Charlie</option>';
  Object.defineProperty(select.querySelector("[disabled]"), "disabled", { value: true });
  document.querySelector("main").append(select);
  const button = select.querySelector("button");
  button.focus();
  button.click();
  const rows = [...select.querySelectorAll(".dd-row")];
  assert.equal(rows.length, 3);
  const pointing = (index) => rows[index].dispatchEvent(new window.Event("pointermove", { bubbles: true }));
  const current = () => rows.filter((row) => row.classList.contains("is-cur")).map((row) => row.id);
  pointing(1);
  assert.deepEqual(current(), [rows[0].id], "a disabled row cannot take the active position");
  pointing(2);
  assert.deepEqual(current(), [rows[2].id]);
  assert.equal(button.getAttribute("aria-activedescendant"), rows[2].id);
  same(document.activeElement, button);
  const enter = new window.Event("keydown", { bubbles: true, cancelable: true });
  enter.key = "Enter";
  button.dispatchEvent(enter);
  assert.equal(select.value, "c");
  assert.equal(observed.size, 1);
  const menu = select.querySelector('[role="listbox"]');
  button.click();
  window.dispatchEvent(new window.Event("resize"));
  assert.equal(button.getAttribute("aria-expanded"), "false");
  menu.dispatchEvent(new window.Event("animationend"));
  assert.equal(menu.hidden, true);
  button.click();
  select.remove();
  assert.equal(observed.size, 0);
  assert.equal(menu.hidden, true);
  document.querySelector("main").append(select);
  assert.equal(observed.size, 1);
  same(select.querySelector("button"), button);
  assert.equal(select.value, "c");
  select.remove();
  assert.equal(observed.size, 0);
});
