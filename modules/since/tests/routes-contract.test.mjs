// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chatActivityApi } from "../../../core/platform/api.js";

const snapshot = JSON.parse(readFileSync(
  new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8",
));
const requests = [];
const chat = "project chat";
const signal = new AbortController().signal;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input), "https://space.invalid/");
  requests.push([url.pathname.replace(encodeURIComponent(chat), "{chat_id}"), init?.method, url.searchParams.get("chat")]);
  if (url.pathname === "/api/chat/chats") return Response.json({ chats: [] });
  if (url.pathname.endsWith("/seen")) return Response.json({ seen: { seen_at: "2026-11-20T12:00:00Z", seen_seq: 1 } });
  throw new Error(`unexpected ${url.pathname}`);
};

await chatActivityApi.chats(signal);
await chatActivityApi.markSeen(chat, signal);

assert.deepEqual(requests, [
  ["/api/chat/chats", "GET", null],
  ["/api/chat/chats/{chat_id}/seen", "PUT", null],
]);
for (const [path, method] of requests) {
  assert.ok(snapshot.paths[path]?.includes(method), `${method} ${path} must be in OpenAPI`);
}
