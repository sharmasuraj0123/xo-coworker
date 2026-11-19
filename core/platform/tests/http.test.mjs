// node core/platform/tests/http.test.mjs: requests, their errors, the Coder token, attachments, uploads and blobs, with fetch and XHR faked.
import assert from "node:assert/strict";

const replaced = [];
const store = new Map();
globalThis.location = /** @type {any} */ ({ href: "https://ws.example/app/?coder_session_token=TOK%2F1&x=1" });
globalThis.history = /** @type {any} */ ({ state: { s: 1 }, replaceState: (st, _t, url) => replaced.push([st, String(url)]) });
Object.defineProperty(globalThis, "sessionStorage", { value: { setItem: (k, v) => store.set(k, v), getItem: (k) => store.get(k) ?? null }, configurable: true });

/** @type {{ url: string, init: any }[]} */
let calls = [];
/** @type {(url: string, init: any) => any} */
let answer = () => res(200, "{}");
const res = (status, body, { type = "basic", statusText = "" } = {}) => ({
  ok: status >= 200 && status < 300, status, statusText, type,
  text: async () => body, json: async () => JSON.parse(body), blob: async () => ({ blob: body }),
});
globalThis.fetch = /** @type {any} */ (async (url, init) => {
  calls.push({ url, init });
  if (init.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
  return answer(url, init);
});

const A = await import("../api.js");
const H = await import("../http.js");
let passed = 0;
const t = async (name, fn) => { calls = []; await fn(); passed++; console.log("  ok  " + name); };
const pick = (e) => ({ status: e.status, code: e.code });
const rejects = async (p) => { try { await p; } catch (e) { return e; } assert.fail("did not reject"); };

await t("the token leaves the address bar, stays for the tab, and rides on every request", async () => {
  assert.deepEqual(replaced, [[{ s: 1 }, "https://ws.example/app/?x=1"]]);
  assert.equal(store.get("xo-coder-token"), "TOK/1");
  assert.deepEqual(A.coderHeaders(), { "Coder-Session-Token": "TOK/1" });
});
await t("request: page-relative URL, query without empty values, JSON body, no-store, manual redirects", async () => {
  answer = () => res(200, '{"ok":1}');
  assert.deepEqual(await A.request("/chat/x", { method: "POST", body: { a: 1 }, query: { q: "a b", e: "", n: null, z: 0 } }), { ok: 1 });
  const [{ url, init }] = calls;
  assert.equal(url, "api/chat/x?q=a+b&z=0");
  assert.equal(init.method, "POST");
  assert.equal(init.body, '{"a":1}');
  assert.equal(init.cache, "no-store");
  assert.equal(init.redirect, "manual");
  assert.deepEqual(init.headers, { "Content-Type": "application/json", "Coder-Session-Token": "TOK/1" });
  answer = () => res(200, "");
  assert.equal(await A.request("/empty", { headers: { "X-A": "1" } }), null);
  assert.deepEqual(calls[1].init.headers, { "Coder-Session-Token": "TOK/1", "X-A": "1" });
});
await t("request: the four error shapes, with storm's extras", async () => {
  answer = () => res(409, JSON.stringify({ detail: { code: "file_changed", message: "Changed.", current: { v: 2 }, other: 1 } }));
  let e = await rejects(A.request("/a"));
  assert.ok(e instanceof A.ApiError);
  assert.deepEqual([e.status, e.code, e.message, e.current, e.other], [409, "file_changed", "Changed.", { v: 2 }, undefined]);
  answer = () => res(422, JSON.stringify({ detail: [{ loc: ["body", "name"], msg: "required" }, { loc: ["q"], msg: "bad" }] }));
  e = await rejects(A.request("/a"));
  assert.deepEqual([e.code, e.message], ["http_422", "name: required; : bad"]);
  answer = () => res(400, JSON.stringify({ detail: "Plain words." }));
  e = await rejects(A.request("/a"));
  assert.deepEqual([e.code, e.message], ["http_400", "Plain words."]);
  answer = () => res(421, JSON.stringify({ error: "bad_host" }), { statusText: "Misdirected" });
  e = await rejects(A.request("/a"));
  assert.deepEqual([e.code, e.message], ["bad_host", "421 Misdirected"]);
  answer = () => res(500, "not json");
  e = await rejects(A.request("/a"));
  assert.deepEqual([e.code, e.message], ["http_500", "500 error"]);
});
await t("request: signed out, network and timeout read as words", async () => {
  answer = () => res(0, "", { type: "opaqueredirect" });
  assert.deepEqual(Object.values(pick(await rejects(A.request("/a")))), [401, "signed_out"]);
  answer = () => { throw new TypeError("Failed to fetch"); };
  assert.deepEqual(Object.values(pick(await rejects(A.request("/a")))), [0, "network"]);
  answer = (_u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("x"), { name: "AbortError" }))));
  const e = await rejects(A.request("/a", { timeout: 20 }));
  assert.deepEqual([e.code, e.message], ["timeout", "XO didn't answer in 0 s."]);
  const ctl = new AbortController();
  const p = A.request("/a", { signal: ctl.signal });
  ctl.abort();
  assert.equal((await rejects(p)).name, "AbortError", "the caller's own abort stays an abort");
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
  globalThis.XMLHttpRequest = /** @type {any} */ (class {
    constructor() { this.headers = {}; this.upload = {}; sent.push(this); }
    open(m, u) { this.m = m; this.u = u; }
    setRequestHeader(k, v) { this.headers[k] = v; }
    send(b) { this.body = b; }
    abort() { this.onabort(); }
  });
  const progress = [];
  const up = A.uploadAttachment("c", { type: "", size: 9 }, "a b.png", { onProgress: (s, n) => progress.push([s, n]) });
  const x = sent[0];
  assert.deepEqual([x.m, x.u, x.headers], ["POST", "api/chat/chats/c/attachments?name=a%20b.png", { "Coder-Session-Token": "TOK/1", "Content-Type": "application/octet-stream" }]);
  x.upload.onprogress({ loaded: 3, lengthComputable: false });
  assert.deepEqual(progress, [[3, 9]]);
  Object.assign(x, { status: 200, responseText: '{"id":"a1"}' }); x.onload();
  assert.deepEqual(await up.promise, { id: "a1" });
  const up2 = A.uploadAttachment("c", { type: "image/png", size: 1 }, "x");
  Object.assign(sent[1], { status: 413, statusText: "Too big", responseText: JSON.stringify({ detail: { code: "too_large", message: "Too large." } }) }); sent[1].onload();
  const e = await rejects(up2.promise);
  assert.deepEqual([e.status, e.code, e.message, sent[1].headers["Content-Type"]], [413, "too_large", "Too large.", "image/png"]);
  const up3 = A.uploadAttachment("c", { type: "", size: 1 }, "x");
  up3.abort();
  assert.equal((await rejects(up3.promise)).name, "AbortError");
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
  for (const p of [A.api.projectImage("p", "x.png"), A.attachmentText("c", "a"), A.request("/a")]) {
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
console.log(`\n${passed} passed`);
