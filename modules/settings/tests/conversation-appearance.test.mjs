// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createDeviceNotice } from "../device-notice.js";
import { wireMessageHops, wireWebPictures } from "../appearance.js";
import { createShapeApply } from "../apply-shape.js";

const { document } = await dom(`<div class="set-row"><span class="set-l">Pictures</span><button id="webpics-tog" role="switch"></button></div>
  <div class="set-row"><span class="set-l">Message hops</span><button id="hops-tog" role="switch"></button></div>`);
const WEBPICS = "xo:conversation/webpics", HOPS = "xo:thread/hops";
const announced = [], saved = [];
const deviceSaid = createDeviceNotice((text) => announced.push(text));
let showPictures = false;
let showHops = true;
/** @type {import("../appearance-types.d.ts").AppearanceShape} */
const shape = {
  on: (key) => key === HOPS ? showHops : showPictures,
  setDevice({ surfaces }) {
    saved.push(surfaces);
    if (surfaces[WEBPICS]) showPictures = surfaces[WEBPICS].on;
    if (surfaces[HOPS]) showHops = surfaces[HOPS].on;
    picturesRender();
    hopsRender();
    return { kept: true };
  },
};
const picturesRender = wireWebPictures(shape, WEBPICS, deviceSaid);
const hopsRender = wireMessageHops(shape, deviceSaid);
picturesRender();
const pictures = document.getElementById("webpics-tog");
const hops = document.getElementById("hops-tog");
assert.equal(pictures.getAttribute("aria-checked"), "false");
assert.equal(hops.getAttribute("aria-checked"), "true");
pictures.click();
hops.click();
assert.equal(pictures.getAttribute("aria-checked"), "true");
assert.equal(hops.getAttribute("aria-checked"), "false");
assert.deepEqual(saved, [{ [WEBPICS]: { on: true } }, { [HOPS]: { on: false } }]);
assert.deepEqual(announced, ["Pictures from the web show in the conversation.", "Hiding how messages travel."]);

const events = [];
let currentView = "t:thread";
showHops = true;
const shapeApply = createShapeApply({
  view: () => currentView, SV: { apply: () => events.push("surface") }, SHAPE: { ...shape, opts: () => ({ mode: "words" }) },
  setWorkMode: (mode) => events.push(mode), hopsRender: () => events.push("hops"), webpicsRender: () => events.push("pictures"),
  convThread: (view) => view === "t:thread" ? { id: "thread" } : null,
  world: { act: { loadHops: (id) => events.push(id) } }, loadChatHops: (view) => events.push(view),
  SH: { redraw: () => events.push("shell") }, STAGE: { reshape: () => events.push("panel") }, schedule: () => events.push("frame"),
});
shapeApply({ boot: true });
assert.deepEqual(events.splice(0), ["surface", "words", "hops", "pictures"]);
shapeApply();
assert.deepEqual(events.splice(0), ["surface", "words", "hops", "pictures", "thread", "shell", "panel", "frame"]);
currentView = "p:project";
shapeApply();
assert.deepEqual(events.splice(0), ["surface", "words", "hops", "pictures", "p:project", "shell", "panel", "frame"]);
showHops = false;
shapeApply();
assert.deepEqual(events.splice(0), ["surface", "words", "hops", "pictures", "shell", "panel", "frame"]);
