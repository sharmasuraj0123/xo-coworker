// @ts-check
import assert from "node:assert/strict";
import { api } from "../../../core/platform/api.js";
import { $ } from "../../../core/platform/dom.js";
import { MAIN_LAYERS } from "../../../shell/overlays.js";
import { dom } from "../../../tests/lib/dom.mjs";
import { createFileViewer } from "../viewer.js";

/** @param {string} path */
export const projectFile = (path) => ({ name: path.split("/").at(-1), path, rel: path, project: "demo" });
/** @param {string} [path] */
export const unavailable = (path = "docs/private.txt") => ({ ...projectFile(path), why: "Cannot preview this file" });

/** @param {Partial<Parameters<typeof createFileViewer>[0]>} [options] @param {Partial<Parameters<typeof createFileViewer>[1]>} [renderers] */
export async function viewerFixture(options = {}, renderers = {}) {
  const { document, window } = await dom(MAIN_LAYERS);
  window.requestAnimationFrame = () => 1;
  window.cancelAnimationFrame = () => {};
  globalThis.MutationObserver = window.MutationObserver;
  document.getSelection = () => null;
  document.hasFocus = () => false;
  const host = document.querySelector("#viewer");
  const announcements = [], clips = [];
  const clipboard = { writeText: async (/** @type {string} */ text) => { clips.push(text); } };
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
  document.execCommand = () => false;
  const selected = [];
  window.HTMLInputElement.prototype.select = function () { selected.push(this.value); };
  window.HTMLTextAreaElement.prototype.select = function () {};
  api.projectVersions = async () => ({ versions: [] });
  const viewer = createFileViewer({ announce: (words) => announcements.push(words), onChange() {}, ...options }, {
    $, jump() {}, diff: async () => { throw new Error("Unexpected diff"); }, isImageChange: () => false,
    drawImageChange: () => { throw new Error("Unexpected image diff"); }, ...renderers,
  });
  /** @param {string} selector */
  function click(selector) {
    const control = host.querySelector(selector);
    assert.ok(control, selector);
    control.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
  }
  return { viewer, window, document, host, clipboard, clips, announcements, selected, click };
}
