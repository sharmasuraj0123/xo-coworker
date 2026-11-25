// @ts-check

/** @typedef {Parameters<typeof import("../core/platform/failure.js").createFailureSurface>[0]} PresentFailure */

/** @param {import("../core/kernel/types").ModuleContext} ctx @returns {PresentFailure} */
export function mountFailurePresenter(ctx) {
  const notices = ctx.use("notices");
  const mid = "system:application-failures";
  const dialog = document.createElement("dialog");
  dialog.setAttribute("aria-label", "Error details");
  const heading = document.createElement("h2");
  heading.textContent = "Error details";
  const detail = document.createElement("pre");
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  dialog.append(heading, detail, close);
  ctx.listen(close, "click", () => dialog.close());
  ctx.listen(document, "click", ({ target }) => {
    const button = target instanceof Element ? target.closest("[data-failure-details]") : null;
    if (!button) return;
    detail.textContent = button.getAttribute("data-failure-details");
    if (!dialog.isConnected) document.body.append(dialog);
    if (!dialog.open) dialog.showModal();
  });
  ctx.effect(() => () => { dialog.remove(); notices.drop(mid); });
  return (summary) => {
    const line = { kind: "halt", force: true, mid, ...summary };
    if (!notices.forMsg(mid, () => line, 8000)) notices.show(line, 8000);
  };
}
