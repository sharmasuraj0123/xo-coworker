// @ts-check

import { UNKEPT } from "./shape-page.js";

/** @param {(message: string) => void} announce */
export function createDeviceNotice(announce) {
  /** @param {Element} tog @param {{ error?: string | null, kept?: boolean } | null | undefined} r @param {string} done */
  return function deviceSaid(tog, r, done) {
    const l = /** @type {HTMLElement} */ ((/** @type {Element} */ (tog.closest(".set-row"))).querySelector(".set-l"));
    let why = l.querySelector(".set-err");
    const say = r && r.error ? r.error : r && r.kept === false ? UNKEPT : null;
    if (say) {
      if (!why) { why = document.createElement("p"); why.className = "set-err"; why.setAttribute("role", "alert"); l.append(why); }
      why.textContent = say;
      return;
    }
    why?.remove();
    announce(done);
  }
}
