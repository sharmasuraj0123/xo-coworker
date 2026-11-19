import assert from "node:assert/strict";
import { createAppsClient } from "../client.js";

/** @type {Array<[string, any]>} */
const calls = [];
const c = createAppsClient(async (path, opts = {}) => { calls.push([path, opts]); return { ok: true }; });
const last = () => calls[calls.length - 1];
const at = { project: "p1", thread: "t1" };

await c.list();
assert.equal(last()[0], "/api/apps");
await c.stage({ git: "https://github.com/me/xo-word", ref: "v0.3.0" });
assert.deepEqual(last(), ["/api/apps/installs", { method: "POST", body: { git: "https://github.com/me/xo-word", ref: "v0.3.0" } }]);
await c.stage({ path: "/home/me/xo-word" });
assert.deepEqual(last()[1].body, { path: "/home/me/xo-word" });
assert.throws(() => c.stage({ git: "http://github.com/me/x" }), /https/);
assert.throws(() => c.stage({ git: "https://x.com/a b" }), /https/);
assert.throws(() => c.stage({ git: "https://github.com/me/x", ref: "--upload-pack=x;rm" }), /ref/);
assert.throws(() => c.stage({ path: "relative/x" }), /absolute/);
assert.throws(() => c.stage({ path: "/home/../etc" }), /absolute/);
assert.throws(() => c.confirm("s1", "nope"), /sha256/);
await c.confirm("s1", "a".repeat(64));
assert.equal(last()[0], "/api/apps/installs/s1/confirm");
assert.throws(() => c.staged("../x"), /staging id/);

assert.throws(() => c.get("../secrets"), /isn't an app id/);
assert.throws(() => c.get("dev.x/../../secrets"), /isn't an app id/);
await c.setGrant("dev.example.word", "p1", { optional: [0], routes: ["GET /api/chat/status"] });
assert.deepEqual(last(), ["/api/apps/dev.example.word/grants", { method: "PUT", query: { project: "p1" }, body: { required: true, optional: [0], routes: ["GET /api/chat/status"] } }]);
assert.throws(() => c.stage({ git: "https://github.com/me/x", ref: "-oProxyCommand=x" }), /ref/);
assert.throws(() => c.revoke("dev.example.word", "p1&x=1"), /project id/);
await c.remove("dev.example.word");
assert.deepEqual(last()[1], { method: "DELETE", body: { delete_data: false } });

await c.call("dev.example.word", at, "word_read", { path: "a.word.json" });
assert.deepEqual(last(), ["/api/coworker/apps/dev.example.word/call", { method: "POST", headers: { "X-XO-Project": "p1", "X-XO-Thread": "t1" }, body: { project: "p1", thread: "t1", tool: "word_read", arguments: { path: "a.word.json" } } }]);
await c.call("dev.example.word", { project: "p1" }, "word_delete", {}, { confirm: true });
assert.equal(last()[1].body.confirm, "destructive");
assert.deepEqual(last()[1].headers, { "X-XO-Project": "p1" });

await c.resource("dev.example.word", "ui://dev.example.word/editor", at);
assert.deepEqual(last(), ["/api/coworker/apps/dev.example.word/resources", { query: { uri: "ui://dev.example.word/editor" }, headers: { "X-XO-Project": "p1", "X-XO-Thread": "t1" } }]);
for (const [fn, tail] of [["viewOpened", "open"], ["viewAlive", "heartbeat"], ["viewClosed", "close"]]) {
  await c[fn]("dev.example.word", at, "ui://dev.example.word/editor");
  assert.deepEqual(last(), [`/api/coworker/apps/dev.example.word/views/${tail}`, { method: "POST", headers: { "X-XO-Project": "p1", "X-XO-Thread": "t1" }, body: { view: "ui://dev.example.word/editor" } }]);
}
assert.equal("route" in c, false, "views reach no local route directly");
assert.throws(() => c.resource("dev.example.word", "ui://other.app/x", at), /its own views/);
await c.prompt("dev.example.word", at, "tighten");
assert.equal(last()[0], "/api/coworker/apps/dev.example.word/prompts/tighten");
const before = calls.length;
assert.throws(() => c.prompt("dev.example.word", at, "../x"), /prompt name/);
assert.equal(calls.length, before, "nothing is sent for a refused call");
assert.throws(() => c.call("dev.example.word", { project: "p/../x" }, "word_read", {}), /project id/);
console.log("ok client: one interface, ids and paths checked before anything is sent");
