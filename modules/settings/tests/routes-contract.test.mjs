// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { api } from "../../../core/platform/api.js";

/** @type {{ paths: Record<string, string[]> }} */
const snapshot = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const session = "account-session";
const code = { user_code: "ABCD-EFGH", verification_uri: "https://github.com/login/device" };
const github = "/api/connectors/github";
const replies = new Map([
  [github + "/status", { status: "needs_auth" }],
  [github + "/cli/start", { session_id: session, ...code, expires_in: 900 }],
  [github + "/cli/poll", { status: "pending", ...code }],
  [github + "/cli/cancel", { status: "cancelled" }],
  [github + "/disconnect", { status: "needs_auth" }],
]);
/** @type {[string, string, () => Promise<unknown>, boolean?][]} */
const routes = [
  ["GET", "/api/connectors/github/status", () => api.githubStatus()],
  ["POST", "/api/connectors/github/cli/start", () => api.githubConnect(true)],
  ["POST", "/api/connectors/github/cli/poll", () => api.githubConnectPoll(session)],
  ["POST", "/api/connectors/github/cli/cancel", () => api.githubConnectCancel(session)],
  ["POST", "/api/connectors/github/disconnect", () => api.githubDisconnect()],
];

for (const [method, path, call, optional] of routes) {
  const seen = [];
  globalThis.fetch = async (url, options) => {
    seen.push([options?.method ?? "GET", new URL(String(url), "http://local/").pathname]);
    if (optional) return Response.json({ detail: "Not Found" }, { status: 404 });
    if (method === "POST" && !replies.has(path)) {
      return new Response('data: {"type":"session","session_id":"account-session"}\n\n');
    }
    assert.ok(replies.has(path), path);
    return Response.json(replies.get(path));
  };
  assert.equal(snapshot.paths[path]?.includes(method) ?? false, !optional, `${method} ${path} in OpenAPI`);
  if (optional) await assert.rejects(call(), { status: 404 });
  else await call();
  assert.deepEqual(seen, [[method, path]]);
}
