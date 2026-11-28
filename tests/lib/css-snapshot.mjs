// @ts-check

import { fileURLToPath } from "node:url";
import { list } from "postcss";
import { flattenStyles } from "../../tools/conformance/css-flatten.mjs";
import { substitute } from "../../tools/conformance/css-resolve.mjs";
import { rootTokenModel } from "../../tools/conformance/css-root-tokens.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
export const declarationFiles = new WeakMap();
export const stylesheetRows = flattenStyles(root, "index.html", (row, path) => declarationFiles.set(row, path));

export function publishedRules() {
  const groups = new Map();
  for (const row of stylesheetRows) {
    const selector = row.context.at(-1)?.selector;
    const file = declarationFiles.get(row);
    if (!selector || !row.property || file?.includes("/vendor/")) continue;
    const scope = row.context;
    if (!groups.has(scope)) {
      const at = scope.slice(0, -1).filter((part) => part.at).map((part) => "@" + part.at + " " + part.params);
      groups.set(scope, { file, at, selectors: list.comma(selector), declarations: [] });
    }
    groups.get(scope).declarations.push({ p: row.property, v: row.value, imp: row.important });
  }
  return [...groups.values()].flatMap(({ file, at, selectors, declarations }, n) => selectors.map((selector) => ({
    f: file, at, sel: selector.replace(/\s+/g, " ").replace(/\s*([>+~])\s*/g, "$1").trim(), declarations, n,
  })));
}
let model;
const tokenModel = () => model ??= rootTokenModel(stylesheetRows);

/** @param {string | ((selector: string) => boolean)} selector @param {string} [property] */
export function valuesFor(selector, property) {
  return declarationsFor(selector, property).map((row) => resolveValue(row.value));
}

/** @param {string | ((selector: string) => boolean)} selector @param {string} [property] */
export function declarationsFor(selector, property) {
  const { folded } = tokenModel();
  const matches = typeof selector === "string" ? (candidate) => candidate === selector : selector;
  return stylesheetRows.filter((row) => {
    const candidate = row.context.at(-1)?.selector;
    return row.property && !folded.has(row) && (!property || row.property === property)
      && typeof candidate === "string" && matches(candidate);
  });
}

/** @param {string} value */
export function resolveValue(value) {
  const { contexts } = tokenModel();
  const variants = contexts.map((context) => substitute(value, context.values));
  return variants.every((variant) => variant === variants[0]) ? variants[0] : variants;
}

/** @param {string} [selector] */
export function tokenValuesFor(selector = ":root") {
  const entries = stylesheetRows.filter((row) => row.property?.startsWith("--")
    && row.context.length === 2 && row.context[0].at === "layer"
    && row.context[0].params === "tokens" && row.context[1].selector === selector);
  return new Map(entries.map((row) => [row.property, row.value]));
}
