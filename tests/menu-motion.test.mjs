// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { publishedRules, tokenValuesFor } from "./lib/css-snapshot.mjs";

const rules = publishedRules();
const tokens = tokenValuesFor();

test("menu items focus immediately without an outline, and menus enter downwards", () => {
  const item = "[role=menu] :is([role=menuitem],[role=menuitemradio])";
  const transitions = rules.filter(({ sel }) => sel === item).flatMap(({ declarations }) => declarations);
  assert.ok(transitions.some(({ p, v }) => p === "transition" && v === "none"), "menu items do not fade");

  const focus = rules.filter(({ sel }) => sel === `${item}:focus`).flatMap(({ declarations }) => declarations);
  assert.ok(focus.some(({ p, v }) => p === "background" && v === "var(--menu-focus)"), "focus uses the menu fill");
  assert.ok(focus.some(({ p, v }) => p === "color" && v === "var(--ink)"), "focus uses the primary text role");
  assert.ok(focus.some(({ p, v }) => p === "outline" && v === "none"), "focus uses the fill in place of a ring");
  assert.ok(tokens.has("--d-out") && tokens.has("--ease"));
  const entrance = rules.filter(({ sel }) => sel === "[role=menu]").flatMap(({ declarations }) => declarations);
  assert.ok(entrance.some(({ p, v }) => p === "animation" && v === "float-in-down var(--d-out) var(--ease)"));
});

test("individual menus use the shared focus treatment and entrance", () => {
  for (const menu of [".tw-menu", ".fl-menu", ".vw-menu"]) {
    assert.ok(!rules.some(({ sel }) => sel.startsWith(menu) && sel.endsWith(":focus")), `${menu} has its own focus rule`);
    const declarations = rules.filter(({ sel, at }) => sel === menu && !at.includes("@media (prefers-reduced-motion:reduce)"))
      .flatMap((rule) => rule.declarations);
    assert.ok(!declarations.some(({ p }) => p === "animation" || p.startsWith("animation-")), `${menu} has its own entrance`);
  }
});
