import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkManifest } from "../manifest.js";
import { buildSrcdoc, themeVariables, createAppFrame, CSP, SANDBOX } from "../frame.js";
import { FakeDoc, message, tick, fakeTimers } from "./dom.mjs";

const app = checkManifest(JSON.parse(readFileSync(new URL("./fixtures/word.plugin.json", import.meta.url), "utf8"))).app;
assert.ok(app);

const doc0 = buildSrcdoc("<!DOCTYPE html><html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src *\"><script>x()</script></head><body>hi</body></html>", { theme: "light", variables: { "--color-text-primary": "#000" } });
assert.ok(doc0.startsWith(`<!doctype html><html class="xo-light" data-theme="light"><head><meta http-equiv="Content-Security-Policy" content="${CSP}">`), "XO's CSP is the first thing parsed");
assert.equal(doc0.match(/<!doctype/gi).length, 1, "the view's own doctype goes, so the page isn't in quirks mode");
assert.ok(doc0.indexOf(CSP) < doc0.indexOf("<script>"));
assert.match(CSP, /connect-src 'none'/);
assert.match(CSP, /default-src 'none'/);
assert.match(CSP, /form-action 'none'/);
assert.ok(!/allow-same-origin/.test(SANDBOX) && SANDBOX === "allow-scripts");

const vars = themeVariables((t) => ({ "--surface": "#111", "--accent": "red;}</style><script>alert(1)</script>", "--sans": "Geist, sans-serif" })[t] || "");
assert.deepEqual(vars, { "--color-background-primary": "#111", "--font-sans": "Geist, sans-serif" }, "a value that could leave its declaration is dropped");

const doc = new FakeDoc();
const host = doc.createElement("div");
doc.body.append(host);
const win = new EventTarget();
const T = fakeTimers();
/** @type {string[]} */
const seen = [];
const hostElement = /** @type {HTMLElement} */ (/** @type {unknown} */ (host));
const make = (load = async () => ({ html: "<p>hi</p>", app, granted: [] })) => createAppFrame(hostElement, {
  doc: /** @type {Document} */ (/** @type {unknown} */ (doc)), win, app, title: "Word: Outline", load,
  timers: /** @type {NonNullable<import("../frame.js").FrameOpts["timers"]>} */ (/** @type {unknown} */ (T)),
  ready: (notify) => { seen.push("ready"); notify("ui/notifications/tool-input", { arguments: { path: "a.word.json" } }); },
  handlers: { callTool: async () => ({}), readResource: async () => ({}), draft() {}, context() {}, openLink: () => false, displayMode: () => "inline" },
});

const f = make();
assert.equal(f.state, "loading");
await tick();
const box = host.children[0];
const iframe = box.find((n) => n.tagName === "IFRAME");
assert.ok(iframe, "the view is mounted");
assert.equal(iframe.getAttribute("sandbox"), "allow-scripts");
assert.equal(iframe.getAttribute("referrerpolicy"), "no-referrer");
assert.match(iframe.getAttribute("allow"), /camera 'none'/);
assert.equal(iframe.getAttribute("title"), "Word: Outline");
assert.ok(iframe.srcdoc.includes(CSP) && iframe.srcdoc.includes("<p>hi</p>"));
assert.equal(iframe.attrs.has("src"), false, "views load from srcdoc only");

const view = iframe.contentWindow;
iframe.dispatch("load");
win.dispatchEvent(message({ jsonrpc: "2.0", id: 1, method: "ui/initialize", params: {} }, view));
await tick();
assert.equal(view.sent[0].m.result.hostContext.theme, "dark");
assert.equal(view.sent[0].m.result.hostContext.styles.variables["--color-background-primary"], "#111");
win.dispatchEvent(message({ jsonrpc: "2.0", method: "ui/notifications/initialized" }, view));
await tick();
assert.equal(f.state, "live");
assert.deepEqual(seen, ["ready"]);
assert.equal(view.sent[view.sent.length - 1].m.method, "ui/notifications/tool-input");

win.dispatchEvent(message({ jsonrpc: "2.0", method: "ui/notifications/size-changed", params: { height: 321.2 } }, view));
await tick();
assert.equal(box.props.get("--xa-view-h"), "322px");

T.advance(5000);
const ping = view.sent[view.sent.length - 1].m;
assert.equal(ping.method, "ping");
win.dispatchEvent(message({ jsonrpc: "2.0", id: ping.id, result: {} }, view));
await tick();
assert.equal(f.state, "live", "an answered ping keeps it live");
T.advance(5000 + 10000);
await tick();
assert.equal(f.state, "stopped", "no answer for 10 s: XO unmounts it");
assert.equal(box.find((n) => n.tagName === "IFRAME"), null);
assert.match(box.children[0].children[0].textContent, /stopped responding/);

await f.reload();
const again = box.find((n) => n.tagName === "IFRAME");
again.dispatch("load");
assert.equal(f.state, "loading");
again.dispatch("load");
assert.equal(f.state, "stopped", "a view that navigates its frame is closed");
assert.match(box.children[0].children[0].textContent, /tried to leave its frame/);

f.destroy();
assert.equal(host.children.length, 0);

const silent = make();
await tick();
const sBox = host.children[0];
sBox.find((n) => n.tagName === "IFRAME").dispatch("load");
sBox.focus();
T.advance(15000);
assert.equal(silent.state, "stopped", "a view that never initializes stops after 15 s");
assert.match(sBox.children[0].children[0].textContent, /didn't open/);
const reloadBtn = sBox.children[0].children[1];
assert.equal(doc.activeElement, reloadBtn, "focus goes to Reload, never to the page");
reloadBtn.dispatch("click");
assert.equal(doc.activeElement, sBox, "while it reopens, the frame holds focus");
await tick();
const v2 = sBox.find((n) => n.tagName === "IFRAME");
v2.dispatch("load");
win.dispatchEvent(message({ jsonrpc: "2.0", id: 1, method: "ui/initialize", params: {} }, v2.contentWindow));
win.dispatchEvent(message({ jsonrpc: "2.0", method: "ui/notifications/initialized" }, v2.contentWindow));
await tick();
assert.equal(doc.activeElement, v2, "then the view has it");
seen.length = 0;
win.dispatchEvent(message({ jsonrpc: "2.0", method: "ui/notifications/initialized" }, v2.contentWindow));
await tick();
assert.deepEqual(seen, [], "initialized is one-shot");
silent.destroy();
T.advance(600);
await tick();
assert.equal(host.children.length, 0, "teardown gets 500 ms, then the frame goes");
assert.equal(v2.listeners.size, 0, "destroy releases the view's listeners");
assert.equal(reloadBtn.listeners.size, 0, "destroy releases Reload's listener");

const bad = make(async () => { throw new Error("it isn't on in this project"); });
await tick();
assert.equal(bad.state, "stopped");
assert.match(host.children[0].children[0].children[0].textContent, /isn't on in this project/);
bad.destroy();
console.log("ok frame: srcdoc with XO's CSP first, sandbox scripts only, theme as tokens, watchdog, navigation closes it");
