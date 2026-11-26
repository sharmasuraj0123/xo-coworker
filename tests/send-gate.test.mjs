import assert from "node:assert/strict";
import { createHerald } from "../core/services/notices.js";
import { createDelivery } from "../modules/conversation/delivery.js";
import { createFileQuestion } from "../modules/conversation/file-question.js";
import { createFileReferences } from "../modules/conversation/file-references.js";
import { createLocalMessages } from "../modules/conversation/local-messages.js";
import { deferred, dom, same, settle } from "./lib/dom.mjs";

const { document } = await dom('<textarea></textarea><button id="send">Send</button><div id="messages"></div>');
const say = document.querySelector("textarea");
const send = document.querySelector("#send");
const msgs = document.querySelector("#messages");
const S = { view: "t:active" };
const localMessages = createLocalMessages();
const fileReferences = createFileReferences();
const thread = { id: "active", project: "demo", title: "Active" };
const state = {
  loaded: true,
  router: { mode: "off" },
  projects: [{ id: "workspace", name: "Workspace" }, { id: "demo", name: "Demo", routing: { mode: "agent" } }],
};
const requests = [];
let chatBlock = "";
const notices = { herald: null };
const announcements = [];
const herald = createHerald({ state: notices, setTimer: () => 0, clearTimer() {} });
const rendered = [];
const deliveryScope = new AbortController();
const noticeWrites = [];
let scheduled = 0;
const provider = (kind) => (recipient, text, options) => {
  const answer = deferred();
  requests.push({ kind, recipient, text, options, answer });
  return answer.promise;
};
const K = { get view() { return S.view; }, say, send, conv: { msgs, follow: { toLatest: () => rendered.push("follow") } } };
const delivery = createDelivery({
  view: () => S.view, signal: deliveryScope.signal, localMessages, fileReferences, world: { state, act: { ask: provider("ask"), reply: provider("reply") } },
  MK: K, say, CH: { isChats: (view) => view.startsWith("c:"), blocked: () => chatBlock, send: (view, text) => requests.push({ view, text }) },
  STAGE: { resumeFollow() {} },
  PROJ: (id) => id === "demo" ? "Demo" : id,
  chatOf: () => "demo", convOfChat: (id) => "p:" + id,
  convThread: (view) => view === "t:active" ? thread : null, composerAt: () => K,
  filesHere: () => ({ count: 0 }), tray: {}, dropThumb() {},
  saveDraft() {}, updateComposer() {}, growSay() {}, announce: (message) => announcements.push(message), schedule() { scheduled++; }, go() {},
  render: () => rendered.push(localMessages.list(S.view).at(-1)?.text),
  heraldShow: (...args) => { noticeWrites.push("show"); return herald.show(...args); },
  heraldFor: (...args) => { noticeWrites.push("replace"); return herald.forMsg(...args); },
});

fileReferences.set(S.view, { path: "notes.md", a: 2, b: 4, name: "notes.md" });
say.value = "@workspace keep these words";
delivery.send();
await settle();
assert.equal(requests.length, 0, "the draft uses the explicitly targeted Workspace gate");
assert.equal(say.value, "@workspace keep these words");
assert.match(notices.herald?.text ?? "", /^Not sent: The router is off/, "the Workspace refusal appears in the shared notice");

say.value = "A reply that bypasses routing";
send.focus();
delivery.send();
await settle();
assert.equal(requests[0].kind, "reply");
assert.equal(requests[0].recipient, thread.id);
assert.equal(requests[0].text, "notes.md:2-4\n\nA reply that bypasses routing");
assert.equal(fileReferences.get(S.view), undefined, "the reference is consumed by an accepted send");
assert.deepEqual(rendered, [requests[0].text, "follow"]);
same(document.activeElement, say);
requests[0].answer.resolve({});
await settle();

fileReferences.set(S.view, { path: "notes.md", a: null, b: null, name: "notes.md" });
say.value = "@demo What about this project?";
delivery.send();
await settle();
const first = requests[1];
assert.equal(first.kind, "ask");
assert.equal(first.recipient, "demo");
assert.equal(first.text, "What about this project?");
assert.equal(fileReferences.get(S.view)?.path, "notes.md", "the thread retains its reference after a send to a different conversation");
assert.equal(notices.herald.text, "Sending to Demo…");
first.answer.reject(Object.assign(new Error("connection lost"), { status: 502 }));
await settle();
const failed = localMessages.list("p:demo")[0];
assert.equal(failed.status, "failed");
assert.equal(notices.herald.text, "Not sent: Can't reach XO");
assert.equal(notices.herald.sub, "open the conversation to retry");

say.value = "@workspace a different draft";
delivery.retry(failed.id);
await settle();
assert.equal(requests.length, 3, "Retry uses the failed send's destination");
const retry = requests[2];
assert.equal(retry.recipient, "demo");
assert.equal(retry.text, first.text);
assert.equal(retry.options.clientId, first.options.clientId);
assert.equal(say.value, "@workspace a different draft");
assert.equal(notices.herald.text, "Sending to Demo…");
retry.answer.resolve({});
await settle();
assert.equal(notices.herald.text, "Sent to Demo");
assert.equal(notices.herald.sub, "open to follow the reply");

say.value = "@demo Keep these words for another try";
delivery.send();
await settle();
requests.at(-1).answer.reject(Object.assign(new Error("connection lost"), { status: 502 }));
await settle();
const blocked = localMessages.list("p:demo").at(-1);
const routing = state.projects.find(({ id }) => id === "demo").routing;
routing.mode = "off";
delivery.retry(blocked.id);
await settle();
assert.equal(requests.length, 4, "a retry blocked at its original destination sends nothing");
assert.equal(blocked.status, "failed");
assert.match(notices.herald.text, /Not sent: Routing is off for this chat/);
assert.match(announcements.at(-1), /Not sent: Routing is off for this chat/);
routing.mode = "agent";

S.view = "c:plain";
say.value = "Direct chat";
assert.deepEqual(delivery.connDest(), { thread: true, pool: undefined });
delivery.send();
assert.deepEqual(requests.at(-1), { view: "c:plain", text: "Direct chat" });

chatBlock = "This chat has ended";
say.value = "Keep the direct draft";
delivery.send();
assert.equal(requests.at(-1).text, "Direct chat", "a refused direct chat issues no request");
assert.equal(say.value, "Keep the direct draft");
assert.match(announcements.at(-1), /Not sent: This chat has ended/);
assert.match(notices.herald.text, /Not sent: This chat has ended/);

S.view = "t:active";
const file = { project: "demo", rel: "notes.md" };
const fileSends = [];
const fileQuestion = createFileQuestion({
  view: () => S.view, localMessages, fileReferences, world: { state }, PROJ: (id) => id, convOfChat: (id) => "p:" + id,
  blockFor: delivery.blockFor, refuse: delivery.refuse,
  deliverLive: (message) => fileSends.push(message), schedule() {}, heraldShow: herald.show,
});
routing.mode = "off";
assert.equal(fileQuestion.askAboutLines(file, 2, 4, "What changed?"), false, "file actions check the file's project routing");
assert.equal(fileSends.length, 0, "a thread's allowed reply cannot authorize sending to the file's project");
assert.match(notices.herald.text, /Not sent: Routing is off for this chat/);
routing.mode = "agent";
assert.equal(fileQuestion.askAboutLines(file, 2, 4, "What changed?"), true);
assert.equal(fileSends[0].target, "demo");
assert.equal(fileSends[0].text, "notes.md:2-4\n\nWhat changed?");

say.value = "Send before disposal";
delivery.send();
say.value = "@demo Server refusal after disposal";
delivery.send();
await settle();
const [lateSuccess, lateRefusal] = requests.slice(-2);
assert.equal(lateSuccess.kind, "reply");
assert.equal(lateRefusal.kind, "ask");
deliveryScope.abort();
const previous = { announcements: announcements.length, notices: noticeWrites.length, scheduled };
lateSuccess.answer.resolve({});
lateRefusal.answer.reject(Object.assign(new Error("late refusal"), { status: 502 }));
await settle();
assert.equal(announcements.length, previous.announcements, "retired delivery never calls the announcer");
assert.equal(noticeWrites.length, previous.notices, "retired delivery never calls the notice owner");
assert.equal(scheduled, previous.scheduled, "retired delivery never requests a render");
