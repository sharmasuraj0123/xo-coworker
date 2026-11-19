// The stylesheets' size, space and type tokens read as the px they are (css/tokens.css, comfortable density), and the
// simple calc()s made of them worked out, so a test that checks a size checks the size, whether a rule writes it as a
// number or names its token (the owner, 19 Nov: every size from the tokens).
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../css/tokens.css", import.meta.url), "utf8");
const TOKENS = {};
for (const m of src.matchAll(/(--[\w-]+):\s*(-?\d+(?:\.\d+)?)px\s*[;}]/g)) if (!(m[1] in TOKENS)) TOKENS[m[1]] = +m[2];
for (const m of src.matchAll(/(--[\w-]+):\s*var\((--[\w-]+)\)\s*[;}]/g)) if (!(m[1] in TOKENS) && m[2] in TOKENS) TOKENS[m[1]] = TOKENS[m[2]];
export const tokens = TOKENS;

// the sizes that had no token before 19 Nov and took one then: a check written against their px reads them as px; a
// check of the older tokens (--h-sm, --h-ctl, --h-lg …) keeps reading their names, as it was written to
export const NEW_SIZES = ["--h-touch", "--h-hit", "--tile", "--tile-lg", "--tile-xl", "--rail-w", "--grip-w", "--grab-w", "--grab-h", "--h-phonebar", "--float-inset"];
/** css with each named token (by default the new sizes) written as its px, and calc()s of px numbers worked out. */
export function resolveTokens(css, names = NEW_SIZES) {
  let out = css.replace(/var\((--[\w-]+)\)/g, (m, k) => (names.includes(k) && k in TOKENS ? `${TOKENS[k]}px` : m));
  for (let i = 0; i < 3; i++) out = out.replace(/calc\(([-\d.px\s()+*/]+)\)/g, (m, e) => { try { const v = Function(`return (${e.replace(/px/g, "")})`)(); return Number.isFinite(v) ? `${+v.toFixed(3)}px` : m; } catch { return m; } });
  return out;
}
