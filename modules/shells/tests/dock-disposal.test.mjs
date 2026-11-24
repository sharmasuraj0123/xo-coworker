// @ts-check

import assert from "node:assert/strict";
import { deferred, dom } from "../../../tests/lib/dom.mjs";

const { document, window } = await dom(
  '<main id="app"><button id="nv-shells"><span class="sh-n"></span></button><aside id="shd"></aside></main>',
);
globalThis.innerHeight = 900;
const { createShells } = await import("../dock.js");
const pending = deferred();
/** @type {AbortSignal | undefined} */
let transport;
let holdList = false;
globalThis.fetch = async (url, options) => {
  if (String(url).endsWith("/status")) return Response.json({ enabled: true });
  if (!holdList) return Response.json({ terminals: [] });
  transport = options?.signal ?? undefined;
  return pending.promise;
};
const dock = createShells();
await new Promise(setImmediate);
const root = document.querySelector("#shd");
holdList = true;
document.querySelector("#nv-shells").click();
await new Promise(setImmediate);
assert.equal(root.hidden, false, "the actual Shells launcher opens the dock");
assert.ok(transport, "opening the dock refreshes its list");
const grip = root.querySelector(".shd-grip");
const resize = () => grip.dispatchEvent(Object.assign(new window.Event("keydown", { cancelable: true }), { key: "ArrowUp" }));
assert.equal(resize(), false, "the active dock handles keyboard resize");
const height = root.style.getPropertyValue("--shd-h");

dock.dispose();
assert.equal(transport.aborted, true, "disposing the dock aborts its pending list");
assert.equal(resize(), true, "the retained grip no longer handles keyboard resize");
assert.equal(root.style.getPropertyValue("--shd-h"), height);
pending.resolve(Response.json({ terminals: [{ id: "late", state: "running", name: "Late shell" }] }));
await new Promise(setImmediate);
assert.equal(root.textContent.includes("Late shell"), false);
