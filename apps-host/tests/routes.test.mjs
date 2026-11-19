import assert from "node:assert/strict";
import { onFloor, parseRoute } from "../routes.js";

for (const [m, p] of [
  ["GET", "/api/secrets/env"], ["GET", "/api/secrets/x/reveal"], ["POST", "/api/files/content"], ["POST", "/api/files/save"],
  ["GET", "/api/agents/claude/default/secrets"], ["GET", "/api/apps"], ["POST", "/api/apps/x/grants"], ["GET", "/mcp/apps/x"],
  ["GET", "/api/config"], ["GET", "/api/configuration"], ["PUT", "/api/runtime-config/x"], ["POST", "/api/terminal/open"],
  ["POST", "/api/chat/review/r1/decision"], ["POST", "/api/chat/rules"], ["POST", "/api/chat/intent/x"],
  ["POST", "/api/chat/chats/c/threads/t/restore"], ["DELETE", "/api/chat/chats/c/threads/t"], ["POST", "/api/xo-projects/p/edits/e/undo"],
  ["POST", "/api/xo-projects/p/files/delete"], ["GET", "/api/xo-projects/p/secret"], ["GET", "/claude/x"], ["POST", "/api/coworker/apps/x/call"], ["GET", "/auth/token"], ["GET", "/static/x"],
  ["GET", "/API/SECRETS/env"],
]) assert.equal(onFloor(m, p), true, `${m} ${p} is on the floor`);
for (const [m, p] of [["GET", "/api/chat/status"], ["POST", "/api/chat/chats/c/messages"], ["GET", "/api/xo-projects/p/file"], ["PUT", "/api/xo-projects/p/file"]]) {
  assert.equal(onFloor(m, p), false, `${m} ${p} may be declared`);
}

const r = parseRoute("POST /api/chat/chats/{chat_id}/messages");
assert.equal(typeof r, "object");
assert.match(String(parseRoute("GET /api/secrets/env")), /never opens/);
assert.match(String(parseRoute("GET /api/apps/{id}")), /never opens/);
assert.match(String(parseRoute("FETCH /api/x")), /isn't a method/);
assert.match(String(parseRoute("GET /api/{x}/../y")), /clean path/);
assert.match(String(parseRoute("get /api/x")), /must look like/);
assert.match(String(parseRoute(42)), /must be text/);

console.log("ok routes: the floor, and templates an app may declare");
