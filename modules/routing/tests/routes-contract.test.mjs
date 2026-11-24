// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { api } from "../../../core/platform/api.js";

const snapshot = JSON.parse(readFileSync(
  new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8",
));
const requests = [];
const setting = { mode: "off", abstain_below: 0.7 };
const connection = { provider: "provider", api_key: "test-key" };
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input), "https://space.invalid");
  const path = url.pathname.replace("/test%20provider", "/{provider}").replace("/test%20chat", "/{chat_id}");
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  requests.push([init?.method, path, body]);
  return Response.json({});
};
await api.router();
await api.routerModels();
await api.setRouter(setting);
await api.connectRouterModel(connection);
await api.disconnectRouterModel("test provider");
await api.patchChat("test chat", { routing: null });
assert.deepEqual(requests, [
  ["GET", "/api/chat/router", null],
  ["GET", "/api/chat/router/models", null],
  ["PUT", "/api/chat/router", setting],
  ["POST", "/api/chat/router/models", connection],
  ["DELETE", "/api/chat/router/models/{provider}", null],
  ["PATCH", "/api/chat/chats/{chat_id}", { routing: null }],
]);
for (const [method, path] of requests) assert.ok(snapshot.paths[path]?.includes(method), `${method} ${path} must be in OpenAPI`);
