// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { api } from "../../../core/platform/api.js";

/** @type {{ paths: Record<string, string[]> }} */
const snapshot = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const origin = "https://xo.test/";

const session = "sample-session";
const chat = "sample-chat";
const thread = "sample-thread";
const model = { model: "sample-model" };
const agent = "codex";

/** @type {[method: string, template: string, path: string, call: () => Promise<unknown>][]} */
const routes = [
  ["GET", "/api/chat/sessions", "/api/chat/sessions", () => api.sessions({ role: "plain" })],
  ["GET", "/api/chat/sessions/{session_id}", `/api/chat/sessions/${session}`, () => api.session(session)],
  ["GET", "/api/messages/{session_id}", `/api/messages/${session}`, () => api.observedMessages(session, { offset: 0, limit: 5 })],
  ["POST", "/api/chat/prompt", "/api/chat/prompt", () => api.prompt({ text: "Hello" })],
  ["GET", "/api/chat/runtimes/{name}/models", `/api/chat/runtimes/${agent}/models`, () => api.models(agent)],
  ["GET", "/api/chat/router/models", "/api/chat/router/models", () => api.routerModels()],
  ["PATCH", "/api/chat/chats/{chat_id}", `/api/chat/chats/${chat}`, () => api.patchChat(chat, model)],
  ["PATCH", "/api/chat/chats/{chat_id}/threads/{ts}", `/api/chat/chats/${chat}/threads/${thread}`, () => api.patchThread(chat, thread, { intelligence: model })],
  ["POST", "/api/chat/chats/{chat_id}/threads/{ts}/continue", `/api/chat/chats/${chat}/threads/${thread}/continue`, () => api.continueThread(chat, thread, { agent })],
];

for (const [method, template, path, request] of routes) {
  assert.ok(snapshot.paths[template]?.includes(method), `${method} ${template} is in OpenAPI`);
  /** @type {string[][]} */
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push([options?.method || "GET", new URL(String(url), origin).pathname]);
    return Response.json({}, { status: 404 });
  };
  await assert.rejects(request, { status: 404 });
  assert.deepEqual(requests, [[method, path]], `${method} ${path}`);
}
