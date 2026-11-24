// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { api } from "../../../core/platform/api.js";

/** @type {{paths: Record<string, string[]>}} */
const snapshot = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const item = "sample-item";
const chat = "sample-chat";
const thread = "sample-thread";

/** @type {[string, string, string, () => Promise<unknown>][]} */
const routes = [
  ["GET", "/api/chat/review/{item_id}", `/api/chat/review/${item}`, () => api.reviewItem(item)],
  ["POST", "/api/chat/review/{item_id}/decision", `/api/chat/review/${item}/decision`, () => api.decide(item, { decision: "allow" })],
  ["POST", "/api/chat/chats/{chat_id}/messages", `/api/chat/chats/${chat}/messages`, () => api.post(chat, { text: "Reply", threadTs: thread, clientId: "client-id" })],
  ["PATCH", "/api/chat/chats/{chat_id}/threads/{ts}", `/api/chat/chats/${chat}/threads/${thread}`, () => api.patchThread(chat, thread, { resolved: true })],
];

for (const [method, template, path, request] of routes) {
  assert.ok(snapshot.paths[template]?.includes(method), `${method} ${template}`);
  /** @type {string[][]} */
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([options?.method || "GET", new URL(String(url), "https://xo.test/").pathname]);
    return Response.json({});
  };
  await request();
  assert.deepEqual(calls, [[method, path]]);
}
