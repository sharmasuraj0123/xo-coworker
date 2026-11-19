// @ts-check

// A paid-usage question's facts as a block: the account, its window used, when it resets, its credits, how far Continue reaches.

import { esc } from "../../../core/platform/util.js";
import { ICON } from "../../../core/ui/icons/names.js";
import { resetWords } from "../../../core/services/runtimes.js";
import { creditsWords } from "../../../core/services/world/paid.js";

/** @param {{ paid?: { account?: string, used?: number | null, resetsAt?: string, credits?: number | null, reach?: string } } | null | undefined} it */
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
