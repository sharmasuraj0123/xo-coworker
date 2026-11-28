// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { list } from "postcss";
import { templateElements } from "../tools/conformance/templates.mjs";
import { context, px } from "./lib/cascade.mjs";
import { declarationsFor, publishedRules, resolveValue, tokenValuesFor, valuesFor } from "./lib/css-snapshot.mjs";
import { dom, same } from "./lib/dom.mjs";
import { resolveTokens } from "./lib/tokens.mjs";

const tokens = Object.fromEntries([...tokenValuesFor()].filter(([, value]) => /^\d+(?:\.\d+)?px$/.test(value))
  .map(([property, value]) => [property, Number.parseFloat(value)]));
const elements = templateElements(fileURLToPath(new URL("../", import.meta.url)));
const controls = new Set();
const add = (element, ignore) => {
  for (const name of element.classList) if (name && !ignore.test(name)) controls.add("." + name);
};
const roles = '[role="button"],[role="tab"],[role="option"],[role="menuitem"],[role="menuitemradio"],[role="switch"]';
for (const element of elements) {
  if (element.matches("button,summary,select")) add(element, /^(is|st|k|m|t|r|e)-/);
  if (element.matches(roles)) add(element, /^is-/);
  if (element.matches("a:not(.lk,.lp-ln,.cp-link)")) add(element, /^is-/);
}

const SCALE = new Set([24, 32, 40, 48, 56]);
const all = publishedRules();
const off = new Map();
for (const r of all) {
  const c = context(r, 1440);
  if (!c.active || c.cond || /data-density|\.is-sheet\b/.test(r.sel)) continue;
  const last = r.sel.split(/[\s>+~]+/).pop();
  if (/::?(before|after)|:(hover|active|focus)/.test(last)) continue;
  if (!(last.match(/\.[\w-]+/g) || []).some((k) => controls.has(k)) && !/^(button|summary|select)\b/.test(last)) continue;
  for (const d of r.declarations) {
    if (d.p !== "height" && d.p !== "min-height") continue;
    const v = px(resolveTokens(d.v), tokens);
    if (v == null || v === 0 || SCALE.has(v)) continue;
    off.set(`${r.f}: ${r.sel} { ${d.p} }`, v);
  }
}



test("the census includes the controls whose sizes previously regressed", () => {
  const required = [".ev-undo", ".dt-more", ".vw-btn", ".xd-btn", ".vw-tab-b", ".pn-nav", ".pn-all",
    ".nrow", ".prow", ".chl-row", ".hd", ".tb-h", ".lp-b", ".lbx-btn"];
  for (const selector of required) assert.ok(controls.has(selector), selector);
  assert.ok(controls.size > 150, String(controls.size));
});

test("desktop control and row heights are on the scale", () => {
  assert.deepEqual([...off], []);
});

const phone = (row) => row.context.some((scope) => scope.at === "media" && scope.params === "(max-width:760px)");
const desktopValue = (selector, property) => {
  const row = declarationsFor(selector, property).find((candidate) => !phone(candidate));
  assert.ok(row, selector + " " + property);
  return resolveValue(row.value);
};

test("desktop, phone and compact rows use their shared heights", () => {
  assert.deepEqual([tokens["--h-row"], tokens["--h-row-act"], tokens["--h-row-list"]], [40, 48, 56]);
  const phoneRow = declarationsFor(":root", "--h-row").find(phone);
  assert.ok(phoneRow);
  assert.equal(resolveValue(phoneRow.value), "36px");
  const compact = ':root[data-density="compact"] :is(.main,.sheet,.iq-pop)';
  assert.deepEqual(valuesFor(compact, "--h-row"), ["32px"]);
  assert.deepEqual(valuesFor(compact, "--h-ctl"), ["24px"]);
  assert.equal(desktopValue(".nrow,.prow", "--nest-in"), "calc((var(--h-row) - 28px) / 2)");
  assert.equal(desktopValue(".nrow,.prow", "min-height"), "var(--h-row)");
  assert.deepEqual(valuesFor(".nrow,.prow", "padding")[0],
    "calc(var(--nest-in) - 1px) 10px calc(var(--nest-in) - 1px) calc(var(--nest-in) - 1px)");
  assert.equal(desktopValue(".chl-row", "height"), "48px");
  assert.equal(desktopValue(".pr-main", "gap"), "0");
  assert.match(String(desktopValue(".pr-name", "font")), /^400 .*\/20px/);
  assert.equal(desktopValue(".pr-t", "line-height"), "16px");
  assert.equal(desktopValue(".hd", "min-height"), "48px");
  const tools = declarationsFor((selector) => selector.endsWith(">.tb-h"), "min-height");
  const openTools = tools.filter((row) => !phone(row) && row.value === "var(--h-row)");
  assert.equal(openTools.length, 2);
  const sidebarPhone = declarationsFor(".nrow,.prow").filter(phone);
  const prop = (name) => resolveValue(sidebarPhone.find((row) => row.property === name)?.value ?? "");
  assert.deepEqual(["min-height", "padding-top", "padding-bottom"].map(prop), ["40px", "5px", "5px"]);
  assert.ok(declarationsFor((selector) => /^\.ch-(?:row|main|m)$/.test(selector)).every((row) => !phone(row)));
  assert.ok(declarationsFor((selector) => /^\.pr-(?:name|t)$/.test(selector), "line-height").every((row) => !phone(row)));
  assert.ok(tools.some((row) => phone(row) && row.context.at(-1).selector.endsWith(".is-unfolded>.tb-h")
    && resolveValue(row.value) === "48px"));
});

test("phone rows use the shared phone height steps", () => {
  const steps = new Set([36, 40, 48, 56]);
  const rowClass = /\.(nrow|prow|chl-row|hd-r|ar|ar-fold|ar-undo|syl-ln|ag-r|ch-r|tb-h|b-opt|set-row|iq-row|fl-r|cx-r|kr)(?![\w-])/;
  const sizes = declarationsFor((selector) => rowClass.test(selector)).filter((row) =>
    phone(row) && (row.property === "height" || row.property === "min-height"));
  const wrong = sizes.flatMap((row) => {
    const height = px(row.value, tokens);
    return height >= 36 && !steps.has(height) ? [row.context.at(-1).selector + " " + height] : [];
  });
  assert.deepEqual(wrong, []);
});

test("the decision's where line fits the inline control height", () => {
  assert.equal(desktopValue(".c-where", "height"), "24px");
  assert.equal(desktopValue(".c-where", "padding"), resolveValue("0 var(--halo)"));
});

test("a row fits its text, padding and border within its height floor", () => {
  const steps = new Set([40, 48, 56]);
  const partners = new Map();
  for (const element of elements) {
    const classes = Array.from(element.classList, (name) => "." + name);
    for (const name of classes) partners.set(name, new Set([...(partners.get(name) ?? []), ...classes]));
  }
  const finalClasses = (selector) => selector.split(/[\s>+~]+/).at(-1).match(/\.[\w-]+/g) ?? [];
  const base = all.filter((rule) => context(rule, 1440).active && !context(rule, 1440).cond
    && !rule.sel.includes("data-density"));
  const borderClasses = new Set(base.filter((rule) => rule.declarations.some((property) =>
    /^border(?:-width)?$/.test(property.p) && /^1px(?:\s|$)/.test(String(resolveValue(property.v)))))
    .flatMap((rule) => finalClasses(rule.sel)));
  const exceeding = [];
  for (const rule of base) {
    const finalSelector = rule.sel.split(/[\s>+~]+/).at(-1);
    const classes = finalClasses(rule.sel);
    if (finalSelector.includes(":") || !classes.some((name) => controls.has(name))) continue;
    const values = new Map(rule.declarations.map(({ p, v }) => [p, v]));
    const floor = px(values.get("min-height") ?? "", tokens);
    if (!steps.has(floor) || !values.has("padding") || (values.has("height") && values.get("height") !== "auto")) continue;
    const line = values.get("line-height") ?? values.get("font")?.split("/")[1]?.split(" ")[0];
    const lineHeight = px(String(resolveValue(line ?? "")), tokens);
    const padding = list.space(values.get("padding")).map((value) => px(String(resolveValue(value)), tokens));
    if (lineHeight === null || padding[0] === null || padding[2] === null) continue;
    const hasBorder = classes.some((name) => borderClasses.has(name)
      || [...(partners.get(name) ?? [])].some((other) => borderClasses.has(other)));
    const size = lineHeight + padding[0] + (padding[2] ?? padding[0]) + (hasBorder ? 2 : 0);
    if (size > floor) exceeding.push(rule.sel + " " + size + " > " + floor);
  }
  assert.deepEqual(exceeding, []);
});

test("action labels stay on one line", () => {
  assert.equal(desktopValue(".meta-btn", "flex"), "none");
  assert.equal(desktopValue(".meta-btn", "white-space"), "nowrap");
  assert.equal(desktopValue(".meta-btn", "display"), "inline-flex");
});

test("answers fit a 40 px row or 56 px with a description", () => {
  const expected = {
    "flex-direction": "column", "align-items": "flex-start", "justify-content": "flex-start",
    gap: "0", "min-height": "40px", padding: "9px 14px", "line-height": "20px",
  };
  for (const [property, value] of Object.entries(expected)) assert.equal(desktopValue(".b-opt", property), value);
  assert.match(String(desktopValue(".o-l", "font")), /^500 .*\/20px/);
  assert.match(String(desktopValue(".o-d", "font")), /^400 .*\/16px/);
  assert.equal(desktopValue(".o-d", "display"), "block");
  assert.equal(desktopValue(".o-d", "margin-top"), "0");
});

test("standalone link buttons have a height floor and inline links sit in their sentence", async () => {
  const linkStyle = declarationsFor((selector) => selector.startsWith(":is("), "transition").find((row) =>
    row.value.startsWith("color var(--d-hover)") && row.context.at(-1).selector.includes(".wsh-home"));
  const heightRule = declarationsFor((selector) => selector.startsWith(":where("), "min-height").find((row) =>
    row.value === "var(--h-sm)" && row.context.at(-1).selector.includes(".fl-link"));
  assert.ok(linkStyle);
  assert.ok(heightRule);
  const subjects = (row) => list.comma(row.context.at(-1).selector.slice(row.context.at(-1).selector.indexOf("(") + 1, -1));
  assert.deepEqual([...subjects(heightRule), ".cp-link", ".lp-ln", ".wsh-home"].sort(), subjects(linkStyle).sort());
  const { document } = await dom('<header id="ws-head"></header>');
  const { createWorkspaceHeader } = await import("../shell/workspace-header.js");
  createWorkspaceHeader(() => "ws", () => [])();
  const sentence = document.querySelector(".wsh-p");
  const link = sentence?.querySelector("button.wsh-home");
  assert.ok(link);
  assert.equal(link.textContent, "Home");
  assert.match(sentence.textContent, /waits on Home\.$/);
  same(sentence.firstElementChild, link);
});

test("compact density keeps the composer controls at their regular size", () => {
  const compact = declarationsFor((selector) => selector.includes('[data-density="compact"]'));
  assert.ok(compact.every((row) => row.property !== "--comp-ctl"));
  assert.ok(compact.every((row) => !row.context.at(-1).selector.includes(":is(.attach,.send)")
    || !/^(width|height|margin)/.test(row.property)));
});

test("segment controls are inset and stay concentric at 24 px", () => {
  assert.deepEqual(valuesFor(".vw-seg", "padding").filter((value) => value === "3px"), ["3px"]);
  assert.deepEqual(valuesFor(".vw-seg button", "height").filter((value) => value === "24px"), ["24px"]);
  const corners = valuesFor(".vw-seg button", "border-radius");
  assert.equal(corners.filter((value) => value === "calc(8px - 4px)").length, 1);
  assert.ok(valuesFor(".vw-seg button:where(:has(svg))", "width").includes("24px"));
});
