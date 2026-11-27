// @ts-check

// <xo-date>: the app's day chooser in place of <input type="date">, written and read like one, its value and min as YYYY-MM-DD.

import { xi } from "../icons/icon.js";
import { RM, setText } from "../motion.js";
import { createScope } from "../../kernel/scope.js";
import { formatDate } from "../../platform/calendar.js";

const GAP = 4;
const EDGE = 8;
const WEEKS = 6;
const LONG = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const NARROW = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });
const MONDAY = new Date(2024, 0, 1);
let seq = 0;
/** Only one calendar is ever open. @type {XoDate | null} */
let openOne = null;

/** @param {number} n */
const two = (n) => String(n).padStart(2, "0");
/** @param {Date} d */
const isoDay = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
/** @param {string | null | undefined} s */
function dayFrom(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
/** @param {Date} d */
const words = (d) => `${formatDate(d, "weekday")} ${d.getDate()} ${formatDate(d, "month")}`;
/** @param {Date} d @param {number} days */
const plus = (d, days) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

class XoDate extends HTMLElement {
  /** @type {string | null} */
  #v = null;
  #open = false;
  #id = "";
  #cur = new Date();
  #shown = new Date();
  /** @type {HTMLButtonElement | null} */
  #btn = null;
  /** @type {HTMLDivElement | null} */
  #pop = null;
  /** @type {ReturnType<typeof createScope> | null} */
  #openScope = null;
  /** @type {ReturnType<typeof createScope> | null} */
  #exitScope = null;

  static get observedAttributes() { return ["value", "min", "disabled", "aria-label"]; }
  /** @returns {string} */
  get value() { return this.#v ?? this.getAttribute("value") ?? ""; }
  set value(/** @type {unknown} */ v) { this.#v = String(v); this.#paint(); }
  get disabled() { return this.hasAttribute("disabled"); }
  /** @override @param {FocusOptions} [opts] */
  focus(opts) { this.#btn?.focus(opts); }

  /** @param {string} name */
  attributeChangedCallback(name) {
    if (name === "value") this.#v = null;
    if (this.#open && this.disabled) this.close(false);
    this.#paint();
  }

  connectedCallback() {
    const { btn, pop } = this.#built();
    if (btn.parentNode !== this) this.append(btn);
    if (pop.parentNode !== this) this.append(pop);
    this.#paint();
  }
  disconnectedCallback() { this.close(false, false); }

  #built() {
    if (this.#btn && this.#pop) return { btn: this.#btn, pop: this.#pop };
    const id = this.#id = `dt${++seq}`;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "dd-btn"; btn.innerHTML = `<span class="dd-v"></span>`;
    for (const [k, v] of [["role", "combobox"], ["aria-haspopup", "grid"], ["aria-expanded", "false"], ["aria-controls", `${id}-g`]]) {
      btn.setAttribute(k, v);
    }
    const pop = document.createElement("div");
    pop.className = "dd-menu dt-pop"; pop.hidden = true;
    pop.innerHTML = `<div class="dt-hd"><b class="dt-mo" aria-live="polite"></b>` +
      `<button type="button" class="dt-nav" data-step="-1" tabindex="-1" aria-label="Previous month">${xi("chevron-left")}</button>` +
      `<button type="button" class="dt-nav" data-step="1" tabindex="-1" aria-label="Next month">${xi("chevron-right")}</button></div>` +
      `<div class="dt-grid" role="grid" id="${id}-g"></div>`;
    btn.addEventListener("click", () => (this.#open ? this.close(true) : this.open()));
    btn.addEventListener("keydown", (e) => this.#key(e));
    btn.addEventListener("blur", () => queueMicrotask(() => { if (document.activeElement !== btn) this.close(false); }));
    pop.addEventListener("pointerdown", (e) => e.preventDefault());
    pop.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const t = e.target instanceof Element ? e.target : null;
      const step = t?.closest("[data-step]");
      if (step instanceof HTMLButtonElement && !step.disabled) this.#month(Number(step.dataset.step));
      const cell = t?.closest("[data-day]");
      if (cell instanceof HTMLElement && cell.getAttribute("aria-disabled") !== "true") this.#choose(dayFrom(cell.dataset.day));
    });
    this.#btn = btn; this.#pop = pop;
    return { btn, pop };
  }

  #paint() {
    if (!this.#btn) return;
    const d = dayFrom(this.value);
    setText(this.#btn.querySelector(".dd-v"), d ? words(d) : "");
    const label = this.getAttribute("aria-label");
    if (label) this.#btn.setAttribute("aria-label", d ? `${label}, ${LONG.format(d)}` : label);
    this.#btn.disabled = this.disabled;
  }

  #min() { return dayFrom(this.getAttribute("min")); }

  #grid() {
    const pop = this.#pop, first = this.#shown, min = this.#min();
    if (!pop) return;
    const chosen = this.value, today = isoDay(new Date()), cur = isoDay(this.#cur), id = this.#id;
    setText(pop.querySelector(".dt-mo"), formatDate(first, "monthYear"));
    const back = pop.querySelector('[data-step="-1"]');
    if (back instanceof HTMLButtonElement) back.disabled = !!min && first <= min;
    const head = Array.from({ length: 7 }, (_, i) => plus(MONDAY, i)).map((d) =>
      `<span role="columnheader" aria-label="${formatDate(d, "fullWeekday")}">${NARROW.format(d)}</span>`).join("");
    const start = plus(first, -((first.getDay() + 6) % 7));
    const rows = Array.from({ length: WEEKS }, (_, w) => `<div role="row">${Array.from({ length: 7 }, (__, i) => {
      const d = plus(start, w * 7 + i), key = isoDay(d);
      if (d.getMonth() !== first.getMonth()) return `<span role="gridcell"></span>`;
      const off = !!min && d < min;
      return `<span role="gridcell" id="${id}-${key}" data-day="${key}" aria-label="${LONG.format(d)}"` +
        ` aria-selected="${key === chosen}"${off ? ' aria-disabled="true"' : ""}${key === today ? ' aria-current="date"' : ""}` +
        `${key === cur ? ' class="is-cur"' : ""}>${d.getDate()}</span>`;
    }).join("")}</div>`).join("");
    const grid = pop.querySelector(".dt-grid");
    if (grid) grid.innerHTML = `<div role="row">${head}</div>${rows}`;
    this.#btn?.setAttribute("aria-activedescendant", `${id}-${cur}`);
  }

  /** @param {Date} to */
  #move(to) {
    const min = this.#min();
    this.#cur = min && to < min ? min : to;
    this.#shown = new Date(this.#cur.getFullYear(), this.#cur.getMonth(), 1);
    this.#grid();
  }

  /** @param {number} step */
  #month(step) {
    const c = this.#cur, last = new Date(c.getFullYear(), c.getMonth() + step + 1, 0).getDate();
    this.#move(new Date(c.getFullYear(), c.getMonth() + step, Math.min(c.getDate(), last)));
  }

  open() {
    const { btn, pop } = this.#built();
    if (this.#open || this.disabled) return;
    if (openOne && openOne !== this) openOne.close(false);
    this.#exitScope?.dispose(); this.#exitScope = null;
    openOne = this; this.#open = true;
    this.#move(dayFrom(this.value) ?? this.#min() ?? new Date());
    pop.classList.remove("is-out", "is-up", "is-in");
    pop.hidden = false;
    this.#place();
    pop.classList.add("is-in");
    btn.setAttribute("aria-expanded", "true");
    const scope = this.#openScope = createScope();
    scope.listen(document, "pointerdown", (e) => { if (!(e.target instanceof Node) || !this.contains(e.target)) this.close(false); }, true);
    scope.listen(window, "scroll", (e) => { if (!(e.target instanceof Node) || !pop.contains(e.target)) this.close(false); }, true);
    scope.listen(window, "resize", () => this.close(false));
  }

  /** Under the button, its left edge on the button's; above when below is short. */
  #place() {
    const pop = this.#pop, btn = this.#btn;
    if (!pop || !btn) return;
    const b = btn.getBoundingClientRect();
    pop.style.left = pop.style.top = "0px";
    const zero = pop.getBoundingClientRect(), { width: w, height: h } = zero;
    const below = innerHeight - b.bottom - GAP - EDGE, up = h > below && b.top - GAP - EDGE > below;
    const left = Math.min(Math.max(EDGE, b.left), innerWidth - EDGE - w);
    pop.style.left = `${left - zero.left}px`;
    pop.style.top = `${(up ? b.top - GAP - h : b.bottom + GAP) - zero.top}px`;
    pop.classList.toggle("is-up", up);
  }

  /** @param {boolean} refocus */
  close(refocus, animate = true) {
    if (!this.#open) return;
    this.#open = false; if (openOne === this) openOne = null;
    this.#openScope?.dispose(); this.#openScope = null;
    const pop = this.#pop, btn = this.#btn;
    btn?.setAttribute("aria-expanded", "false");
    btn?.removeAttribute("aria-activedescendant");
    if (refocus) btn?.focus({ preventScroll: true });
    if (!pop) return;
    const hide = () => { this.#exitScope?.dispose(); this.#exitScope = null; pop.hidden = true; pop.classList.remove("is-out", "is-in"); };
    if (RM.matches || !animate) { hide(); return; }
    const scope = this.#exitScope = createScope();
    pop.classList.add("is-out");
    scope.listen(pop, "animationend", hide);
    scope.timeout(hide, 220);
  }

  /** @param {Date | null} d */
  #choose(d) {
    if (!d) return;
    const v = isoDay(d), changed = v !== this.value;
    this.#v = v; this.#paint();
    this.close(true);
    if (!changed) return;
    this.dispatchEvent(new Event("input", { bubbles: true }));
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** @param {KeyboardEvent} e */
  #key(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key, c = this.#cur;
    const take = () => { e.preventDefault(); e.stopPropagation(); };
    if (!this.#open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(k)) { take(); this.open(); }
      return;
    }
    const by = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -((c.getDay() + 6) % 7), End: 6 - ((c.getDay() + 6) % 7) };
    if (k in by) { take(); this.#move(plus(c, by[/** @type {keyof typeof by} */ (k)])); return; }
    if (k === "PageUp" || k === "PageDown") { take(); this.#month((k === "PageUp" ? -1 : 1) * (e.shiftKey ? 12 : 1)); return; }
    if (k === "Enter" || k === " ") { take(); this.#choose(c); return; }
    if (k === "Escape") { take(); this.close(true); return; }
    if (k === "Tab") this.close(false);
  }
}

export function defineXoDate() {
  if (!customElements.get("xo-date")) customElements.define("xo-date", XoDate);
}
