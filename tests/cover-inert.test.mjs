// @ts-check

import assert from "node:assert/strict";
import { stageFixture } from "./lib/stage-fixture.mjs";

const observed = new Set();
globalThis.ResizeObserver = class {
  observe(target) { observed.add(target); this.target = target; }
  disconnect() { observed.delete(this.target); }
};
const { document, window, panel, setPhone } = await stageFixture({ phone: true });
const { PHONE_MAX_WIDTH } = await import("../core/platform/viewport.js");
const outside = document.getElementById("outside");
const main = document.getElementById("main");
const dock = document.createElement("section");
dock.innerHTML = '<div id="herald"><button>Undo</button></div><textarea></textarea>';
const herald = dock.querySelector("#herald");
const composer = dock.querySelector("textarea");
const alreadyInert = document.createElement("aside");
alreadyInert.inert = true;
main.append(dock, alreadyInert);

globalThis.innerWidth = PHONE_MAX_WIDTH + 1;
panel.open({ focus: false });
panel.sync();
assert.equal(composer.inert, true, "the Stage cover follows the media query instead of the window width");
assert.equal(document.body.classList.contains("stage-over"), false, "phone Stage suppresses the desktop overlap style");
assert.equal(Boolean(herald.inert), false, "the notice and its Undo stay reachable");
assert.equal(alreadyInert.hasAttribute("data-stage-inert"), false, "Stage leaves other inert owners alone");

outside.after(composer);
const newControl = document.createElement("button");
dock.append(newControl);
panel.sync();
assert.equal(composer.inert, false, "redraw releases the composer after it moves outside the cover");
assert.equal(newControl.inert, true, "redraw covers the replacement control");

setPhone(false);
assert.equal(newControl.inert, false, "returning to desktop releases the phone cover");
assert.equal(document.body.classList.contains("stage-over"), true, "the same narrow desktop admits panel overlap");
setPhone(true);
panel.close({ restore: false });
assert.equal(newControl.inert, false, "closing releases the remaining cover");
assert.equal(alreadyInert.inert, true, "closing preserves unrelated inert state");
assert.equal(document.querySelectorAll("[data-stage-inert]").length, 0);

setPhone(false);
panel.open();
const activeWidth = document.documentElement.style.getPropertyValue("--sw");
assert.ok(observed.has(document.querySelector(".stg-frames")), "Stage tracks the mounted frame stack");
setPhone(true);
assert.equal(newControl.inert, true, "the Stage is covering the conversation when it is disposed");
assert.equal(document.body.classList.contains("stage-covers"), true);
newControl.remove();
panel.disposeLayout();
assert.equal(observed.size, 0, "disposing Stage disconnects the frame observations");
assert.equal(newControl.inert, false, "Stage releases a covered control even after it has been detached");
assert.equal(newControl.hasAttribute("data-stage-inert"), false);
assert.equal(document.body.classList.contains("stage-covers"), false, "disposing Stage releases the cover");
assert.equal(alreadyInert.inert, true, "disposal preserves unrelated inert state");
dock.append(newControl);
setPhone(true);
assert.equal(newControl.inert, false, "disposed Stage ignores media-query changes");
globalThis.innerWidth = 1440;
window.dispatchEvent(new window.Event("resize"));
assert.equal(document.documentElement.style.getPropertyValue("--sw"), activeWidth, "disposed Stage ignores window resize");
