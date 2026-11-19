// node e2e/tests/apps.test.mjs: the fake Space's app routes, in xo-space's shapes; an approval waits for an answer only a case gives.
import assert from "node:assert/strict";
import { createApps, answerApps } from "../lib/apps.mjs";

const A = createApps({ packages: { "/home/me/xo-apps/hello": "e2e/fixtures/apps/hello" }, answers: { hello_greet: "Hello, {name}." } });
/** @type {any[]} */
const frames = [];
const ask = (/** @type {string} */ method, /** @type {string} */ url, /** @type {unknown} */ body) => {
  const u = new URL(url, "http://e2e");
  return /** @type {any} */ (answerApps(A, { method, path: u.pathname, query: u.searchParams, body }, frames));
};

assert.equal(ask("GET", "/api/chat/chats"), undefined, "other routes are the store's");
assert.deepEqual(ask("GET", "/api/apps").body, { contract: "0.1", safe_mode: false, apps: [] }, "every seed answers an empty app list");
const sheet = ask("POST", "/api/apps/installs", { source: { kind: "folder", path: "/home/me/xo-apps/hello" } }).body;
assert.equal(sheet.id, "dev.xo-apps.hello");
assert.equal(sheet.publisher, "unverified");
assert.equal(sheet.uses_internet, true);
assert.equal(ask("POST", "/api/apps/installs", { source: { kind: "folder", path: "/elsewhere" } }).status, 422);
assert.equal(ask("POST", `/api/apps/installs/${sheet.staging_id}/confirm`, { sha256: "0".repeat(64) }).status, 409);
const conf = ask("POST", `/api/apps/installs/${sheet.staging_id}/confirm`, { sha256: sheet.sha256 });
assert.equal(conf.status, 202);
for (let i = 0; i < 3; i++) assert.equal(ask("GET", `/api/apps/approvals/${conf.body.approval_id}`).body.state, "pending", "never applied by asking again");
assert.deepEqual(ask("GET", "/api/apps").body.apps, []);
A.answer(conf.body.approval_id, "allow");
const done = ask("GET", `/api/apps/approvals/${conf.body.approval_id}`).body;
assert.equal(done.state, "applied");
assert.deepEqual(done.result, { id: "dev.xo-apps.hello", slug: "hello", version: "0.1.0" });
assert.equal(frames.at(-1).type, "apps.changed");
const [row] = ask("GET", "/api/apps").body.apps;
assert.equal(row.manifest.id, "dev.xo-apps.hello", "manifest is the raw space.xo block");
assert.equal(ask("POST", "/api/coworker/apps/dev.xo-apps.hello/call", { project: "demo", tool: "hello_greet", arguments: { name: "Ana" } }).status, 403, "off in the project: refused");
const en = ask("PUT", "/api/apps/dev.xo-apps.hello/grants?project=demo", { state: "enabled" });
assert.equal(en.status, 202);
assert.equal(ask("GET", "/api/apps").body.apps[0].pending[0].project, "demo");
A.answer(en.body.approval_id, "allow");
assert.equal(ask("GET", "/api/apps").body.apps[0].projects.demo.state, "enabled");
assert.deepEqual(ask("POST", "/api/coworker/apps/dev.xo-apps.hello/call", { project: "demo", tool: "hello_greet", arguments: { name: "Ana" } }).body.content[0].text, "Hello, Ana.");
assert.match(ask("GET", "/api/coworker/apps/dev.xo-apps.hello/resources?uri=ui://dev.xo-apps.hello/panel").body.contents[0].text, /Say hello/);
const off = ask("PUT", "/api/apps/dev.xo-apps.hello/grants?project=demo", { state: "disabled" });
assert.equal(off.status, 200, "narrowing applies at once");
const again = ask("PUT", "/api/apps/dev.xo-apps.hello/grants?project=demo", { state: "enabled" });
A.answer(again.body.approval_id, "decline");
assert.equal(ask("GET", `/api/apps/approvals/${again.body.approval_id}`).body.state, "declined");
assert.equal(ask("GET", "/api/apps").body.apps[0].projects.demo.state, "disabled");
assert.throws(() => A.answer(again.body.approval_id, "allow"), /no pending approval/);
console.log("ok apps: installs and enables wait for the owner's answer; the app's routes answer in xo-space's shapes");
