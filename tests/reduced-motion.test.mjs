// @ts-check

import assert from "node:assert/strict";
import test from "node:test";
import { declarationsFor } from "./lib/css-snapshot.mjs";
import { dom } from "./lib/dom.mjs";

test("reduced motion suppresses all transition durations and delays", () => {
  for (const property of ["transition-duration", "transition-delay"]) {
    const rows = declarationsFor("*,*::before,*::after", property).filter(({ context }) =>
      context.some(({ at, params }) => at === "media" && params === "(prefers-reduced-motion:reduce)"));
    assert.deepEqual(rows.map(({ value, important }) => ({ value, important })), [{ value: "0s", important: true }], property);
  }
});

test("a select closes even without an animationend event", async ({ mock }) => {
  const { window, document } = await dom("<main></main>");
  Object.assign(globalThis, {
    customElements: window.customElements,
    MutationObserver: class {
      observe() {}
      takeRecords() { return []; }
    },
    getComputedStyle: window.getComputedStyle,
    innerHeight: 844,
    innerWidth: 1440,
    removeEventListener: window.removeEventListener.bind(window),
  });
  await import("../core/ui/components/xo-select.js");
  mock.timers.enable({ apis: ["setTimeout"] });
  const select = document.createElement("xo-select");
  select.innerHTML = '<option value="a">Alpha</option><option value="b">Bravo</option>';
  document.querySelector("main").append(select);
  const button = select.querySelector('[role="combobox"]');
  button.click();
  const menu = select.querySelector(".dd-menu");
  assert.equal(button.getAttribute("aria-expanded"), "true");
  button.click();
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(menu.hidden, false, "the outro remains visible until cleanup");
  mock.timers.runAll();
  assert.equal(menu.hidden, true, "a missing animationend cannot strand the menu");
  select.remove();
});

test("a loaded picture settles once, with or without transitionend", async ({ mock }) => {
  const boxes = ["event", "fallback"].map((key) =>
    `<div class="mx-one is-frame"><img class="mx-img" data-mx-img="${key}"></div>`).join("");
  const { window, document } = await dom(`<main>${boxes}</main>`);
  window.Element.prototype.animate = () => { throw new Error("the frame uses a CSS transition"); };
  globalThis.getComputedStyle = window.getComputedStyle;
  const { hydrateMedia } = await import("../core/services/media/hydrate.js");
  mock.timers.enable({ apis: ["setTimeout"] });
  const [animated, frame] = document.querySelectorAll(".mx-one");
  for (const box of [animated, frame]) {
    box.getBoundingClientRect = () => ({ width: 400, height: 260, bottom: 260 });
    const image = box.querySelector("img");
    Object.defineProperties(image, {
      complete: { value: true }, naturalWidth: { value: 640 }, naturalHeight: { value: 480 },
    });
  }
  hydrateMedia(document.querySelector("main"));
  const done = new window.Event("transitionend");
  Object.defineProperty(done, "propertyName", { value: "height" });
  animated.dispatchEvent(done);
  assert.equal(animated.style.aspectRatio, "640 / 480");
  animated.style.aspectRatio = "1 / 1";
  assert.equal(frame.style.height, "300px");
  assert.equal(frame.style.aspectRatio, "auto");
  mock.timers.runAll();
  assert.equal(animated.style.aspectRatio, "1 / 1", "the settled frame no longer has a fallback timeout");
  assert.equal(frame.style.transition, "");
  assert.equal(frame.style.height, "");
  assert.equal(frame.style.aspectRatio, "640 / 480");
});
