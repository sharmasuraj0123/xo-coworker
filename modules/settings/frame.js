// @ts-check

// Settings: a page over the main area with a rail of tabs; closing it returns exactly where you were.

/** @param {import("./types").SettingsFrameDeps} deps */
export function createSettingsFrame({ el, side, phoneButton, closeButton, onPage, beforeOpen, beforeClose, onHidden, focusIn, fallback, phone }) {
  /** @type {Element | null} */
  let setReturn = null;
  const all = (/** @type {string} */ sel) => /** @type {HTMLElement[]} */ ([...document.querySelectorAll(sel)]);
  /** @param {string} id */
  function setPage(id) {
    // the rail is a tablist: only the chosen tab is in the Tab order, Tab goes on into its page
    for (const b of all("[data-set]")) { const on = b.dataset.set === id; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; }
    for (const p of all("[data-page]")) p.hidden = p.dataset.page !== id;
    onPage(id);
  }
  function open() {
    if (!el.hidden) return;
    // the layers Settings takes the place of close first: where the keyboard is then is where closing returns it
    beforeOpen();
    setReturn = document.activeElement;
    el.hidden = false;
    side.classList.add("is-on");
    side.setAttribute("aria-expanded", "true");
    const first = /** @type {HTMLElement | null} */ (el.querySelector('[aria-selected="true"]'));
    if (first) focusIn(first);
  }
  function close({ restore = true } = {}) {
    if (el.hidden) return;
    beforeClose();
    el.hidden = true;
    onHidden();
    side.classList.remove("is-on");
    side.setAttribute("aria-expanded", "false");
    // back where you were, if it can take the keyboard; else the composer
    const takes = (/** @type {any} */ x) => !!x && x !== document.body && x.isConnected && x.getClientRects().length > 0 && !x.closest("[inert]") && !x.disabled;
    if (restore) /** @type {HTMLElement | undefined} */ ([setReturn, fallback()].find(takes))?.focus({ preventScroll: true });
  }
  side.addEventListener("click", () => (el.hidden ? open() : close()));
  phoneButton.addEventListener("click", open);
  closeButton.addEventListener("click", () => close());
  // a link into one Settings page (a thread's runtime name opens Runtimes)
  document.addEventListener("click", (e) => { const b = /** @type {any} */ (e.target).closest("[data-set-open]"); if (b) { setPage(b.dataset.setOpen); if (el.hidden) open(); else /** @type {HTMLElement | null} */ (el.querySelector('[aria-selected="true"]'))?.focus({ preventScroll: true }); } });
  const nav = /** @type {HTMLElement} */ (el.querySelector(".set-nav"));
  // one listener for every tab, so a tab added later (a settings.section) is a tab too
  nav.addEventListener("click", (e) => { const b = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest("[data-set]")); if (b) setPage(/** @type {string} */ (b.dataset.set)); });
  // the rail's keys (WAI-ARIA tabs, chosen as they're reached): arrows the next or previous, wrapping; Home, End
  nav.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tabs = all("[data-set]");
    const i = tabs.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (i < 0) return;
    const j = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1
      : e.key === "ArrowDown" || e.key === "ArrowRight" ? (i + 1) % tabs.length
      : e.key === "ArrowUp" || e.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : -1;
    if (j < 0) return;
    e.preventDefault();
    tabs[j].focus(); setPage(/** @type {string} */ (tabs[j].dataset.set));
  });
  // a column of tabs at the side; on a phone, a row across the top
  const orient = () => nav.setAttribute("aria-orientation", phone.matches ? "horizontal" : "vertical");
  orient(); phone.addEventListener("change", orient);
  return { setPage, open, close };
}
