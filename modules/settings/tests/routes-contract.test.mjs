// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { api } from "../../../core/platform/api.js";
import { SIGN_IN } from "../accounts.js";

/** @type {{ paths: Record<string, string[]> }} */
const snapshot = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const control = new AbortController();
const stream = { signal: control.signal, on() {} };
const session = "account-session";
/** @type {[string, string, () => Promise<unknown>, boolean?][]} */
const routes = [
  ["GET", "/api/chat/runtimes", () => api.runtimes()],
  ["GET", "/api/connectors/github/status", () => api.githubStatus()],
  ["POST", "/api/connectors/github/cli/start", () => api.githubConnect(true)],
  ["POST", "/api/connectors/github/cli/poll", () => api.githubConnectPoll(session)],
  ["POST", "/api/connectors/github/cli/cancel", () => api.githubConnectCancel(session)],
  ["POST", "/api/connectors/github/disconnect", () => api.githubDisconnect()],
  ["POST", "/connect/claude-code", () => api.signInStream(SIGN_IN.claude_code.route, stream)],
  ["POST", "/connect/claude-code/callback", () => api.signInCode("claude-code", session, "test-code")],
  ["DELETE", "/connect/claude-code", () => api.signInCancel("claude-code")],
  ["POST", "/connect/codex", () => api.signInStream(SIGN_IN.codex.route, stream)],
  ["POST", "/connect/antigravity", () => api.signInStream(SIGN_IN.antigravity.route, stream), true],
  ["POST", "/connect/antigravity/callback", () => api.signInCode("antigravity", session, "test-code"), true],
];

for (const [method, path, call, optional] of routes) {
  const seen = [];
  globalThis.fetch = async (url, options) => {
    seen.push([options?.method ?? "GET", new URL(String(url), "http://local/").pathname]);
    if (optional) return Response.json({ detail: "Not Found" }, { status: 404 });
    return Response.json(path === "/api/chat/runtimes" ? { runtimes: [] } : {});
  };
  assert.equal(snapshot.paths[path]?.includes(method) ?? false, !optional, `${method} ${path} in OpenAPI`);
  if (optional) await assert.rejects(call(), { status: 404 });
  else await call();
  assert.deepEqual(seen, [[method, path]]);
}
