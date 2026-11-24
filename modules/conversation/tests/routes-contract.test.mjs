// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { api, uploadAttachment } from "../../../core/platform/api.js";

/** @type {{paths: Record<string, string[]>}} */
const snapshot = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const chat = "sample-chat";
const thread = "sample-thread";

/** @type {[string, string, string, () => Promise<unknown>][]} */
const routes = [
  ["GET", "/api/chat/chats/{chat_id}/messages", `/api/chat/chats/${chat}/messages`, () => api.messages(chat, { thread, before_seq: 10 })],
  ["GET", "/api/chat/chats/{chat_id}/threads/{ts}", `/api/chat/chats/${chat}/threads/${thread}`, () => api.thread(chat, thread)],
  ["GET", "/api/chat/chats/{chat_id}/hops", `/api/chat/chats/${chat}/hops`, () => api.hops(chat)],
  ["POST", "/api/chat/chats/{chat_id}/messages", `/api/chat/chats/${chat}/messages`, () => api.post(chat, { text: "Hello", threadTs: thread, clientId: "client-id", attachments: ["attachment"] })],
  ["POST", "/api/chat/abort", "/api/chat/abort", () => api.abort("session-id")],
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

assert.ok(snapshot.paths["/api/chat/chats/{chat_id}/attachments"]?.includes("POST"));
/** @type {string[][]} */
const uploads = [];
Object.assign(globalThis, {
  XMLHttpRequest: class {
    status = 200;
    responseText = "{}";
    /** @type {() => void} */
    onload = () => {};
    /** @param {string} method @param {string} url */
    open(method, url) { uploads.push([method, new URL(url, "https://xo.test/").pathname]); }
    setRequestHeader() {}
    send() { this.onload(); }
  },
});
await uploadAttachment(chat, new Blob(["test"]), "notes.txt").promise;
assert.deepEqual(uploads, [["POST", `/api/chat/chats/${chat}/attachments`]]);
