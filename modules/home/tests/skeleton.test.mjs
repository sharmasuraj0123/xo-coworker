// @ts-check

import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";

const { document, window } = await dom('<main id="home"></main>');
const key = "xo-home-shape", reports = [], writes = [];
const page = new URL("https://example.test/?coder_session_token=first-paint&keep=1");
const historyUpdates = [], sessionAccess = [];
const styleReads = [], mediaReads = [];
let saved = JSON.stringify({ w: 680, parts: [{ id: "hm-made", hidden: false, h: 52, n: 2 }] });
let failure;
Object.assign(globalThis, {
  location: page,
  history: { replaceState(_state, _title, url) { historyUpdates.push(url.href); } },
  getComputedStyle(element) {
    styleReads.push(element);
    return { getPropertyValue: () => "" };
  },
  matchMedia(query) {
    mediaReads.push(query);
    return { matches: false };
  },
  sessionStorage: {
    getItem(name) { sessionAccess.push(["read", name]); return null; },
    setItem(name, value) { sessionAccess.push(["write", name, value]); },
  },
  reportError: (error) => reports.push(error),
  localStorage: {
    getItem(name) {
      assert.equal(name, key);
      if (failure) throw failure;
      return saved;
    },
    setItem(name, value) {
      assert.equal(name, key);
      if (failure) throw failure;
      writes.push(JSON.parse(value));
      saved = value;
    },
  },
});
const { rememberedMade } = await import("../skeleton.js");
assert.equal(rememberedMade(), 2);
assert.equal(document.querySelectorAll("#hm-made .md-it").length, 2);
assert.equal(styleReads.length, 0, "first paint does not read computed style");
assert.deepEqual(mediaReads, [], "first paint does not read motion preferences");
assert.deepEqual(historyUpdates, [], "first paint leaves the token URL alone");
assert.deepEqual(sessionAccess, [], "first paint leaves session storage alone");
await import("../../../core/ui/landing.js");
assert.deepEqual(styleReads, [document.documentElement]);
assert.deepEqual(mediaReads, ["(prefers-reduced-motion: reduce)"]);
const { captureCoderToken, coderHeaders } = await import("../../../core/platform/http.js");
assert.deepEqual(historyUpdates, []);
assert.deepEqual(sessionAccess, []);
captureCoderToken();
assert.deepEqual(historyUpdates, ["https://example.test/?keep=1"]);
assert.deepEqual(sessionAccess, [["write", "xo-coder-token", "first-paint"]]);
assert.deepEqual(coderHeaders(), { "Coder-Session-Token": "first-paint" });
saved = '{"parts":[{"id":"hm-made","n":3}]}';
assert.equal(rememberedMade(), 3, "older partial snapshots still seed Recently made");
saved = '{"parts":[null]}';
assert.equal(rememberedMade(), null);
saved = "{";
assert.equal(rememberedMade(), null);
failure = new DOMException("Storage is disabled", "SecurityError");
assert.equal(rememberedMade(), null);
assert.deepEqual(reports, []);
failure = new Error("Unexpected storage error");
assert.equal(rememberedMade(), null);
assert.deepEqual(reports, [failure]);
failure = undefined;

const body = document.getElementById("hm-body");
Object.defineProperties(body, { offsetParent: { value: document.body }, clientWidth: { value: 680 } });
for (const el of document.querySelectorAll(".hm-sk, #hm-head .sk")) el.remove();
Object.defineProperty(document, "hidden", { value: true });
const hide = (persisted) => window.dispatchEvent(Object.assign(new Event("pagehide"), { persisted }));
const change = () => document.dispatchEvent(new Event("visibilitychange"));

hide(true);
change();
assert.deepEqual(writes.map(({ w }) => w), [680, 680]);
hide(false);
change();
hide(false);
assert.deepEqual(writes.map(({ w }) => w), [680, 680, 680], "unload saves the last shape and retires both listeners");
