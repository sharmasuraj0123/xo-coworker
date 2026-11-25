// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createChats } from "../chats.js";
import { reconcile } from "../../../core/ui/redraw.js";

const { document } = await dom('<div id="msgs"></div>');
const box = document.getElementById("msgs");
const data = Array.from({ length: 100 }, (_, i) => ({
  id: `chat-${i}`, native_id: `native-${i}`, role: "plain", state: "idle", created_at: new Date(i).toISOString(), cwd: null,
}));
const waiting = new Map();
const requests = [];
let peak = 0;
let listReads = 0;
globalThis.fetch = async (url, options) => {
  const { pathname: path, searchParams } = new URL(String(url), "https://xo.test/");
  if (path === "/api/chat/sessions") {
    listReads++;
    assert.equal(searchParams.get("role"), "plain");
    return Response.json({ sessions: data });
  }
  const id = path.split("/").at(-1);
  const response = Promise.withResolvers();
  requests.push(id);
  waiting.set(id, response);
  peak = Math.max(peak, waiting.size);
  options?.signal?.addEventListener("abort", () => response.reject(options.signal.reason), { once: true });
  try { return await response.promise; }
  finally { waiting.delete(id); }
};

/** @type {(entries: {target: Element, isIntersecting: boolean}[]) => void} */
let visibility;
const observed = new Set();
Object.assign(globalThis, { IntersectionObserver: class {
  constructor(fn) { visibility = fn; }
  observe(node) { observed.add(node); }
  unobserve(node) { observed.delete(node); }
  disconnect() { observed.clear(); }
} });
const sessions = Object.create(null);
let consumer;
let publish;
let view = "chats";
let render = () => {};
const chats = createChats({
  world: {
    state: { sessions, projects: [] }, project: () => null,
    act: { sentAt: () => ({ at: 0, seq: null }), noteSession: (session) => { sessions[session.id] = session; } },
    onEvent(fn) { consumer = fn; return () => { consumer = undefined; }; },
    subscribe(fn) { publish = fn; return () => { publish = undefined; }; },
  },
  view: () => view, announce() {}, heraldShow() {}, go() {}, schedule: () => render(),
}, { dayGroup: () => "Today", rowTime: () => "", cliName: () => "", heldBadge: () => "", heldShort: () => "",
  chatOrder: (prompts) => prompts.map((m) => ({ kind: "you", m })),
  turnHtml: () => "", turnAv: () => "" });
render = () => { reconcile(box, chats.items(view), { quiet: true }); };
chats.showAll(true);
chats.open("chats");
chats.open("chats");
await new Promise(setImmediate);
assert.equal(listReads, 1);
const rows = [...box.querySelectorAll(".chl-row")];
assert.equal(rows.length, 100);
assert.equal(requests.length, 0, "the list renders without fetching any offscreen history");
const inView = (targets, isIntersecting) => visibility(targets.map((target) => ({ target, isIntersecting })));
inView(rows.slice(0, 6), true);
await new Promise(setImmediate);
assert.equal(requests.length, 4);
inView([rows[4]], false);
const first = rows[0];
first.focus();
const firstRequest = requests[0];
const history = (title) => ({ messages: [{ id: "prompt", data: { role: "user" }, parts: [{ data: { type: "text", text: title } }] }] });
waiting.get(firstRequest).resolve(Response.json(history("A title from history")));
await new Promise(setImmediate);
assert.equal(requests.length, 5, "only the waiting row still in view starts when a slot frees");
assert.equal(peak, 4);
assert.equal(first.querySelector(".chl-t").textContent, "A title from history");
assert.equal(document.activeElement === first, true);
assert.equal(box.querySelector(".chl-row") === first, true);
assert.equal(requests.includes(rows[4].dataset.go.replace("c:chat-", "native-")), false);

const secondRequest = requests[1];
const secondRowKey = rows[1].dataset.go;
chats.showAll(false);
chats.showAll(true);
await new Promise(setImmediate);
const remounted = box.querySelector(`[data-go="${secondRowKey}"]`);
assert.equal(remounted !== rows[1], true);
inView([remounted], true);
waiting.get(requests[3]).resolve(Response.json(history("Another chat")));
await new Promise(setImmediate);
assert.equal(requests.filter((id) => id === secondRequest).length, 1, "remounting a row shares the session's pending read");
waiting.get(secondRequest).resolve(Response.json(history("The replacement row's title")));
await new Promise(setImmediate);
assert.equal(remounted.querySelector(".chl-t").textContent, "The replacement row's title");

chats.leaveList();
await new Promise(setImmediate);
assert.equal(waiting.size, 0);
assert.equal(observed.size, 0);

view = "chats";
chats.search("A cold query's title");
assert.match(box.textContent, /Searching chat titles/);
await new Promise(setImmediate);
assert.equal(waiting.size, 4, "search starts bounded discovery before intersection");
const [found] = waiting.keys();
waiting.get(found).resolve(Response.json(history("A cold query's title")));
await new Promise(setImmediate);
assert.equal(box.querySelector(".chl-t")?.textContent, "A cold query's title");
const foundId = found.replace("native-", "chat-");
sessions[foundId] = { ...sessions[foundId], native_id: "replacement" };
publish();
render();
assert.equal(box.querySelector(".chl-row") !== null, false, "the old title cannot match after its native session changes");
const [next] = waiting.keys();
waiting.get(next).resolve(Response.json(history("An unrelated title")));
await new Promise(setImmediate);
assert.equal(waiting.has("replacement"), true, "search reads the replacement native session");
waiting.get("replacement").resolve(Response.json(history("A cold query's title, revised")));
await new Promise(setImmediate);
assert.equal(box.querySelector(".chl-t")?.textContent, "A cold query's title, revised");
assert.equal(peak, 4);
view = "home";
publish();
await new Promise(setImmediate);
assert.equal(waiting.size, 0, "leaving Chats cancels in-flight title discovery");
const afterExit = requests.length;
await new Promise(setImmediate);
assert.equal(requests.length, afterExit, "queued discovery cannot start after leaving");

view = "c:chat-99";
chats.open(view);
await new Promise(setImmediate);
waiting.get("native-99").resolve(Response.json(history("The complete chat")));
await new Promise(setImmediate);
const beforeTurn = requests.length;
consumer({ kind: "chat_turn_finished", session: "chat-98" });
assert.equal(requests.length, beforeTurn);
consumer({ kind: "chat_turn_finished", session: "chat-99" });
await new Promise(setImmediate);
assert.equal(requests.length, beforeTurn + 1, "the matching finish event reads history on that event loop turn");
consumer({ kind: "chat_turn_finished", session: "chat-99" });
consumer({ kind: "chat_turn_finished", session: "chat-99" });
waiting.get("native-99").resolve(Response.json(history("A second turn")));
await new Promise(setImmediate);
assert.equal(requests.length, beforeTurn + 2, "finishes during a pending read request one fresh read after it");
sessions["chat-99"] = { ...sessions["chat-99"], native_id: "new-native-99" };
waiting.get("native-99").resolve(Response.json(history("An answer from the previous native session")));
await new Promise(setImmediate);
assert.equal(requests.at(-1), "new-native-99", "a superseded read triggers a read of the current native session");
render();
assert.doesNotMatch(box.textContent, /previous native session/);
waiting.get("new-native-99").resolve(Response.json(history("The current native conversation")));
await new Promise(setImmediate);
assert.match(box.textContent, /The current native conversation/);

let now = Date.now();
const clock = Date.now;
const logError = console.error;
const reported = [];
Date.now = () => now;
console.error = (error) => reported.push(error.code);
sessions["chat-99"] = { ...sessions["chat-99"], native_id: "retry-native", cwd: undefined };
publish();
await new Promise(setImmediate);
const failedSession = waiting.get("chat-99");
assert.ok(failedSession, "the changed identifier must read the session before its history");
failedSession.resolve(Response.json({ detail: { code: "session_read_failed" } }, { status: 500 }));
await new Promise(setImmediate);
const failedCount = requests.length;
for (let i = 0; i < 5; i++) publish();
await new Promise(setImmediate);
assert.equal(requests.length, failedCount, "ordinary stream updates do not retry a failed detail read immediately");
assert.deepEqual(reported, ["session_read_failed"]);
assert.match(box.textContent, /The current native conversation/, "the last good drawing survives a failed read");
now += 1200;
publish();
await new Promise(setImmediate);
assert.equal(requests.length, failedCount + 1, "a later stream update retries the same identifier");
waiting.get("chat-99").resolve(Response.json({ ...sessions["chat-99"], cwd: null }));
await new Promise(setImmediate);
waiting.get("retry-native").resolve(Response.json(history("Conversation recovered")));
await new Promise(setImmediate);
assert.match(box.textContent, /Conversation recovered/);
Date.now = clock;
console.error = logError;

consumer({ kind: "chat_turn_finished", session: "chat-99" });
await new Promise(setImmediate);
assert.equal(waiting.has("retry-native"), true);
chats.dispose();
await new Promise(setImmediate);
assert.equal(waiting.size, 0);
