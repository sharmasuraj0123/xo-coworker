// The browser harness patches served modules by text: each anchor must be there (storm's once, with the names it uses in scope), and no flow reads a global nothing sets.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const harness = read("tests/browser/harness.cjs");
const hook = harness.match(/page\.route\("\*\*\/(core\/services\/storm\/stream\.js)", [^\n]*?\.replace\(("(?:[^"\\]|\\.)*"), ("(?:[^"\\]|\\.)*")\)/);
assert.ok(hook, "the harness hooks storm's stream module");
const [, file, anchor, added] = hook;
const src = read(file);
assert.equal(src.split(JSON.parse(anchor)).length - 1, 1, `"${JSON.parse(anchor)}" once in ${file}`);
const body = src.slice(src.indexOf("export function startStorm("));
for (const name of ["ctx.apply", "ctx.stopTimers", "stream?.close", "recoverT"]) assert.ok(JSON.parse(added).includes(name), `the hook uses ${name}`);
for (const name of ["ctx.apply(", "ctx.stopTimers = ", "let stream", "let recoverT"]) assert.ok(body.includes(name) || read("core/services/storm/account.js").includes(name), `${name} is in scope`);
console.log("ok  the storm hook finds its anchor");
const hooks = [...harness.matchAll(/page\.route\("\*\*\/([^"]+)"[^\n]*?\.replace\(("(?:[^"\\]|\\.)*")/g)].map((m) => ({ file: m[1], anchor: JSON.parse(m[2]) }));
for (const h of hooks) assert.ok(read(h.file).includes(h.anchor), `${h.file} no longer has ${JSON.stringify(h.anchor)}, so its hook is dead`);
console.log(`ok  every one of the harness's ${hooks.length} text hooks finds its anchor`);
const flows = read("tests/browser/flows.test.cjs");
const set = new Set([...(harness + flows).matchAll(/window\.(__\w+)\s*=[^=]/g)].map((m) => m[1]));
for (const g of new Set([...flows.matchAll(/window\.(__\w+)/g)].map((m) => m[1]))) assert.ok(set.has(g), `flows read window.${g}, which neither a hook nor a flow sets`);
console.log("ok  no flow waits on a global that nothing sets");
