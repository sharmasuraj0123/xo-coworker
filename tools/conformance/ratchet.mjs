// @ts-check

import { runGit } from "../git-environment.mjs";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { family, inventory } from "./inventory.mjs";
import { applyCoverage, readCoverage } from "./coverage.mjs";
import { wiringGrowth } from "./app-wiring.mjs";

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

/** @param {ReturnType<typeof inventory>} findings @param {object} baselines @param {Set<string>} touched @param {object} [prior] */
export function compare(findings, baselines, touched, prior = {}) {
  const current = totals(findings);
  const seen = new Set();
  const errors = [];
  for (const finding of findings) {
    const { file, rule, line, note } = finding;
    const name = family(finding);
    const total = current[name][file][rule];
    const changed = touched.has(file) || (rule === "sourceReadTarget" && touched.has(note));
    const zero = changed && (CLEAR_ON_TOUCH.has(rule) || prior[file]?.sites.some(([kind]) => kind === rule));
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

/** @param {string} root @param {string} baselineDir @param {{git: Function, ref: string} | null} repository */
function loadCoverage(root, baselineDir, repository) {
  const path = join(baselineDir, "coverage.json");
  const local = relative(root, path).split(sep).join("/");
  const previous = repository?.git(["show", `${repository.ref}:${local}`]);
  const prior = previous?.status === 0 ? readCoverage(previous.stdout) : null;
  if (prior && !existsSync(path)) throw new Error("Keep the conformance coverage record, even when empty");
  return { coverage: existsSync(path) ? readCoverage(readFileSync(path, "utf8")) : {}, prior };
}

/** @param {string} root @param {string} baselineDir @param {{update: boolean, base?: string}} options */
export function checkConformance(root, baselineDir, { update, base }) {
  const repository = checkout(root, base);
  const baselines = {};
  const growth = [];
  let recordedStyle = {};
  for (const name of FAMILIES) {
    const path = join(baselineDir, `${name}.json`);
    const local = relative(root, path).split(sep).join("/");
    const current = readBaseline(local, readFileSync(path, "utf8"));
    if (name === "style") {
      recordedStyle = current.$recorded ?? {};
      delete current.$recorded;
    }
    baselines[name] = current;
    if (!repository) continue;
    const { git, ref } = repository;
    const entry = git(["ls-tree", ref, "--", local]);
    if (entry.status !== 0) throw new Error(entry.error?.message ?? entry.stderr);
    if (!entry.stdout) continue;
    const existing = git(["show", `${ref}:${local}`]);
    if (existing.status !== 0) throw new Error(existing.error?.message ?? existing.stderr);
    const previous = readBaseline(local, existing.stdout);
    if (name === "style" && previous.$recorded) {
      const offGrid = record => Object.fromEntries(Object.entries(record).filter(([key]) => key.includes(" / offGridToken / ")));
      growth.push(...allowanceSurplus({ shared: offGrid(recordedStyle) }, { shared: offGrid(previous.$recorded) },
        (file, key) => `  New off-grid token debt: ${key}`));
    }
    growth.push(...allowanceSurplus(current, previous,
      (file, rule, old, count) => `  ${local}: ${file} raised the ${rule} allowance from ${old} to ${count}`));
  }
  if (growth.length) return growth.join("\n");
  const namesPath = "tools/baselines/token-ownership.json";
  const priorNames = repository?.git(["show", `${repository.ref}:${namesPath}`]);
  if (priorNames?.status === 0) {
    const allowed = new Set(JSON.parse(priorNames.stdout));
    const current = readFileSync(join(root, namesPath), "utf8");
    const additions = JSON.parse(current).filter(name => !allowed.has(name));
    if (additions.length) return "Token ownership allowances can only shrink: " + additions.join(", ");
  }
  const touched = changes(repository);
  const app = "js/app.js";
  if (repository && touched.has(app) && existsSync(join(root, app))) {
    const priorApp = repository.git(["ls-tree", repository.ref, "--", app]);
    if (priorApp.status !== 0) throw new Error(priorApp.error?.message ?? priorApp.stderr);
    const original = priorApp.stdout ? repository.git(["show", `${repository.ref}:${app}`]) : { status: 0, stdout: "" };
    if (original.status !== 0) throw new Error(original.error?.message ?? original.stderr);
    const wiring = wiringGrowth(original.stdout, readFileSync(join(root, app), "utf8"));
    if (wiring.length) return wiring.join("\n");
  }
  const { coverage, prior } = loadCoverage(root, baselineDir, repository);
  const observed = {};
  const migrated = applyCoverage(root, inventory(root, undefined, observed), coverage, prior, touched);
  const { current, errors } = compare(migrated.remaining, baselines, touched, prior ?? {});
  if (migrated.errors.length) return [...migrated.errors, ...errors].join("\n");
  if (errors.length) return errors.join("\n");
  if (!update) {
    if (formatBaseline({ recordedStyle }) !== formatBaseline({ recordedStyle: observed })) {
      return "Refresh the recorded CSS debt with --update-baselines.";
    }
    const stale = FAMILIES.flatMap(name => allowanceSurplus(baselines[name], current[name],
      (file, rule, count, allowed) => `  ${file}: ${rule} has ${count}, baseline allows ${allowed}`));
    if (stale.length) return `Stale conformance baseline. Run node tools/check.mjs --fast --update-baselines.\n${stale.join("\n")}`;
  }
  if (update) {
    for (const name of FAMILIES) {
      const path = join(baselineDir, `${name}.json`);
      const snapshot = name === "style" && Object.keys(observed).length ? { ...current[name], $recorded: observed } : current[name];
      const updated = formatBaseline(snapshot);
      if (updated !== readFileSync(path, "utf8")) writeFileSync(path, updated);
    }
  }
  return null;
}
