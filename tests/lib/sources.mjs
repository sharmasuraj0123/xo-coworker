// @ts-check

// The app's own source files wherever a move puts them (js/, css/, core/, shell/, modules/, apps-host/), never vendor or tests.
import { readdirSync, readFileSync, existsSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const DIRS = ["js", "css", "core", "shell", "modules", "apps-host"];

/** @param {string} ext @returns {string[]} */
export function sourcePaths(ext) {
  const out = [];
  for (const d of DIRS) {
    if (!existsSync(new URL(`${d}/`, ROOT))) continue;
    for (const f of readdirSync(new URL(`${d}/`, ROOT), { recursive: true })) {
      const p = `${d}/${String(f)}`;
      if (p.endsWith(ext) && !/(^|\/)(vendor|tests|node_modules)\//.test(p)) out.push(p);
    }
  }
  return out.sort();
}
/** @param {string} p */
export const readSource = (p) => readFileSync(new URL(p, ROOT), "utf8");
/** @param {string} ext */
export const sourceText = (ext) => sourcePaths(ext).map(readSource).join("\n");
/** Every stylesheet named relative to css/ ("app.css", "../modules/settings/shape.css"), for tests that read css/${name}. */
export const cssNames = () => sourcePaths(".css").map((p) => (p.startsWith("css/") ? p.slice(4) : `../${p}`));
