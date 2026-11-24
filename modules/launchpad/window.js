// @ts-check
import { createScope } from "../../core/kernel/scope.js";
import { ICON } from "../../core/ui/icons/names.js";
import { xi } from "../../core/ui/icons/icon.js";

/** @param {import("./surface-types.d.ts").LaunchpadWindowOptions} options */
export function createLpWindow({ launch, projectOf, nameOf, iconOf, allApps, onChange }) {
  const scope = createScope();
  const d = document.createElement("dialog");
  d.className = "dlg lq";
  d.id = "lq";
  d.setAttribute("aria-labelledby", "lq-title");
  d.innerHTML = `<nav class="lq-side nav" aria-label="Launchpad"><div class="nrow lq-me"><span class="nr-ic"></span><span><b></b><small class="lp-hs"></small></span></div>` +
    `<div class="lq-nav"></div><span class="lq-gap"></span>` +
    `<button type="button" class="nrow" data-lq-all><span class="nr-ic">${xi("grid")}</span><span>All apps</span></button></nav>` +
    `<div class="lq-main"><div class="fr-b lq-body" tabindex="-1"></div><button type="button" class="lq-x" data-lq-close aria-label="Close" title="Close (Esc)">${ICON.close}</button><div class="lq-notes" aria-live="polite"></div></div>`;
  document.body.appendChild(d);
  /** @type {string | null} */
  let view = null;
  /** @type {Element | null} */
  let back = null;
  /** @type {string | null | undefined} */
  let painted;
  scope.effect(() => () => { close(); d.remove(); });
  launch.mount(d, { open: show, hide: () => close() }, scope);

  function paintMe() {
    const project = projectOf(view);
    if (painted === project) return;
    const icon = d.querySelector(".lq-me .nr-ic"), name = d.querySelector(".lq-me b");
    if (icon) icon.innerHTML = iconOf(project) || "";
    if (name) name.textContent = nameOf(project);
    painted = project;
  }
  /** @param {string} v */
  function open(v, from = document.activeElement) {
    if (scope.signal.aborted) return;
    view = v;
    back = from && from !== document.body ? from : null;
    paintMe();
    launch.paint(v, true);
    show();
    const body = d.querySelector(".lq-body");
    if (body instanceof HTMLElement) body.focus({ preventScroll: true });
    onChange?.();
  }
  function show() {
    if (d.open) return;
    d.classList.remove("is-closing");
    d.showModal();
  }
  const close = () => { if (d.open) d.close(); };
  scope.listen(d, "close", () => {
    if (view !== null) launch.paint(view, false);
    launch.away();
    const target = back?.isConnected ? back : document.querySelector("[data-lp-open]");
    back = null;
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    onChange?.();
  });
  scope.listen(d, "click", (e) => {
    if (e.target === d) { close(); return; }
    if (!(e.target instanceof Element)) return;
    if (e.target.closest("[data-lq-close]")) { close(); return; }
    if (e.target.closest("[data-lq-all]")) { close(); allApps && allApps(); }
  });

  return {
    open, close, dispose: scope.dispose,
    get isOpen() { return d.open; },
    get view() { return d.open ? view : null; },
    /** Every render: the open window draws what changed. */
    sync() { if (d.open && view !== null) launch.paint(view, true); },
    /** @param {string} name */
    press(name) { scope.frame(() => launch.press(name)); },
  };
}
