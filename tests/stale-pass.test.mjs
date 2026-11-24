// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { list } from "postcss";
import { templateElements } from "../tools/conformance/templates.mjs";
import { publishedRules } from "./lib/css-snapshot.mjs";

const root = new URL("../", import.meta.url);
const ids = new URL("e2e/fixtures/controls/controls-ids.json", root);
const rechecks = new URL("e2e/fixtures/controls/link-rows.json", root);
/** @type {Record<string, {key: string, aliases?: string[]}>} */
const registry = JSON.parse(readFileSync(ids, "utf8")).ids;

test("the recheck list covers all controls using the shared text link treatment", () => {
  const link = publishedRules().find(({ sel, declarations }) => /^:is\(\.[\w., -]+\)$/.test(sel)
    && declarations.some(({ p, v }) => p === "transition" && v.startsWith("color var(--d-hover)")
      && v.includes("text-decoration-color")));
  assert.ok(link, "the shared text link transition is published");
  const classes = list.comma(link.sel.slice(4, -1)).map((selector) => selector.slice(1));
  const reached = new Set();
  for (const node of templateElements(fileURLToPath(root))) {
    const tag = node.localName;
    if (tag !== "a" && tag !== "button") continue;
    const cls = classes.find((name) => node.classList.contains(name));
    if (!cls) continue;
    const hooks = [...node.attributes].filter(({ name }) => name.startsWith("data-"));
    for (const [id, { key, aliases = [] }] of Object.entries(registry)) {
      if (hooks.length) {
        if (key.startsWith(`${tag}[`) && hooks.every(({ name, value }) => key.includes(name)
          && (!value.trim() || !key.includes(`${name}=`) || key.includes(`${name}=${value.trim()}`)))) reached.add(id);
      } else {
        const selector = `${tag}.${cls}`;
        if ([key, ...aliases].some((entry) => entry === selector || entry.startsWith(`${selector} `)
          || entry.includes(` ${selector}`))) reached.add(id);
      }
    }
  }
  const listed = new Set(JSON.parse(readFileSync(rechecks, "utf8")));
  assert.deepEqual([...reached].filter((id) => !listed.has(id)).sort(), [], "affected controls missing from the recheck list");
  assert.deepEqual([...listed].filter((id) => !reached.has(id)).sort(), [], "unaffected controls on the recheck list");
  assert.ok(reached.has("S238") && reached.has("S139"), "Runs and the viewer both include their Try again controls");
});
