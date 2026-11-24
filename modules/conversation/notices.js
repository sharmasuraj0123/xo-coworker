// @ts-check

import { createHerald } from "../../core/services/notices.js";

/** @import { Notice } from "../../core/services/notices.js" */

/** @param {{ S: { herald: Notice | null; _her?: ReturnType<typeof createHerald> }; schedule(): void }} deps */
export function createConversationNotices({ S, schedule }) {
  function HER() { return S._her || (S._her = createHerald({ state: S, schedule: () => schedule() })); }
  /** @param {Notice} h @param {number} [ms] */
  function heraldShow(h, ms) { return HER().show(h, ms); }
  /** @param {string} mid @param {(h: Notice) => Notice} make @param {number | null} [ms] */
  function heraldFor(mid, make, ms) { return HER().forMsg(mid, make, ms); }
  function heraldNext() { return HER().next(); }
  /** @param {string} mid */
  function heraldDrop(mid) { return HER().drop(mid); }

  return { heraldShow, heraldFor, heraldNext, heraldDrop };
}
