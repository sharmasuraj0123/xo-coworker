// @ts-check
import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { classify, glyph, TOPICS } from "./projicons.js";
import { wirePickKeys } from "./icon-picker-keys.js";

/** @param {string} k */
const topicName = (k) => (k === "project" ? "Cube" : k[0].toUpperCase() + k.slice(1));

/** @param {import("./icon-picker-types.d.ts").IconPickerDeps} options */
export function createProjectIconPicker({ world, SHAPE, PROJ, ownIcon, forgetIcon, announce, render }) {
  /** @type {{ el: HTMLElement | null, pid: string | null, from: HTMLElement | null }} */
  const PICK = { el: null, pid: null, from: null };

  /** @param {string} pid @param {HTMLElement} from */
  function pickIcon(pid, from) {
    if (PICK.el && PICK.pid === pid) { closePick(); return; }
    closePick();
    const own = ownIcon(pid), name = PROJ(pid);
    const guess = classify((world.project(pid) || {}).name || pid, world.state.threads.filter((t) => t.project === pid).map((t) => t.title || "")).icon;
    /** @param {string} k @param {string} label @param {string} svg @param {boolean} on */
    const opt = (k, label, svg, on) => `<button type="button" class="pk-o${on ? " is-on" : ""}" role="radio" aria-checked="${on}" data-pk="${k}" title="${esc(label)}" aria-label="${esc(label)}" tabindex="${on ? 0 : -1}">${svg}</button>`;
    const el = document.createElement("div");
    el.className = "side-pop pk-pop"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", `${name}'s icon`);
    el.innerHTML = `<div class="se-h"><b>${esc(name)}'s icon</b><span>Kept on every device you use. Automatic picks one from its name and threads.</span></div>` +
      `<div class="pk-grid" role="radiogroup" aria-label="Icons">${opt("", `Automatic (${topicName(guess)})`, `<span class="pk-auto">${glyph(guess)}<i>A</i></span>`, !own)}` +
      [...TOPICS, "project"].map((k) => opt(k, topicName(k), glyph(k), own === k)).join("") + `</div>`;
    document.body.append(el);
    const r = from.getBoundingClientRect();
    el.style.setProperty("--pop-x", `${Math.round(r.left - 8)}px`); el.style.setProperty("--pop-y", `${Math.round(r.bottom + 8 + 8)}px`);
    el.hidden = false;
    PICK.el = el; PICK.pid = pid; PICK.from = from;
    from.setAttribute("aria-expanded", "true");
    (/** @type {HTMLElement} */ (el.querySelector('.pk-o[tabindex="0"]'))).focus({ preventScroll: true });
    el.addEventListener("click", (e) => { const o = (/** @type {HTMLElement} */ (e.target)).closest("[data-pk]"); if (o) chooseIcon(pid, /** @type {string} */ ((/** @type {HTMLElement} */ (o)).dataset.pk)); });
    wirePickKeys(el, closePick);
  }

  function closePick({ focus = false } = {}) {
    if (!PICK.el) return;
    PICK.el.remove(); PICK.from?.setAttribute("aria-expanded", "false");
    const back = $(`[data-pj-icon="${CSS.escape(/** @type {string} */ (PICK.pid))}"]`);
    PICK.el = null; PICK.pid = null; PICK.from = null;
    if (focus) back?.focus({ preventScroll: true });
  }

  /** @param {string} pid @param {string} k */
  function chooseIcon(pid, k) {
    SHAPE.patchMine({ layout: { icons: { [pid]: k || null } } });
    forgetIcon(pid);
    closePick({ focus: true });
    announce(k ? `${PROJ(pid)} wears ${topicName(k)}` : `${PROJ(pid)}'s icon is automatic again`);
    render();
  }

  return { PICK, pickIcon, closePick };
}
