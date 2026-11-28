// @ts-check

import { tokenValuesFor } from "./css-snapshot.mjs";

const definitions = tokenValuesFor();
/** @type {Record<string, number>} */
const TOKENS = {};
for (const [property, value] of definitions) {
  const dimension = /^(-?\d+(?:\.\d+)?)px$/.exec(value);
  if (dimension && !(property in TOKENS)) TOKENS[property] = Number(dimension[1]);
}
for (const [property, value] of definitions) {
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  if (alias && !(property in TOKENS) && alias[1] in TOKENS) TOKENS[property] = TOKENS[alias[1]];
}
export const tokens = TOKENS;

export const NEW_SIZES = [
  "--h-touch", "--h-hit", "--tile", "--tile-lg", "--tile-xl", "--rail-w",
  "--grip-w", "--grab-w", "--grab-h", "--h-phonebar", "--float-inset",
];
/** @param {string} css @param {string[]} [names] */
export function resolveTokens(css, names = NEW_SIZES) {
  let out = css.replace(/var\((--[\w-]+)\)/g, (m, k) => (names.includes(k) && k in TOKENS ? `${TOKENS[k]}px` : m));
  for (let i = 0; i < 3; i++) out = out.replace(/calc\(([-\d.px\s()+*/]+)\)/g, (m, e) => { try { const v = Function(`return (${e.replace(/px/g, "")})`)(); return Number.isFinite(v) ? `${+v.toFixed(3)}px` : m; } catch { return m; } });
  return out;
}
