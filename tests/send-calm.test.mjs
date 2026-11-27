import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate, setInterval, setTimeout } from "node:timers";
import { ICON } from "../core/ui/icons/names.js";
import { deferred, dom, same } from "./lib/dom.mjs";

const markup = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const { document, window } = await dom(markup, { wholeDocument: true });
const encode = new TextEncoder();
let stream;
let sequence = 0;
const body = new ReadableStream({ start(controller) {
  stream = controller;
  stream.enqueue(encode.encode("event: heartbeat\ndata: {}\n\n"));
} });
const frame = (type, fields) => {
  const seq = ++sequence;
  stream.enqueue(encode.encode(`id: ${seq}\nevent: ${type}\ndata: ${JSON.stringify({ type, seq, ...fields })}\n\n`));
};
const reply = deferred();
const requests = [];
const frames = [];
const animations = [];
const matches = window.Element.prototype.matches;
window.Element.prototype.matches = function (selector) {
  if (selector === ":focus-within") return this.contains(document.activeElement);
  if (selector === ":focus-visible") return this === document.activeElement;
  return matches.call(this, selector);
};
window.HTMLElement.prototype.scrollTo = function () {};
window.HTMLElement.prototype.getAnimations = function () { return []; };
window.Element.prototype.animate = function (keyframes) {
  animations.push({ node: this, keyframes });
  return { finished: Promise.resolve(), cancel() {} };
};
const chats = [
  { id: "workspace-chat", kind: "workspace" },
  { id: "project-chat", kind: "project", project: "demo", routing: { mode: "agent" } },
];
const storage = new Map();
Object.assign(globalThis, {
  location: new URL("http://localhost/"),
  innerWidth: 1440,
  history: { replaceState() {}, pushState() {} },
  localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  MutationObserver: window.MutationObserver,
  ResizeObserver: class { observe() {} disconnect() {} },
  customElements: window.customElements,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  requestAnimationFrame: (callback) => frames.push(callback),
  cancelAnimationFrame() {},
  setInterval: (callback, ms) => setInterval(callback, ms).unref(),
  setTimeout: (callback, ms) => setTimeout(callback, ms).unref(),
  async fetch(input, init) {
    const path = new URL(input, location.href).pathname;
    if (path === "/api/chat/stream") return new Response(body);
    if (path === "/api/chat/chats") return Response.json({ chats });
    if (path === "/api/chat/router") return Response.json({ mode: "agent" });
    if (path === "/api/chat/chats/project-chat/messages" && init?.method === "POST") {
      requests.push(JSON.parse(init.body));
      return reply.promise;
    }
    if (path.endsWith("/messages")) return Response.json({ messages: [] });
    if (path.endsWith("/threads")) return Response.json({ threads: [] });
    if (path.endsWith("/sessions")) return Response.json({ sessions: [] });
    if (path.endsWith("/hops")) return Response.json({ hops: [] });
    if (path.endsWith("/runtime-policy")) return Response.json({ effective: {} });
    if (path.endsWith("/runtimes")) return Response.json({ runtimes: [] });
    if (path === "/api/chat/active") return Response.json({ turns: [] });
    if (path === "/api/advisory") return Response.json({ accounts: [] });
    if (path === "/api/chat/intent") return Response.json({ intents: [], pools: [] });
    if (path === "/api/chat/review") return Response.json({ items: [] });
    return Response.json({});
  },
});
await import("../boot.js");
const { publishedRules } = await import("./lib/css-snapshot.mjs");

async function paint() {
  await new Promise((resolve) => setImmediate(resolve));
  for (const callback of frames.splice(0)) callback(performance.now());
}
async function paintUntil(ready, description) {
  for (let attempt = 0; attempt < 100; attempt++) {
    await paint();
    if (ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(description);
}
function press(selector) {
  const node = document.querySelector(selector);
  assert.ok(node, selector);
  node.click();
}
await paint();
press('#side [data-go="p:demo"]');
await paint();

const say = document.querySelector("#say");
const send = document.querySelector("#send");
const list = document.querySelector("#msgs");
const draft = "Keep the optimistic message in the conversation.";
say.value = draft;
say.dispatchEvent(new window.Event("input", { bubbles: true }));
animations.length = 0;
assert.equal(send.disabled, false, "the project composer enables Send for the draft");
document.querySelector("#composer").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
await paint();
assert.equal(requests.length, 1, "the composer sends one real POST");
assert.equal(requests[0].text, draft);
const row = list.querySelector(".m-you.is-pending[data-k]");
assert.ok(row, "the optimistic row is visible while the POST is held");
const key = row.dataset.k;
assert.equal(row.querySelector(".bubble").textContent, draft);
assert.equal(row.querySelector(".meta.is-sending").textContent, "Sending");
assert.equal(row.querySelector(".meta.is-sending .spin").getAttribute("aria-hidden"), "true");
const motion = animations.find(({ node }) => node === row);
assert.ok(motion, "the optimistic row animates inside the message list");
assert.equal(motion.keyframes.at(-1).transform, "none");
assert.match(document.querySelector("#typing").textContent, /coordinator is replying/i);
press("#nv-chats");
await paintUntil(() => document.querySelector('#msgs .chl-row[data-go="ws"]'), "Chats shows the Workspace row");
press('#msgs .chl-row[data-go="ws"]');
await paint();
assert.doesNotMatch(document.querySelector("#typing").textContent, /coordinator is replying/i);
press('#side [data-go="p:demo"]');
await paint();
assert.match(document.querySelector("#typing").textContent, /coordinator is replying/i);
const returned = list.querySelector(`[data-k="${key}"]`);
assert.ok(returned?.classList.contains("is-pending"), "returning while the POST is held draws the same optimistic message");

const serverMessage = {
  id: "server-message", chat_id: "project-chat", author_kind: "owner", text: draft,
  seq: sequence + 1, created_at: new Date().toISOString(), client_id: requests[0].client_id,
};
reply.resolve(Response.json(serverMessage));
await paintUntil(() => Boolean(list.querySelector(".sent")), "the accepted POST draws its acknowledgement");
const acknowledged = list.querySelector(`[data-k="${key}"]`);
assert.ok(acknowledged, "the POST acknowledgement does not retire the optimistic row");
same(acknowledged, returned);
assert.equal(acknowledged.querySelector(".bubble").textContent, draft, "acknowledgement keeps the optimistic bubble");
assert.equal(acknowledged.querySelector(".sent").textContent.trim(), "Received by XO");
assert.equal(Boolean(acknowledged.querySelector(".is-sending")), false);
frame("message", { chat_id: "project-chat", data: serverMessage });
frame("reaction", { chat_id: "project-chat", data: { message_id: serverMessage.id, emoji: "👍" } });
await paintUntil(() => acknowledged.querySelector(".m-react")?.textContent === "👍", "the streamed reaction appears on the acknowledged row");
const copies = [...list.querySelectorAll(".m-you .bubble")].filter(({ textContent }) => textContent === draft);
assert.equal(copies.length, 1, "the drawn echo replaces the optimistic copy");
same(copies[0].closest("[data-k]"), acknowledged);
assert.equal(acknowledged.querySelector(".m-react")?.textContent, "👍", "the remaining row includes the server's data");

frame("session", {
  chat_id: "project-chat", session_id: "demo-coordinator",
  data: { reason: "created", role: "project-coordinator", status: "running" },
});
await paintUntil(() => send.getAttribute("aria-label") === "Stop the reply", "a running coordinator turns Send into Stop");
const expected = document.createElement("span");
expected.innerHTML = ICON.stop;
assert.equal(send.innerHTML, expected.innerHTML, "the wired Stop control uses the rounded-square glyph");
say.value = "Continue with this";
say.dispatchEvent(new window.Event("input", { bubbles: true }));
await paint();
assert.equal(send.classList.contains("is-stop"), false);
assert.equal(send.getAttribute("aria-label"), "Send");

const css = publishedRules();
function animation(selector) {
  return css.filter(({ sel }) => sel === selector).flatMap(({ declarations }) => declarations)
    .findLast(({ p }) => p === "animation")?.v;
}
assert.equal(animation(".meta.is-sending"), "fade var(--d-in) var(--ease) var(--d-wait) both");
assert.equal(animation(".m-you.is-pending .bubble"), "pend var(--d-in) var(--ease) var(--d-wait) forwards");
assert.equal(animation(".sent"), "fade var(--d-in) var(--ease)");
