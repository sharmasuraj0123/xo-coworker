// @ts-check

// Jump (⌘K): one field over the places, threads and actions; arrows or the pointer choose, Enter or a click goes.

import { esc } from "../../core/platform/util.js";

/** @param {import("./types").JumpDeps} deps */
export function createJump({ host, field, list, places, actions, more, go, announce, focusIn, onHidden }) {
  let jsel = 0;
  /** @type {import("./types").JumpItem[]} */
  let jitems = [];
  /** @type {Element | null} */
  let jumpReturn = null;

  function render() {
    const q = field.value.trim().toLowerCase();
    const all = places(q);
    // verbs, after the places and only when typed for: searching never runs one; Enter or a click does
    const verbs = q ? actions().filter((x) => x.name.toLowerCase().includes(q)) : [];
    jitems = all.filter((x) => !q || (x.name + " " + x.sub).toLowerCase().includes(q)).concat(verbs, more(q));
    jsel = Math.min(jsel, Math.max(0, jitems.length - 1));
    list.innerHTML = jitems.map((x, i) => `<li role="option" id="j-${i}" aria-selected="${i === jsel}" data-i="${i}" class="${x.t ? "is-t" : ""}"><span class="j-ic">${x.icon}</span><span class="j-n">${esc(x.name)}</span><span class="j-s">${esc(x.sub)}</span></li>`).join("") || `<li class="j-none">Nothing matches “${esc(q)}”.</li>`;
    field.setAttribute("aria-activedescendant", jitems.length ? `j-${jsel}` : "");
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }
  function open() { jumpReturn = document.activeElement; host.hidden = false; field.value = ""; jsel = 0; render(); focusIn(field); }
  function close({ restore = true } = {}) { if (host.hidden) return; host.hidden = true; onHidden(); const r = /** @type {HTMLElement | null} */ (jumpReturn); if (restore && r && r.isConnected && r.offsetParent) r.focus({ preventScroll: true }); }
  /** @param {import("./types").JumpItem} x */
  const pick = (x) => { close({ restore: !!x.run }); if (x.run) x.run(); else go(/** @type {string} */ (x.v)); };
  field.addEventListener("input", () => { jsel = 0; render(); });
  field.addEventListener("keydown", (e) => {
    // an IME's keys are the word's: none of them moves the selection or closes Jump
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); jsel = (jsel + (e.key === "ArrowDown" ? 1 : jitems.length - 1)) % Math.max(1, jitems.length); render(); }
    // with nothing found, Jump stays open on what you typed
    if (e.key === "Enter") { e.preventDefault(); const x = jitems[jsel]; if (!x) { announce("Nothing matches. Change what you typed, or Esc to close."); return; } close({ restore: !!x.run }); x.run ? x.run() : go(/** @type {string} */ (x.v)); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  });
  /** @param {Event} e */
  const row = (e) => /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest("[data-i]"));
  // the row under a moving pointer becomes the selection; a list scrolling under a still pointer never does
  list.addEventListener("pointermove", (e) => {
    const li = row(e);
    if (!li || +(li.dataset.i ?? "") === jsel) return;
    list.querySelector('[aria-selected="true"]')?.setAttribute("aria-selected", "false");
    jsel = +(li.dataset.i ?? ""); li.setAttribute("aria-selected", "true");
    field.setAttribute("aria-activedescendant", li.id);
  });
  list.addEventListener("click", (e) => { const li = row(e); if (li) pick(jitems[+(li.dataset.i ?? "")]); });
  host.addEventListener("mousedown", (e) => { if (e.target === host) close(); });

  return { open, close, get isOpen() { return !host.hidden; } };
}
