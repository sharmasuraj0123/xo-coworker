// @ts-check
import { esc } from "../../core/platform/util.js";
import { autoTint, classify, glyph, TINTS, TOPICS } from "./projicons.js";
import { wirePickKeys } from "./icon-picker-keys.js";

/** @param {string} k */
const topicName = (k) => (k === "project" ? "Cube" : k[0].toUpperCase() + k.slice(1));

/** @param {string} k @param {string} label @param {number} t @param {boolean} on @param {string} [mark] */
const swatch = (k, label, t, on, mark = "") =>
  `<button type="button" class="pk-o pk-sw${on ? " is-on" : ""}" role="radio" aria-checked="${on}" data-pt="${k}" data-tint="${t}"` +
  ` title="${esc(label)}" aria-label="${esc(label)}" tabindex="${on ? 0 : -1}"><span class="pk-dot">${mark}</span></button>`;

/** The colour row: automatic, every colour, none. @param {number | null} tint @param {number} auto */
const colourRow = (tint, auto) => `<div class="pk-grid" role="radiogroup" aria-label="Colours">` +
  swatch("", `Automatic (colour ${auto})`, auto, tint == null, "<i>A</i>") +
  Array.from({ length: TINTS }, (_, i) => swatch(String(i + 1), `Colour ${i + 1}`, i + 1, tint === i + 1)).join("") +
  swatch("0", "No colour", 0, tint === 0) + `</div>`;

/** @param {import("./icon-picker-types.d.ts").IconPickerDeps} options */
export function createProjectIconPicker({ world, SHAPE, PROJ, ownIcon, ownTint, forgetIcon, announce, render }) {
  /** @type {{ el: HTMLElement | null, pid: string | null, from: HTMLElement | null }} */
  const PICK = { el: null, pid: null, from: null };

  let release = () => {};
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
      [...TOPICS, "project"].map((k) => opt(k, topicName(k), glyph(k), own === k)).join("") + `</div>` +
      colourRow(ownTint(pid), autoTint((world.project(pid) || {}).name || pid));
    document.body.append(el);
    const r = from.getBoundingClientRect();
    el.style.setProperty("--pop-x", `${Math.round(r.left - 8)}px`); el.style.setProperty("--pop-y", `${Math.round(r.bottom + 8 + 8)}px`);
    el.hidden = false;
    PICK.el = el; PICK.pid = pid; PICK.from = from;
    from.setAttribute("aria-expanded", "true");
    (/** @type {HTMLElement} */ (el.querySelector('.pk-o[tabindex="0"]'))).focus({ preventScroll: true });
    /** @param {Event} event */
    const click = (event) => {
      const option = event.target instanceof Element && event.target.closest("[data-pk],[data-pt]");
      if (!(option instanceof HTMLElement)) return;
      if (option.dataset.pt != null) chooseTint(pid, option.dataset.pt); else chooseIcon(pid, option.dataset.pk || "");
    };
    el.addEventListener("click", click);
    const stopKeys = wirePickKeys(el, closePick);
    release = () => { el.removeEventListener("click", click); stopKeys(); };
  }

  function closePick({ focus = false } = {}) {
    if (!PICK.el) return;
    release(); release = () => {};
    PICK.el.remove(); PICK.from?.setAttribute("aria-expanded", "false");
    const back = /** @type {HTMLElement | null} */ (document.querySelector(`[data-pj-icon="${CSS.escape(/** @type {string} */ (PICK.pid))}"]`));
    PICK.el = null; PICK.pid = null; PICK.from = null;
    if (focus) back?.focus({ preventScroll: true });
  }

  /** @param {string} pid @param {string | null} icon @param {number | null} tint */
  function keep(pid, icon, tint) {
    SHAPE.patchMine({ layout: { icons: { [pid]: icon == null && tint == null ? null : { icon, tint } } } });
    forgetIcon(pid);
    closePick({ focus: true });
    render();
  }
  /** @param {string} pid @param {string} k */
  function chooseIcon(pid, k) {
    keep(pid, k || null, ownTint(pid));
    announce(k ? `${PROJ(pid)} wears ${topicName(k)}` : `${PROJ(pid)}'s icon is automatic again`);
  }
  /** @param {string} pid @param {string} k */
  function chooseTint(pid, k) {
    keep(pid, ownIcon(pid), k ? Number(k) : null);
    const p = PROJ(pid);
    announce(k === "0" ? `${p} has no colour` : k ? `${p} wears colour ${k}` : `${p}'s colour is automatic again`);
  }

  return { PICK, pickIcon, closePick };
}
