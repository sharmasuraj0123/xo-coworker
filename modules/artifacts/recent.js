// @ts-check

import { syncList } from "../../core/ui/motion.js";
import { ICON } from "../../core/ui/icons/names.js";

/** @import {GalleryDeps, MadeDeps} from "./page-types.d.ts" */

const RECENT = 3;

/** @param {Pick<GalleryDeps, "MS" | "PV" | "syncCards"> & Pick<MadeDeps, "skTile" | "rememberedMade">} options */
export function createRecentMade({ MS, PV, syncCards, skTile, rememberedMade }) {
  const template = document.createElement("template");
  const ready = new WeakSet();

  /** @param {HTMLElement} box */
  return function homeMade(box) {
    const pending = MS.madePending(null);
    const items = pending ? [] : MS.madeOf(null);
    if (!ready.has(box)) {
      box.innerHTML = '<section class="md-recent" aria-labelledby="md-recent-h" hidden>'
        + `<header class="hm-lbl"><h2 id="md-recent-h">${ICON.spark}Recently made</h2>`
        + '<button type="button" data-go="artifacts" aria-label="See all artifacts">See all ›</button></header>'
        + '<ul class="md-grid is-strip"></ul></section>';
      ready.add(box);
    }
    const section = box.querySelector(".md-recent");
    const list = section?.querySelector(".md-grid");
    if (!(section instanceof HTMLElement) || !(list instanceof HTMLElement)) return;
    if (pending) {
      const count = Math.min(RECENT, rememberedMade() ?? 0);
      section.hidden = !count;
      syncList(list, Array.from({ length: count }, (_, index) => ({ key: `~sk${index}`, index })), {
        make({ index }) {
          template.innerHTML = skTile(true, index);
          return /** @type {HTMLElement} */ (template.content.firstElementChild);
        },
        update() {},
      });
      return;
    }
    section.hidden = !items.length;
    if (!items.length) return;
    const visible = [...items.filter((item) => item.pinned), ...items.filter((item) => !item.pinned)].slice(0, RECENT);
    PV.loadThumbs(visible);
    PV.loadTexts(visible);
    syncCards(list, visible, true);
  };
}
