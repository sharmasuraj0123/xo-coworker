// @ts-check

// The fake Space's store and its HTTP server, without a browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isResponseObject } from "../../core/platform/http.js";
import { createStore, answer, treeOf } from "../lib/store.mjs";
import { startSpace } from "../lib/space.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, "..", "..");
const basic = JSON.parse(readFileSync(join(DIR, "..", "seeds", "basic.json"), "utf8"));
let passed = 0;
const test = async (/** @type {string} */ name, /** @type {() => unknown} */ fn) => { await fn(); passed++; console.log(`ok ${name}`); };
/** @param {import("../lib/types.d.ts").Store} st @param {string} method @param {string} path @param {unknown} body */
function ask(st, method, path, body = null) {
  const u = new URL(path, "http://e2e");
  return answer(st, { method, path: u.pathname, query: u.searchParams, body });
}
/** @param {unknown} value */
function record(value) { assert.ok(isResponseObject(value)); return value; }
/** @param {unknown} value */
function records(value) { assert.ok(Array.isArray(value)); return value.map(record); }

await test("an empty seed is the quiet Space: the Workspace and demo, no messages", () => {
  const st = createStore({});
  assert.deepEqual(st.chats.map((c) => [c.id, c.kind, c.project]), [["chat_ws", "workspace", null], ["chat_demo", "project", "demo"]]);
  assert.equal(records(record(ask(st, "GET", "/api/chat/chats/chat_demo/messages").answer.body).messages).length, 0);
  assert.equal(ask(st, "GET", "/api/chat/status").answer.status, 200);
});

await test("a seed's rows come back in xo-space's shapes, filled where the seed is short", () => {
  const st = createStore(basic);
  const messages = records(record(ask(st, "GET", "/api/chat/chats/chat_demo/messages").answer.body).messages);
  assert.deepEqual(messages.map((m) => m.seq), [1, 2, 3]);
  assert.equal(messages[0].chat_id, "chat_demo");
  assert.deepEqual(messages[0].extra, {});
  const threads = records(record(ask(st, "GET", "/api/chat/chats/chat_demo/threads").answer.body).threads);
  assert.equal(threads[0].title, "Tidy the README");
  assert.deepEqual(threads[0].outputs, []);
  const page = record(ask(st, "GET", "/api/chat/chats/chat_demo/messages?thread=cmsg_e2e_readme").answer.body);
  assert.deepEqual(records(page.messages).map((m) => m.thread_ts), ["cmsg_e2e_readme", "cmsg_e2e_readme"]);
  assert.equal(record(ask(st, "GET", "/api/chat/chats/chat_demo/threads/cmsg_e2e_readme").answer.body).ts, "cmsg_e2e_readme");
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
  assert.equal(record(a.body).seq, 6, "after the seed's highest seq (5, in a thread)");
  assert.equal(record(a.body).client_id, "c1");
  assert.deepEqual(frames.map((f) => f.type), ["message"]);
  assert.equal(records(record(ask(st, "GET", "/api/chat/chats/chat_demo/messages").answer.body).messages).at(-1)?.text, "hello");
  assert.deepEqual(st.writes.map((w) => [w.method, w.path, !!w.unknown]), [["POST", "/api/chat/chats/chat_demo/messages", false]]);
});

await test("seen: a chat's mark is kept on its row", () => {
  const st = createStore(basic);
  assert.deepEqual(ask(st, "PUT", "/api/chat/chats/chat_demo/seen", {}).answer.body, { seen: { seen_at: basic.now, seen_seq: 5 } });
  assert.deepEqual(st.chats.find((c) => c.id === "chat_demo")?.seen, { seen_at: basic.now, seen_seq: 5 });
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

await test("a quiet Space has no active turns and demo has no linked GitHub repository", () => {
  const st = createStore(basic);
  assert.deepEqual(ask(st, "GET", "/api/chat/active").answer, { status: 200, body: { turns: [] } });
  assert.deepEqual(ask(st, "GET", "/api/xo-projects/demo/github/issues").answer, {
    status: 200, body: { project_id: "demo", repo: null, fetched_at: null, error: null,
      issues: [], tracked: 0, untracked: 0, state: "no_remote" },
  });
  assert.deepEqual(st.misses, []);
});

await test("files: the tree lists one level, sorted; a file reads with a version", () => {
  const files = basic.files.demo;
  assert.deepEqual(treeOf(files, ""), { dirs: [{ name: "src", relative_path: "src" }], files: [{ name: "README.md", relative_path: "README.md", size_bytes: Buffer.byteLength(files["README.md"]) }, { name: "notes.txt", relative_path: "notes.txt", size_bytes: 14 }] });
  assert.deepEqual(treeOf(files, "src").files.map((f) => f.relative_path), ["src/app.js"]);
  const st = createStore(basic);
  const f = record(ask(st, "GET", "/api/xo-projects/demo/file?relative_path=notes.txt").answer.body);
  assert.equal(f.content, "one\ntwo\nthree\n");
  assert.ok(typeof f.version === "string");
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
    const reader = /** @type {ReadableStream<Uint8Array>} */ (res.body).getReader(), dec = new TextDecoder();
    let text = "";
    const until = async (/** @type {RegExp} */ re) => { while (!re.test(text)) { const { value, done } = await reader.read(); if (done) break; text += dec.decode(value); } };
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

await test("a seeded project's deploy check says it needs preparing; another project's is a 404", () => {
  const st = createStore(basic);
  const c = record(ask(st, "GET", "/api/deploy/demo/check").answer.body);
  assert.equal(c.project, "demo");
  assert.equal(c.state, "needs-agent");
  assert.equal(ask(st, "GET", "/api/deploy/nope/check").answer.status, 404);
});

await test("a read the seed doesn't answer is a 404 and kept, so the case fails on it", () => {
  const st = createStore({});
  assert.equal(ask(st, "GET", "/api/chat/nope").answer.status, 404);
  assert.deepEqual(st.misses, ["GET /api/chat/nope"]);
});

await test("seed rows keep their order: a missing seq follows the row before it; out of order or reused is refused", () => {
  const chats = [{ id: "a", kind: "project", project: "a" }, { id: "b", kind: "project", project: "b" }];
  const st = createStore({ chats, messages: { a: [{ id: "1" }, { id: "2", seq: 7 }, { id: "3" }], b: [{ id: "4", seq: 20 }] } });
  assert.deepEqual(st.messages.a.map((m) => m.seq), [1, 7, 8]);
  assert.equal(st.seq, 20);
  const both = createStore({ chats, messages: { a: [{ id: "1" }, { id: "2" }], b: [{ id: "3" }] }, threadMessages: { t: [{ id: "4", chat_id: "a" }] } });
  assert.deepEqual([...both.messages.a, ...both.messages.b, ...both.threadMessages.t].map((m) => m.seq), [1, 2, 3, 4], "rows without seqs are numbered once across the whole seed");
  assert.throws(() => createStore({ chats, messages: { a: [{ id: "1", seq: 5 }, { id: "2", seq: 3 }] } }), /seq 3 after 5/);
  assert.throws(() => createStore({ chats, messages: { a: [{ id: "1", seq: 5 }], b: [{ id: "2", seq: 5 }] } }), /seq 5 is used twice/);
});

await test("a seeded project with no files has an empty tree; an unknown project's is a 404", () => {
  const st = createStore({});
  assert.deepEqual(ask(st, "GET", "/api/xo-projects/demo/tree").answer.body, {
    project_id: "demo", relative_path: "", parent_relative_path: null, dirs: [], files: [],
  });
  assert.equal(ask(st, "GET", "/api/xo-projects/demo/file?relative_path=a.md").answer.status, 404);
  assert.equal(ask(st, "GET", "/api/xo-projects/nope/tree").answer.status, 404);
});

await test("over HTTP: a path is decoded once; a bad one is answered, never a crash", async () => {
  const sp = await startSpace({ root: ROOT, seed: { chats: [{ id: "chat%x", kind: "project", project: "p" }], messages: { "chat%x": [{ id: "m", text: "hi" }] } } });
  try {
    const r = await fetch(sp.base + "/api/chat/chats/chat%25x/messages");
    assert.equal(r.status, 200);
    assert.equal((await r.json()).messages[0].text, "hi");
    assert.equal((await fetch(sp.base + "/%E0%A4%A")).status, 400);
    assert.equal((await fetch(sp.base + "/api/chat/chats/%E0%A4%A/messages")).status, 500);
    assert.equal(sp.errors.length, 1, "the Space's own failure is kept for the case");
    assert.equal(sp.open, 0);
  } finally { await sp.close(); }
});

await test("over HTTP: a client that goes away mid-body leaves no request open", async () => {
  const { request } = await import("node:http");
  const sp = await startSpace({ root: ROOT, seed: basic });
  try {
    const u = new URL(sp.base);
    const req = request({ host: u.hostname, port: u.port, method: "POST", path: "/api/chat/chats/chat_demo/messages", headers: { "Content-Type": "application/json", "Content-Length": "100" } });
    req.on("error", () => {});
    req.write('{"text":');
    while (sp.open === 0) await new Promise((ok) => setImmediate(ok));
    req.destroy();
    assert.equal(await sp.idle(2000), true, "idle() resolves once the request is gone");
    assert.equal(sp.store.messages.chat_demo.length, 3, "no message made from a body that never arrived");
    assert.deepEqual(sp.store.writes, []);
    assert.deepEqual(sp.errors, []);
  } finally { await sp.close(); }
});

await test("over HTTP: a stream resumed with Last-Event-ID gets the frames after it, not a snapshot", async () => {
  const sp = await startSpace({ root: ROOT, seed: basic });
  try {
    sp.push("pool", { pool: "x" });
    sp.push("pool", { pool: "y" });
    const ctl = new AbortController();
    const res = await fetch(sp.base + "/api/chat/stream", { headers: { "Last-Event-ID": "6" }, signal: ctl.signal });
    const reader = /** @type {ReadableStream<Uint8Array>} */ (res.body).getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    assert.match(text, /^id: 7\nevent: pool/);
    assert.doesNotMatch(text, /snapshot|id: 6/);
    ctl.abort();
  } finally { await sp.close(); }
});

await test("over HTTP: a body that isn't JSON is a 400 and a Space error, never an empty write", async () => {
  const sp = await startSpace({ root: ROOT, seed: basic });
  try {
    const r = await fetch(sp.base + "/api/chat/chats/chat_demo/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json" });
    assert.equal(r.status, 400);
    assert.equal(sp.errors.length, 1);
    assert.equal(sp.store.messages.chat_demo.length, 3);
    assert.deepEqual(sp.store.writes, []);
  } finally { await sp.close(); }
});

await test("over HTTP: a resume that missed nothing gets its headers at once, then only heartbeats", async () => {
  const sp = await startSpace({ root: ROOT, seed: basic });
  try {
    const ctl = new AbortController();
    const res = await fetch(sp.base + "/api/chat/stream", { headers: { "Last-Event-ID": "5" }, signal: AbortSignal.any([ctl.signal, AbortSignal.timeout(2000)]) });
    assert.equal(res.status, 200);
    assert.match(String(res.headers.get("content-type")), /^text\/event-stream/);
    ctl.abort();
  } finally { await sp.close(); }
});

await test("over HTTP: a gated path waits until it is released; served counts every answered request", async () => {
  const sp = await startSpace({ root: ROOT, seed: basic });
  try {
    const before = sp.served;
    const release = sp.gate("/api/chat/chats");
    let answered = false;
    const p = fetch(sp.base + "/api/chat/chats").then((r) => { answered = true; return r.json(); });
    while (sp.open === 0) await new Promise((ok) => setImmediate(ok));
    assert.equal(answered, false);
    release();
    assert.equal((await p).chats.length, 2);
    await (await fetch(sp.base + "/favicon.svg")).arrayBuffer();
    assert.equal(await sp.idle(1000), true);
    assert.equal(sp.served - before, 2);
  } finally { await sp.close(); }
});

console.log(`${passed} passed`);
