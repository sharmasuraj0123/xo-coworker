// @ts-check

import { esc } from "../../core/platform/util.js";

/** @import { MentionDeps, Composer } from "./mention-types.d.ts" */

/** @param {MentionDeps} options */
export function createMentionList({ MK, world, projects, projectIcon, isBusy, saveDraft, updateComposer }) {
  /** @param {Composer} K */
  function atRender(K) {
    const at = K.at, pre = K.main ? "at" : "tat", before = K.say.value.slice(0, K.say.selectionStart);
    const m = before.match(/(^|\s)@([\w.-]*)$/);
    // no @ at the caret, or the list was shut here with Escape (until the text or the caret moves): closed
    if (!m || at._shut === before) { atClose(K); return; }
    at._shut = null;
    const q = m[2].toLowerCase();
    const opts = projects().filter((p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    if (!opts.length) { atClose(K); return; }
    at._sel = Math.min(at._sel || 0, opts.length - 1);
    at.innerHTML = opts.map((p, i) => {
      const w = world.state.threads.filter((x) => x.project === p.id && isBusy(x)).length;
      return `<li role="option" id="${pre}-${i}" data-pid="${esc(p.id)}" aria-selected="${i === at._sel}"><span class="at-ic" aria-hidden="true">${projectIcon(p.id)}</span>@${esc(p.id)}<span class="at-s">${w ? `${w} working` : "quiet"}</span></li>`;
    }).join("");
    if (at.hidden) at.style.setProperty("--at-room", `${Math.round(K.form.getBoundingClientRect().top)}px`);
    at.hidden = false;
    const li = /** @type {HTMLElement} */ (at.children[at._sel]);
    // the keyboard's row stays in view inside the list's own scroll (never scrollIntoView: it would move the chat too)
    if (li.offsetTop < at.scrollTop) at.scrollTop = li.offsetTop;
    else if (li.offsetTop + li.offsetHeight > at.scrollTop + at.clientHeight) at.scrollTop = li.offsetTop + li.offsetHeight - at.clientHeight;
    K.say.setAttribute("aria-expanded", "true");
    K.say.setAttribute("aria-activedescendant", `${pre}-${at._sel}`);
  }

  /** @param {Composer} [K] */
  function atClose(K = MK) {
    K.at.hidden = true;
    if (K.say.getAttribute("aria-expanded") !== "false") K.say.setAttribute("aria-expanded", "false");
    K.say.removeAttribute("aria-activedescendant");
  }

  /** @param {string} pid @param {Composer} [K] */
  function pickAt(pid, K = MK) {
    const f = K.say, pos = f.selectionStart;
    const before = f.value.slice(0, pos).replace(/(^|\s)@([\w.-]*)$/, `$1@${pid}`);
    const after = f.value.slice(pos).replace(/^[\w.-]*/, "");
    f.value = before + (/^\s/.test(after) ? "" : " ") + after;
    f.setSelectionRange(before.length + 1, before.length + 1);
    K.at._sel = 0; K.at._shut = null;
    saveDraft(K);
    updateComposer(K); f.focus();
  }

  return { atRender, atClose, pickAt };
}
