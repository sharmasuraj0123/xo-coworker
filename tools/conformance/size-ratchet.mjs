// @ts-check

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { conformanceFiles } from "./inventory.mjs";

/** @param {string} root */
export function sizeSignals(root) {
  const signals = [];
  for (const file of conformanceFiles(root)) {
    const source = readFileSync(join(root, file), "utf8");
    const lines = source.split("\n").length - Number(source.endsWith("\n"));
    if (lines > 400) signals.push(`${file} (${lines} lines)`);
  }
  return signals;
}

/** @param {Record<string, Record<string, number>>} actual @param {Record<string, Record<string, number>>} cap */
export function sizeRatchet(actual, cap) {
  const growth = [];
  const stale = [];
  for (const [kind, values] of Object.entries(actual)) {
    const unit = kind === "lines" ? "lines" : "!important";
    for (const [file, count] of Object.entries(values)) {
      const allowed = cap[kind][file] ?? 0;
      if (count <= allowed) continue;
      growth.push(`  ${file}: ${count} ${unit}, allowed ${allowed}`);
    }
    for (const [file, allowed] of Object.entries(cap[kind])) {
      const count = values[file] ?? 0;
      if (count < allowed) stale.push(`  ${file}: stale ${unit} allowance ${allowed}; current count ${count}`);
    }
  }
  return { growth, stale };
}
