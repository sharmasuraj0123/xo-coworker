import assert from "node:assert/strict";
import { test } from "node:test";
import { same } from "./lib/dom.mjs";
import { imageViewer } from "./lib/viewer-fixture.mjs";

test("an image decoding updates its dimensions and keeps the selected File control in place", async () => {
  const { el, viewer, window, document } = await imageViewer();
  try {
    const file = el.querySelector('[data-vw-show="file"]');
    const changes = el.querySelector('[data-vw-show="changes"]');
    const img = el.querySelector(".vw-img img");
    assert.equal(file.getAttribute("aria-pressed"), "true");
    assert.equal(changes.getAttribute("aria-pressed"), "false");
    Object.defineProperties(img, { naturalWidth: { value: 640 }, naturalHeight: { value: 480 } });
    file.focus();
    file.dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
    img.dispatchEvent(new window.Event("load", { bubbles: true }));
    assert.match(el.querySelector(".vw-meta").textContent, /640 × 480/);
    same(el.querySelector('[data-vw-show="file"]'), file, "the button under the press is the same node");
    same(document.activeElement, file, "focus follows the value of File, not the first Show button");
  } finally {
    viewer.close();
  }
});
