import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SNAP = JSON.parse(readFileSync(new URL("./fixtures/openapi-routes.json", import.meta.url), "utf8"));
const templates = Object.entries(SNAP.paths).map(([p, methods]) => ({ p, methods, re: new RegExp(`^${p.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{[^}]+\\?\}/g, "[^/]+")}$`) }));

globalThis.location = ({ href: "http://127.0.0.1:5180/" });
globalThis.history = ({ state: null, replaceState() {} });
/** @type {{ method: string, path: string, from: string }[]} */
const seen = [];
let from = "";
const record = (method, url) => { const u = new URL(String(url), "http://127.0.0.1:5180/"); seen.push({ method: method.toUpperCase(), path: u.pathname, from }); };
globalThis.fetch = (async (url, init = {}) => {
  record(init.method || "GET", url);
  const status = 204;
  return { ok: false, status, statusText: "", type: "basic", text: async () => "", json: async () => ({}), blob: async () => ({}) };
});
globalThis.XMLHttpRequest = (class { constructor() { this.upload = {}; } open(m, u) { record(m, u); } setRequestHeader() {} send() {} abort() {} });

const { api, attachmentUrl, attachmentText, uploadAttachment, terminalSocketUrl } = await import("../api.js");

const STREAM_OPTIONS = { signal: new AbortController().signal, on() {} };
const ARGS = {
  projectTree: [["x", "y"]],
  githubIssue: [["x", "y"]],
  githubPull: [["x", "y"]],
  pinMade: [["c", "m", true], ["c", "m", false]],
  launchpadApps: [["x"]],
  launchpadDeploy: [["x", {}, STREAM_OPTIONS]],
  launchpadWatch: [["x", STREAM_OPTIONS]],
  signInStream: [["claude_code", STREAM_OPTIONS]],
  signInCode: [["claude_code", "session", "code"]],
  signInCancel: [["claude_code"]],
  runtimeAction: ["install", "update", "uninstall", "sign_out"].map((action) => ["codex", action]),
  setRemoteControl: [["codex", true], ["codex", false]],
  schedules: [[undefined]],
  scheduleRuns: [["x", {}, undefined]],
  personas: [["x"], [null]],
  importable: [["x"]],
  importPersona: [[{ adapter: "claude_code", id: "space:x" }]],
  tryOnce: [[{ project: "x", text: "y" }]],
};
const OPTIONAL_GITHUB = new Map([
  ["api.githubIssue", "/api/xo-projects/x/github/issues/y"],
  ["api.githubPulls", "/api/xo-projects/x/github/pulls"],
  ["api.githubPull", "/api/xo-projects/x/github/pulls/y"],
]);
const OPTIONAL_SIGN_IN = new Map();
const call = async (name, fn, args) => { from = name; await Promise.resolve().then(() => fn(...args)).catch(() => undefined); };
for (const [name, fn] of Object.entries(api)) {
  if (name === "streamUrl") { from = `api.${name}`; record("GET", fn()); continue; }
  for (const args of ARGS[name] || [["x", "y", "z", "w"]]) await call(`api.${name}`, fn, args);
}
await call("attachmentText", attachmentText, ["c", "a"]);
await call("uploadAttachment", (...a) => { uploadAttachment(...a); }, ["c", { type: "", size: 1 }, "n"]);
from = "attachmentUrl"; record("GET", attachmentUrl("c", "a"));
await new Promise((r) => setTimeout(r, 20));

const wsPath = new URL(terminalSocketUrl("t")).pathname;
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };
t("the client was driven: every api route made a request", () => {
  assert.ok(seen.length >= Object.keys(api).length, `${seen.length} requests`);
  for (const name of Object.keys(api)) assert.ok(seen.some((s) => s.from === `api.${name}`), `api.${name} made no request`);
  for (const name of ["attachmentText", "uploadAttachment", "attachmentUrl"]) assert.ok(seen.some((s) => s.from === name), `${name} made no request`);
});
const optional = ({ method, path, from }) =>
  (method === "GET" && OPTIONAL_GITHUB.get(from) === path)
  || (method === "POST" && OPTIONAL_SIGN_IN.get(from) === path);
t("each request matches OpenAPI or an optional route with 404 coverage", () => {
  const unlisted = seen.filter(({ method, path }) => !templates.some((x) => x.re.test(path) && x.methods.includes(method)));
  const missing = [...new Set(unlisted
    .filter((request) => !optional(request))
    .map(({ method, path, from }) => `${method} ${path} (${from})`))];
  assert.deepEqual(missing, [], `routes the client calls that xo-space doesn't define (snapshot ${SNAP.taken})`);
});
t("each optional entry refers to a route absent from this OpenAPI snapshot", () => {
  for (const [method, routes] of [["GET", OPTIONAL_GITHUB], ["POST", OPTIONAL_SIGN_IN]]) {
    for (const [from, path] of routes) {
      assert.ok(seen.some((request) => request.from === from && request.method === method && request.path === path), from);
      assert.ok(!templates.some((entry) => entry.re.test(path) && entry.methods.includes(method)), `remove ${from} from the optional routes`);
    }
  }
});
t("a shell's socket hangs off a terminal session xo-space defines (OpenAPI lists no sockets)", () => {
  const session = wsPath.replace(/\/ws$/, "");
  assert.notEqual(session, wsPath, "the socket is the session's /ws");
  assert.ok(templates.some((x) => x.re.test(session) && x.methods.includes("GET")), `${session} is a terminal session in the snapshot`);
});
console.log(`\n${passed} passed`);
