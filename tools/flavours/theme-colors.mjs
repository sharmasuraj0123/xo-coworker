// @ts-check

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { flattenStyles } from "../conformance/css-flatten.mjs";
import { substitute } from "../conformance/css-resolve.mjs";
import { rootTokenModel } from "../conformance/css-root-tokens.mjs";
import { STONE } from "../../core/ui/flavours.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const destination = new URL("../../core/ui/flavours.js", import.meta.url);
const begin = "// Generated canvas colours begin.\n";
const end = "// Generated canvas colours end.\n";

export function canvasPalette() {
  const rows = flattenStyles(root);
  const { contexts, folded } = rootTokenModel(rows, new Set());
  if (rows.some((row) => row.property === "--canvas" && !folded.has(row))) {
    throw new Error("Canvas colours must be resolvable on the document root");
  }
  /** @type {Map<string, Record<string, string>>} */
  const palette = new Map();
  for (const { state: { theme, flavour }, values } of contexts) {
    const id = flavour ?? STONE.id;
    const color = substitute("var(--canvas)", values).trim();
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`Invalid canvas colour for ${id} in ${theme}: ${color}`);
    const pair = palette.get(id) ?? {};
    if (pair[theme] && pair[theme] !== color) throw new Error(`Canvas colour varies within ${id} in ${theme}`);
    pair[theme] = color;
    palette.set(id, pair);
  }
  return palette;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const palette = canvasPalette();
  const format = ({ dark, light }) => `{ dark: ${JSON.stringify(dark)}, light: ${JSON.stringify(light)} }`;
  const entries = [...palette].map(([id, pair]) =>
    `  [${JSON.stringify(id)}, ${id === STONE.id ? "STONE_CANVAS" : format(pair)}],`);
  const source = readFileSync(destination, "utf8");
  const first = source.indexOf(begin);
  const last = source.indexOf(end);
  if (first < 0 || last <= first || first !== source.lastIndexOf(begin) || last !== source.lastIndexOf(end)) {
    throw new Error("Expected one bounded generated canvas section");
  }
  const generated = [
    `const STONE_CANVAS = ${format(palette.get(STONE.id))};`,
    "const CANVAS_COLORS = new Map([",
    ...entries,
    "]);",
    "",
  ].join("\n");
  const next = source.slice(0, first + begin.length) + generated + source.slice(last);
  if (source !== next) writeFileSync(destination, next);
}
