import assert from "node:assert/strict";
import { test } from "node:test";
import { createViewerHead } from "../modules/files/viewer-head.js";
import { MAIN_LAYERS } from "../shell/overlays.js";
import { dom, same } from "./lib/dom.mjs";

test("the viewer can hold focus while a focused header control is removed", async () => {
  const { document } = await dom(MAIN_LAYERS);
  const el = document.querySelector("#viewer");
  assert.equal(el.getAttribute("role"), "dialog");
  assert.equal(el.getAttribute("aria-labelledby"), "vw-h");
  assert.equal(el.getAttribute("tabindex"), "-1");
  assert.equal(el.hidden, true);
  el.hidden = false;
  const V = { file: { name: "run.js" }, tabs: [] };
  const D = { confirm: true, versions: [] };
  const { head, paintHead } = createViewerHead({
    V, TX: {}, el, doc: () => D, canSave: () => true, chg: () => null,
    showsDiff: () => false, showsText: () => false, runsCode: () => true,
  });
  el.innerHTML = head();
  const cancel = el.querySelector("[data-vw-noconfirm]"), more = el.querySelector("[data-vw-more]");
  cancel.focus();
  const seen = [];
  el.addEventListener("focusin", () => { seen.push([document.activeElement === el, cancel.isConnected]); });
  D.confirm = false;
  paintHead();
  assert.deepEqual(seen[0], [true, true], "the dialog holds focus before the confirmation disappears");
  assert.equal(cancel.isConnected, false);
  same(document.activeElement, more);
});
