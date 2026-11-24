// @ts-check

import { requestFailureMessage } from "../../core/services/notices/failures.js";

/** @import { AccountControls } from "./accounts-types" */

/** @param {AccountControls} controls */
export function wireAccounts({ scope, box, state, github, agentIn, agentCancel, agentCode, draw, focus, announce }) {
  const root = /** @type {HTMLElement} */ (document.querySelector("#settings"));
  scope.listen(root, "submit", (e) => {
    if (!(e.target instanceof Element)) return;
    const form = e.target.closest("form[data-agent-form]");
    if (!form || !box()?.contains(form)) return;
    const runtime = form.getAttribute("data-agent-form");
    const code = /** @type {HTMLInputElement | null} */ (form.querySelector('input[name="code"]'));
    if (!runtime || !code) return;
    e.preventDefault();
    void agentCode(runtime, code.value.trim());
  });

  scope.listen(root, "click", (e) => {
    if (!(e.target instanceof Element)) return;
    const agent = e.target.closest("[data-agent][data-rt]");
    const n = agent?.getAttribute("data-rt");
    if (agent && n && box()?.contains(agent)) {
      const id = agent.getAttribute("data-agent");
      const f = state.f[n];
      if (id === "open") {
        if (f?.code) copyCode(f.code);
        if (f && !f.opened) { f.opened = true; scope.timeout(draw, 0); }
        return;
      }
      if (agent.getAttribute("aria-disabled") === "true") { e.preventDefault(); return; }
      if (id === "in") agentIn(n, false);
      else if (id === "again") agentIn(n, true);
      else if (id === "cancel") agentCancel(n);
      return;
    }
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
