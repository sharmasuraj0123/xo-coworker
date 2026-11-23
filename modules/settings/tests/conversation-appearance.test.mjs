// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createDeviceNotice } from "../device-notice.js";
import { wireMessageHops, wireWebPictures } from "../appearance.js";

const { document } = await dom(`<div class="set-row"><span class="set-l">Pictures</span><button id="webpics-tog" role="switch"></button></div>
  <div class="set-row"><span class="set-l">Message hops</span><button id="hops-tog" role="switch"></button></div>`);
const WEBPICS = "xo:conversation/webpics", HOPS = "xo:thread/hops";
const S = { showHops: true }, announced = [], saved = [];
const deviceSaid = createDeviceNotice((text) => announced.push(text));
let showPictures = false;
/** @type {import("../types.d.ts").AppearanceShape} */
const shape = {
  on: () => showPictures,
  setDevice({ surfaces }) {
    saved.push(surfaces);
    if (surfaces[WEBPICS]) showPictures = surfaces[WEBPICS].on;
    if (surfaces[HOPS]) S.showHops = surfaces[HOPS].on;
    picturesRender();
    hopsRender();
    return { kept: true };
  },
};
const picturesRender = wireWebPictures(shape, WEBPICS, deviceSaid);
const hopsRender = wireMessageHops(S, shape, deviceSaid);
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
