import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { view } from "../settings-view.js";
import { createAppsSettings } from "../settings.js";
import { FakeDoc, tick } from "./dom.mjs";

const WORD = JSON.parse(readFileSync(new URL("./fixtures/word.plugin.json", import.meta.url), "utf8"));
const base = { mode: "list", rows: [], loading: false, error: "", busy: "", source: "git", staged: null, appId: "", grantFor: "", activity: null, values: {}, off: "", waiting: "" };
const ctx = { projects: [{ id: "p1", name: "Book" }], project: "p1" };

assert.match(view(/** @type {any} */ ({ ...base }), ctx), /No apps yet/);
const evil = view(/** @type {any} */ ({ ...base, rows: [{ id: "x.y", name: "<img src=x onerror=alert(1)>", version: "1\"><b>" }] }), ctx);
assert.ok(!evil.includes("<img src=x") && evil.includes("&lt;img src=x onerror=alert(1)&gt;"), "names are escaped");
assert.ok(!evil.includes('1"><b>'));

const staged = { staging_id: "s1", sha256: "a".repeat(64), id: "dev.example.word", name: "Word", version: "0.3.0", publisher: "", commit: "0123456789abcdef", permissions: WORD.extensions["space.xo"].permissions, routes: [{ words: "Start threads and send messages in this project, as the app", routes: ["POST /api/chat/chats/{chat_id}/messages"] }], secrets: ["API_KEY"] };
const sheet = view(/** @type {any} */ ({ ...base, mode: "sheet", staged }), ctx);
assert.match(sheet, /Install Word\?/);
assert.match(sheet, /Unverified publisher/);
assert.match(sheet, /Read files in docs\/\*\*, \*\*\/\*\.word\.json/);
assert.match(sheet, /To open your documents\./);
assert.match(sheet, /Installing runs nothing/);
const buttons = (/** @type {string} */ h) => [...h.matchAll(/<button type="button" class="([^"]+)" data-act="([^"]+)"/g)].map((m) => [m[2], m[1]]);
assert.deepEqual(buttons(sheet), [["back", "btn"], ["confirm", "btn"]], "Install and Not now carry equal weight");

const row = { id: "dev.example.word", name: "Word", version: "0.3.0", manifest: WORD.extensions["space.xo"], manifest_sha: "f".repeat(64), projects: { p1: { state: "enabled" } } };
const page = view(/** @type {any} */ ({ ...base, mode: "app", appId: row.id, rows: [row], grantFor: "p1", values: { "dev.example.word|p1": { units: "px" }, "dev.example.word|p2": { units: "pt" } } }), ctx);
assert.match(page, /Turn Word on in Book\?/);
assert.match(page, /data-optional="composer.draft#0"/);
assert.deepEqual(buttons(page).filter(([a]) => a === "allow" || a === "cancel-grant").map(([, c]) => c), ["btn", "btn"]);
assert.match(page, /class="btn btn-danger" data-act="remove"/);
assert.match(page, /<option selected>px<\/option>/);

const doc = new FakeDoc();
const el = /** @type {any} */ (doc.createElement("div"));
doc.body.append(el);
/** @type {Record<string, any>} */
const inputs = { "#xa-git": { value: " https://github.com/me/xo-word " }, "#xa-ref": { value: "v0.3.0" } };
el.querySelector = (/** @type {string} */ s) => inputs[s] || null;
el.querySelectorAll = (/** @type {string} */ s) => (s.startsWith("input[data-optional]") ? [{ dataset: { optional: "composer.draft#0" } }] : []);
let rows = /** @type {any[]} */ ([]);
/** @type {any[]} */
const calls = [];
let ok = true;
/** @type {any[]} */
const confirms = [];
const client = /** @type {any} */ ({
  stage: async (src) => { calls.push(["stage", src]); return staged; },
  confirm: async (...a) => { calls.push(["confirm", ...a]); rows = [row]; },
  setGrant: async (...a) => { calls.push(["setGrant", ...a]); },
  revoke: async (...a) => { calls.push(["revoke", ...a]); },
  remove: async (...a) => { calls.push(["remove", ...a]); rows = []; },
  settings: async () => ({ values: { units: "pt" } }),
});
const S = createAppsSettings({ client, redraw: (e, html) => { /** @type {any} */ (e).html = html; }, projects: () => ctx.projects, confirm: async (/** @type {string} */ text, /** @type {any} */ o) => { confirms.push([text, o]); return ok; }, rows: () => rows, refresh: async () => {} });
S.loaded(false);
S.render(el, { project: "p1" });
/** @param {string} act @param {Record<string, string>} [data] */
const press = async (act, data = {}) => {
  const b = { dataset: { act, ...data }, disabled: false };
  el.contains = () => true;
  el.dispatch("click", { target: { closest: () => b } });
  await tick(); await tick();
};
await press("install");
assert.match(el.html, /Install an app/);
await press("stage");
assert.deepEqual(calls.at(-1), ["stage", { git: "https://github.com/me/xo-word", ref: "v0.3.0" }], "the client turns this into {source: {kind: \"git\", …}}");
assert.match(el.html, /Install Word\?/);
await press("confirm");
assert.deepEqual(calls.at(-1), ["confirm", "s1", "a".repeat(64)]);
assert.match(el.html, /<h3 class="xa-title"[^>]*>Word<\/h3>/);
await press("grant", { project: "p1" });
await press("allow", { project: "p1" });
assert.deepEqual(calls.at(-1), ["setGrant", "dev.example.word", "p1", { state: "enabled", permissions: [{ cap: "files.read", paths: ["docs/**", "**/*.word.json"], names: [] }, { cap: "files.write", paths: ["**/*.word.json"], names: [] }, { cap: "composer.draft", paths: [], names: [] }] }], "the required permissions and the picked optional one, by their caps and paths");
ok = false;
await press("remove");
assert.equal(calls.at(-1)[0], "setGrant", "No to the confirm removes nothing");
ok = true;
await press("remove");
assert.deepEqual(calls.at(-1), ["remove", "dev.example.word"]);
assert.deepEqual(confirms.at(-1)[1], { yes: "Remove", near: el }, "Remove asks inside Settings");
assert.match(el.html, /No apps yet/);
client.stage = async () => { throw new Error("needs XO apps contract >=0.2; this Space has 0.1"); };
await press("install");
await press("stage");
assert.match(el.html, /class="set-err" role="alert">needs XO apps contract/);

const el2 = /** @type {any} */ (doc.createElement("div"));
doc.body.append(el2);
el2.querySelector = (/** @type {string} */ q) => inputs[q] || null;
el2.querySelectorAll = () => [];
el2.contains = () => true;
let polls = 0, verdict = "applied";
/** @type {any[]} */
const opened = [];
rows = [];
const c2 = /** @type {any} */ ({
  stage: async () => staged,
  confirm: async () => ({ approval_id: "ap_1" }),
  approval: async (/** @type {string} */ id) => { assert.equal(id, "ap_1"); polls++; return { state: polls < 3 ? "pending" : verdict, result: verdict === "applied" ? { id: "dev.example.word", slug: "word", version: "0.3.0" } : null }; },
  setGrant: async () => ({ approval_id: "ap_1" }),
  settings: async () => ({}),
});
const S2 = createAppsSettings({ client: c2, redraw: (e, html) => { /** @type {any} */ (e).html = html; }, projects: () => ctx.projects, confirm: async () => true, rows: () => rows, refresh: async () => { if (polls >= 3 && verdict === "applied") rows = [row]; }, openPanel: (k, at) => opened.push([k, at.project]), wait: async () => { await tick(); assert.match(el2.html, /Waiting for your approval in Needs you/); assert.match(el2.html, /aria-busy="false"/, "waiting for a person is not loading"); } });
S2.loaded(false);
S2.render(el2, { project: "p1" });
const press2 = async (/** @type {string} */ act, data = {}) => { el2.dispatch("click", { target: { closest: () => ({ dataset: { act, ...data }, disabled: false }) } }); for (let i = 0; i < 8; i++) await tick(); };
await press2("install");
await press2("stage");
await press2("confirm");
assert.equal(polls, 3, "install waits for the owner's answer in Needs you");
assert.match(el2.html, /<h3 class="xa-title"[^>]*>Word<\/h3>/);
await press2("open-panel", { project: "p1" });
assert.deepEqual(opened, [["dev.example.word:outline", "p1"]], "Open shows the app's panel for that project");
polls = 0; verdict = "declined";
await press2("grant", { project: "p1" });
await press2("allow", { project: "p1" });
assert.match(el2.html, /You said not now/);
polls = 0; verdict = "mystery";
await press2("allow", { project: "p1" });
assert.match(el2.html, /couldn&#39;t tell what happened/, "a state XO doesn't know is never taken as a yes");
console.log("ok settings: install sheet, equal-weight choices, grants with picked optional permissions, remove asks first, errors in words");
