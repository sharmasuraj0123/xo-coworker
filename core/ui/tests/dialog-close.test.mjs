// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";
import { closeDialog } from "../components/dialog.js";

test("a dialog stays up while its sheet-out plays, and closes when it ends", async () => {
  const { document } = await dom("<dialog open></dialog>");
  const box = /** @type {HTMLDialogElement} */ (document.querySelector("dialog"));
  const { promise: finished, resolve: end } = Promise.withResolvers();
  Object.assign(box, { getAnimations: () => [{ finished }] });
  closeDialog(box);
  assert.equal(box.classList.contains("is-closing") && box.hasAttribute("open"), true, "still shown while it leaves");
  end();
  await finished;
  await Promise.resolve();
  assert.equal(box.hasAttribute("open") || box.classList.contains("is-closing"), false, "closed once it has left");
});

test("one reopened while it leaves stays open", async () => {
  const { document } = await dom("<dialog open></dialog>");
  const box = /** @type {HTMLDialogElement} */ (document.querySelector("dialog"));
  const { promise: finished, resolve: end } = Promise.withResolvers();
  Object.assign(box, { getAnimations: () => [{ finished }] });
  closeDialog(box);
  box.classList.remove("is-closing");
  end();
  await finished;
  await Promise.resolve();
  assert.equal(box.hasAttribute("open"), true);
});

test("with nothing to play it closes at once", async () => {
  const { document } = await dom("<dialog open></dialog>");
  const box = /** @type {HTMLDialogElement} */ (document.querySelector("dialog"));
  Object.assign(box, { getAnimations: () => [] });
  closeDialog(box);
  assert.equal(box.hasAttribute("open"), false);
});
