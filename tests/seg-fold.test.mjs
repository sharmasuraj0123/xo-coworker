import assert from "node:assert/strict";
import { test } from "node:test";
import { createViewerHead } from "../modules/files/viewer-head.js";
import { publishedRules } from "./lib/css-snapshot.mjs";
import { dom } from "./lib/dom.mjs";

test("the narrow viewer only hides a full label when an icon or short label remains", async () => {
  const { document, window } = await dom('<section id="viewer"></section>');
  const el = document.querySelector("#viewer");
  const V = { file: { name: "example" }, tabs: [] };
  const { head } = createViewerHead({
    V, el, doc: () => null, canSave: () => true, chg: () => ({ file: {} }),
    showsDiff: () => false, runsCode: () => false,
  });
  const rules = publishedRules().filter(({ at }) => at.includes("@container flpv (max-width:520px)"));
  const property = (selector, name) => rules.filter(({ sel }) => sel === selector)
    .flatMap(({ declarations }) => declarations.filter(({ p }) => p === name).map(({ v }) => v));
  assert.deepEqual(property(".vw-seg button:where(:has(svg))", "width"), ["var(--h-sm)"]);
  assert.deepEqual(property(".vw-seg button:where(:has(svg))", "padding"), ["0"]);
  assert.deepEqual(property(".vw-seg button:where(:has(svg))", "justify-content"), ["center"]);
  const hidden = rules.filter(({ declarations }) => declarations.some(({ p, v }) => p === "display" && v === "none"));
  assert.deepEqual(property(".vw-seg .vw-wide", "display"), ["none"]);
  assert.deepEqual(property(".vw-seg .vw-narrow", "display"), ["inline"]);
  assert.deepEqual(property(".vw-seg button:where(:has(svg)) span", "display"), ["none"]);
  for (const kind of ["markdown", "html", "image"]) {
    V.data = { kind };
    el.innerHTML = head();
    const groups = el.querySelectorAll(".vw-seg");
    assert.equal(groups.length, 2, kind);
    for (const button of el.querySelectorAll(".vw-seg button")) {
      const visibleText = [...button.childNodes].some((node) => {
        if (node.nodeType === window.Node.TEXT_NODE) return Boolean(node.textContent.trim());
        return node.localName === "span" && Boolean(node.textContent.trim())
          && !hidden.some(({ sel }) => sel.startsWith(".vw-seg ") && node.matches(sel));
      });
      assert.ok(Boolean(button.querySelector("svg")) || visibleText, button.getAttribute("aria-label") || button.textContent);
    }
  }
});
