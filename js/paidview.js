// A paid-usage question's facts as a block (the card in the panel and Home's next move): the account, how much of its
// window is used, when it resets, its credits, and how far Continue reaches. Its words are the item's own (js/paid.js
// paidItem); this only lays them out.

import { esc } from "./world.js";
import { ICON } from "./ui.js";
import { resetWords } from "./runtimes.js";
import { creditsWords } from "./paid.js";

export function paidHtml(it) {
  const P = it && it.paid;
  if (!P) return "";
  const when = P.resetsAt ? resetWords(P.resetsAt) : "";
  const credits = P.credits != null ? creditsWords(P.credits) : "";
  const used = P.used != null ? `${Math.round(P.used * 100)}% of its window used` : "";
  return `<div class="lim">${P.account ? `<p class="lim-acct">${esc(P.account)}</p>` : ""}` +
    (used ? `<p class="lim-credits">${esc(used)}</p>` : "") +
    (when ? `<p class="lim-when">${ICON.clock}<span>Its window resets ${esc(when)}</span></p>` : "") +
    (credits ? `<p class="lim-credits">${esc(credits)} left</p>` : "") +
    `<p class="lim-credits">${esc(P.reach)}</p></div>`;
}
