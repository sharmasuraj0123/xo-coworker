// @ts-check

// <xo-select>: the app's one dropdown in place of <select>, written and read like one, a WAI-ARIA select-only combobox with a fixed list.

import { ICON } from "../icons/names.js";
import { hasIcon, xi } from "../icons/icon.js";
import { RM, setText } from "../motion.js";
import { createScope } from "../../kernel/scope.js";

const CHEV = ICON.chevron;
const GAP = 4; // trigger → list
const EDGE = 8; // the list never comes closer than this to the window's edge
const TYPE_MS = 600; // type-ahead: keys closer than this make one word
let seq = 0;
/** Only one list is ever open. @type {XoSelect | null} */
let openOne = null;

class XoSelect extends HTMLElement {
  /** @type {{ scope: ReturnType<typeof createScope>, observer: MutationObserver } | null} */
  #connection = null;
  /** @type {ReturnType<typeof createScope> | null} */
  #openScope = null;
  /** @type {ReturnType<typeof createScope> | null} */
  #exitScope = null;

  constructor() {
    super();
    /** @type {string | null} */
    this._v = null;
    this._active = -1; this._typed = ""; this._typedAt = 0; this._built = false; this._open = false; this._focused = false; this._id = "";
    this._btn = /** @type {HTMLButtonElement} */ (/** @type {unknown} */ (null));
    this._menu = /** @type {HTMLDivElement} */ (/** @type {unknown} */ (null));
  }

  /** @returns {HTMLOptionElement[]} */
  get options() { return /** @type {HTMLOptionElement[]} */ ([...this.children].filter((c) => c.tagName === "OPTION")); }
  get value() { return this._v ?? (this.options[0]?.value ?? ""); }
  set value(/** @type {unknown} */ v) { this._v = String(v); this._paint(); }
  get selectedIndex() { return this.options.findIndex((o) => o.value === this.value); }
  get disabled() { return this.hasAttribute("disabled"); }
  set disabled(/** @type {boolean} */ on) { this.toggleAttribute("disabled", !!on); }
  /** Held while its choice is being saved (aria-busy or aria-disabled): it keeps focus and its place, but takes no new choice and doesn't open. */
  get held() { return this.getAttribute("aria-busy") === "true" || this.getAttribute("aria-disabled") === "true"; }
  /** @override @param {FocusOptions} [opts] */
  focus(opts) { this._btn?.focus(opts); }
  /** @override */
  blur() { this._btn?.blur(); }

  static get observedAttributes() { return ["disabled", "aria-label", "aria-busy", "aria-disabled"]; }
  attributeChangedCallback() { if (!this._built) return; if (this._open && (this.disabled || this.held)) this.close(true); this._paint(); }

  connectedCallback() {
    if (!this._built) this._build();
    const scope = createScope();
    const observer = new MutationObserver((recs) => {
      if (!recs.every((r) => this._menu.contains(r.target) || this._btn.contains(r.target))) this._sync(recs);
    });
    scope.observe(observer);
    this.#connection = { scope, observer };
    observer.observe(this, {
      childList: true, subtree: true, attributes: true, characterData: true,
      attributeFilter: ["selected", "disabled", "value", "label", "data-desc"],
    });
    this._sync();
  }
  disconnectedCallback() {
    this.close(false, false);
    this.#hideMenu();
    this.#connection?.scope.dispose();
    this.#connection = null;
  }

  _build() {
    this._built = true;
    const id = `dd${++seq}`;
    this._id = id;
    const b = document.createElement("button");
    b.type = "button"; b.className = "dd-btn"; b.id = `${id}-b`;
    b.setAttribute("role", "combobox");
    b.setAttribute("aria-haspopup", "listbox");
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-controls", `${id}-l`);
    b.innerHTML = `<span class="dd-v"></span>${CHEV}`;
    const m = document.createElement("div");
    m.className = "dd-menu"; m.id = `${id}-l`; m.hidden = true; m.tabIndex = -1;
    m.setAttribute("role", "listbox");
    b.setAttribute("data-own", ""); m.setAttribute("data-own", ""); // a redraw keeps to the options
    this._btn = b; this._menu = m;

    b.addEventListener("click", () => (this._open ? this.close(true) : this.open()));
    b.addEventListener("keydown", (e) => this._key(e));
    b.addEventListener("focus", () => { this._focused = true; }); // focus a re-render takes away comes back with the button
    b.addEventListener("blur", () => queueMicrotask(() => {
      if (b.parentNode !== this || document.activeElement === b) return; // blur comes before the removal: look once it's done
      this._focused = false;
      if (this._open) this.close(false);
    }));
    // a press in the list never takes focus from the button (so blur means "focus went elsewhere")
    m.addEventListener("pointerdown", (e) => e.preventDefault());
    m.addEventListener("pointermove", (e) => {
      const row = e.target instanceof Element ? e.target.closest(".dd-row") : null;
      if (row instanceof HTMLElement && !row.hasAttribute("aria-disabled")) this._activate(Number(row.dataset.i), false);
    });
    m.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation(); // inside a <label>, a click on the list must not reach the button too
      const row = e.target instanceof Element ? e.target.closest(".dd-row") : null;
      if (row instanceof HTMLElement && !row.hasAttribute("aria-disabled")) this._choose(Number(row.dataset.i));
    });
  }

  /** The options are the source; the choice changes only when the options or their selected change, never for a disabled or a description. @param {MutationRecord[] | null} [recs] */
  _sync(recs = null) {
    let back = false;
    if (this._btn.parentNode !== this) { this.append(this._btn); back = true; }
    if (this._menu.parentNode !== this) this.append(this._menu);
    if (back && this._focused && this.isConnected && (!document.activeElement || document.activeElement === document.body)) this._btn.focus({ preventScroll: true });
    this.#connection?.observer.takeRecords();
    const opts = this.options;
    const marked = opts.find((o) => o.hasAttribute("selected"));
    const ours = (/** @type {Node | null} */ n) => !!n && (n === this._btn || n === this._menu || this._btn.contains(n) || this._menu.contains(n));
    const adopt = !recs || recs.some((r) => !ours(r.target) && (r.type === "childList" ? [...r.addedNodes, ...r.removedNodes].some((n) => !ours(n)) : r.attributeName === "selected" || r.attributeName === "value"));
    if (marked && adopt) this._v = marked.value;
    else if (this._v == null || !opts.some((o) => o.value === this._v)) this._v = (marked || opts[0])?.value ?? null;
    this._paint();
    if (this._open) this._rows();
  }

  _label() {
    if (this.hasAttribute("aria-label")) return { name: this.getAttribute("aria-label") };
    if (this.hasAttribute("aria-labelledby")) return { by: this.getAttribute("aria-labelledby") };
    const lab = this.closest("label"); // named by its label's own words, never its value
    const words = lab && [...lab.children].find((c) => c !== this && !c.contains(this) && (c.textContent || "").trim());
    if (words) { if (!words.id) words.id = `${this._id}-n`; return { by: words.id }; }
    return {};
  }

  _paint() {
    if (!this._built) return;
    const o = this.options.find((x) => x.value === this.value);
    setText(this._btn.querySelector(".dd-v"), o ? (o.textContent || "").trim() : "");
    const l = this._label();
    if (l.name) { this._btn.setAttribute("aria-label", l.name); this._btn.removeAttribute("aria-labelledby"); this._menu.setAttribute("aria-label", l.name); }
    if (l.by) { this._btn.setAttribute("aria-labelledby", l.by); this._btn.removeAttribute("aria-label"); this._menu.setAttribute("aria-labelledby", l.by); }
    this._btn.disabled = this.disabled;
    for (const a of ["aria-busy", "aria-disabled"]) { if (this.getAttribute(a) === "true") this._btn.setAttribute(a, "true"); else this._btn.removeAttribute(a); }
    if (this.title) this._btn.title = this.title;
  }

  _rows() {
    const cur = this.value, check = this.dataset.mark === "check", menu = this._menu;
    menu.innerHTML = "";
    menu.classList.toggle("is-check", check);
    this.options.forEach((o, i) => {
      const r = document.createElement("div");
      r.className = "dd-row"; r.id = `${this._id}-o${i}`; r.dataset.i = String(i);
      r.setAttribute("role", "option");
      const sel = o.value === cur;
      r.setAttribute("aria-selected", String(sel));
      if (o.disabled) r.setAttribute("aria-disabled", "true");
      const mk = document.createElement("span"); mk.className = "dd-mk"; mk.setAttribute("aria-hidden", "true");
      if (sel) mk.innerHTML = `<i class="dd-dot"></i>`;
      const t = document.createElement("span"); t.className = "dd-t"; t.textContent = (o.textContent || "").trim();
      if (!check) r.append(mk);
      if (o.dataset.icon && hasIcon(o.dataset.icon)) r.insertAdjacentHTML("beforeend", xi(o.dataset.icon, "dd-ic"));
      r.append(t);
      if (o.dataset.desc) { const d = document.createElement("span"); d.className = "dd-d"; d.textContent = o.dataset.desc; r.append(d); }
      if (check) r.insertAdjacentHTML("beforeend", `<span class="dd-ck" aria-hidden="true">${sel ? ICON.check : ""}</span>`);
      this._menu.append(r);
    });
  }

  open() {
    if (this._open || this.disabled || this.held || !this.options.length) return;
    if (openOne && openOne !== this) openOne.close(false);
    this.#exitScope?.dispose();
    this.#exitScope = null;
    openOne = this; this._open = true;
    this._rows();
    const m = this._menu;
    m.classList.remove("is-out", "is-up", "is-in");
    m.hidden = false;
    this._place(); // measured still: the arrival animation starts only once it stands where it belongs
    m.classList.add("is-in");
    this._btn.setAttribute("aria-expanded", "true");
    this.classList.add("is-open");
    this._activate(Math.max(0, this.selectedIndex), true, "center");
    const scope = createScope();
    this.#openScope = scope;
    scope.listen(document, "pointerdown", (e) => {
      const target = e.target;
      if (target instanceof Node && !this.contains(target) && !this.closest("label")?.contains(target)) this.close(false);
    }, true);
    scope.listen(window, "scroll", (e) => {
      if (!(e.target instanceof Node) || !m.contains(e.target)) this.close(false);
    }, true);
    scope.listen(window, "resize", () => this.close(false));
  }

  /** The rows' text starts on the button's, the dot hanging out to the left; below, or above when below is short. */
  _place() {
    const m = this._menu, b = this._btn.getBoundingClientRect();
    const cs = getComputedStyle(this._btn);
    const btnText = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
    m.style.left = m.style.top = "0px"; m.style.maxHeight = ""; m.style.minWidth = "";
    const first = m.querySelector(".dd-t");
    const zero = m.getBoundingClientRect(); // where (0,0) lands: a transformed ancestor moves it
    const rowText = first ? first.getBoundingClientRect().left - zero.left : 0;
    const hang = Math.max(0, rowText - btnText);
    m.style.maxWidth = `${Math.min(400, innerWidth - 2 * EDGE)}px`;
    m.style.minWidth = `${Math.min(b.width + hang, innerWidth - 2 * EDGE)}px`;
    const w = m.getBoundingClientRect().width;
    const below = innerHeight - b.bottom - GAP - EDGE, above = b.top - GAP - EDGE;
    const natural = m.scrollHeight + (m.offsetHeight - m.clientHeight);
    const up = natural > below && above > below;
    const room = up ? above : below;
    if (natural > room) m.style.maxHeight = `${Math.max(96, room)}px`;
    const h = Math.min(natural, Math.max(96, room));
    const left = Math.min(Math.max(EDGE, b.left - hang), innerWidth - EDGE - w);
    const top = up ? b.top - GAP - h : b.bottom + GAP;
    m.style.left = `${left - zero.left}px`;
    m.style.top = `${top - zero.top}px`;
    m.classList.toggle("is-up", up);
  }

  /** @param {boolean} refocus */
  close(refocus, animate = true) {
    if (!this._open) return;
    this._open = false; if (openOne === this) openOne = null;
    this.#openScope?.dispose();
    this.#openScope = null;
    this._btn.setAttribute("aria-expanded", "false");
    this._btn.removeAttribute("aria-activedescendant");
    this.classList.remove("is-open");
    const m = this._menu;
    if (RM.matches || !animate) this.#hideMenu();
    else {
      const scope = createScope();
      this.#exitScope = scope;
      const done = () => this.#hideMenu();
      m.classList.add("is-out");
      scope.listen(m, "animationend", done);
      scope.timeout(done, 220);
    }
    if (refocus) this._btn.focus({ preventScroll: true });
  }

  #hideMenu() {
    this.#exitScope?.dispose();
    this.#exitScope = null;
    this._menu.hidden = true;
    this._menu.classList.remove("is-out", "is-in");
  }

  /** @param {number} i */
  _activate(i, scroll = true, block = "nearest") {
    const rows = /** @type {HTMLElement[]} */ ([...this._menu.children]);
    if (!rows[i]) return;
    rows.forEach((r, k) => r.classList.toggle("is-cur", k === i));
    this._active = i;
    this._btn.setAttribute("aria-activedescendant", rows[i].id);
    const m = this._menu, r = rows[i]; // the list scrolls itself, never the page under it
    if (scroll && m.scrollHeight > m.clientHeight) {
      const pad = parseFloat(getComputedStyle(m).paddingTop) || 0;
      if (block === "center") m.scrollTop = r.offsetTop - (m.clientHeight - r.offsetHeight) / 2;
      else if (r.offsetTop - pad < m.scrollTop) m.scrollTop = r.offsetTop - pad;
      else if (r.offsetTop + r.offsetHeight + pad > m.scrollTop + m.clientHeight) m.scrollTop = r.offsetTop + r.offsetHeight + pad - m.clientHeight;
    }
  }

  /** @param {number} i */
  _choose(i) {
    const o = this.options[i];
    if (!o || o.disabled) return;
    if (this.held) { this.close(true); return; } // a choice while the last one saves: none
    const changed = o.value !== this.value;
    this._v = o.value; this._paint();
    this.close(true);
    if (changed) {
      this.dispatchEvent(new Event("input", { bubbles: true }));
      this.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  /** @param {number} from @param {number} d */
  _step(from, d) {
    const opts = this.options, n = opts.length;
    for (let i = from + d; i >= 0 && i < n; i += d) if (!opts[i].disabled) return i;
    return from;
  }
  /** @param {boolean} end */
  _edge(end) { return end ? this._step(this.options.length, -1) : this._step(-1, 1); }
  /** Ten rows on, then the nearest choosable option that way, else back: never a disabled one. @param {number} from @param {number} d */
  _page(from, d) {
    const n = this.options.length;
    const at = Math.max(0, Math.min(n - 1, from + 10 * d));
    const ok = (/** @type {number} */ j) => j >= 0 && j < n && !this.options[j].disabled;
    for (let j = at; j >= 0 && j < n; j += d) if (ok(j)) return j;
    for (let j = at - d; j >= 0 && j < n; j -= d) if (ok(j)) return j;
    return from;
  }

  /** @param {KeyboardEvent} e */
  _key(e) {
    const k = e.key, open = this._open;
    const take = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.metaKey || e.ctrlKey) return;
    if (!open) {
      if (k === "ArrowDown" || k === "ArrowUp" || k === "Enter" || k === " ") { take(); this.open(); return; }
      if (k === "Home" || k === "End") { take(); this.open(); this._activate(this._edge(k === "End")); return; }
      if (k.length === 1 && !e.altKey && k !== " ") { take(); this.open(); this._typeAhead(k); return; }
      return;
    }
    const i = this._active;
    switch (k) {
      case "ArrowDown": take(); this._activate(this._step(i, 1)); return;
      case "ArrowUp": take(); if (e.altKey) this._choose(i); else this._activate(this._step(i, -1)); return;
      case "Home": take(); this._activate(this._edge(false)); return;
      case "End": take(); this._activate(this._edge(true)); return;
      case "PageDown": take(); this._activate(this._page(i, 1)); return;
      case "PageUp": take(); this._activate(this._page(i, -1)); return;
      case "Enter": take(); this._choose(i); return;
      case "Escape": take(); this.close(true); return;
      case "Tab": this._choose(i); return; // chooses, and lets focus move on
      case " ": take(); if (this._typed && Date.now() - this._typedAt < TYPE_MS) this._typeAhead(" "); else this._choose(i); return;
      default: if (k.length === 1 && !e.altKey) { take(); this._typeAhead(k); }
    }
  }

  /** @param {string} ch */
  _typeAhead(ch) {
    const now = Date.now();
    this._typed = now - this._typedAt < TYPE_MS ? this._typed + ch.toLowerCase() : ch.toLowerCase();
    this._typedAt = now;
    const opts = this.options, n = opts.length;
    const same = [...this._typed].every((c) => c === this._typed[0]);
    const q = same ? this._typed[0] : this._typed;
    const start = same || this._typed.length === 1 ? this._active + 1 : this._active;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (!opts[i].disabled && (opts[i].textContent || "").trim().toLowerCase().startsWith(q)) { this._activate(i); return; }
    }
  }
}

export function defineXoSelect() {
  if (!customElements.get("xo-select")) customElements.define("xo-select", XoSelect);
}
