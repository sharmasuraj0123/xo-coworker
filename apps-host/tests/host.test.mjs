import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createKernel } from "../../core/kernel/index.js";
import { definePlaces } from "../../shell/places.js";
import { createAppsHost, MANIFEST } from "../host.js";
import { FakeDoc, tick } from "./dom.mjs";

const WORD = JSON.parse(readFileSync(new URL("./fixtures/word.plugin.json", import.meta.url), "utf8"));
assert.deepEqual(JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8")), { ...MANIFEST }, "module.json is the module's manifest");

let rows = [{ id: "dev.example.word", name: "Word", version: "0.3.0", state: "installed", manifest: WORD, projects: { p1: { state: "enabled", granted: ["files.read", "composer.draft"] }, p2: { state: "disabled" } } }];
/** @type {any[]} */
const calls = [];
const client = /** @type {any} */ (new Proxy({}, { get: (_t, k) => async (...a) => { calls.push([k, ...a]); if (k === "list") return { apps: rows }; if (k === "resource") return { contents: [{ uri: a[1], text: "<p>view</p>" }] }; if (k === "prompt") return { text: "Tighten the selected paragraph." }; return {}; } }));
const doc = new FakeDoc();
/** @type {any[]} */
const drafts = [], opened = [], asked = [];
let yes = true;
const win = Object.assign(new EventTarget(), { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval, open: () => null });
const K = createKernel({ warn: () => {}, log: () => {} });
definePlaces(K);
K.register(createAppsHost({
  client, doc: /** @type {any} */ (doc), win: /** @type {any} */ (win), redraw: (el, html) => { /** @type {any} */ (el).html = html; },
  projects: () => [{ id: "p1", name: "Book" }, { id: "p2", name: "Site" }],
  draft: (t, at) => drafts.push([t, at.project]), openPanel: (k, at) => opened.push([k, at.project]), confirm: async (text) => { asked.push(text); return yes; }, context() {},
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
assert.match(asked.at(-1), /Word wants to run word_delete/);
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
unmount();
assert.ok(calls.some((c) => c[0] === "viewClosed"));

const keep = doc.createElement("div");
doc.body.append(keep);
/** @type {any} */ (P.get("panel.page", "dev.example.word:outline")).mount(keep, p1);
await tick(); await tick();
assert.ok(keep.find((n) => n.tagName === "IFRAME"));
rows = [{ ...rows[0], projects: { p1: { state: "disabled" } } }];
K.bus.emit("apps:refresh");
await tick(); await tick();
assert.equal(keep.find((n) => n.tagName === "IFRAME"), null, "turning it off in a project closes its open views at once");
assert.deepEqual(P.entries("panel.page", p1), []);
rows = [{ ...rows[0], projects: { p1: { state: "enabled", granted: ["files.read", "composer.draft"] }, p2: { state: "disabled" } } }];
K.bus.emit("apps:refresh");
await tick(); await tick();
assert.equal(P.entries("panel.page", p1).length, 1);
assert.equal(host.children.length, 0);

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
rows = [{ ...rows[0], version: "0.4.0", manifest: broken }];
await K.enable("xo.apps-host");
assert.equal(K.status("xo.apps-host"), "active");
assert.equal(P.entries("panel.page", p1).length, 0, "a version with a forbidden route contributes nothing");
rows = [];
await K.disable("xo.apps-host");
await K.enable("xo.apps-host");
assert.equal(P.entries("command", p1).length, 0, "a removed app leaves no trace");
console.log("ok host: manifest → places per project, prompt commands draft, views open and close, cards are pictures first, disable leaves nothing");
