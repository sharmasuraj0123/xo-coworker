// @ts-check

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { runGit } from "../../git-environment.mjs";

const project = new URL("../../../", import.meta.url);

/** @param {string} scratch @param {string} [directory] */
function snapshot(scratch, directory = "") {
  const fixtureDir = join(scratch, "fixtures", directory);
  return readdirSync(fixtureDir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? snapshot(scratch, path) : [[path, readFileSync(join(fixtureDir, entry.name))]];
  });
}

test("Git fixture suites leave a repository named by the environment byte-identical", (context) => {
  const scratch = mkdtempSync(join(tmpdir(), "xo-outer-git-"));
  const outer = join(scratch, "fixtures");
  mkdirSync(outer);
  context.after(() => rmSync(scratch, { recursive: true, force: true }));
  const git = (...args) => {
    const result = runGit(args, { cwd: outer, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  git("init", "-q", "-b", "outer");
  writeFileSync(join(outer, "original.js"), "function outer() {}\n");
  git("add", "original.js");
  git("-c", "user.name=Outer", "-c", "user.email=outer@example.invalid", "commit", "-qm", "outer");
  writeFileSync(join(outer, "untracked"), "preserve the outer working tree\n");
  const before = snapshot(scratch);
  const metadata = join(outer, ".git");
  const env = {
    ...process.env, HOME: outer, XDG_CONFIG_HOME: outer, GIT_DIR: metadata, GIT_WORK_TREE: outer,
    GIT_INDEX_FILE: join(metadata, "index"), GIT_CONFIG_GLOBAL: join(outer, "global-config"),
  };
  const suites = [
    [process.execPath, "tools/conformance/tests/ratchet.test.mjs"],
    ["python3", "tests/ledger-evidence.test.py"],
  ];
  const results = suites.map(([command, file]) =>
    spawnSync(command, [file], { cwd: fileURLToPath(project), encoding: "utf8", env }));
  const after = snapshot(scratch);
  const baseline = new Map(before);
  const changes = after.filter(([path, bytes]) => !baseline.get(path)?.equals(bytes)).map(([path]) => path);
  const retained = new Set(after.map(([path]) => path));
  changes.push(...before.filter(([path]) => !retained.has(path)).map(([path]) => path));
  assert.deepEqual(changes, [], "Inherited Git routing modified the outer repository");
  for (const result of results) assert.equal(result.status, 0, result.error?.message ?? result.stdout + result.stderr);
});
