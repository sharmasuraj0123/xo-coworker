// Every route Launchpad's client calls is in xo-space's OpenAPI snapshot, with that method.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SNAP = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const templates = Object.entries(SNAP.paths).map(([p, methods]) => ({ p, methods, re: new RegExp(`^${p.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{[^}]+\\?\}/g, "[^/]+")}$`) }));

globalThis.location = new URL("http://127.0.0.1:5180/");
globalThis.history = { state: null, replaceState() {} };
/** @type {{ method: string, path: string, from: string }[]} */
const seen = [];
let from = "";
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url), "http://127.0.0.1:5180/");
  seen.push({ method: (init.method || "GET").toUpperCase(), path: u.pathname, from });
  return { ok: false, status: 204, statusText: "", type: "basic", text: async () => "", json: async () => ({}), blob: async () => ({}) };
};

const { createLpApi } = await import("../client.js");
const lp = createLpApi();
const signal = new AbortController().signal;
const ARGS = { apps: [["p", signal]], githubStart: [[true, signal], [false, signal]], githubPoll: [["p", signal]] };
for (const [name, fn] of Object.entries(lp)) for (const args of ARGS[name] || [["p", "q"]]) {
  from = name;
  try { await fn(...(name === "deploy" ? [args[0], {}, () => {}] : name === "watch" ? [args[0], () => {}] : args)); }
  catch (error) { assert.equal(error.name, "Error"); }
}
await new Promise((r) => setTimeout(r, 20));

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };
t("every call of the deploy client made a request", () => {
  for (const name of Object.keys(lp)) assert.ok(seen.some((s) => s.from === name), `${name} made no request`);
});
t("each request's path and method are in xo-space's OpenAPI", () => {
  const missing = [...new Set(seen.filter(({ method, path }) => !templates.some((x) => x.re.test(path) && x.methods.includes(method))).map(({ method, path, from: f }) => `${method} ${path} (${f})`))];
  assert.deepEqual(missing, [], `routes the client calls that xo-space doesn't define (snapshot ${SNAP.taken})`);
});
console.log(`\n${passed} passed`);
