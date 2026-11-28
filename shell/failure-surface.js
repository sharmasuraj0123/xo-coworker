// @ts-check
import { createDialog } from "../core/ui/components/dialog.js";

/** @typedef {Parameters<typeof import("../core/platform/failure.js").createFailureSurface>[0]} PresentFailure */

/** @param {import("../core/kernel/types").ModuleContext} ctx @returns {PresentFailure} */
export function mountFailurePresenter(ctx) {
  const notices = ctx.use("notices");
  const mid = "system:application-failures";
  const dialog = createDialog();
  dialog.setAttribute("aria-labelledby", "failure-title");
  dialog.innerHTML = `<form method="dialog">
    <header class="dlg-head"><h2 id="failure-title">Error details</h2></header>
    <pre class="failure-detail"></pre>
    <footer class="dlg-foot"><button class="btn" type="button">Close</button></footer>
  </form>`;
  const detail = dialog.querySelector("pre");
  const close = dialog.querySelector("button");
  if (!detail || !close) throw new Error("Incomplete error dialog");
  /** @type {(() => void) | undefined} */
  let pop;
  function dismiss() {
    if (!pop) return false;
    const undo = pop;
    pop = undefined;
    dialog.close();
    undo();
    return true;
  }
  ctx.listen(close, "click", dismiss);
  ctx.listen(dialog, "cancel", event => { event.preventDefault(); dismiss(); });
  ctx.listen(document, "click", ({ target }) => {
    const button = target instanceof Element ? target.closest("[data-failure-details]") : null;
    if (!button) return;
    detail.textContent = button.getAttribute("data-failure-details");
    if (!dialog.isConnected) document.body.append(dialog);
    if (!pop) {
      dialog.showModal();
      pop = ctx.pushLayer({ id: "failure-details", back: dismiss, escape: dismiss, returnFocus: button });
      close.focus();
    }
  });
  ctx.effect(() => () => { dismiss(); dialog.remove(); notices.drop(mid); });
  return (summary) => {
    const line = { kind: "halt", force: true, mid, ...summary };
    if (!notices.forMsg(mid, () => line, 8000)) notices.show(line, 8000);
  };
}
