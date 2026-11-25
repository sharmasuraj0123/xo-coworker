// @ts-check
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runGit } from "../../git-environment.mjs";
import { wiringGrowth } from "../app-wiring.mjs";
import { checkConformance, FAMILIES } from "../ratchet.mjs";

test("root wiring counts assigned bags, member calls, nested literals and spreads", () => {
  const initial = "mount({ view });";
  const expanded = "const wiring = { view, ...ports }; shell.mount(wiring, { input: { read } });";
  assert.deepEqual(wiringGrowth(initial, expanded), ["js/app.js: dependency keys increased from 1 to 4"]);
  assert.deepEqual(wiringGrowth(expanded, initial), []);
});

test("forward references resolve lexical bindings even inside deferred callbacks", () => {
  const ready = "const view = read(); mount(() => view());";
  const later = "mount(() => view()); const view = read();";
  assert.deepEqual(wiringGrowth(ready, later), ["js/app.js: forward references increased from 0 to 1"]);
  assert.deepEqual(wiringGrowth(ready, "mount(view => view()); const view = read();"), []);
  assert.deepEqual(wiringGrowth(ready, ready + "\n".repeat(500)), []);
});

test("package conformance rejects a committed increase against its original base", (context) => {
  const root = mkdtempSync(join(tmpdir(), "xo-package-wiring-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const git = (...args) => {
    const result = runGit(args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  mkdirSync(join(root, "js"));
  const baselines = join(root, "baselines");
  mkdirSync(baselines);
  for (const family of FAMILIES) writeFileSync(join(baselines, family + ".json"), "{}\n");
  const app = join(root, "js/app.js");
  const write = (source) => writeFileSync(app, "// @ts-check\n" + source);
  const commit = () => {
    git("add", ".");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture");
  };
  git("init", "-q");
  write("const view = read(); mount(() => view());");
  commit();
  const base = git("rev-parse", "HEAD");
  write("shell.mount({ view: () => view() }); const view = read();");
  commit();
  assert.equal(checkConformance(root, baselines, { base, update: true }),
    "js/app.js: dependency keys increased from 0 to 1\njs/app.js: forward references increased from 0 to 1");
});
