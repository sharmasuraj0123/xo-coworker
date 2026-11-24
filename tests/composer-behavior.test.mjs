// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setTimeout as delay, setInterval as interval } from "node:timers";
import { dom } from "./lib/dom.mjs";

const { window, document } = await dom(readFileSync(new URL("../index.html", import.meta.url), "utf8"));
const storage = new Map([["cv-drafts:live", JSON.stringify({ ws: "Workspace draft", home: "Home draft" })]]);
const posts = [];
const stops = [];
const uploads = [];
const thread = { ts: "thread-1", chat_id: "chat-demo", title: "Composer fixture", state: "working" };
const timers = [];
let phone = false;
const frames = new Map();
let frameId = 0;
const stream = new ReadableStream({ start(controller) {
  controller.enqueue(new TextEncoder().encode('event: snapshot\ndata: {"data":{"seq":0}}\n\n'));
} });

const match = window.Element.prototype.matches;
window.Element.prototype.matches = function (selector) {
  return selector === ":focus-within" ? this.contains(document.activeElement) : match.call(this, selector);
};
window.HTMLElement.prototype.scrollTo = function ({ top }) { this.scrollTop = top; };
Object.assign(globalThis, {
  location: new URL("http://localhost/"),
  innerWidth: 1440,
  history: { replaceState() {}, pushState() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  MutationObserver: window.MutationObserver,
  ResizeObserver: class { observe() {} disconnect() {} },
  customElements: window.customElements,
  getComputedStyle: window.getComputedStyle,
  XMLHttpRequest: class {
    upload = {};
    status = 200;
    responseText = JSON.stringify({ id: "attached", name: "notes.txt", type: "text/plain", bytes: 4 });
    open(method, path) {
      const url = new URL(path, location.href);
      uploads.push({ method, path: url.pathname + url.search });
    }
    setRequestHeader() {}
    send() { uploads.at(-1).complete = () => this.onload(); }
  },
  matchMedia: (query) => ({ get matches() { return query === "(prefers-reduced-motion: reduce)" || (query === "(max-width: 760px)" && phone); }, addEventListener() {}, removeEventListener() {} }),
  requestAnimationFrame: (fn) => { frames.set(++frameId, fn); return frameId; },
  cancelAnimationFrame: (id) => frames.delete(id),
  setInterval: (fn, ms) => interval(fn, ms).unref(),
  setTimeout: (fn, ms) => {
    if (ms === 3000) timers.push(fn);
    return delay(ms === 3000 ? () => {} : fn, ms).unref();
  },
  fetch: async (input, options) => {
    const path = new URL(String(input), location.href).pathname;
    if (path === "/api/chat/stream") return new Response(stream, { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/chat/chats") return Response.json({ chats: [{ kind: "workspace", id: "chat-ws" }, { kind: "project", id: "chat-demo", project: "demo" }] });
    if (path === "/api/chat/chats/chat-demo/threads") return Response.json({ threads: [thread] });
    if (path === "/api/chat/chats/chat-demo/threads/thread-1") return Response.json(thread);
    if (path === "/api/chat/sessions") return Response.json({ sessions: [{ id: "session-ws", chat_id: "chat-ws", role: "workspace-coordinator", state: "running" }] });
    if (path === "/api/chat/active") return Response.json({ turns: [{ turn_id: "turn-ws", session_id: "session-ws", chat_id: "chat-ws" }] });
    if (path === "/api/chat/abort") {
      stops.push(JSON.parse(options.body));
      return Response.json({ stopped: true });
    }
    if (path === "/api/chat/chats/chat-ws/messages" && options?.method === "POST") {
      const post = JSON.parse(options.body);
      posts.push(post);
      if (posts.length === 1) return Response.json({ detail: { code: "unavailable", message: "Try again" } }, { status: 503 });
      return Response.json({ id: "message-sent", seq: 1, author_kind: "owner", text: post.text, client_id: post.client_id });
    }
    return Response.json({});
  },
});

async function draw() {
  await new Promise((resolve) => delay(resolve, 0));
  for (const id of [...frames.keys()]) {
    const frame = frames.get(id);
    frames.delete(id);
    frame?.(performance.now());
  }
}
function element(selector) {
  const node = document.querySelector(selector);
  assert.ok(node, selector);
  return node;
}
function press(selector, pointerType = "mouse") {
  const event = new window.Event("click", { bubbles: true, cancelable: true });
  element(selector).dispatchEvent(Object.assign(event, { pointerType }));
}
function submit() {
  element("#composer").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
}
function write(text) {
  say.value = text;
  say.dispatchEvent(new window.Event("input", { bubbles: true }));
}

await import("../boot.js");
await draw();
const say = element("#say");
assert.equal(say.value, "Home draft");
press("#nv-ws");
assert.equal(say.value, "Workspace draft");
assert.ok(document.activeElement === element("#scroller"), "a conversation opens on its landmark");
write("Keep my Workspace draft");
assert.equal(JSON.parse(storage.get("cv-drafts:live")).ws, "Keep my Workspace draft");
press("#nv-home");
assert.equal(say.value, "Home draft");
phone = true;
globalThis.innerWidth = 390;
press("#nv-ws");
assert.ok(document.activeElement === element("#scroller"), "touch navigation opens on the conversation landmark");
assert.equal(say.value, "Keep my Workspace draft");

say.focus();
say.selectionStart = 3;
say.setSelectionRange = (start) => { say.selectionStart = start; };
write("@de");
const mention = element('#at-list [data-pid="demo"]');
assert.equal(say.getAttribute("aria-activedescendant"), mention.id);
mention.dispatchEvent(new window.Event("mousedown", { bubbles: true, cancelable: true }));
assert.equal(say.value, "@demo ");
assert.equal(JSON.parse(storage.get("cv-drafts:live")).ws, "@demo ");
assert.equal(say.getAttribute("aria-expanded"), "false");
assert.ok(document.activeElement === say, "choosing a target leaves focus in the composer");
write("Keep my Workspace draft");

const send = element("#send");
const fileInput = element("#att-input");
fileInput.files = [new File(["note"], "notes.txt", { type: "text/plain" })];
fileInput.dispatchEvent(new window.Event("change", { bubbles: true }));
assert.equal(uploads[0]?.path, "/api/chat/chats/chat-ws/attachments?name=notes.txt");
const remove = element('#att-tray [data-a="x"]');
remove.focus();
assert.equal(send.disabled, true, "Send waits for the upload");
uploads[0].complete();
await draw();
assert.ok(document.activeElement === remove, "an upload paints its receipt in place");
assert.ok(remove === element('#att-tray [data-a="x"]'), "the attachment control survives redraw");
assert.equal(send.disabled, false);
send.focus();
submit();
assert.ok(document.activeElement === say, "Send hands focus back to the composer");
await draw();
assert.equal(posts.length, 1);
assert.equal(posts[0].text, "Keep my Workspace draft");
assert.deepEqual(posts[0].attachments, ["attached"]);
const retry = element("#msgs [data-retry]");
const row = retry.closest("[data-k]");
const scroller = element("#scroller");
Object.defineProperties(scroller, { scrollHeight: { value: 2400 }, clientHeight: { value: 600 } });
scroller.getBoundingClientRect = () => ({ top: 0 });
scroller.scrollTop = 1800;
scroller.dispatchEvent(new window.Event("scroll"));
scroller.scrollTop = 120;
scroller.dispatchEvent(new window.Event("scroll"));
row.getBoundingClientRect = () => {
  const top = (row.contains(retry) ? 12 : 52) - (scroller.scrollTop - 120);
  return { top, bottom: top + 50, height: 50 };
};
retry.focus();
press("#msgs [data-retry]");
assert.ok(document.activeElement === say, "Retry hands focus back to the composer");
await draw();
assert.equal(posts.length, 2);
assert.deepEqual(posts[1], posts[0], "Retry sends the same words and client ID");
assert.ok(row === element(`#msgs [data-k="${row.dataset.k}"]`), "success updates the existing optimistic row");
assert.equal(say.value, "");
assert.equal(scroller.scrollTop, 160, "the reading row stays at the same viewport position after redraw");

assert.equal(send.dataset.mode, "stop");
const beforeStop = timers.length;
submit();
await draw();
assert.deepEqual(stops, [], "Stop waits for its Undo window");
assert.equal(element("[data-herald-undo]").textContent, "Undo");
assert.equal(timers.length, beforeStop + 1);
press("[data-herald-undo]");
await timers.at(-1)();
await draw();
assert.deepEqual(stops, [], "Undo cancels the pending Stop");

submit();
await draw();
assert.equal(timers.length, beforeStop + 2);
await timers.at(-1)();
await draw();
assert.deepEqual(stops, [{ session_id: "session-ws" }]);

phone = false;
globalThis.innerWidth = 1440;
press('#side [data-go="p:demo"]');
press("[data-stage-open]");
press('#stage [data-go="t:thread-1"]');
await draw();
await draw();
assert.ok(document.activeElement === element("#tsay"), "desktop panel entry focuses its composer");
assert.match(element("#ttarget").textContent, /Reply in this thread/);
const threadSay = element("#tsay");
threadSay.placeholder = "";
threadSay.dispatchEvent(new window.Event("input", { bubbles: true }));
assert.equal(threadSay.placeholder, "Reply to the agent…");
press("[data-stg-sections]");
phone = true;
globalThis.innerWidth = 390;
press("[data-stage-open]", "touch");
press('#stage [data-go="t:thread-1"]', "touch");
await draw();
await draw();
assert.ok(document.activeElement === element("#tsay"), "touch panel entry currently focuses its composer");
