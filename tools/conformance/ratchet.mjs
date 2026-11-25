// @ts-check

import { runGit } from "../git-environment.mjs";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { family, inventory } from "./inventory.mjs";

export const FAMILIES = ["lifecycle", "hygiene", "structure", "style"];
const CLEAR_ON_TOUCH = new Set([
  "commentOnlyCatch", "commentReference", "changelogComment", "explicitAny",
  "sourceRead", "sourceReadTarget", "inlineViewportQuery", "viewportLiteral", "domExpando", "missingTsCheck",
  "typeSuppression",
  "globalListener", "storage", "setTimeout", "setInterval", "requestAnimationFrame",
]);

/** @param {ReturnType<typeof inventory>} findings */
export function totals(findings) {
  const counts = Object.fromEntries(FAMILIES.map((name) => [name, {}]));
  for (const finding of findings) {
    const { file, rule } = finding;
    const rules = (counts[family(finding)][file] ??= {});
    rules[rule] = (rules[rule] ?? 0) + 1;
  }
  return counts;
}

/** @param {object} counts */
export function formatBaseline(counts) {
  const sorted = (record) => Object.entries(record).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const entries = sorted(counts).map(([file, rules]) => [file, Object.fromEntries(sorted(rules))]);
  return JSON.stringify(Object.fromEntries(entries), null, 1) + "\n";
}

/** @param {ReturnType<typeof inventory>} findings @param {object} baselines @param {Set<string>} touched */
export function compare(findings, baselines, touched) {
  const current = totals(findings);
  const seen = new Set();
  const errors = [];
  for (const finding of findings) {
    const { file, rule, line, note } = finding;
    const name = family(finding);
    const total = current[name][file][rule];
    const zero = CLEAR_ON_TOUCH.has(rule) && (touched.has(file) || (rule === "sourceReadTarget" && touched.has(note)));
    const allowed = zero ? 0 : baselines[name][file]?.[rule] ?? 0;
    const key = JSON.stringify([file, rule, zero ? note : ""]);
    if (total <= allowed || seen.has(key)) continue;
    seen.add(key);
    const location = rule === "sourceReadTarget" ? `${note}:${line} → ${file}` : `${file}:${line}`;
    const detail = rule === "unusedExport" ? ` (${note})` : "";
    errors.push(`  ${location}: ${rule}${detail} has ${total}, allowed ${allowed}${zero ? " in changed files" : ""}`);
  }
  return { errors, current };
}

/** @param {string} root @param {string[]} args */
function gitAt(root, args) {
  return runGit(args, { cwd: root, encoding: "utf8" });
}

/** @param {string} root @param {string | undefined} base */
function checkout(root, base) {
  const git = (args) => gitAt(root, args);
  const worktree = git(["rev-parse", "--show-toplevel"]);
  if (worktree.status !== 0 || realpathSync(worktree.stdout.trim()) !== realpathSync(root)) {
    if (base) throw new Error("--conformance-base needs a Git checkout");
    return null;
  }
  const commit = git(["rev-parse", "--verify", "--end-of-options", `${base ?? "HEAD"}^{commit}`]);
  if (commit.status !== 0) throw new Error(`Unknown conformance base: ${base ?? "HEAD"}`);
  return { git, ref: commit.stdout.trim() };
}

/** @param {{git: Function, ref: string} | null} repository */
function changes(repository) {
  if (!repository) return new Set();
  const { git, ref } = repository;
  const diff = ["diff", "--name-only", "--no-renames", "-z"];
  const results = [
    git([...diff, ref, "--"]),
    git([...diff, "--cached", ref, "--"]),
    git(["ls-files", "--others", "--exclude-standard", "-z"]),
  ];
  const files = new Set();
  for (const result of results) {
    if (result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
    for (const file of result.stdout.split("\0").filter(Boolean)) files.add(file);
  }
  return files;
}

/** @param {string} root @param {string} [base] */
export function changedFiles(root, base) {
  return changes(checkout(root, base));
}

/** @param {string} path @param {string} source */
function readBaseline(path, source) {
  const value = JSON.parse(source);
  const record = (item) => item && typeof item === "object" && !Array.isArray(item);
  if (!record(value) || !Object.values(value).every((rules) =>
    record(rules) && Object.values(rules).every((count) => Number.isSafeInteger(count) && count >= 0))) {
    throw new Error(`Invalid conformance baseline: ${path}`);
  }
  return value;
}

/** @param {object} current @param {object} previous @param {(file: string, rule: string, old: number, count: number) => string} message */
function allowanceSurplus(current, previous, message) {
  const errors = [];
  for (const [file, rules] of Object.entries(current)) {
    for (const [rule, count] of Object.entries(rules)) {
      const old = previous[file]?.[rule] ?? 0;
      if (count > old) errors.push(message(file, rule, old, count));
    }
  }
  return errors;
}

/** @param {string} root @param {string} baselineDir @param {{update: boolean, base?: string}} options */
export function checkConformance(root, baselineDir, { update, base }) {
  const repository = checkout(root, base);
  const baselines = {};
  const growth = [];
  for (const name of FAMILIES) {
    const path = join(baselineDir, `${name}.json`);
    const local = relative(root, path).split(sep).join("/");
    const current = readBaseline(local, readFileSync(path, "utf8"));
    baselines[name] = current;
    if (!repository) continue;
    const { git, ref } = repository;
    const entry = git(["ls-tree", ref, "--", local]);
    if (entry.status !== 0) throw new Error(entry.error?.message ?? entry.stderr);
    if (!entry.stdout) continue;
    const existing = git(["show", `${ref}:${local}`]);
    if (existing.status !== 0) throw new Error(existing.error?.message ?? existing.stderr);
    growth.push(...allowanceSurplus(current, readBaseline(local, existing.stdout),
      (file, rule, old, count) => `  ${local}: ${file} raised the ${rule} allowance from ${old} to ${count}`));
  }
  if (growth.length) return growth.join("\n");
  const { current, errors } = compare(inventory(root), baselines, changes(repository));
  if (errors.length) return errors.join("\n");
  if (!update) {
    const stale = FAMILIES.flatMap(name => allowanceSurplus(baselines[name], current[name],
      (file, rule, count, allowed) => `  ${file}: ${rule} has ${count}, baseline allows ${allowed}`));
    if (stale.length) return `Stale conformance baseline. Run node tools/check.mjs --fast --update-baselines.\n${stale.join("\n")}`;
  }
  if (update) {
    for (const name of FAMILIES) {
      const path = join(baselineDir, `${name}.json`);
      const updated = formatBaseline(current[name]);
      if (updated !== formatBaseline(baselines[name])) writeFileSync(path, updated);
    }
  }
  return null;
}
