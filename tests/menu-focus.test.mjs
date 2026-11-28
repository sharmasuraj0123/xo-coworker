import assert from "node:assert/strict";
import { test } from "node:test";
import { createViewerHead } from "../modules/files/viewer-head.js";
import { dom, same } from "./lib/dom.mjs";
import { imageViewer } from "./lib/viewer-fixture.mjs";

test("the first matching button with a visible box wins over a hidden twin", async () => {
  const { document } = await dom('<section id="viewer"><button class="mode" hidden>Header</button><button class="mode">Menu</button></section>');
  const el = document.querySelector("#viewer");
  const { shown } = createViewerHead({ el });
  same(shown(el, ".mode"), el.lastElementChild);
  el.lastElementChild.hidden = true;
  assert.equal(Boolean(shown(el, ".mode")), false, "all matching controls are hidden");
});

test("a choice from More restores focus to More when the folded header twin is hidden", async () => {
  const { el, viewer, document, click } = await imageViewer();
  try {
    const more = el.querySelector("[data-vw-more]");
    more.focus();
    click(more);
    const button = el.querySelector('.vw-top > * [data-vw-mode="actual"]:not([role])');
    const menu = el.querySelector(".vw-menu"), choice = menu.querySelector('[data-vw-mode="actual"]');
    assert.equal(choice.getAttribute("role"), "menuitemradio");
    const proto = Object.getPrototypeOf(button), rects = proto.getClientRects;
    proto.getClientRects = function () {
      return this.matches('[data-vw-mode="actual"]:not([role])') ? [] : rects.call(this);
    };
    choice.focus();
    try { click(choice); } finally { proto.getClientRects = rects; }
    assert.equal(Boolean(el.querySelector(".vw-menu")), false);
    assert.equal(el.querySelector('.vw-top [data-vw-mode="actual"]').getAttribute("aria-pressed"), "true");
    same(document.activeElement, el.querySelector("[data-vw-more]"));
  } finally {
    viewer.close();
  }
});
