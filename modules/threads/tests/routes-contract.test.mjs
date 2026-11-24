// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCommands } from "../../../core/services/storm/commands.js";
import { createThreadResolve } from "../resolve.js";

/** @type {{ paths: Record<string, string[]> }} */
const { paths } = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const route = "/api/chat/chats/{chat_id}/threads/{ts}";
assert.ok(paths[route]?.includes("PATCH"), `PATCH ${route} in OpenAPI`);
const calls = [];
globalThis.fetch = async (url, init) => {
  const request = new URL(String(url), "http://local");
  calls.push([init?.method, request.pathname, JSON.parse(String(init?.body))]);
  return Response.json({});
};
const rawThreads = new Map([["thread/key", { chat_id: "chat/key", state: "working" }]]);
const ctx = { rawThreads, soon() {}, sentAt() { return {}; }, sessRead() { return {}; } };
const act = createCommands(/** @type {import("../../../core/services/storm/types").Ctx} */ (/** @type {unknown} */ (ctx)));
const resolve = createThreadResolve({
  world: { act, thread: () => ({ title: "Review" }) },
  schedule() {}, announce() {}, heraldFor: () => false, heraldShow() {}, heraldDrop() {},
});
assert.deepEqual(await resolve("thread/key", true, { undo: false }), { ok: true });
assert.deepEqual(await resolve("thread/key", false, { undo: false }), { ok: true });
assert.deepEqual(calls, [
  ["PATCH", "/api/chat/chats/chat%2Fkey/threads/thread%2Fkey", { resolved: true }],
  ["PATCH", "/api/chat/chats/chat%2Fkey/threads/thread%2Fkey", { resolved: false }],
]);
