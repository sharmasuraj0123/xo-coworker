// @ts-check

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { flattenStyles } from "../css-flatten.mjs";
import { resolvedStyles } from "../css-resolve.mjs";
import { cssSyntax } from "../css-syntax.mjs";

/** @param {import("node:test").TestContext} context @param {Record<string, string>} styles */
function site(context, styles) {
  const root = mkdtempSync(join(tmpdir(), "css-resolve-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const html = '<!doctype html><html><head><link href="styles/app.css" rel="stylesheet"></head></html>';
  for (const [file, content] of Object.entries({ "index.html": html, ...styles })) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
}

test("flattening preserves declarations, cascade layers, conditions, and relative asset URLs", (context) => {
  const app = "styles/app.css";
  const original = site(context, {
    [app]: '@layer tokens, ui; @layer ui { @media (min-width: 700px) { .box { background: url(./tile.svg); } } }',
  });
  const rest = "moved/ui.css";
  const contents = "@media (min-width: 700px) { .box { background: url(../styles/tile.svg); } }";
  const moved = site(context, { [app]: '@layer tokens, ui; @import "../moved/ui.css" layer(ui);', [rest]: contents });
  assert.deepEqual(flattenStyles(moved), flattenStyles(original));
  writeFileSync(join(moved, rest), contents.replace("../styles/tile.svg", "./tile.svg"));
  assert.notDeepEqual(flattenStyles(moved), flattenStyles(original));
  writeFileSync(join(moved, rest), '@import "../styles/app.css";');
  assert.throws(() => flattenStyles(moved), /cyclic stylesheet/);
});

test("resolution proves a token-only substitution and detects theme-exclusive changes", (context) => {
  const app = "styles/app.css";
  const original = site(context, { [app]: ".box { padding: 8px; }" });
  const token = ":root { --pad: 8px; } .box { padding: var(--pad); }";
  const changed = site(context, { [app]: token });
  const originalTable = resolvedStyles(flattenStyles(original));
  assert.deepEqual(resolvedStyles(flattenStyles(changed)), originalTable);
  writeFileSync(join(changed, app), token + ':root[data-theme="light"] { --pad: 12px; }');
  const table = resolvedStyles(flattenStyles(changed));
  assert.deepEqual(table.declarations[0].value, ["8px", "12px"]);
  assert.notDeepEqual(table, originalTable);
});

test("resolution conservatively retains scoped, runtime and cyclic definitions", (context) => {
  const css = `
    :root { --runtime: 4px; --ref: var(--runtime); --cycle: var(--cycle); }
    .card { --local: 15px; padding: var(--ref); margin: var(--local); height: var(--cycle, 8px); }
  `;
  const root = site(context, { "styles/app.css": css });
  const rows = flattenStyles(root);
  const output = resolvedStyles(rows, new Set(["--runtime"])).declarations;
  assert.deepEqual(output, rows);
});

test("resolution includes desktop, phone, contrast, and flavour states", (context) => {
  const source = `
    @layer token, core;
    :root { --text: #123; }
    @layer token { :root[data-flavour="sand"] { --text: #aba; } }
    :root[data-flavour="sand"] { --text: #456; }
    @media (max-width: 760px) { :root[data-flavour="sand"] { --text: #789; } }
    @media (prefers-contrast: more) { :root[data-theme="light"] { --text: #abc !important; } }
    .card { color: var(--text); }
  `;
  const root = site(context, { "styles/app.css": source });
  const { states, declarations } = resolvedStyles(flattenStyles(root));
  const color = declarations.find((row) => row.property === "color").value;
  const sample = (query) => color[states.findIndex(query)];
  assert.equal(sample((v) => v.flavour === "sand" && v.width > 760 && v.theme === "dark"), "#456");
  assert.equal(sample((v) => v.flavour === "sand" && v.width === 760 && v.theme === "dark"), "#789");
  assert.equal(sample((v) => v.theme === "light" && v.moreContrast), "#abc");
});

test("new malformed CSS is rejected", () => {
  assert.throws(() => cssSyntax(".box { (broken); }", "style.css", () => {}), /Unknown word/);
});
