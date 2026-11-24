// @ts-check

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { flattenStyles } from "../css-flatten.mjs";

/** @param {import("node:test").TestContext} context */
function site(context) {
  const root = mkdtempSync(join(tmpdir(), "css-cascade-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "index.html"), '<link rel="stylesheet" href="./css/app.css">');
  return (app, imports = {}) => {
    for (const [file, text] of Object.entries({ "css/app.css": app, ...imports })) {
      const target = join(root, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text);
    }
    return flattenStyles(root);
  };
}

test("relative and root-relative assets resolve to different published routes", (context) => {
  const snapshot = site(context);
  const mask = (url) => `.item { mask-image: url(${url}); }`;
  const relative = snapshot(mask("../assets/mask.svg"));
  const absolute = snapshot(mask("/assets/mask.svg"));
  assert.notDeepEqual(relative, absolute);
  assert.match(relative[0].value, /\/v\/[^/]+\/assets\/mask\.svg/);
  assert.equal(absolute[0].value, 'url("/assets/mask.svg")');
  assert.deepEqual(relative, snapshot('@import "../modules/example/part.css";', {
    "modules/example/part.css": mask("../../assets/mask.svg"),
  }));
});

test("anonymous layers keep separate identities in blocks and imports", (context) => {
  const snapshot = site(context);
  const first = "#item { color: red; }";
  const second = ".item { color: blue; }";
  const separate = snapshot(`@layer { ${first} } @layer { ${second} }`);
  const merged = snapshot(`@layer { ${first} ${second} }`);
  assert.notDeepEqual(separate, merged);
  assert.deepEqual(separate, snapshot('@import "./first.css" layer; @import "./second.css" layer;', {
    "css/first.css": first, "css/second.css": second,
  }));
});

test("an empty registration fixes layer priority and matches an order statement", (context) => {
  const snapshot = site(context);
  const body = "@layer a { .item { color: red; } } @layer b { .item { color: blue; } }";
  const registered = snapshot("@layer b {} " + body);
  assert.notDeepEqual(registered, snapshot(body));
  assert.deepEqual(registered, snapshot("@layer b, a; " + body));
  assert.deepEqual(registered, snapshot('@import "./empty.css" layer(b); ' + body, { "css/empty.css": "" }));
});
