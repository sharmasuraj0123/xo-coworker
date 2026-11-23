// Launchpad's window: one project's deploy over the app, its sections down the side; Esc, the × or the dim closes it.
import { ICON } from "./ui.js";
import { xi } from "./icon.js";

export function createLpWindow({ launch, projectOf, nameOf, iconOf, allApps, onChange }) {
  const d = document.createElement("dialog");
  d.className = "dlg lq";
  d.id = "lq";
  d.setAttribute("aria-labelledby", "lq-title");
  d.innerHTML = `<nav class="lq-side nav" aria-label="Launchpad"><div class="nrow lq-me"><span class="nr-ic"></span><span><b></b><small class="lp-hs"></small></span></div>` +
    `<div class="lq-nav"></div><span class="lq-gap"></span>` +
    `<button type="button" class="nrow" data-lq-all><span class="nr-ic">${xi("grid")}</span><span>All apps</span></button></nav>` +
    `<div class="lq-main"><div class="fr-b lq-body" tabindex="-1"></div><button type="button" class="lq-x" data-lq-close aria-label="Close" title="Close (Esc)">${ICON.close}</button><div class="lq-notes" aria-live="polite"></div></div>`;
  document.body.appendChild(d);
  const S = { v: null, back: null };
  launch.mount(d, { hide: () => close() });

  function paintMe() {
    const p = projectOf(S.v);
    const me = d.querySelector(".lq-me"), ic = iconOf(p) || "";
    if (me._p !== p) { me.querySelector(".nr-ic").innerHTML = ic; me.querySelector("b").textContent = nameOf(p); me._p = p; }
  }
  function open(v, from = document.activeElement) {
    S.v = v; S.back = from && from !== document.body ? from : null;
    paintMe();
    launch.paint(v, true);
    if (!d.open) { d.classList.remove("is-closing"); d.showModal(); }
    d.querySelector(".lq-body").focus({ preventScroll: true });
    onChange && onChange();
  }
  const close = () => { if (d.open) d.close(); };
  // closed by any way (Esc, the ×, the dim, a thread opened from it): the header's Deploy shows it and focus goes back
  d.addEventListener("close", () => {
    launch.paint(S.v, false);
    launch.away();
    const back = S.back && S.back.isConnected ? S.back : document.querySelector("[data-lp-open]");
    S.back = null;
    back?.focus({ preventScroll: true });
    onChange && onChange();
  });
  d.addEventListener("click", (e) => {
    if (e.target === d) { close(); return; } // the dim around it
    if (e.target.closest("[data-lq-close]")) { close(); return; }
    if (e.target.closest("[data-lq-all]")) { close(); allApps && allApps(); }
  });

  return {
    open, close,
    get isOpen() { return d.open; },
    get view() { return d.open ? S.v : null; },
    /** Every render: the open window draws what changed. */
    sync() { if (d.open) launch.paint(S.v, true); },
    /** One of the window's own actions, pressed once it's drawn (the page's fixes). */
    press(name) { requestAnimationFrame(() => launch.press(name)); },
  };
}
