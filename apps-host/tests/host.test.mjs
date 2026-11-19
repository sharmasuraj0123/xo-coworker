import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createKernel } from "../../core/kernel/index.js";
import { definePlaces } from "../../shell/places.js";
import { createAppsHost, MANIFEST } from "../host.js";
import { FakeDoc, tick, message } from "./dom.mjs";

const WORD = JSON.parse(readFileSync(new URL("./fixtures/word.plugin.json", import.meta.url), "utf8"));
assert.deepEqual(JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8")), { ...MANIFEST }, "module.json is the module's manifest");

let rows = [{ id: "dev.example.word", name: "Word", version: "0.3.0", state: "installed", manifest: WORD.extensions["space.xo"], projects: { p1: { state: "enabled", permissions: [{ cap: "files.read" }, { cap: "composer.draft" }, { cap: "context.update" }] }, p2: { state: "disabled" } } }];
/** @type {any[]} */
const calls = [];
const client = /** @type {any} */ (new Proxy({}, { get: (_t, k) => async (...a) => { calls.push([k, ...a]); if (k === "list") return { apps: rows }; if (k === "resource") return { contents: [{ uri: a[1], text: "<p>view</p>" }] }; if (k === "prompt") return { text: "Tighten the selected paragraph." }; return {}; } }));
const doc = new FakeDoc();
/** @type {any[]} */
const drafts = [], opened = [], asked = [], contexts = [];
let yes = true;
const win = Object.assign(new EventTarget(), { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval, open: () => null });
const K = createKernel({ warn: () => {}, log: () => {} });
definePlaces(K);
K.register(createAppsHost({
  client, doc: /** @type {any} */ (doc), win: /** @type {any} */ (win), redraw: (el, html) => { /** @type {any} */ (el).html = html; },
  projects: () => [{ id: "p1", name: "Book" }, { id: "p2", name: "Site" }],
  draft: (t, at) => drafts.push([t, at.project]), openPanel: (k, at) => opened.push([k, at.project]), confirm: async (text, o) => { asked.push([text, o]); return yes; }, context: (id, at, p) => contexts.push([id, at.project, p]),
}));
const report = await K.start();
assert.deepEqual(report.failed, []);
assert.equal(K.status("xo.apps-host"), "active");

const P = K.places;
assert.ok(P.get("settings.section", "apps"), "Settings › Apps is a settings section");
assert.ok(P.get("conversation.block", "app"), "one renderer draws every app's cards");
const p1 = { project: "p1", view: "thread" }, p2 = { project: "p2", view: "thread" };
assert.deepEqual(P.entries("panel.page", p1).map((e) => e.id), ["dev.example.word:outline"]);
assert.deepEqual(P.entries("panel.page", p2), [], "off in p2: nothing shows there");
assert.deepEqual(P.entries("panel.page", {}), [], "outside a project: nothing shows");
assert.deepEqual(P.entries("header.action", p1).map((e) => e.id), ["dev.example.word:open-outline"]);
assert.deepEqual(P.entries("command", p1).map((e) => e.id), ["dev.example.word:delete", "dev.example.word:new", "dev.example.word:tighten"]);
assert.deepEqual(P.entries("command", { project: "p1", view: "project" }).map((e) => e.id), ["dev.example.word:delete", "dev.example.word:new"], "a when clause hides /tighten outside threads");
assert.deepEqual(P.entries("decision.evidence", p1).map((e) => e.id), ["dev.example.word:pick"]);

const kind = /** @type {any} */ (P.first("files.viewer.kind", p1));
assert.equal(kind.id, "dev.example.word:editor");
assert.equal(kind.accepts({ path: "docs/a.word.json" }, p1), true);
assert.equal(kind.accepts({ path: "docs/a.md" }, p1), false);
assert.equal(kind.accepts({ path: "docs/a.word.json" }, p2), false);

/** @type {any} */ (P.get("header.action", "dev.example.word:open-outline")).onPress(p1);
assert.deepEqual(opened, [["dev.example.word:outline", "p1"]]);
await /** @type {any} */ (P.get("command", "dev.example.word:tighten")).run(p1);
assert.deepEqual(drafts, [["Tighten the selected paragraph.", "p1"]], "a prompt command drafts; nothing sends itself");
await /** @type {any} */ (P.get("command", "dev.example.word:new")).run(p1, { title: "x" });
assert.deepEqual(calls.find((c) => c[0] === "call").slice(1), ["dev.example.word", { project: "p1" }, "word_create", { title: "x" }, { confirm: false }]);

yes = false;
await assert.rejects(/** @type {any} */ (P.get("command", "dev.example.word:delete")).run(p1), /you said no/);
assert.match(asked.at(-1)[0], /Word wants to run word_delete/);
assert.deepEqual(asked.at(-1)[1], { yes: "Run it", near: null }, "a command has no view to ask beside");
assert.ok(!calls.some((c) => c[0] === "call" && c[3] === "word_delete"), "a destructive command never runs without a yes");
yes = true;
await /** @type {any} */ (P.get("command", "dev.example.word:delete")).run(p1);
assert.deepEqual(calls.at(-1).slice(3), ["word_delete", {}, { confirm: true }]);

const host = doc.createElement("div");
doc.body.append(host);
const unmount = /** @type {any} */ (P.get("panel.page", "dev.example.word:outline")).mount(host, p1);
await tick(); await tick();
assert.ok(calls.some((c) => c[0] === "viewOpened"));
assert.ok(calls.some((c) => c[0] === "resource" && c[2] === "ui://dev.example.word/outline"));
const iframe = host.find((n) => n.tagName === "IFRAME");
assert.ok(iframe && iframe.srcdoc.includes("<p>view</p>"));
const vw = iframe.contentWindow;
iframe.dispatch("load");
const say = async (/** @type {any} */ m) => { win.dispatchEvent(message({ jsonrpc: "2.0", ...m }, vw)); for (let i = 0; i < 6; i++) await tick(); };
await say({ id: 1, method: "ui/initialize", params: {} });
await say({ method: "ui/notifications/initialized" });
yes = true;
await say({ id: 2, method: "tools/call", params: { name: "word_delete", arguments: {} } });
assert.equal(asked.at(-1)[1].yes, "Run it");
assert.equal(asked.at(-1)[1].near, host, "a view's destructive tool asks beside the view");
await say({ id: 3, method: "ui/open-link", params: { url: "https://example.com/a" } });
assert.deepEqual([asked.at(-1)[0], asked.at(-1)[1].yes, asked.at(-1)[1].near === host], ["Open https://example.com/a?", "Open", true]);
await say({ id: 4, method: "ui/message", params: { role: "user", content: [{ type: "text", text: "Tighten §2" }] } });
assert.deepEqual(drafts.at(-1), ["Tighten §2", "p1"], "a draft goes to the composer where the view is");
await say({ id: 5, method: "ui/update-model-context", params: { content: [{ type: "text", text: "§2" }] } });
assert.deepEqual(contexts.at(-1), ["dev.example.word", "p1", { content: [{ type: "text", text: "§2" }], structuredContent: undefined }], "context goes through with where the view is");
unmount();
assert.ok(calls.some((c) => c[0] === "viewClosed"));

const keep = doc.createElement("div");
doc.body.append(keep);
/** @type {any} */ (P.get("panel.page", "dev.example.word:outline")).mount(keep, p1);
await tick(); await tick();
assert.ok(keep.find((n) => n.tagName === "IFRAME"));
rows = [{ ...rows[0], projects: { ...rows[0].projects, p2: { state: "enabled", permissions: [] } } }];
K.bus.emit("apps:refresh");
await tick(); await tick();
assert.ok(keep.find((n) => n.tagName === "IFRAME"), "turning it on in another project leaves this project's view alone");
rows = [{ ...rows[0], projects: { p1: { state: "disabled" } } }];
K.bus.emit("apps:refresh");
await tick(); await tick();
assert.equal(keep.find((n) => n.tagName === "IFRAME"), null, "turning it off in a project closes its open views at once");
assert.equal(keep.children[0].dataset.state, "stopped", "XO's frame stays, with words and Reload");
assert.match(keep.children[0].children[0].children[0].textContent, /Word is off in this project/);
assert.deepEqual(P.entries("panel.page", p1), []);
rows = [{ ...rows[0], projects: { p1: { state: "enabled", permissions: [{ cap: "files.read" }, { cap: "composer.draft" }, { cap: "context.update" }] }, p2: { state: "disabled" } } }];
K.bus.emit("apps:refresh");
await tick(); await tick();
assert.equal(P.entries("panel.page", p1).length, 1);
const v2 = structuredClone(WORD);
v2.version = "0.4.0";
v2.extensions["space.xo"].surfaces.find((/** @type {any} */ s) => s.id === "outline").view = "ui://dev.example.word/outline-2";
rows = [{ ...rows[0], version: "0.4.0", manifest: v2.extensions["space.xo"] }];
K.bus.emit("apps:refresh");
await tick(); await tick();
calls.length = 0;
keep.children[0].children[0].children[1].dispatch("click");
await tick(); await tick();
assert.deepEqual(calls.filter((c) => c[0] === "resource").map((c) => c[2]), ["ui://dev.example.word/outline-2"], "Reload opens the app as it is now, not as it was");
assert.ok(keep.find((n) => n.tagName === "IFRAME"));
const v3 = structuredClone(v2);
v3.version = "0.5.0";
v3.extensions["space.xo"].surfaces = v3.extensions["space.xo"].surfaces.filter((/** @type {any} */ s) => s.place !== "panel.page" && s.place !== "header.action");
rows = [{ ...rows[0], version: "0.5.0", manifest: v3.extensions["space.xo"] }];
K.bus.emit("apps:refresh");
await tick(); await tick();
keep.children[0].children[0].children[1].dispatch("click");
await tick(); await tick();
assert.match(keep.children[0].children[0].children[0].textContent, /this view is gone from the app/);
await new Promise((r) => setTimeout(r, 600));
assert.equal(host.children.length, 0, "a live view gets its teardown, then goes");

const el = doc.createElement("div");
const block = /** @type {any} */ (P.get("conversation.block", "app"));
const drop = block.render(el, { app: "dev.example.word", card: "card", caption: "Made 3 variants", snapshot: "data:image/png;base64,iVBORw0KGgo=" }, p1);
const fig = el.find((n) => n.tagName === "FIGURE");
assert.equal(fig.find((n) => n.tagName === "FIGCAPTION").textContent, "Made 3 variants");
assert.equal(fig.find((n) => n.tagName === "IMG").src, "data:image/png;base64,iVBORw0KGgo=");
drop();
const el2 = doc.createElement("div");
block.render(el2, { app: "dev.example.word", card: "card", caption: "x", snapshot: "javascript:alert(1)" }, p1);
assert.equal(el2.find((n) => n.tagName === "IMG"), null, "only a data: picture is drawn");

const sEl = doc.createElement("div");
doc.body.append(sEl);
/** @type {any} */ (P.get("settings.section", "apps")).render(sEl, p1);
assert.match(String(/** @type {any} */ (sEl).html), /<b>Word<\/b>/, "Settings › Apps lists the installed app");

await K.disable("xo.apps-host");
assert.equal(K.live("xo.apps-host"), 0, "disable leaves nothing behind");
assert.equal(P.entries("panel.page", p1).length, 0);
assert.equal(P.get("settings.section", "apps"), undefined);

const broken = structuredClone(WORD);
broken.extensions["space.xo"].routes.push("GET /api/secrets/env");
rows = [{ ...rows[0], version: "0.4.0", manifest: broken.extensions["space.xo"] }];
await K.enable("xo.apps-host");
assert.equal(K.status("xo.apps-host"), "active");
assert.equal(P.entries("panel.page", p1).length, 0, "a version with a forbidden route contributes nothing");
rows = [];
await K.disable("xo.apps-host");
await K.enable("xo.apps-host");
assert.equal(P.entries("command", p1).length, 0, "a removed app leaves no trace");
const K3 = createKernel({ warn: () => {}, log: () => {} });
definePlaces(K3);
const old = /** @type {any} */ ({ list: async () => { throw Object.assign(new Error("Not Found"), { status: 404, code: "http_404" }); } });
K3.register(createAppsHost({ client: old, doc: /** @type {any} */ (doc), win: /** @type {any} */ (win), redraw: (el, html) => { /** @type {any} */ (el).html = html; }, projects: () => [], draft() {}, openPanel() {}, confirm: async () => true, context() {} }));
assert.deepEqual((await K3.start()).failed, [], "a Space without the app routes boots apps-host quietly");
const oldEl = doc.createElement("div");
doc.body.append(oldEl);
/** @type {any} */ (K3.places.get("settings.section", "apps")).render(oldEl, {});
assert.match(String(/** @type {any} */ (oldEl).html), /doesn&#39;t run apps yet/);
const K4 = createKernel({ warn: () => {}, log: () => {} });
definePlaces(K4);
const safe = /** @type {any} */ ({ list: async () => ({ contract: "0.1", safe_mode: true, apps: [{ id: "dev.example.word", name: "Word", version: "0.3.0", state: "installed", manifest: WORD.extensions["space.xo"], projects: { p1: { state: "enabled", permissions: [] } } }] }) });
K4.register(createAppsHost({ client: safe, doc: /** @type {any} */ (doc), win: /** @type {any} */ (win), redraw: (el, html) => { /** @type {any} */ (el).html = html; }, projects: () => [], draft() {}, openPanel() {}, confirm: async () => true, context() {} }));
await K4.start();
assert.equal(K4.places.entries("panel.page", { project: "p1" }).length, 0, "safe mode: no app shows anywhere");
const safeEl = doc.createElement("div");
doc.body.append(safeEl);
/** @type {any} */ (K4.places.get("settings.section", "apps")).render(safeEl, {});
assert.match(String(/** @type {any} */ (safeEl).html), /Safe mode is on/);
assert.doesNotMatch(String(/** @type {any} */ (oldEl).html), /Install an app|set-err/);
console.log("ok host: manifest → places per project, prompt commands draft, views open and close, cards are pictures first, disable leaves nothing");
