// @ts-check
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runGit } from "../../git-environment.mjs";
import { javascript } from "../syntax.mjs";
import { importEffects, wiringGrowth } from "../app-wiring.mjs";
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

test("boot accepts imported modules and rejects hidden assembly with no object keys", () => {
  const imports = 'import { bootShell as boot } from "../shell/boot.js"; import { feature } from "./feature.js";';
  const base = imports + "await boot([feature]);";
  const expected = ["js/app.js: boot must receive a static list of imported modules"];
  assert.deepEqual(wiringGrowth(base, imports + "\nawait boot([feature]);"), []);
  assert.deepEqual(wiringGrowth(base, imports + "await boot([feature()]);"), expected);
  assert.deepEqual(wiringGrowth(base, imports + "feature.wire(); await boot([feature]);"), expected);
  assert.deepEqual(wiringGrowth(base, imports + 'import "./wire.js"; await boot([feature]);'), expected);
  assert.deepEqual(wiringGrowth(base, "assemble();"), expected);
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

test("importing features leaves boot and subscriptions to activation", () => {
  const effects = (source, file = "modules/demo/module.js") => {
    const lines = [];
    importEffects(file, javascript(source, file).tree, (_, line) => lines.push(line));
    return lines;
  };
  assert.deepEqual(effects('import { createKernel as kernel } from "./kernel.js";\nconst app = kernel();'), [2]);
  assert.deepEqual(effects('if (document) document.addEventListener("click", handler);'), [1]);
  assert.deepEqual(effects('export const module = { activate(ctx) { ctx.listen(document, "click", handler); } };'), []);
  assert.deepEqual(effects('home.append(skeleton);', "shell/frame.js"), []);
});
