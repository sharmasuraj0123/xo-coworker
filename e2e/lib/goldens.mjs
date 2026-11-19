// @ts-check

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Every golden under `dir`. @param {string} dir @returns {string[]} */
export function goldens(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? goldens(join(dir, d.name)) : d.name.endsWith(".aria.yml") ? [join(dir, d.name)] : []);
}

/** Goldens no case used, judged only after a whole run in which every case passed; else none. @param {{filter: string, total: number, passed: number, used: Set<string>, all: string[]}} o */
export function unused({ filter, total, passed, used, all }) {
  if (filter || total === 0 || passed !== total) return [];
  return all.filter((f) => !used.has(f));
}
