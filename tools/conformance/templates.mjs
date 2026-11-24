// @ts-check

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHTML } from "linkedom";
import { conformanceFiles } from "./inventory.mjs";
import { javascript, JS, SOURCE, TEST, walk } from "./syntax.mjs";

/** @param {string} root */
export function appDocument(root) {
  return parseHTML(readFileSync(join(root, "index.html"), "utf8")).document;
}

/** @param {string} html */
function elements(html) {
  const { document } = parseHTML("<!doctype html><html><body>" + html + "</body></html>");
  return Array.from(document.body.querySelectorAll("*"));
}

/** @param {string} root @param {(file: string) => boolean} [include] */
export function templateElements(root, include = () => true) {
  const result = [];
  if (include("index.html")) {
    const document = appDocument(root);
    result.push(...document.body.querySelectorAll("*"));
  }
  for (const file of conformanceFiles(root)) {
    if (!JS.test(file) || !SOURCE.test(file) || TEST.test(file) || !include(file)) continue;
    const source = readFileSync(join(root, file), "utf8");
    walk(javascript(source, file).tree, (node) => {
      const text = node.type === "TemplateLiteral"
        ? node.quasis.map((part) => part.value.cooked).join(" ")
        : node.type === "Literal" && typeof node.value === "string" ? node.value : "";
      if (/<[a-z][^>]*>/i.test(text)) result.push(...elements(text));
    });
  }
  return result;
}
