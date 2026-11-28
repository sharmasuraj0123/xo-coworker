// @ts-check

import { esc } from "../../core/platform/util.js";

/** @import { MentionDeps, Composer, MentionSelection } from "./mention-types.d.ts" */

/** @param {Composer} K @param {MentionSelection} selection @param {Pick<MentionDeps, "world" | "projects" | "projectIcon" | "isBusy">} options */
export function renderMentionList(K, selection, { world, projects, projectIcon, isBusy }) {
  const at = K.at, pre = K.main ? "at" : "tat", before = K.say.value.slice(0, K.say.selectionStart);
  const m = before.match(/(^|\s)@([\w.-]*)$/);
  // no @ at the caret, or the list was shut here with Escape (until the text or the caret moves): closed
  if (!m || selection.closedAt === before) { closeMentionList(K); return; }
  selection.closedAt = null;
  const q = m[2].toLowerCase();
  const opts = projects().filter((p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  if (!opts.length) { closeMentionList(K); return; }
  selection.selected = Math.min(selection.selected, opts.length - 1);
  at.innerHTML = opts.map((p, i) => {
    const w = world.state.threads.filter((x) => x.project === p.id && isBusy(x)).length;
    return `<li role="option" id="${pre}-${i}" data-pid="${esc(p.id)}" aria-selected="${i === selection.selected}">`
      + `<span class="at-ic" aria-hidden="true">${projectIcon(p.id)}</span>@${esc(p.id)}`
      + `<span class="at-s">${w ? `${w} working` : "quiet"}</span></li>`;
  }).join("");
  if (at.hidden) at.style.setProperty("--at-room", `${Math.round(K.form.getBoundingClientRect().top)}px`);
  at.hidden = false;
  const li = /** @type {HTMLElement} */ (at.children[selection.selected]);
  // the keyboard's row stays in view inside the list's own scroll (never scrollIntoView: it would move the chat too)
  if (li.offsetTop < at.scrollTop) at.scrollTop = li.offsetTop;
  else if (li.offsetTop + li.offsetHeight > at.scrollTop + at.clientHeight) at.scrollTop = li.offsetTop + li.offsetHeight - at.clientHeight;
  K.say.setAttribute("aria-expanded", "true");
  K.say.setAttribute("aria-activedescendant", li.id);
}

/** @param {Composer} K */
export function closeMentionList(K) {
  K.at.hidden = true;
  if (K.say.getAttribute("aria-expanded") !== "false") K.say.setAttribute("aria-expanded", "false");
  K.say.removeAttribute("aria-activedescendant");
}
