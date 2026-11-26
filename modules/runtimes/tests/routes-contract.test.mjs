// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { api } from "../../../core/platform/api.js";

/** @type {{ paths: Record<string, string[]> }} */
const snapshot = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const stream = { signal: new AbortController().signal, on() {} };
const session = "runtime-session";
const job = { id: "j1", runtime: "codex", action: "install", status: "running", log: [], result: null };
const rt = "/api/chat/runtimes/codex";
/** @type {[string, string, () => Promise<unknown>, unknown][]} */
const routes = [
  ["GET", "/api/chat/runtimes", () => api.runtimes(), { runtimes: [] }],
  ["GET", rt + "/lifecycle", () => api.lifecycle("codex"), { name: "codex", state: "installed", installed: true, signed_in: false, actions: ["install"] }],
  ["POST", rt + "/sign-in", () => api.signInStream("codex", stream), null],
  ["POST", rt + "/sign-in/callback", () => api.signInCode("codex", session, "test-code"), { ok: true, message: "Code sent", session_id: session }],
  ["DELETE", rt + "/sign-in", () => api.signInCancel("codex"), { ok: true, message: "Session cancelled", session_id: session }],
  ["POST", rt + "/install", () => api.runtimeAction("codex", "install"), job],
  ["POST", rt + "/update", () => api.runtimeAction("codex", "update"), job],
  ["POST", rt + "/uninstall", () => api.runtimeAction("codex", "uninstall", { force: true }), job],
  ["POST", rt + "/sign-out", () => api.runtimeAction("codex", "sign_out"), job],
  ["GET", rt + "/jobs/j1", () => api.runtimeJob("codex", "j1"), job],
  ["GET", rt + "/remote-control/status", () => api.remoteControl("codex"), { running: false }],
  ["POST", rt + "/remote-control/start", () => api.setRemoteControl("codex", true), { running: true }],
  ["POST", rt + "/remote-control/stop", () => api.setRemoteControl("codex", false), { running: false }],
];
const template = (/** @type {string} */ path) => path.replace(/^\/api\/chat\/runtimes\/codex/, "/api/chat/runtimes/{name}").replace(/\/jobs\/j1$/, "/jobs/{job_id}");

for (const [method, path, call, reply] of routes) {
  /** @type {[string, string, unknown][]} */
  const seen = [];
  globalThis.fetch = /** @type {typeof fetch} */ (async (url, options) => {
    seen.push([options?.method ?? "GET", new URL(String(url), "http://local/").pathname, options?.body ? JSON.parse(String(options.body)) : null]);
    if (reply === null) return new Response(`data: {"type":"session","session_id":"${session}"}\n\n`);
    return Response.json(reply);
  });
  assert.ok(snapshot.paths[template(path)]?.includes(method), `${method} ${template(path)} in OpenAPI`);
  await call();
  assert.deepEqual(seen.map(([m, p]) => [m, p]), [[method, path]]);
  if (path.endsWith("/uninstall")) assert.deepEqual(seen[0][2], { force: true });
}
console.log(`${routes.length} passed`);
