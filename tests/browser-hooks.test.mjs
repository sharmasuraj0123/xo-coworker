// The browser harness adds window.__storm to storm's stream module by text: its anchor must be there once, and the names it uses in scope.
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
