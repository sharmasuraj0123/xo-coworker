// @ts-check

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { applyCoverage, readCoverage, site } from "../coverage.mjs";
import { compare, totals } from "../ratchet.mjs";

const file = "core/ui/demo.js";
const first = { file, rule: "setTimeout", line: 3, note: "" };
const second = { ...first, line: 4 };

/** @param {import("node:test").TestContext} context */
function fixture(context) {
  const root = mkdtempSync(join(tmpdir(), "conformance-migration-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, file);
  const source = "\n\nsetTimeout(run);\n";
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  const sha256 = createHash("sha256").update(source).digest("hex");
  return { root, path, coverage: { [file]: { sha256, sites: [site(first)] } } };
}

test("only the exact site is carried over", (context) => {
  const { root, coverage } = fixture(context);
  assert.deepEqual(applyCoverage(root, [first, second], coverage, coverage, new Set()), {
    remaining: [second], errors: [],
  });
});

test("changing the file or its bytes restores the migrated finding", (context) => {
  const { root, path, coverage } = fixture(context);
  const touched = applyCoverage(root, [first], coverage, coverage, new Set([file]));
  assert.match(touched.errors[0], /editing this file/);
  assert.deepEqual(touched.remaining, [first]);
  writeFileSync(path, "replacement\n");
  const modified = applyCoverage(root, [first], coverage, coverage, new Set());
  assert.match(modified.errors[0], /original source bytes/);
  assert.deepEqual(modified.remaining, [first]);
});

test("migrated records can shrink and cannot grow or survive a removed finding", (context) => {
  const { root, coverage } = fixture(context);
  const more = { [file]: { ...coverage[file], sites: [site(first), site(second)] } };
  assert.match(applyCoverage(root, [first], more, coverage, new Set()).errors[0], /only be removed/);
  assert.match(applyCoverage(root, [first], coverage, {}, new Set()).errors[0], /only be removed/);
  assert.match(applyCoverage(root, [], coverage, coverage, new Set()).errors[0], /stale migrated finding/);
  assert.deepEqual(applyCoverage(root, [], {}, coverage, new Set([file])), { remaining: [], errors: [] });
});

test("a second site on the same line uses a second record", (context) => {
  const { root, coverage } = fixture(context);
  assert.deepEqual(applyCoverage(root, [first, first], coverage, coverage, new Set()).remaining, [first]);
  const sites = [site(first), site(first)];
  const double = readCoverage(JSON.stringify({ [file]: { ...coverage[file], sites } }));
  assert.deepEqual(applyCoverage(root, [first, first], double, double, new Set()).remaining, []);
});

test("the coverage file rejects malformed sites", (context) => {
  const { coverage } = fixture(context);
  const invalid = JSON.stringify({ [file]: { ...coverage[file], sites: [["setTimeout", 0, ""]] } });
  assert.throws(() => readCoverage(invalid), /Invalid conformance coverage/);
  assert.deepEqual(readCoverage(JSON.stringify(coverage)), coverage);
});

test("ordinary count allowances cannot cover migrated rules after a file edit", () => {
  const observer = { ...first, rule: "observer" };
  const baseline = totals([observer]);
  const prior = { [file]: { sites: [site(observer)] } };
  assert.deepEqual(compare([observer], baseline, new Set()).errors, []);
  assert.match(compare([observer], baseline, new Set([file]), prior).errors[0], /allowed 0 in changed files/);
});
