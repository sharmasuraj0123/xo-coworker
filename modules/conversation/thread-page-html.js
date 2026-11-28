// @ts-check

import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";

/** @param {string} accept */
export function threadPageHtml(accept) {
  return `<header class="tp-head" id="tphead"></header><div class="thead tp-thead" id="tpthead" hidden></div>` +
    `<div class="scroller tp-scroller" id="tscroller" tabindex="-1" data-own-scroll><div class="column" id="tcolumn">` +
    `<div class="msgs" id="tmsgs" role="log" aria-live="off" aria-label="The thread's messages"></div><div class="typing-slot" id="ttyping"></div></div></div>` +
    `<div class="dock tp-dock" id="tpdock"><div class="herald" id="tpherald" aria-live="polite"></div><div class="tdock" id="tptdock"></div><div class="cbar"><form class="composer" id="tpcomposer" autocomplete="off">` +
    `<label class="sr-only" for="tsay" id="tsay-label">Reply</label><ul class="att-tray" id="tatt-tray" aria-label="Files on this reply" hidden></ul>` +
    `<div class="composer-field"><textarea id="tsay" rows="1" placeholder="Reply to the agent…" aria-autocomplete="list" aria-controls="tat-list" aria-expanded="false" spellcheck="true"></textarea><ul id="tat-list" class="at-list" role="listbox" aria-label="Projects" hidden></ul></div>` +
    `<div class="composer-row"><button type="button" class="attach" id="tattach" aria-label="Add files" title="Add files: text, images or PDFs, up to 25 MB each">${ICON.clip}</button><input type="file" id="tatt-input" multiple hidden tabindex="-1" accept="${esc(accept)}">` +
    `<button type="button" class="target" id="ttarget" title="Aim at a project (@)"></button><button type="button" class="iq" id="tiq" aria-haspopup="dialog" aria-expanded="false"></button><button type="submit" class="send" id="tsend" aria-label="Send" title="Send (Enter)" disabled></button></div>` +
    `<p class="att-note" id="tatt-note" hidden>Files are kept in the project's <code>.xo/</code> folder. Unlike chat text, they aren't scrubbed for secrets.</p></form></div></div>`;
}
