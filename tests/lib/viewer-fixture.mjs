// @ts-check

import { api } from "../../core/platform/api.js";
import { createFileViewer } from "../../modules/files/viewer.js";
import { MAIN_LAYERS } from "../../shell/overlays.js";
import { dom, settle } from "./dom.mjs";

export async function imageViewer() {
  const { document, window } = await dom(MAIN_LAYERS);
  globalThis.HTMLImageElement = window.HTMLImageElement;
  api.projectImage = async () => new Blob(["image"], { type: "image/png" });
  const viewer = createFileViewer({
    announce() {},
    changes: { at: () => ({ file: {}, path: "image.png", binary: true }) },
  }, { $: (selector) => document.querySelector(selector) });
  viewer.open({ project: "demo", rel: "image.png", name: "image.png" });
  await settle();
  const el = document.querySelector("#viewer");
  const click = (/** @type {HTMLElement} */ element) => element.dispatchEvent(new window.Event("click", { bubbles: true }));
  return { el, window, document, viewer, click };
}
