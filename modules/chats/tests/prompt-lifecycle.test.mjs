// @ts-check

import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createChats } from "../chats.js";

await dom('<div id="msgs"></div>');
const requests = [];
globalThis.fetch = async (url, options) => {
  assert.match(String(url), /\/chat\/prompt$/);
  assert.equal(options?.method, "POST");
  const pending = Promise.withResolvers();
  requests.push(pending);
  return pending.promise;
};

const sessions = Object.create(null);
const announcements = [], seen = [], destinations = [], reports = [], restored = [], notices = [];
const navigationError = new Error("Could not open the new chat");
let failNavigation = false;
globalThis.reportError = (error) => reports.push(error);
const chats = createChats({
  world: {
    state: { sessions, projects: [], runtimes: [{ name: "codex" }] },
    project: () => null,
    onEvent() {},
    act: {
      sentAt: () => ({ at: 1, seq: 2 }),
      noteSession(session, sent) { sessions[session.id] = session; seen.push([session.id, sent]); },
    },
  },
  view: () => "chats",
  go(view) { if (failNavigation) throw navigationError; destinations.push(view); },
  announce: (words) => announcements.push(words),
  heraldShow(notice) { notices.push(notice); },
  restore(words) { restored.push(words); return true; },
  schedule() {},
}, {
  cliName: (name) => name || "", turnHtml: () => "", turnAv: () => "", chatOrder: (prompts) => prompts.map((m) => ({ kind: "you", m })),
  heldShort: () => "", heldBadge: () => "", dayGroup: () => "", rowTime: () => "",
});

const first = chats.send("chats", "A chat I can open");
await new Promise(setImmediate);
requests[0].resolve(Response.json({ session_id: "new" }));
await first;
assert.deepEqual(seen, [["new", { at: 1, seq: 2 }]], "new sessions are recorded by the world owner");
assert.deepEqual(destinations, ["c:new"]);
assert.deepEqual(announcements, ["Sent."]);
assert.match(chats.headHtml("c:new"), /A chat I can open/);
sessions.new = { ...sessions.new, native_id: "initial-native" };
assert.match(chats.headHtml("c:new"), /A chat I can open/, "the first native assignment preserves the optimistic title");
sessions.new = { ...sessions.new, native_id: "next-native" };
assert.doesNotMatch(chats.headHtml("c:new"), /A chat I can open/, "a later native replacement retires the optimistic title");

const failed = chats.send("c:new", "A failed reply");
await new Promise(setImmediate);
requests.at(-1).resolve(Response.json({ detail: { code: "server_error", message: "Internal failure" } }, { status: 500 }));
await failed;
assert.equal(reports.length, 1, "unexpected HTTP failure reaches the shared notice owner once");
assert.equal(reports[0].status, 500);
assert.match(chats.items("c:new").map((item) => item.html).join(""), /Not sent.*data-chat-retry/);

const auth = chats.send("chats", "A disconnected agent");
await new Promise(setImmediate);
requests.at(-1).resolve(Response.json({ detail: { code: "auth_required", message: "Connect first" } }, { status: 409 }));
await auth;
assert.equal(reports.length, 1, "expected authentication rejection stays with the prompt UI");
assert.deepEqual(restored, ["A disconnected agent"]);
assert.equal(notices[0].text, "The agent isn't connected");

failNavigation = true;
const accepted = chats.send("chats", "Accepted before navigation fails");
await new Promise(setImmediate);
requests.at(-1).resolve(Response.json({ session_id: "accepted" }));
await accepted;
assert.equal(reports.at(-1) === navigationError, true, "the local failure reaches the shared notice owner");
assert.equal(reports.length, 2);
assert.deepEqual(restored, ["A disconnected agent"], "navigation failure cannot put an accepted message back");
assert.equal(notices.length, 1);
const html = chats.items("c:accepted").map((item) => item.html).join("");
assert.match(html, /Accepted before navigation fails/);
assert.doesNotMatch(html, /data-chat-retry/);

const later = chats.send("chats", "A receipt from an old mount");
await new Promise(setImmediate);
chats.dispose();
requests.at(-1).resolve(Response.json({ session_id: "late" }));
await later;
assert.equal(Boolean(sessions.late), false, "a disposed Chats owner cannot publish a prompt receipt");
assert.deepEqual(destinations, ["c:new"]);
assert.deepEqual(announcements, ["Sent."]);
