// @ts-check

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { runGit } from "../../git-environment.mjs";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { inventory } from "../inventory.mjs";
import { sizeSignals } from "../size-ratchet.mjs";
import { changedFiles, checkConformance, compare, formatBaseline, totals } from "../ratchet.mjs";

const HEADER = "// @ts-check\n\n";
const FILE = "modules/sample/page.js";
const EMPTY = totals([]);

/** @param {string} root @param {string} file @param {string} source */
function write(root, file, source) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), source);
}

/** @param {import("node:test").TestContext} context @param {Record<string, string>} files */
function fixture(context, files) {
  const root = mkdtempSync(join(tmpdir(), "conformance-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, source] of Object.entries(files)) write(root, file, source);
  return root;
}

const kind = (findings) => findings.map(({ rule }) => rule).sort();

test("size review includes server, tools and tests without blocking cohesive files", (context) => {
  const root = fixture(context, {
    "serve.py": "pass\n".repeat(401),
    "tools/report.mjs": "\n".repeat(403),
    "tests/view.mjs": "\n".repeat(402),
    "tests/small.mjs": "\n".repeat(400),
  });
  assert.deepEqual(sizeSignals(root), ["serve.py (401 lines)", "tests/view.mjs (402 lines)", "tools/report.mjs (403 lines)"]);
  assert.deepEqual(compare(inventory(root), EMPTY, new Set()).errors, []);
});

const jsCases = [
  ["unstyledDialog", 'document.createElement("dialog");'],
  ["unstyledDialog", 'const markup = `<dialog class="custom"></dialog>`;'],
  ["bareAriaState", 'control.toggleAttribute("aria-busy", working);'],
  ["observer", "new ResizeObserver(callback);"],
  ["globalListener", 'window.document["addEventListener"]("click", callback);'],
  ["globalListener", 'addEventListener("click", callback);', "core/ui/example.js"],
  ["setTimeout", "window.setTimeout(callback, delay);", "core/services/example.js"],
  ["setTimeout", "globalThis.setTimeout(callback, delay);"],
  ["setInterval", "setInterval(callback, delay);"],
  ["requestAnimationFrame", "requestAnimationFrame(callback);"],
  ["storage", 'globalThis["localStorage"].getItem(key);'],
  ["commentOnlyCatch", "try { run(); } catch { /* skipped */ }"],
  ["commentOnlyCatch", "function run() { try { read(); } catch { return; } }"],
  ["commentOnlyCatch", "function read() { try { return load(); } catch { return fallback; } }"],
  ["commentOnlyCatch", "operation().catch(() => {});"],
  ["commentOnlyCatch", "operation().catch(() => null);"],
  ["explicitAny", "/** @type {{ x: Array<any>, any: string }} */\nconst shape = value;"],
  ["domExpando", 'const card = document.createElement("div");\ncard["cache"] = 1;'],
  ["inlineViewportQuery", "window.matchMedia(`(max-width: 760px)`);"],
  ["viewportLiteral", "const small = 760 >= window.innerWidth;"],
  ["dayLiteral", "const day = 86_400_000;"],
  ["sharedStateParameter", "const render = ({ state: S }) => S;"],
  ["functionLines", "const mount = () => {\n" + "draw();\n".repeat(149) + "};"],
  ["lineLength", "const value = '" + "a".repeat(130) + "';"],
  ["commentReference", "// See PLAN.md."],
  ["changelogComment", "// Astra C058 on 517af1c"],
  ["changelogComment", "// Catalog refresh F25"],
  ["changelogComment", "// Component fix C115"],
  ["changelogComment", "// Style check S083"],
  ["changelogComment", "// Harness item H012"],
  ["changelogComment", "// xo-space 3886701 field"],
  ["commentLines", "// A\n// B"],
  ["typeSuppression", "// @ts-ignore\ndraw();"],
  ["dependencyKey", "createExample({ render });", "js/app.js"],
  ["missingTsCheck", "draw();", FILE, ""],
];

for (const [rule, source, file = FILE, header = HEADER] of jsCases) {
  test(`${rule} counts one syntax violation and rejects the addition`, (context) => {
    const root = fixture(context, { [file]: header + source });
    const findings = inventory(root);
    assert.deepEqual(kind(findings), [rule]);
    assert.equal(compare(findings, EMPTY, new Set()).errors.length, 1);
  });
}

test("scoped resources, local bindings and reported failures stay clear", (context) => {
  const source = [
    'import { setInterval } from "./clock.js";',
    'function mount({ addEventListener, setTimeout }, window, localStorage) {',
    '  addEventListener("click", callback); setInterval(callback); setTimeout(callback);',
    '  window.setTimeout(callback, 2); localStorage.getItem("model");',
    '}',
    '{ const ResizeObserver = Mock; new ResizeObserver(callback); }',
    'function make() { requestAnimationFrame(callback); var requestAnimationFrame = run; }',
    'scope.listen(document, "click", callback); scope.frame(callback);',
    'const state = { localStorage: 1 };',
    'function readState() { try { return read(); } catch (error) { report(error); return null; } }',
    'load().catch(error => { throw error; });',
  ].join("\n");
  const root = fixture(context, { "core/ui/example.js": HEADER + source });
  assert.deepEqual(inventory(root), []);
});

const scopeImport = 'import { createScope as scopeFor } from "../kernel/scope.js";\n';
const observerOwners = [
  [scopeImport + "const scope = scopeFor();\nconst observer = new IntersectionObserver(read);\n", "scope.observe(observer);"],
  [scopeImport + "let tracking;\ntracking = scopeFor();\nconst watch = new MutationObserver(read);\n", "tracking.observe(watch);"],
  [scopeImport + "const scope = scopeFor();\nconst watcher = { observer: new IntersectionObserver(read) };\n", "scope.observe(watcher.observer);"],
  [
    '/** @param {ReturnType<typeof import("../kernel/scope.js").createScope>} scope */\nexport function observe(scope) {\n' +
    "const observer = new IntersectionObserver(read);\n",
    "scope.observe(observer);",
  ],
];
for (const [index, [source, register]] of observerOwners.entries()) {
  for (const owned of [false, true]) {
    test(`observer ownership at constructor form ${index + 1}: ${owned}`, (context) => {
      const body = source + (owned ? register : "") + (source.includes("function observe") ? "\n}" : "");
      const root = fixture(context, {
        "core/ui/example.js": HEADER + body,
        "core/kernel/scope.js": HEADER + "export function createScope() {}",
      });
      assert.equal(kind(inventory(root)).filter(rule => rule === "observer").length, owned ? 0 : 1);
    });
  }
}

test("a branch, opaque receiver or different binding does not prove observer ownership", (context) => {
  const root = fixture(context, {
    "core/ui/example.js": HEADER + scopeImport + [
      "const scope = scopeFor();",
      "const conditional = new IntersectionObserver(read);",
      "if (shouldRegister) scope.observe(conditional);",
      "const opaque = new IntersectionObserver(read);",
      "fake.observe(opaque);",
      "const mismatched = new IntersectionObserver(read);",
      "scope.observe(opaque);",
    ].join("\n"),
    "core/kernel/scope.js": HEADER + "export function createScope() {}",
  });
  assert.deepEqual(kind(inventory(root)), ["observer", "observer", "observer"]);
});

test("global listeners require a proven scope signal", (context) => {
  const root = fixture(context, {
    "core/ui/example.js": HEADER + scopeImport + [
      "const scope = scopeFor();",
      'window.addEventListener("click", update, { signal: scope.signal });',
      'window.addEventListener("click", update, { signal: unrelated.signal });',
      'window.addEventListener("click", update, { signal: scope.signal, ...options });',
      'window.addEventListener("click", update);',
    ].join("\n"),
  });
  assert.deepEqual(kind(inventory(root)), ["globalListener", "globalListener", "globalListener"]);
});

test("an owned native timer returns cleanup for the same timer handle", (context) => {
  const root = fixture(context, {
    "core/ui/example.js": HEADER + scopeImport + [
      "const scope = scopeFor();",
      "scope.effect(() => { const id = setTimeout(run); return () => clearTimeout(id); });",
      "scope.effect(() => { const id = setTimeout(run); return () => clearTimeout(other); });",
      "scope.effect(() => { const id = setTimeout(run); return () => {}; });",
      "scope.effect(async () => { const id = setTimeout(run); return () => clearTimeout(id); });",
    ].join("\n"),
  });
  assert.deepEqual(kind(inventory(root)), ["setTimeout", "setTimeout", "setTimeout"]);
});

for (const use of ["scope.effect(start);", "start();", "scope.effect(() => {});"]) {
  test(`observer disposer used by its importer: ${use}`, (context) => {
    const root = fixture(context, {
      "core/ui/observe.js": HEADER + [
        "export function start() {",
        "  const observer = new MutationObserver(read);",
        "  observer.observe(document);",
        "  return () => observer.disconnect();",
        "}",
      ].join("\n"),
      "core/ui/mount.js": HEADER + scopeImport + 'import { start } from "./observe.js";\nconst scope = scopeFor();\n' + use,
    });
    assert.deepEqual(kind(inventory(root)), use === "scope.effect(start);" ? [] : ["observer"]);
  });
}

test("comment checks leave CSS colours and formatted measurements alone", (context) => {
  const root = fixture(context, {
    "core/ui/example.js": HEADER + "// Color #f4e6c297 and 1,440,900 pixels.",
    "core/ui/example.css": "/* Numeric hex #38867010. */",
  });
  assert.deepEqual(inventory(root), []);
});

test("namespace property reads track only names on the imported binding", (context) => {
  const file = "core/ui/public.js";
  const root = fixture(context, {
    [file]: HEADER + ["first", "second", "outer", "shadowed"].map(name => `export const ${name} = 1;`).join("\n"),
    "core/ui/consumer.js": HEADER + [
      'import * as api from "./public.js";',
      'const { second: local } = api; use(local, api["first"]);',
      "function render(api) { return api.shadowed; }",
      'const { outer } = await import("./public.js"); use(outer);',
    ].join("\n"),
  });
  const findings = inventory(root);
  assert.deepEqual(findings.map((finding) => [finding.file, finding.rule, finding.note]), [[file, "unusedExport", "shadowed"]]);
  assert.equal(compare(findings, EMPTY, new Set()).errors.length, 1);
});

test("opaque namespace accesses preserve exports that can be read at runtime", (context) => {
  const root = fixture(context, {
    "core/ui/public.js": HEADER + "export const runtime = 1; export const fallback = 2;",
    "core/ui/consumer.js": HEADER + 'import * as api from "./public.js"; use(api[key]);',
  });
  assert.deepEqual(inventory(root), []);
});

test("only the canonical calendar day constant owns the millisecond literal", (context) => {
  const calendar = "core/platform/calendar.js";
  const definition = "const DAY_MS = 86_400_000;";
  const root = fixture(context, {
    [calendar]: HEADER + definition + "\n{ " + definition + " }",
    ["core/platform/time.js"]: HEADER + definition,
  });
  assert.deepEqual(inventory(root).map(({ file, rule, line }) => [file, rule, line]), [
    [calendar, "dayLiteral", 4],
    ["core/platform/time.js", "dayLiteral", 3],
  ]);
});

const cssCases = [
  ["rawColor", 'a { color: #fff; }'],
  ["rawColor", 'a { color: oklch(0.6 0 0); }'],
  ["rawColor", 'a { border: 1px solid rebeccapurple; }'],
  ["important", "a { color: var(--text) !important; }"],
  ["themeSelector", 'a:is([data-theme="light"], [data-other="light"]) { display: none; }'],
  ["widthMediaQuery", "@media (700px < width) { a { display: none; } }"],
  ["widthMediaQuery", "@media (max-width: 759px) { a { display: none; } }"],
  ["widthMediaQuery", "@media (min-width: 762px) { a { display: none; } }"],
  ["px-spacing", "a { padding-inline: -4px; }"],
  ["px-size", "a { width: calc(100% - 1e1px); }"],
  ["px-radius", "a { border-top-left-radius: 3px; }"],
  ["px-stroke", "a { border: 2px solid var(--edge); }"],
  ["px-typography", "a { font-size: 14px; }"],
  ["px-position", "a { top: .5px; }"],
  ["px-effect", "a { filter: blur(8px); }"],
];

for (const [rule, source] of cssCases) {
  test(`${rule} counts one CSS violation and rejects the addition`, (context) => {
    const root = fixture(context, { "css/test.css": source });
    const findings = inventory(root);
    assert.deepEqual(kind(findings), [rule]);
    assert.equal(compare(findings, EMPTY, new Set()).errors.length, 1);
  });
}

test("parsed comments, CSS values and types ignore source lookalikes", (context) => {
  const root = fixture(context, {
    [FILE]: HEADER + `
      const text = "try {} catch { /* skipped */ }";
      const state = { localStorageKey: 'key' };
      state._cache = 1;
      class Widget { mount() { this._private = 1; } }
      /** @type {{any: string}} */
      const config = { any: "any" };
      try { read(); } catch { fallback(); }
    `,
    "core/platform/types.d.ts": 'type Mode = "any"; interface Config { any: string }',
    "css/test.css": `
      @media (max-width: 760px) { a { margin: 0px 1px; } }
      @media (max-width:760px) { a { display: none; } }
      @media (min-width:761px) and (max-height:820px) { a { display: none; } }
      a { content: "10px red #fff !important"; background: url(/icons/#abc); color: var(--red); }
    `,
    "core/ui/tokens.css": ':root[data-theme="light"] { --text: #fff; --tile: 4px; }',
    "modules/first/card.css": ".card { color: var(--text); width: var(--tile); }",
    "modules/second/row.css": ".row { color: var(--text); gap: var(--tile); }",
  });
  assert.deepEqual(inventory(root), []);
});

test("shared tokens need two owners through direct uses or aliases", (context) => {
  const root = fixture(context, {
    "core/ui/tokens.css": ":root { --base: 7px; --alias: var(--base); --unused: 5px; --owned: 3px; } .card { --bad: var(--base); }",
    "modules/first/card.css": ".card { width: var(--alias); height: var(--owned); }",
    "modules/first/row.css": ".row { width: var(--owned); }",
    "modules/second/tag.css": ".tag { gap: var(--alias); }",
  });
  const findings = inventory(root);
  assert.deepEqual(findings.filter(row => row.rule === "singleOwnerToken").map(row => row.note).sort(),
    ["--bad", "--owned", "--unused"]);
  assert.ok(findings.some(row => row.rule === "componentTokenSelector"));
});

test("component geometry allowances match the exact declaration", (context) => {
  const file = "modules/map/arrow.css";
  const rule = value => JSON.stringify([file, ":root", "--tip", value]);
  const root = fixture(context, {
    [file]: ":root { --tip: .8; }",
    "tools/baselines/token-ownership.json": JSON.stringify([rule(".9")]),
  });
  assert.deepEqual(kind(inventory(root)), ["localTokenLiteral", "staleTokenAllowance"]);
  write(root, file, ":root { --tip: .9; }");
  assert.deepEqual(inventory(root), []);
});

test("DOM property detection follows the lexical binding and counts reflective writes", (context) => {
  const root = fixture(context, { [FILE]: HEADER + `
    const node = document.querySelector("div");
    function model(node) { node.cache = 1; }
    Object.assign(node, { cache: 1, title: "allowed" });
    Object.defineProperty(node, "memo", {});
    node.textContent = "allowed";
  ` });
  assert.deepEqual(kind(inventory(root)), ["domExpando", "domExpando"]);
});

test("declaration syntax catches an explicit escape hatch", (context) => {
  const root = fixture(context, { "core/platform/types.d.ts": "type Unsafe = Record<string, any>;" });
  const findings = inventory(root);
  assert.deepEqual(kind(findings), ["explicitAny"]);
  assert.equal(compare(findings, EMPTY, new Set()).errors.length, 1);
});

test("comment checks cover app manifests, build tools and shell entry points", (context) => {
  const root = fixture(context, {
    "apps-host/manifest.js": HEADER + 'const pattern = "**/*.hello";\n// first\n// second\n',
    "core/services/shape/model.js": HEADER + 'const preset = "presets/*.json";',
    "tools/diffview/theme.mjs": "/* first\nsecond */",
    "start.sh": "#!/bin/sh\n# first\n# second\ncat <<'TEXT'\n# literal\n# still literal\nTEXT\n",
  });
  assert.deepEqual(inventory(root).filter(row => row.rule === "commentLines").map(row => row.file),
    ["apps-host/manifest.js", "start.sh", "tools/diffview/theme.mjs"]);
});

test("Python uses real comments and docstrings", (context) => {
  const source = '"""Real docstring.\nSecond line."""\n' + "pass\n".repeat(397)
    + 'text = "# Astra C058"\n# QA #123\n';
  const root = fixture(context, {
    "serve.py": source,
    "serve/proxy.py": "pass\n".repeat(401),
  });
  const findings = inventory(root);
  assert.deepEqual(kind(findings), ["changelogComment", "commentLines"]);
  assert.equal(compare(findings, EMPTY, new Set()).errors.length, 2);
});

test("a source read identifies the test and the production path, leaving data fixtures alone", (context) => {
  const root = fixture(context, {
    [FILE]: HEADER + "export const mount = () => {};",
    "js/app.js": HEADER + 'import { mount } from "../modules/sample/page.js";\nmount();',
    "tests/view.test.mjs": HEADER + `
      import { readFileSync as read } from 'node:fs';
      const root = new URL('../', import.meta.url);
      read(new URL('modules/sample/page.js', root), 'utf8');
      read(new URL('tests/fixtures/seed.js', root), 'utf8');
    `,
  });
  const findings = inventory(root);
  assert.deepEqual(kind(findings), ["sourceRead", "sourceReadTarget"]);
  const allowed = totals(findings);
  assert.deepEqual(compare(findings, allowed, new Set()).errors, []);
  assert.match(compare(findings, allowed, new Set([FILE])).errors[0], /view.test.mjs:6 → modules\/sample\/page.js/);
  assert.equal(compare(findings, EMPTY, new Set()).errors.length, 2);
});

test("a map over a literal list reports only the files that can be read", (context) => {
  const files = ["decoration", "message-reply", "notice-line", "working-turn"];
  const wanted = files.filter((name) => name !== "notice-line");
  const scripts = Object.fromEntries(files.map((name) => [`modules/conversation/${name}.js`, HEADER]));
  const target = (findings, testPath) => findings.filter((entry) => entry.rule === "sourceReadTarget" && entry.note === testPath)
    .map((entry) => entry.file).sort();
  const reader = 'import { readFileSync } from "node:fs";\n';
  const map = 'map((name) => readFileSync(new URL(`../modules/conversation/${name}.js`, import.meta.url)))';
  const joined = 'map((name) => readFileSync(new URL("../modules/conversation/" + name + ".js", import.meta.url)))';
  const entries = JSON.stringify(wanted);
  const root = fixture(context, {
    ...scripts,
    "tests/literal.test.mjs": `${reader}${entries}.${map};`,
    "tests/constant.test.mjs": `${reader}const files = ${entries}; files.map((name) => name.length); files.${map};`,
    "tests/computed.test.mjs": `${reader}[...otherFiles, 'decoration'].${map};`,
    "tests/mutated.test.mjs": `${reader}const files = ${entries}; files.push(extra); files.${map};`,
    "tests/callback.test.mjs": `${reader}const files = ${entries}; files.map((name, i, all) => { all[0] = "notice-line"; }); files.${joined};`,
    "tests/arguments.test.mjs": `${reader}const files = ${entries}; files.map(function () { arguments[2][0] = "notice-line"; }); files.${map};`,
    "tests/exported.test.mjs": `${reader}export const files = ${entries}; files.${map};`,
    "tests/eval.test.mjs": `${reader}const files = ${entries}; eval(source); files.${map};`,
    "tests/shadowed.test.mjs": reader + 'const name = "decoration"; function inspect(name) { ' +
      'readFileSync(new URL(`../modules/conversation/${name}.js`, import.meta.url)); }',
  });
  const findings = inventory(root);
  for (const name of ["literal", "constant"]) {
    assert.deepEqual(target(findings, `tests/${name}.test.mjs`), wanted.map((entry) => `modules/conversation/${entry}.js`));
  }
  for (const name of ["computed", "mutated", "callback", "arguments", "exported", "eval", "shadowed"]) {
    assert.deepEqual(target(findings, `tests/${name}.test.mjs`), files.map((entry) => `modules/conversation/${entry}.js`));
  }
});

test("only HTML used solely to boot the DOM harness is exempt", (context) => {
  const setup = 'import { readFileSync } from "node:fs"; import { dom as boot } from "./lib/dom.mjs";';
  const read = 'readFileSync(new URL("../index.html", import.meta.url), "utf8")';
  const root = fixture(context, {
    "index.html": "<!doctype html><html><body><main></main></body></html>",
    "tests/lib/dom.mjs": "export function dom() {}",
    "tests/direct.test.mjs": `${setup} await boot(${read});`,
    "tests/bound.test.mjs": `${setup} const html = ${read}; await boot(html);`,
    "tests/asserted.test.mjs": `${setup} const html = ${read}; await boot(html); assert.match(html, /main/);`,
    "tests/shadowed.test.mjs": `${setup} function other(boot) { boot(${read}); }`,
  });
  const findings = inventory(root);
  const reads = findings.filter((entry) => entry.rule === "sourceRead").map((entry) => entry.file).sort();
  assert.deepEqual(reads, ["tests/asserted.test.mjs", "tests/shadowed.test.mjs"]);
});

test("a test import does not rescue a dead export and a used re-export reaches its origin", (context) => {
  const root = fixture(context, {
    [FILE]: HEADER + "export const used = 1, dead = 2;",
    "js/bridge.js": HEADER + 'export * from "../modules/sample/page.js";',
    "js/app.js": HEADER + 'import { used } from "./bridge.js";\nconsume(used);',
    "tests/view.test.mjs": HEADER + 'import { dead } from "../modules/sample/page.js";\nconsume(dead);',
  });
  const findings = inventory(root);
  assert.deepEqual(findings, [{ file: FILE, rule: "unusedExport", line: 3, note: "dead" }]);
  assert.equal(compare(findings, EMPTY, new Set()).errors.length, 1);
});

test("a successful ratchet update only lowers allowances and a failed update is read-only", (context) => {
  const root = fixture(context, { [FILE]: HEADER + "setTimeout(callback, delay);" });
  const baselines = totals(inventory(root));
  for (const [name, counts] of Object.entries(baselines)) write(root, `baselines/${name}.json`, formatBaseline(counts));
  const paths = join(root, "baselines");
  const options = { update: true };
  write(root, FILE, HEADER + "setTimeout(callback, delay);\nsetTimeout(callback, delay);");
  const baseline = join(paths, "lifecycle.json");
  const original = readFileSync(baseline, "utf8");
  assert.match(checkConformance(root, paths, options), /setTimeout has 2, allowed 1/);
  assert.equal(readFileSync(baseline, "utf8"), original);
  write(root, FILE, HEADER + "scope.timeout(callback, delay);");
  assert.match(checkConformance(root, paths, { update: false }), /Stale conformance baseline/);
  assert.equal(checkConformance(root, paths, options), null);
  assert.deepEqual(JSON.parse(readFileSync(baseline, "utf8")), {});
  write(root, FILE, HEADER + "setTimeout(callback, delay);");
  assert.match(checkConformance(root, paths, options), /setTimeout has 1, allowed 0/);
});

test("the package base includes committed, staged, unstaged and untracked paths", (context) => {
  const root = fixture(context, { [FILE]: HEADER + "mount();" });
  const git = (...args) => {
    const result = runGit(args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const commit = () => git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture");
  git("init", "-q");
  git("add", ".");
  commit();
  const base = git("rev-parse", "HEAD");
  write(root, FILE, HEADER + "render();");
  git("add", FILE);
  commit();
  for (const file of ["js/staged.js", "js/untracked.js"]) write(root, file, HEADER);
  git("add", "js/staged.js");
  assert.deepEqual(changedFiles(root, base), new Set(["js/staged.js", FILE, "js/untracked.js"]));
  assert.deepEqual(changedFiles(root), new Set(["js/staged.js", "js/untracked.js"]));
});

test("published baseline allowances cannot be raised in a package commit", (context) => {
  const files = Object.fromEntries(Object.keys(EMPTY).map((name) => [`baselines/${name}.json`, "{}\n"]));
  const root = fixture(context, files);
  const git = (...args) => {
    const result = runGit(args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "-q");
  git("add", ".");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "baseline");
  const base = git("rev-parse", "HEAD");
  write(root, "baselines/lifecycle.json", JSON.stringify({ [FILE]: { observer: 1 } }));
  git("add", ".");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "raise allowance");
  const result = checkConformance(root, join(root, "baselines"), { update: false, base });
  assert.match(result, /raised the observer allowance from 0 to 1/);
});

test("lint reports correctness errors and suspicious warnings in the project configuration", (context) => {
  const root = fixture(context, {
    "lint-fixture.js": `
      const status = NaN;
      if (status === NaN) console.log(status);
      function show(status) { console.log(status); }
      show(status);
    `,
  });
  const project = new URL("../../../", import.meta.url);
  const oxlint = fileURLToPath(new URL("node_modules/.bin/oxlint", project));
  const config = fileURLToPath(new URL(".oxlintrc.json", project));
  const lint = spawnSync(oxlint, ["-c", config, "--format", "json", "."], { cwd: root, encoding: "utf8" });
  assert.equal(lint.status, 1, lint.error?.message ?? lint.stderr);
  const diagnostics = JSON.parse(lint.stdout).diagnostics;
  assert.ok(diagnostics.some((item) => item.code.includes("use-isnan") && item.severity === "error"));
  assert.ok(diagnostics.some((item) => item.code.includes("no-shadow") && item.severity === "warning"));
});
