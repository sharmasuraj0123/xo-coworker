// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dom } from "./lib/dom.mjs";
import { mountLatestButton } from "../modules/conversation/latest-button.js";

const { document, window } = await dom(`<div id="conv"><div id="msgs"></div><div id="scroller"></div><div id="composer"></div><div id="dock"></div><div id="tdock"></div></div>`);
const element = (/** @type {string} */ id) => document.getElementById(id);
const scroller = element("scroller"), composer = element("composer"), conv = element("conv");
let layoutReads = 0;
composer.getBoundingClientRect = () => { layoutReads++; return { top: 400, height: 0 }; };
scroller.getBoundingClientRect = () => ({ top: 0 });
Object.defineProperty(scroller, "clientHeight", { value: 500 });
conv.getBoundingClientRect = () => ({ bottom: 500 });
const frames = new Map();
const globals = /** @type {Record<string, unknown>} */ (globalThis);
globals.requestAnimationFrame = (/** @type {FrameRequestCallback} */ callback) => { frames.set(frames.size + 1, callback); return frames.size; };
globals.MutationObserver = class { observe() {} };
globals.ResizeObserver = class { observe() {} };
/** @type {boolean[]} */
const followed = [];
mountLatestButton({
  conv, msgs: element("msgs"), scroller, composer, dock: element("dock"), tdock: element("tdock"), host: conv,
  typing: conv, say: document.createElement("textarea"), send: conv, isThread: () => false,
  follow: { fromLatest: () => 300, toLatest: (animate) => followed.push(animate) },
});

scroller.dispatchEvent(new window.Event("scroll"));
scroller.dispatchEvent(new window.Event("scroll"));
assert.equal(layoutReads, 0, "scroll listeners defer layout reads until the frame");
assert.equal(frames.size, 1, "scroll events in one frame share the same update");
const callback = frames.get(1);
frames.clear();
callback(0);
assert.equal(layoutReads, 2);
const down = conv.querySelector(".mx-down");
assert.equal(down.classList.contains("is-on"), true);
down.click();
assert.deepEqual(followed, [true]);
scroller.dispatchEvent(new window.Event("scroll"));
assert.equal(frames.size, 1, "a later scroll schedules its own frame");

const follow = readFileSync(new URL("../modules/conversation/follow.js", import.meta.url), "utf8");
assert.match(follow, /export function initFollow\(\)/);
