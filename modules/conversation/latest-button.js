// @ts-check
import { space } from "../../core/platform/index.js";
import { ICON } from "../../core/ui/icons/names.js";

/** @param {import("./decoration-types.js").Conversation} E */
export function mountLatestButton(E) {
  const { conv, msgs, composer, scroller } = E;
  const { toLatest, fromLatest } = E.follow;
  const down = document.createElement("button");
  down.type = "button"; down.className = "mx-down"; down.title = "Back to the latest";
  down.innerHTML = `${ICON.chevron}<span class="mx-down-n" hidden></span>`;
  conv.append(down);
  let unseen = 0;
  const away = fromLatest;
  const tdock = E.tdock, herald = E.herald;
  function dockTop() {
    let top = composer.getBoundingClientRect().top;
    for (const el of tdock.querySelectorAll(":scope > *, :scope > * > *")) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.width > 0 && getComputedStyle(el).visibility !== "hidden") top = Math.min(top, r.top);
    }
    const d = down.getBoundingClientRect();
    for (const el of herald ? herald.children : []) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.right > d.left && r.left < d.right) top = Math.min(top, r.top);
    }
    return top;
  }
  function downSync() {
    const top = dockTop(), v = conv.getBoundingClientRect();
    if (Number.isFinite(top) && composer.getBoundingClientRect().height) down.style.bottom = `${Math.round(v.bottom - top + space("--s-3"))}px`;
    const room = top - 12 - 40 >= scroller.getBoundingClientRect().top + 8;
    const far = room && away() > Math.max(240, scroller.clientHeight * 0.5);
    if (!far) unseen = 0;
    down.classList.toggle("is-on", far);
    const n = /** @type {HTMLElement} */ (down.querySelector(".mx-down-n")), txt = unseen > 99 ? "99+" : String(unseen), label = unseen ? `${unseen} new below · back to the latest` : "Back to the latest";
    if (n.hidden !== !unseen) n.hidden = !unseen;
    if (n.textContent !== txt) n.textContent = txt;
    if (down.getAttribute("aria-label") !== label) down.setAttribute("aria-label", label);
  }
  let downT = 0;
  const downSoon = () => { if (!downT) downT = requestAnimationFrame(() => { downT = 0; downSync(); }); };
  scroller.addEventListener("scroll", downSoon, { passive: true });
  down.addEventListener("click", () => toLatest(true));
  new MutationObserver((ms) => {
    if (ms.reduce((n, m) => n + m.removedNodes.length, 0) > 6) { unseen = 0; requestAnimationFrame(downSync); return; }
    let news = 0;
    for (const m of ms) for (const n of m.addedNodes) {
      if (n.nodeType !== 1 || !(/** @type {HTMLElement} */ (n)).classList.contains("is-new") || !(/** @type {HTMLElement} */ (n)).matches(".m-them, .m-you")) continue;
      let after = (/** @type {HTMLElement} */ (n)).nextElementSibling;
      while (after && (after.classList.contains("mx-live") || !after.classList.contains("m"))) after = after.nextElementSibling;
      if (!after) news++;
    }
    if (news && away() > 80) unseen += news;
    requestAnimationFrame(downSync);
  }).observe(msgs, { childList: true });
  const downRO = new ResizeObserver(() => downSync());
  downRO.observe(scroller); downRO.observe(E.dock); downRO.observe(tdock); if (herald) downRO.observe(herald);
  let downRaf = 0;
  /** @param {number} until */
  const followDock = (until) => { cancelAnimationFrame(downRaf); const step = () => { downSync(); if (performance.now() < until) downRaf = requestAnimationFrame(step); }; step(); };
  new MutationObserver(() => {
    const a = E.host, first = tdock.firstElementChild;
    a.classList.toggle("has-tdock", !!first);
    a.classList.toggle("has-tdock-card", !!tdock.querySelector(":scope > .card"));
    followDock(performance.now() + 700);
  }).observe(tdock, { childList: true, subtree: true });
  if (herald) new MutationObserver(() => followDock(performance.now() + 700)).observe(herald, { childList: true });
}
