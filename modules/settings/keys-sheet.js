// @ts-check

import { esc } from "../../core/platform/util.js";
import { requireHtml } from "../../core/platform/dom.js";
import * as K from "../../core/platform/keys.js";
import { keyHtml } from "../../core/ui/a11y/keycap.js";

export function keysSheetRender() {
  /** @param {string[]} ids */
  const col = (ids) => `<dl class="keys">${ids.map((g) => `<dt class="kh">${esc((/** @type {{ name: string }} */ (K.GROUPS.find((x) => x.id === g))).name)}</dt><dd></dd>` +
    K.ACTIONS.filter((a) => a.scope === g).map((a) => `<dt><kbd>${keyHtml(K.label(a.id))}</kbd></dt><dd>${esc(a.label)}</dd>`).join("")).join("")}</dl>`;
  requireHtml("#keys-cols").innerHTML = col(["global", "picture"]) + col(["decision", "intel"]);
}
