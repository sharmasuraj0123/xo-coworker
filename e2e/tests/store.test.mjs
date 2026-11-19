// The fake Space's store and its HTTP server, without a browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createStore, answer, treeOf } from "../lib/store.mjs";
import { startSpace } from "../lib/space.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, "..", "..");
const basic = JSON.parse(readFileSync(join(DIR, "..", "seeds", "basic.json"), "utf8"));
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`ok ${name}`); };
const ask = (st, method, path, body = null) => { const u = new URL(path, "http://e2e"); return answer(st, { method, path: u.pathname, query: u.searchParams, body }); };

await test("an empty seed is the quiet Space: the Workspace and demo, no messages", () => {
  const st = createStore({});
  assert.deepEqual(st.chats.map((c) => [c.id, c.kind, c.project]), [["chat_ws", "workspace", null], ["chat_demo", "project", "demo"]]);
  assert.equal(ask(st, "GET", "/api/chat/chats/chat_demo/messages").answer.body.messages.length, 0);
  assert.equal(ask(st, "GET", "/api/chat/status").answer.status, 200);
});

await test("a seed's rows come back in xo-space's shapes, filled where the seed is short", () => {
  const st = createStore(basic);
  const { messages } = ask(st, "GET", "/api/chat/chats/chat_demo/messages").answer.body;
  assert.deepEqual(messages.map((m) => m.seq), [1, 2, 3]);
  assert.equal(messages[0].chat_id, "chat_demo");
  assert.deepEqual(messages[0].extra, {});
  const { threads } = ask(st, "GET", "/api/chat/chats/chat_demo/threads").answer.body;
  assert.equal(threads[0].title, "Tidy the README");
  assert.deepEqual(threads[0].outputs, []);
  const page = ask(st, "GET", "/api/chat/chats/chat_demo/messages?thread=cmsg_e2e_readme").answer.body.messages;
  assert.deepEqual(page.map((m) => m.thread_ts), ["cmsg_e2e_readme", "cmsg_e2e_readme"]);
  assert.equal(ask(st, "GET", "/api/chat/chats/chat_demo/threads/cmsg_e2e_readme").answer.body.ts, "cmsg_e2e_readme");
  assert.equal(ask(st, "GET", "/api/chat/chats/chat_nope/messages").answer.status, 404);
});

await test("the seed file is never changed by a run", () => {
  const seed = { messages: { chat_demo: [{ id: "a", text: "x" }] } };
  const st = createStore(seed);
  ask(st, "POST", "/api/chat/chats/chat_demo/messages", { text: "y" });
  assert.equal(seed.messages.chat_demo.length, 1);
});

await test("a post is stored with the next seq, answered with its row, and streamed as a message frame", () => {
  const st = createStore(basic);
  const { answer: a, frames } = ask(st, "POST", "/api/chat/chats/chat_demo/messages", { text: "hello", client_id: "c1" });
  assert.equal(a.status, 200);
  assert.equal(a.body.seq, 6, "after the seed's highest seq (5, in a thread)");
  assert.equal(a.body.client_id, "c1");
  assert.deepEqual(frames.map((f) => f.type), ["message"]);
  assert.equal(ask(st, "GET", "/api/chat/chats/chat_demo/messages").answer.body.messages.at(-1).text, "hello");
  assert.deepEqual(st.writes.map((w) => [w.method, w.path, !!w.unknown]), [["POST", "/api/chat/chats/chat_demo/messages", false]]);
});

await test("seen: a chat's mark is kept on its row", () => {
  const st = createStore(basic);
  assert.deepEqual(ask(st, "PUT", "/api/chat/chats/chat_demo/seen", {}).answer.body, { seen: { seen_at: basic.now, seen_seq: 5 } });
  assert.deepEqual(st.chats.find((c) => c.id === "chat_demo").seen, { seen_at: basic.now, seen_seq: 5 });
  assert.equal(ask(st, "PUT", "/api/chat/chats/nope/seen", {}).answer.status, 404);
});

await test("a write the seed doesn't answer is refused and kept, so the case fails on it", () => {
  const st = createStore({});
  assert.equal(ask(st, "DELETE", "/api/chat/chats/chat_demo").answer.status, 405);
  assert.equal(st.writes[0].unknown, true);
});

await test("a seed's own route wins over everything", () => {
  const st = createStore({ routes: { "GET /api/chat/status": { pools: ["mine"] } } });
  assert.deepEqual(ask(st, "GET", "/api/chat/status").answer.body, { pools: ["mine"] });
});

await test("files: the tree lists one level, sorted; a file reads with a version", () => {
  const files = basic.files.demo;
  assert.deepEqual(treeOf(files, ""), { dirs: [{ name: "src", relative_path: "src" }], files: [{ name: "README.md", relative_path: "README.md", size_bytes: Buffer.byteLength(files["README.md"]) }, { name: "notes.txt", relative_path: "notes.txt", size_bytes: 14 }] });
  assert.deepEqual(treeOf(files, "src").files.map((f) => f.relative_path), ["src/app.js"]);
  const st = createStore(basic);
  const f = ask(st, "GET", "/api/xo-projects/demo/file?relative_path=notes.txt").answer.body;
  assert.equal(f.content, "one\ntwo\nthree\n");
  assert.match(f.version, /^sha256:/);
  assert.equal(ask(st, "GET", "/api/xo-projects/demo/file?relative_path=nope").answer.status, 404);
});

await test("over HTTP: the app's files, the API, and a stream that opens with a snapshot and carries a post", async () => {
  const sp = await startSpace({ root: ROOT, seed: basic });
  try {
    const html = await fetch(sp.base + "/");
    assert.equal(html.status, 200);
    assert.match(await html.text(), /<html/i);
    assert.equal((await fetch(sp.base + "/../../etc/passwd")).status, 404);
    assert.equal((await fetch(sp.base + "/api/chat/chats")).status, 200);
    const ctl = new AbortController();
    const res = await fetch(sp.base + "/api/chat/stream", { signal: ctl.signal });
    const reader = res.body.getReader(), dec = new TextDecoder();
    let text = "";
    const until = async (re) => { while (!re.test(text)) { const { value, done } = await reader.read(); if (done) break; text += dec.decode(value); } };
    await until(/event: snapshot/);
    assert.match(text, /"seq":5/, "the snapshot stands where the store does");
    assert.equal(sp.open, 0, "the stream isn't counted as an open request");
    const post = await fetch(sp.base + "/api/chat/chats/chat_demo/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "over the wire" }) });
    assert.equal((await post.json()).seq, 6);
    await until(/event: message/);
    assert.match(text, /id: 6\nevent: message/, "the frame carries the message's own seq: one sequence, as in xo-space");
    ctl.abort();
  } finally { await sp.close(); }
});

console.log(`${passed} passed`);
