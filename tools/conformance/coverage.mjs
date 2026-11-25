// @ts-check

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** @param {Buffer} source */
const digest = source => createHash("sha256").update(source).digest("hex");

/** @param {{ rule: string, line: number, note: string }} finding */
export const site = ({ rule, line, note }) => [rule, line, note];

/** @param {unknown} value */
function validSite(value) {
  return Array.isArray(value) && value.length === 3 && typeof value[0] === "string"
    && Number.isSafeInteger(value[1]) && value[1] > 0 && typeof value[2] === "string";
}

/** @param {object} record */
function sitesOf(record) {
  const counts = new Map();
  for (const value of record?.sites ?? []) {
    const key = JSON.stringify(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** @param {string} source */
export function readCoverage(source) {
  const coverage = JSON.parse(source);
  if (!coverage || typeof coverage !== "object" || Array.isArray(coverage)) throw new Error("Invalid conformance coverage");
  for (const [file, record] of Object.entries(coverage)) {
    if (!/^[\w.-]+(?:\/[\w.-]+)+$/.test(file) || file.split("/").some(part => part === "." || part === "..")
        || !/^[\da-f]{64}$/.test(record?.sha256) || !Array.isArray(record.sites) || !record.sites.length
        || record.sites.some(value => !validSite(value))) {
      throw new Error(`Invalid conformance coverage record: ${file}`);
    }
  }
  return coverage;
}

/** @param {string} root @param {object[]} findings @param {object} coverage @param {object | null} previous @param {Set<string>} touched */
export function applyCoverage(root, findings, coverage, previous, touched) {
  const remaining = [];
  const unmatched = new Map();
  const errors = [];
  for (const [file, record] of Object.entries(coverage)) {
    const prior = previous?.[file];
    const sites = sitesOf(record);
    const old = sitesOf(prior);
    if (previous && (prior?.sha256 !== record.sha256 || [...sites].some(([key, count]) => count > (old.get(key) ?? 0)))) {
      errors.push(`  ${file}: migrated findings can only be removed`);
      continue;
    }
    if (touched.has(file)) {
      errors.push(`  ${file}: clear migrated findings when editing this file`);
      continue;
    }
    const path = join(root, file);
    if (!existsSync(path) || digest(readFileSync(path)) !== record.sha256) {
      errors.push(`  ${file}: migrated findings require the original source bytes`);
      continue;
    }
    unmatched.set(file, sites);
  }
  for (const finding of findings) {
    const sites = unmatched.get(finding.file);
    const key = JSON.stringify(site(finding));
    const count = sites?.get(key) ?? 0;
    if (!count) remaining.push(finding);
    else if (count === 1) sites.delete(key);
    else sites.set(key, count - 1);
  }
  for (const [file, sites] of unmatched) {
    const count = [...sites.values()].reduce((total, value) => total + value, 0);
    if (count) errors.push(`  ${file}: remove ${count} stale migrated finding(s)`);
  }
  return { remaining, errors };
}
