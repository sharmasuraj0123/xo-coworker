// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { list } from "postcss";
import { templateElements } from "../tools/conformance/templates.mjs";
import { publishedRules, resolveValue } from "./lib/css-snapshot.mjs";

const rules = publishedRules();
const root = fileURLToPath(new URL("../", import.meta.url));
const linkControl = rules.find(({ sel, declarations }) => /^:is\(\.[\w., -]+\)$/.test(sel)
  && declarations.some(({ p, v }) => p === "transition" && v.startsWith("color var(--d-hover)")
    && v.includes("text-decoration-color")));
assert.ok(linkControl, "the shared transition for text link controls");

test("text link controls use one hover and press treatment", () => {
  const link = linkControl.sel;
  const enabled = ':not(:disabled,[aria-disabled="true"],[aria-busy="true"])';
  const hover = rules.find(({ sel }) => sel === `${link}:where(:hover${enabled})`);
  const press = rules.find(({ sel }) => sel === `${link}:where(:active${enabled})`);
  assert.ok(hover?.declarations.some(({ p, v }) => p === "color" && v === "var(--ink)"), "hover uses full ink");
  assert.ok(hover?.declarations.some(({ p, v }) => p === "text-decoration-color" && v === "currentColor"));
  assert.ok(press?.declarations.some(({ p, v }) => p === "opacity" && resolveValue(v) === ".7"), "press dims");
  const fill = rules.find(({ sel, declarations }) => sel.startsWith(":where(button,") && sel.endsWith(":where(:active)")
    && declarations.some(({ p, v }) => p === "background-image" && v === "linear-gradient(var(--press-fill),var(--press-fill))"));
  assert.ok(fill?.sel.includes(`,${link}))`), "the shared press fill excludes text links");
});

test("every underlined text button uses the shared treatment and can brighten on hover", () => {
  const listed = new Set(list.comma(linkControl.sel.slice(4, -1)).map((selector) => selector.slice(1)));
  const buttons = new Set(templateElements(root).filter(({ localName }) => localName === "button")
    .flatMap((button) => [...button.classList]));
  const underlined = new Set();
  const restingInk = new Map();
  for (const { sel, declarations } of rules) {
    const match = /^(?:button)?\.([\w-]+)$/.exec(sel);
    if (!match || !buttons.has(match[1])) continue;
    for (const { p, v } of declarations) {
      if ((p === "text-decoration" || p === "text-decoration-line") && v.split(/\s+/).includes("underline")) {
        underlined.add(match[1]);
      }
      if (p === "color") restingInk.set(match[1], v);
    }
  }
  assert.deepEqual([...underlined].filter((button) => !listed.has(button)), [], "underlined buttons outside the shared state");
  assert.deepEqual([...listed].filter((button) => restingInk.get(button) === "var(--ink)"), [], "buttons resting at full ink");
  assert.ok(listed.has("vw-cut-dl") && underlined.has("vw-cut-dl"), "the viewer's Try again and Download use it");
});
