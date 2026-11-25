// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createScope } from "../../kernel/scope.js";
import { dom } from "../../../tests/lib/dom.mjs";
import { canvasPalette } from "../../../tools/flavours/theme-colors.mjs";
import { FLAVOURS, STONE } from "../flavours.js";
import { createTheme, wireThemeToggle } from "../theme.js";

test("theme and flavour changes update browser chrome without reading computed style", async () => {
  const { document } = await dom('<meta name="theme-color"><meta name="color-scheme"><button id="theme"></button>');
  const storage = new Map([["cv-theme", "system"]]);
  let notify = () => {};
  const os = { matches: false, addEventListener: (_type, listener) => { notify = listener; } };
  Object.assign(globalThis, {
    getComputedStyle() { assert.fail("Applying a theme must not force a computed-style read"); },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    matchMedia: () => os,
  });
  const expected = canvasPalette();
  assert.deepEqual([...expected.keys()].sort(), [STONE, ...FLAVOURS].map(({ id }) => id).sort());
  let diffTheme;
  const scope = createScope();
  const { applyTheme } = createTheme(scope, (theme) => { diffTheme = theme; });
  const button = document.querySelector("#theme");
  const color = document.querySelector('meta[name="theme-color"]');
  const scheme = document.querySelector('meta[name="color-scheme"]');
  const checks = (mode, canvas) => {
    assert.equal(document.documentElement.dataset.theme, mode);
    assert.equal(diffTheme, mode);
    const flavour = document.documentElement.dataset.flavour ?? "Stone";
    assert.equal(color.getAttribute("content"), canvas,
      `Browser chrome uses the ${mode} canvas for ${flavour}. Regenerate with node tools/flavours/theme-colors.mjs`);
    assert.equal(scheme.content, mode);
    assert.equal(button.getAttribute("aria-checked"), String(mode === "light"));
  };
  checks("dark", expected.get("stone").dark);
  os.matches = true;
  notify();
  checks("light", expected.get("stone").light);
  for (const [id, pair] of expected) {
    storage.set("cv-flavour", id);
    applyTheme("light");
    checks("light", pair.light);
    applyTheme("dark");
    checks("dark", pair.dark);
  }
  storage.set("cv-flavour", "constructor");
  let announcement;
  wireThemeToggle(scope, applyTheme, (message) => { announcement = message; });
  button.click();
  checks("light", expected.get("stone").light);
  assert.equal(storage.get("cv-theme"), "light");
  assert.equal(announcement, "Light mode");
});
