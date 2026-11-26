// @ts-check

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ORIGIN, sourcePath } from "../tools/conformance/css-publication.mjs";
import { appDocument } from "../tools/conformance/templates.mjs";
import { declarationsFor, stylesheetRows, tokenValuesFor, valuesFor } from "./lib/css-snapshot.mjs";

const root = new URL("../", import.meta.url);
const tokens = tokenValuesFor();

test("the interface, reading and code have their own font families", () => {
  assert.match(tokens.get("--sans"), /^"Geist",system-ui,/);
  assert.match(tokens.get("--sans-read"), /^"DM Sans",system-ui,/);
  assert.match(tokens.get("--mono"), /^"JetBrains Mono",ui-monospace,/);
});

test("each published font swaps in from a local file with its licence", () => {
  const faces = new Map();
  for (const { context, property, value } of stylesheetRows) {
    const scope = context.at(-1);
    if (scope?.at !== "font-face") continue;
    if (!faces.has(scope)) faces.set(scope, new Map());
    faces.get(scope).set(property, value);
  }
  assert.equal(faces.size, 9);
  for (const face of faces.values()) {
    assert.equal(face.get("font-display"), "swap");
    const src = /^url\("([^"]+\.woff2)"\)/.exec(face.get("src"))?.[1];
    assert.ok(src);
    const published = new URL(src, ORIGIN);
    assert.equal(published.origin, ORIGIN);
    const path = sourcePath(published);
    assert.ok(path.startsWith("/fonts/"), path);
    const local = new URL(path.slice(1), root);
    assert.ok(existsSync(local), path);
    assert.ok(["OFL.txt", "LICENSE.txt"].some((name) => existsSync(new URL(name, local))), path);
  }
});

test("the body font is the only preload", () => {
  const document = appDocument(fileURLToPath(root));
  const preloads = [...document.querySelectorAll('link[rel~="preload"][as="font"]')];
  assert.deepEqual(preloads.map((link) => link.getAttribute("href")), ["./fonts/geist/Geist-Variable.woff2"]);
  assert.ok(existsSync(new URL(preloads[0].getAttribute("href"), root)));
  assert.ok([...document.querySelectorAll("link[href]")].every((link) =>
    !/^fonts\.(?:googleapis|gstatic)\.com$/i.test(new URL(link.href, ORIGIN).hostname)));
});

test("the reading face provides the metrics for the composer, bubbles and message headings", () => {
  assert.ok(declarationsFor(".composer textarea", "font-family").some(({ value }) => value === "var(--sans-read)"));
  for (const selector of [".bubble", ".prose"]) {
    const declarations = new Map(declarationsFor(selector).map(({ property, value }) => [property, value]));
    assert.equal(declarations.get("font-family"), "var(--sans-read)", selector);
    for (const property of ["--cap-mid", "--asc", "--desc"]) {
      assert.equal(declarations.get(property), `var(${property}-read)`, `${selector} ${property}`);
    }
  }
  assert.equal(declarationsFor(".md-h", "font-family").length, 0);
});

test("a Markdown page reads in chat's face and metrics, its headings and list marks included", () => {
  const page = new Map(declarationsFor(".vw-doc .cm-xo-page .cm-scroller").map(({ property, value }) => [property, value.trim()]));
  assert.equal(page.get("font"), "var(--fw-read) var(--fs-read)/var(--lh-read) var(--sans-read)");
  for (const property of ["--cap-mid", "--asc", "--desc"]) assert.equal(page.get(property), `var(${property}-read)`, property);
  assert.equal(declarationsFor(".cm-md-h,.cm-md-h *", "font-family").length, 0, "headings keep the reading face");
  for (const mark of [".cm-md-bullet", ".cm-md-olnum"]) assert.deepEqual(valuesFor(mark, "color"), valuesFor(".prose li::marker", "color"), mark);
});

test("the shared type scale retains the reading and interface steps", () => {
  const scale = (prefix, steps) => steps.map((name) => tokens.get(`--${prefix}-${name}`));
  assert.deepEqual(scale("fs", ["meta", "ui", "code", "read", "title", "input", "heading", "display", "hero"]),
    ["12px", "14px", "14px", "16px", "16px", "16px", "20px", "28px", "40px"]);
  assert.deepEqual(scale("lh", ["meta", "ui", "read", "title", "heading", "display", "hero"]),
    ["16px", "20px", "24px", "24px", "28px", "36px", "44px"]);
});

test("a link capsule fits the font metrics it inherits", () => {
  const padding = "calc(var(--cap-mid) + .735em - var(--asc)) .6em calc(.735em - var(--cap-mid) - var(--desc)) .38em";
  assert.ok(valuesFor(".lk-in", "padding").includes(padding));
});
