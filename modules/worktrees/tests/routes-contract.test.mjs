// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chatActivityApi } from "../../../core/platform/api.js";

const snapshot = JSON.parse(readFileSync(
  new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8",
));
const routes = [];
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input), "https://space.invalid");
  const path = url.pathname.replace("/project%20chat/thread%20id", "/{chat_id}/{thread_ts}");
  routes.push([path, init?.method, url.searchParams.get("confirm")]);
  if (init?.method === "DELETE") return Response.json({ removed: true, forced: true, lost: null, note: "Removed" });
  return Response.json({ worktrees: [], removed: [], reported: [] });
};
await chatActivityApi.worktrees();
await chatActivityApi.removeWorktree("project chat", "thread id", "confirm-token");
assert.deepEqual(routes, [
  ["/api/chat/worktrees", "GET", null],
  ["/api/chat/worktrees/{chat_id}/{thread_ts}", "DELETE", "confirm-token"],
]);
for (const [path, method] of routes) assert.ok(snapshot.paths[path]?.includes(method), `${method} ${path} must be in OpenAPI`);
