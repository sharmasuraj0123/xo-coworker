// node core/platform/tests/http.test.mjs: requests, their errors, the Coder token, attachments, uploads and blobs, with fetch and XHR faked.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock } from "node:test";

const replaced = [];
const store = new Map();
globalThis.location = { href: "https://ws.example/app/?coder_session_token=TOK%2F1&x=1" };
globalThis.history = { state: { s: 1 }, replaceState: (st, _t, url) => replaced.push([st, String(url)]) };
Object.defineProperty(globalThis, "sessionStorage", { value: { setItem: (k, v) => store.set(k, v), getItem: (k) => store.get(k) ?? null }, configurable: true });

let calls = [];
let answer = () => res(200, "{}");
const res = (status, body, { type = "basic", statusText = "" } = {}) => ({
  ok: status >= 200 && status < 300, status, statusText, type,
  text: async () => body, json: async () => JSON.parse(body), blob: async () => ({ blob: body }),
});
globalThis.fetch = async (url, init) => {
  calls.push({ url, init });
  if (init.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
  return answer(url, init);
};

const A = await import("../api.js");
const H = await import("../http.js");
let passed = 0;
const t = async (name, fn) => { calls = []; await fn(); passed++; console.log("  ok  " + name); };
const pick = (e) => ({ status: e.status, code: e.code });
const rejects = async (p) => { try { await p; } catch (e) { return e; } assert.fail("did not reject"); };

await t("the token leaves the address bar, stays for the tab, and rides on every request", async () => {
  assert.deepEqual(replaced, []);
  assert.deepEqual(A.coderHeaders(), {});
  H.captureCoderToken();
  assert.deepEqual(replaced, [[{ s: 1 }, "https://ws.example/app/?x=1"]]);
  assert.equal(store.get("xo-coder-token"), "TOK/1");
  assert.deepEqual(A.coderHeaders(), { "Coder-Session-Token": "TOK/1" });
});
await t("request: page-relative URL, query without empty values, JSON body, no-store, manual redirects", async () => {
  answer = () => res(200, '{"ok":1}');
  assert.deepEqual(await H.requestJson("/chat/x", { method: "POST", body: { a: 1 }, query: { q: "a b", e: "", n: null, z: 0 } }), { ok: 1 });
  const [{ url, init }] = calls;
  assert.equal(url, "api/chat/x?q=a+b&z=0");
  assert.equal(init.method, "POST");
  assert.equal(init.body, '{"a":1}');
  assert.equal(init.cache, "no-store");
  assert.equal(init.redirect, "manual");
  assert.deepEqual(init.headers, { "Content-Type": "application/json", "Coder-Session-Token": "TOK/1" });
  answer = () => res(200, "");
  assert.equal(await H.requestJson("/empty", { headers: { "X-A": "1" } }), null);
  assert.deepEqual(calls[1].init.headers, { "Coder-Session-Token": "TOK/1", "X-A": "1" });
});
await t("request: the four error shapes, with storm's extras", async () => {
  answer = () => res(409, JSON.stringify({ detail: { code: "file_changed", message: "Changed.", current: { v: 2 }, other: 1 } }));
  let e = await rejects(H.requestJson("/a"));
  assert.ok(e instanceof A.ApiError);
  assert.deepEqual([e.status, e.code, e.message, e.current, e.other], [409, "file_changed", "Changed.", { v: 2 }, undefined]);
  answer = () => res(422, JSON.stringify({ detail: [{ loc: ["body", "name"], msg: "required" }, { loc: ["q"], msg: "bad" }] }));
  e = await rejects(H.requestJson("/a"));
  assert.deepEqual([e.code, e.message], ["http_422", "name: required; : bad"]);
  answer = () => res(400, JSON.stringify({ detail: "Plain words." }));
  e = await rejects(H.requestJson("/a"));
  assert.deepEqual([e.code, e.message], ["http_400", "Plain words."]);
  answer = () => res(421, JSON.stringify({ error: "bad_host" }), { statusText: "Misdirected" });
  e = await rejects(H.requestJson("/a"));
  assert.deepEqual([e.code, e.message], ["bad_host", "421 Misdirected"]);
  answer = () => res(500, "not json");
  e = await rejects(H.requestJson("/a"));
  assert.deepEqual([e.code, e.message], ["http_500", "500 error"]);
});
await t("a malformed successful JSON answer reports the invalid response", async () => {
  answer = () => res(200, "not json");
  assert.deepEqual(pick(await rejects(H.requestJson("/a"))), { status: 200, code: "bad_answer" });
  answer = () => res(204, "");
  assert.equal(await H.requestJson("/a"), null);
});
await t("the status route checks its response before returning it", async () => {
  const fixture = readFileSync(new URL("./fixtures/chat-status.json", import.meta.url), "utf8");
  answer = () => res(200, fixture);
  assert.deepEqual(await A.api.status(), JSON.parse(fixture));
  assert.equal(calls[0].url, "api/chat/status");
  for (const payload of ["null", '{"pools":{}}', '{"pools":[{"id":42}]}', '{"pools":[{"id":"pool","state":{}}]}']) {
    answer = () => res(200, payload);
    assert.equal((await rejects(A.api.status())).code, "bad_answer");
  }
});
await t("request: signed out, network and timeout read as words", async () => {
  answer = () => res(0, "", { type: "opaqueredirect" });
  assert.deepEqual(Object.values(pick(await rejects(H.requestJson("/a")))), [401, "signed_out"]);
  answer = () => { throw new TypeError("Failed to fetch"); };
  assert.deepEqual(Object.values(pick(await rejects(H.requestJson("/a")))), [0, "network"]);
  answer = (_u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("x"), { name: "AbortError" }))));
  const e = await rejects(H.requestJson("/a", { timeout: 20 }));
  assert.deepEqual([e.code, e.message], ["timeout", "XO didn't answer in 0 s."]);
  const ctl = new AbortController();
  const p = H.requestJson("/a", { signal: ctl.signal });
  ctl.abort();
  assert.equal((await rejects(p)).name, "AbortError", "the caller's own abort stays an abort");
});
await t("an already cancelled request does not dispatch in any fetch adapter", async () => {
  answer = () => res(200, "{}");
  const ctl = new AbortController();
  const reason = new Error("read retired");
  ctl.abort(reason);
  const { signal } = ctl;
  const reads = [
    H.requestJson("/a", { signal }),
    H.text("/a", { signal }), H.blob("/a", { signal }),
  ];
  const outcomes = await Promise.allSettled(reads);
  assert.equal(calls.length, 0);
  assert.deepEqual(outcomes, reads.map(() => ({ status: "rejected", reason })));
});
await t("a successful JSON body delivered after the deadline is retired", async () => {
  answer = (_url, { signal }) => ({
    ...res(200, "{}"),
    text: () => new Promise((resolve) => signal.addEventListener("abort", () => resolve("{}"), { once: true })),
  });
  const error = await rejects(H.requestJson("/a", { timeout: 20 }));
  assert.deepEqual(pick(error), { status: 0, code: "timeout" });
});
await t("a held unsuccessful body still follows the deadline", async () => {
  answer = (_url, { signal }) => ({
    ...res(422, ""),
    text: () => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })),
  });
  assert.deepEqual(pick(await rejects(H.requestJson("/a", { timeout: 20 }))), { status: 0, code: "timeout" });
});
await t("text and blob bodies delivered after their deadlines are retired", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    for (const [kind, read, ms] of [
      ["text", () => H.text("/a"), 30000],
      ["blob", () => H.blob("/a", { ms: 20 }), 20],
    ]) {
      const { promise: reading, resolve: started } = Promise.withResolvers();
      const { promise: body, resolve: deliver } = Promise.withResolvers();
      answer = () => ({ ...res(200, ""), [kind]: () => { started(); return body; } });
      const pending = read();
      await reading;
      mock.timers.tick(ms);
      deliver(kind === "blob" ? new Blob(["late"]) : "late");
      assert.deepEqual(pick(await rejects(pending)), { status: 0, code: "timeout" });
    }
  } finally {
    mock.timers.reset();
  }
});
await t("caller cancellation during an error body has priority over the status", async () => {
  for (const read of [H.requestJson, H.text, H.blob]) {
    const ctl = new AbortController();
    const reason = new Error("retired during body");
    const { promise: reading, resolve: started } = Promise.withResolvers();
    const { promise: body, resolve: deliver } = Promise.withResolvers();
    answer = () => ({ ...res(422, ""), text: () => { started(); return body; } });
    const pending = read("/a", { signal: ctl.signal });
    await reading;
    ctl.abort(reason);
    deliver('{"detail":"late validation failure"}');
    await assert.rejects(pending, (error) => error === reason);
  }
});
await t("validation details use only string or numeric locations and string messages", async () => {
  const malformed = [{ loc: ["body", { toString: 0 }], msg: "invalid" }, { loc: ["body", "name"], msg: { toString: 0 } }];
  answer = () => res(422, JSON.stringify({ detail: malformed }), { statusText: "Unprocessable Content" });
  const fallback = await rejects(H.requestJson("/a"));
  assert.ok(fallback instanceof H.ApiError);
  assert.deepEqual([fallback.status, fallback.code, fallback.message], [422, "http_422", "422 Unprocessable Content"]);
  answer = () => res(422, JSON.stringify({ detail: [...malformed, { loc: ["body", "names", 0], msg: "required" }] }));
  const valid = await rejects(H.requestJson("/a"));
  assert.equal(valid.message, "names.0: required");
});
await t("a request serialization failure is local and never reaches fetch", async () => {
  const error = new TypeError("body cannot be serialized");
  const body = { toJSON() { throw error; } };
  await assert.rejects(H.requestJson("/a", { body, method: "POST" }), (e) => e === error);
  assert.equal(calls.length, 0);
});
await t("missingRoute: a bare 404 or a 405, never a route's own 404", async () => {
  assert.equal(A.missingRoute({ status: 405 }), true);
  assert.equal(A.missingRoute({ status: 404, code: "http_404" }), true);
  assert.equal(A.missingRoute({ status: 404 }), true);
  assert.equal(A.missingRoute({ status: 404, code: "not_found" }), false);
  assert.equal(A.missingRoute(null), false);
});
await t("attachments: a signed URL, its text, and a socket URL", async () => {
  assert.equal(A.attachmentUrl("c/1", "a 1"), "api/chat/chats/c%2F1/attachments/a%201?coder_session_token=TOK%2F1");
  assert.equal(A.terminalSocketUrl("t1"), "wss://ws.example/app/api/terminal/sessions/t1/ws?coder_session_token=TOK%2F1");
  answer = () => res(200, "hello");
  assert.equal(await A.attachmentText("c", "a"), "hello");
  assert.equal(calls[0].url, "api/chat/chats/c/attachments/a");
  assert.deepEqual([calls[0].init.headers, calls[0].init.redirect, calls[0].init.cache], [{ "Coder-Session-Token": "TOK/1" }, "manual", undefined]);
  answer = () => res(404, JSON.stringify({ detail: { code: "no_attachment", message: "Gone." } }));
  const e = await rejects(A.attachmentText("c", "a"));
  assert.deepEqual([e.status, e.code, e.message], [404, "no_attachment", "Gone."]);
  answer = () => { throw new TypeError("x"); };
  assert.equal((await rejects(A.attachmentText("c", "a"))).code, "network");
});
await t("a project image comes as a Blob, its errors as ApiErrors", async () => {
  answer = () => res(200, "PNG");
  assert.deepEqual(await A.api.projectImage("p", "a/b.png"), { blob: "PNG" });
  assert.equal(calls[0].url, "api/xo-projects/p/image?relative_path=a%2Fb.png");
  assert.equal(calls[0].init.cache, "no-store");
  answer = () => res(404, JSON.stringify({ detail: { code: "not_found", message: "No such file." } }));
  const e = await rejects(A.api.projectImage("p", "x.png"));
  assert.deepEqual([e.status, e.code, e.message], [404, "not_found", "No such file."]);
  answer = () => res(403, "nope", { statusText: "Forbidden" });
  assert.equal((await rejects(A.api.projectImage("p", "x.png"))).message, "403 Forbidden");
});
await t("an upload sends raw bytes with the token, reports progress and reads its answer", async () => {
  const sent = [];
  globalThis.XMLHttpRequest = class {
    constructor() { this.headers = {}; this.upload = {}; sent.push(this); }
    open(m, u) { this.m = m; this.u = u; }
    setRequestHeader(k, v) { this.headers[k] = v; }
    send(b) { this.body = b; }
    abort() { this.onabort(); }
  };
  const progress = [];
  const up = A.uploadAttachment("c", { type: "", size: 9 }, "a b.png", { onProgress: (s, n) => progress.push([s, n]) });
  const x = sent[0];
  assert.deepEqual([x.m, x.u, x.headers], ["POST", "api/chat/chats/c/attachments?name=a%20b.png", { "Coder-Session-Token": "TOK/1", "Content-Type": "application/octet-stream" }]);
  x.upload.onprogress({ loaded: 3, lengthComputable: false });
  assert.deepEqual(progress, [[3, 9]]);
  const uploaded = { id: "a1", name: "a b.png", type: "image/png", bytes: 9, w: 8, h: 12, tint: "#345678" };
  Object.assign(x, { status: 200, responseText: JSON.stringify(uploaded) }); x.onload();
  assert.deepEqual(await up.promise, uploaded);
  const up2 = A.uploadAttachment("c", { type: "image/png", size: 1 }, "x");
  Object.assign(sent[1], { status: 413, statusText: "Too big", responseText: JSON.stringify({ detail: { code: "too_large", message: "Too large." } }) }); sent[1].onload();
  const e = await rejects(up2.promise);
  assert.deepEqual([e.status, e.code, e.message, sent[1].headers["Content-Type"]], [413, "too_large", "Too large.", "image/png"]);
  const up3 = A.uploadAttachment("c", { type: "", size: 1 }, "x");
  up3.abort();
  assert.equal((await rejects(up3.promise)).name, "AbortError");
  const malformed = A.uploadAttachment("c", { type: "", size: 1 }, "x");
  Object.assign(sent[3], { status: 200, responseText: '{"id":"missing-name"}' }); sent[3].onload();
  assert.equal((await rejects(malformed.promise)).code, "bad_answer");
});
await t("one error parser: blobs, texts and uploads read every error shape as requests do, extras and all", async () => {
  answer = () => res(421, JSON.stringify({ error: "bad_host" }), { statusText: "Misdirected" });
  let e = await rejects(A.api.projectImage("p", "x.png"));
  assert.deepEqual([e.status, e.code, e.message], [421, "bad_host", "421 Misdirected"]);
  answer = () => res(422, JSON.stringify({ detail: [{ loc: ["query", "relative_path"], msg: "required" }] }));
  e = await rejects(A.api.projectImage("p", "x.png"));
  assert.deepEqual([e.code, e.message], ["http_422", "relative_path: required"]);
  answer = () => res(409, JSON.stringify({ detail: { code: "changed", message: "Changed.", current: { v: 3 } } }));
  e = await rejects(A.api.projectImage("p", "x.png"));
  assert.deepEqual([e.code, e.current], ["changed", { v: 3 }]);
  e = await rejects(A.attachmentText("c", "a"));
  assert.deepEqual([e.code, e.current], ["changed", { v: 3 }]);
});
await t("a failed answer whose body can't be read keeps its status: blobs, texts and requests alike", async () => {
  const broken = (status) => ({ ...res(status, "", { statusText: "Gone" }), text: async () => { throw new TypeError("body stream broke"); }, json: async () => { throw new TypeError("body stream broke"); } });
  answer = () => broken(410);
  for (const p of [A.api.projectImage("p", "x.png"), A.attachmentText("c", "a"), H.requestJson("/a")]) {
    const e = await rejects(p);
    assert.deepEqual([e.status, e.code, e.message], [410, "http_410", "410 Gone"]);
  }
});
await t("signed and socket URLs keep a query the path already has, and add the token to it", async () => {
  assert.equal(H.signedUrl("/x/file?relative_path=a%2Fb.png&hidden=true"), "api/x/file?relative_path=a%2Fb.png&hidden=true&coder_session_token=TOK%2F1");
  assert.equal(H.signedUrl("/x"), "api/x?coder_session_token=TOK%2F1");
  assert.equal(H.socketUrl("/t/ws?cols=80"), "wss://ws.example/app/api/t/ws?cols=80&coder_session_token=TOK%2F1");
});
await t("clientId: fresh each time, ui_ prefixed", async () => {
  const a = A.clientId(), b = A.clientId();
  assert.match(a, /^ui_[0-9a-z]+_[0-9a-z]{1,8}$/);
  assert.notEqual(a, b);
});
await t("the stream's URL is page-relative", async () => assert.equal(A.api.streamUrl(), "api/chat/stream"));
await t("a boot without a token in the URL reads the current tab's stored token", async () => {
  globalThis.location.href = "https://ws.example/app/?keep=1";
  store.set("xo-coder-token", "saved");
  H.captureCoderToken();
  assert.deepEqual(H.coderHeaders(), { "Coder-Session-Token": "saved" });
  assert.equal(replaced.length, 1);
  store.clear();
  H.captureCoderToken();
  assert.deepEqual(H.coderHeaders(), {});
});
console.log(`\n${passed} passed`);
