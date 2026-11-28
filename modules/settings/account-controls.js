// @ts-check

import { requestFailureMessage } from "../../core/services/notices/failures.js";

/** @import { AccountControls } from "./accounts-types" */

/** @param {AccountControls} controls */
export function wireAccounts({ scope, box, github, focus, announce }) {
  const root = /** @type {HTMLElement} */ (document.querySelector("#settings"));
  scope.listen(root, "click", (e) => {
    if (!(e.target instanceof Element)) return;
    const b = e.target.closest("[data-acct]");
    if (!b || !box()?.contains(b)) return;
    const id = b.getAttribute("data-acct");
    if (id === "open") { copyCode(github.get().flow?.code ?? ""); return; }
    if (b.getAttribute("aria-disabled") === "true") { e.preventDefault(); return; }
    if (id === "in") github.signIn(false);
    else if (id === "again") github.signIn(true);
    else if (id === "cancel") github.cancel();
    else if (id === "check") { github.set({ gh: null, err: "" }); void github.read(); }
    else if (id === "out") { github.set({ confirm: true, err: "" }); focus('[data-acct="keep"]'); }
    else if (id === "keep") { github.set({ confirm: false }); focus('[data-acct="out"]'); }
    else if (id === "out-yes") github.signOut(b);
  });

  /** @param {string} code */
  function copyCode(code) {
    navigator.clipboard?.writeText(code).catch((error) => {
      if (!(error instanceof DOMException && error.name === "NotAllowedError")) requestFailureMessage(error, "Couldn't copy the code.");
    });
    announce("Code copied.");
  }
}
