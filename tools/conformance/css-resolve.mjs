// @ts-check

import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { flattenStyles } from "./css-flatten.mjs";
import { rootTokenModel } from "./css-root-tokens.mjs";
import { closingParen, valueTokens } from "./css-values.mjs";
import { conformanceFiles } from "./inventory.mjs";
import { JS, SOURCE, TEST } from "./syntax.mjs";

/** @param {string} value @param {Map<string, string>} values @param {Set<string>} [active] */
export function substitute(value, values, active = new Set()) {
  if (!/var\(/i.test(value)) return value;
  const tokens = valueTokens(value);
  let output = "";
  let start = 0;
  for (let index = 0; index < tokens.length - 1; index++) {
    if (tokens[index].text.toLowerCase() !== "var" || tokens[index + 1].text !== "(") continue;
    const end = closingParen(tokens, index + 1);
    if (end === -1) throw new Error(`Malformed var(): ${value}`);
    const argument = value.slice(tokens[index + 1].offset + 1, tokens[end].offset);
    const [, key, fallback] = /^\s*(--[\w-]+)\s*(?:,([\s\S]*))?$/.exec(argument) ?? [];
    const at = tokens[index].offset;
    const after = tokens[end].offset + 1;
    output += value.slice(start, at);
    if (values.has(key) && !active.has(key)) {
      output += substitute(values.get(key), values, new Set(active).add(key));
    } else if (fallback !== undefined) {
      output += `var(${key},${substitute(fallback, values, active)})`;
    } else output += value.slice(at, after);
    start = after;
    index = end;
  }
  return output + value.slice(start);
}

/** @param {string} root */
function runtimeNames(root) {
  const keys = new Set();
  for (const file of conformanceFiles(root).filter((candidate) => SOURCE.test(candidate) && !TEST.test(candidate))) {
    if (!(JS.test(file) || file.endsWith(".html"))) continue;
    const source = readFileSync(join(root, file), "utf8");
    for (const [, key] of source.matchAll(/(?:setProperty\(\s*["'`]|(?:style=["']|;)\s*)(--[\w-]+)/g)) {
      keys.add(key);
    }
  }
  return keys;
}

/** @param {object[]} rows @param {Set<string>} [runtime] */
export function resolvedStyles(rows, runtime = new Set()) {
  const { folded, contexts } = rootTokenModel(rows, runtime);
  const declarations = rows.filter((row) => !folded.has(row));
  const cache = new Map();
  return {
    states: contexts.map(({ state }) => state),
    declarations: declarations.map((row) => {
      if (row.value === undefined || !/var\(/i.test(row.value)) return row;
      if (!cache.has(row.value)) {
        const variants = contexts.map(({ values }) => substitute(row.value, values));
        cache.set(row.value, variants.every((value) => value === variants[0]) ? variants[0] : variants);
      }
      return { ...row, value: cache.get(row.value) };
    }),
  };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? ".")).href) {
  const [mode, directory = "."] = process.argv.slice(2);
  if (!["--flat", "--resolved"].includes(mode)) throw new Error("Usage: css-resolve.mjs --flat|--resolved [root]");
  const root = resolve(directory);
  const rows = flattenStyles(root);
  const output = mode === "--flat" ? rows : resolvedStyles(rows, runtimeNames(root));
  process.stdout.write(JSON.stringify(output) + "\n");
}
