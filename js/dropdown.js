// One dropdown for the whole app: <xo-select>, in place of the browser's own <select>.
//
// Written like a select, read like a select:
//   <xo-select data-cs="model" aria-label="Model">
//     <option value="">The agent's default</option>
//     <option value="opus" data-desc="For complex work" selected>Opus 5.5</option>
//   </xo-select>
//   el.value, el.value = "opus", el.options, el.focus(); a bubbling "change" (and "input") on a choice.
// So callers keep their markup and their "change" listeners; only the tag changes.
//
// It looks like the composer's model picker (css/dropdown.css): its surface, line, shadow, row type,
// the same neutral dot for the chosen row, the same fade-and-settle. It behaves like the WAI-ARIA
// select-only combobox: focus stays on the button (role=combobox), the open list is a listbox and the
// active row is aria-activedescendant. Keys: ↓ ↑ Enter Space Alt+↓ open; ↓ ↑ Home End PageUp
// PageDown move; Enter Space Alt+↑ choose; Tab chooses and moves on; Esc closes, changing nothing;
// typing jumps to the row that starts with what you typed (the same letter again cycles).
//
// Its options are its own <option> children, kept hidden: re-render them (innerHTML, setHtml) and it
// follows. The open list is position:fixed, so no scrolling box or popover clips it.

import { ICON } from "./ui.js";

const CHEV = ICON.chevron;
const GAP = 4;          // trigger → list
const EDGE = 8;         // the list never comes closer than this to the window's edge
const TYPE_MS = 600;    // type-ahead: keys closer than this make one word
let seq = 0;
let openOne = null;     // only one list is ever open

class XoSelect extends HTMLElement {
  constructor() {
    super();
    this._v = null; this._active = -1; this._typed = ""; this._typedAt = 0; this._built = false;
  }

  // ── a select's surface ──────────────────────────────────────────────────────────────────────────
  get options() { return [...this.children].filter((c) => c.tagName === "OPTION"); }
  get value() { return this._v ?? (this.options[0]?.value ?? ""); }
  set value(v) { this._v = String(v); this._paint(); }
  get selectedIndex() { return this.options.findIndex((o) => o.value === this.value); }
  get disabled() { return this.hasAttribute("disabled"); }
  set disabled(on) { this.toggleAttribute("disabled", !!on); }
  focus(opts) { this._btn?.focus(opts); }
  blur() { this._btn?.blur(); }

  static get observedAttributes() { return ["disabled", "aria-label"]; }
  attributeChangedCallback() { if (this._built) this._paint(); }

  connectedCallback() {
    if (!this._built) this._build();
    this._sync();
  }
  disconnectedCallback() { if (openOne === this) this.close(false); }

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
    this._btn = b; this._menu = m;

    b.addEventListener("click", () => (this._open ? this.close(true) : this.open()));
    b.addEventListener("keydown", (e) => this._key(e));
    // focus that a re-render takes away (its options replaced, innerHTML) comes back with the button
    b.addEventListener("focus", () => { this._focused = true; });
    // (the browser says blur before it takes the button out, so look once the removal is done)
    b.addEventListener("blur", () => queueMicrotask(() => {
      if (b.parentNode !== this || document.activeElement === b) return;
      this._focused = false;
      if (this._open) this.close(false);
    }));
    // a press in the list never takes focus from the button (so blur means "focus went elsewhere")
    m.addEventListener("pointerdown", (e) => e.preventDefault());
    m.addEventListener("pointermove", (e) => { const r = e.target.closest?.(".dd-row"); if (r && !r.hasAttribute("aria-disabled")) this._activate(+r.dataset.i, false); });
    m.addEventListener("click", (e) => {
      // inside a <label>, a click on the list must not be passed on to the button as well
      e.preventDefault(); e.stopPropagation();
      const r = e.target.closest(".dd-row");
      if (r && !r.hasAttribute("aria-disabled")) this._choose(+r.dataset.i);
    });

    // the options are the source: re-rendered options (innerHTML) bring the button and list back
    this._mo = new MutationObserver((recs) => {
      if (recs.every((r) => this._menu.contains(r.target) || this._btn.contains(r.target))) return;
      this._sync(recs);
    });
    this._mo.observe(this, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ["selected", "disabled", "value", "label", "data-desc"] });
  }

  /** recs: the changes that brought it here. The current choice changes only when the options themselves or what
   *  they say is selected change; a change of availability (disabled) or of a description keeps it (Astra S229:
   *  disabling the select quietly put the first value back). */
  _sync(recs = null) {
    let back = false;
    if (this._btn.parentNode !== this) { this.append(this._btn); back = true; }
    if (this._menu.parentNode !== this) this.append(this._menu);
    if (back && this._focused && this.isConnected && (!document.activeElement || document.activeElement === document.body)) this._btn.focus({ preventScroll: true });
    this._mo.takeRecords();
    const opts = this.options;
    const marked = opts.find((o) => o.hasAttribute("selected"));
    const adopt = !recs || recs.some((r) => r.type === "childList" || r.attributeName === "selected" || r.attributeName === "value");
    if (marked && adopt) this._v = marked.value;
    else if (this._v == null || !opts.some((o) => o.value === this._v)) this._v = (marked || opts[0])?.value ?? null;
    this._paint();
    if (this._open) this._rows();
  }

  _label() {
    if (this.hasAttribute("aria-label")) return { name: this.getAttribute("aria-label") };
    if (this.hasAttribute("aria-labelledby")) return { by: this.getAttribute("aria-labelledby") };
    // inside <label><span>Folder</span><xo-select>…: named by the label's own words, never its value
    const lab = this.closest("label");
    const words = lab && [...lab.children].find((c) => c !== this && !c.contains(this) && c.textContent.trim());
    if (words) { if (!words.id) words.id = `${this._id}-n`; return { by: words.id }; }
    return {};
  }

  _paint() {
    if (!this._built) return;
    const o = this.options.find((x) => x.value === this.value);
    this._btn.querySelector(".dd-v").textContent = o ? o.textContent.trim() : "";
    const l = this._label();
    if (l.name) { this._btn.setAttribute("aria-label", l.name); this._btn.removeAttribute("aria-labelledby"); this._menu.setAttribute("aria-label", l.name); }
    if (l.by) { this._btn.setAttribute("aria-labelledby", l.by); this._btn.removeAttribute("aria-label"); this._menu.setAttribute("aria-labelledby", l.by); }
    this._btn.disabled = this.disabled;
    if (this.title) this._btn.title = this.title;
  }

  _rows() {
    const cur = this.value;
    this._menu.innerHTML = "";
    this.options.forEach((o, i) => {
      const r = document.createElement("div");
      r.className = "dd-row"; r.id = `${this._id}-o${i}`; r.dataset.i = i;
      r.setAttribute("role", "option");
      const sel = o.value === cur;
      r.setAttribute("aria-selected", String(sel));
      if (o.disabled) r.setAttribute("aria-disabled", "true");
      const mk = document.createElement("span"); mk.className = "dd-mk"; mk.setAttribute("aria-hidden", "true");
      if (sel) mk.innerHTML = `<i class="dd-dot"></i>`;
      const t = document.createElement("span"); t.className = "dd-t"; t.textContent = o.textContent.trim();
      r.append(mk, t);
      if (o.dataset.desc) { const d = document.createElement("span"); d.className = "dd-d"; d.textContent = o.dataset.desc; r.append(d); }
      this._menu.append(r);
    });
  }

  // ── open, place, close ─────────────────────────────────────────────────────────────────────────
  open() {
    if (this._open || this.disabled || !this.options.length) return;
    if (openOne && openOne !== this) openOne.close(false);
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
    // a press on its own <label> is the button's (it toggles), anything else outside closes it
    this._onAway = (e) => { if (!this.contains(e.target) && !this.closest("label")?.contains(e.target)) this.close(false); };
    this._onMove = (e) => { if (e.type === "resize" || !m.contains(e.target)) this.close(false); };
    document.addEventListener("pointerdown", this._onAway, true);
    addEventListener("scroll", this._onMove, true);
    addEventListener("resize", this._onMove);
  }

  // the list's row text starts on the button's text: the dot hangs out to the left, like a menu
  // laid over its control. It opens below, or above when below is short, and scrolls past the room.
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

  close(refocus) {
    if (!this._open) return;
    this._open = false; if (openOne === this) openOne = null;
    document.removeEventListener("pointerdown", this._onAway, true);
    removeEventListener("scroll", this._onMove, true);
    removeEventListener("resize", this._onMove);
    this._btn.setAttribute("aria-expanded", "false");
    this._btn.removeAttribute("aria-activedescendant");
    this.classList.remove("is-open");
    const m = this._menu;
    const done = () => { if (!this._open) { m.hidden = true; m.classList.remove("is-out", "is-in"); } };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) done();
    else { m.classList.add("is-out"); m.addEventListener("animationend", done, { once: true }); setTimeout(done, 220); }
    if (refocus) this._btn.focus({ preventScroll: true });
  }

  _activate(i, scroll = true, block = "nearest") {
    const rows = [...this._menu.children];
    if (!rows[i]) return;
    rows.forEach((r, k) => r.classList.toggle("is-cur", k === i));
    this._active = i;
    this._btn.setAttribute("aria-activedescendant", rows[i].id);
    // the list scrolls itself, never the page under it
    const m = this._menu, r = rows[i];
    if (scroll && m.scrollHeight > m.clientHeight) {
      const pad = parseFloat(getComputedStyle(m).paddingTop) || 0;
      if (block === "center") m.scrollTop = r.offsetTop - (m.clientHeight - r.offsetHeight) / 2;
      else if (r.offsetTop - pad < m.scrollTop) m.scrollTop = r.offsetTop - pad;
      else if (r.offsetTop + r.offsetHeight + pad > m.scrollTop + m.clientHeight) m.scrollTop = r.offsetTop + r.offsetHeight + pad - m.clientHeight;
    }
  }

  _choose(i) {
    const o = this.options[i];
    if (!o || o.disabled) return;
    const changed = o.value !== this.value;
    this._v = o.value; this._paint();
    this.close(true);
    if (changed) {
      this.dispatchEvent(new Event("input", { bubbles: true }));
      this.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // ── keys ───────────────────────────────────────────────────────────────────────────────────────
  _step(from, d) {
    const opts = this.options, n = opts.length;
    for (let i = from + d; i >= 0 && i < n; i += d) if (!opts[i].disabled) return i;
    return from;
  }
  _edge(end) { return end ? this._step(this.options.length, -1) : this._step(-1, 1); }
  /** PageDown / PageUp: ten rows on (or to the end), then the nearest choosable option in that direction, else
   *  the nearest one back; the cursor never rests on a disabled option. */
  _page(from, d) {
    const n = this.options.length;
    const at = Math.max(0, Math.min(n - 1, from + 10 * d));
    const ok = (j) => j >= 0 && j < n && !this.options[j].disabled;
    for (let j = at; j >= 0 && j < n; j += d) if (ok(j)) return j;
    for (let j = at - d; j >= 0 && j < n; j -= d) if (ok(j)) return j;
    return from;
  }

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
      // ten rows on, then on to the nearest option that can be chosen (never a disabled one: Astra S230)
      case "PageDown": take(); this._activate(this._page(i, 1)); return;
      case "PageUp": take(); this._activate(this._page(i, -1)); return;
      case "Enter": take(); this._choose(i); return;
      case "Escape": take(); this.close(true); return;
      case "Tab": this._choose(i); return; // chooses, and lets focus move on
      case " ": take(); if (this._typed && Date.now() - this._typedAt < TYPE_MS) this._typeAhead(" "); else this._choose(i); return;
      default: if (k.length === 1 && !e.altKey) { take(); this._typeAhead(k); }
    }
  }

  _typeAhead(ch) {
    const now = Date.now();
    this._typed = now - this._typedAt < TYPE_MS ? this._typed + ch.toLowerCase() : ch.toLowerCase();
    this._typedAt = now;
    const opts = this.options, n = opts.length;
    // the same letter again walks through the rows that start with it
    const same = [...this._typed].every((c) => c === this._typed[0]);
    const q = same ? this._typed[0] : this._typed;
    const start = same || this._typed.length === 1 ? this._active + 1 : this._active;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (!opts[i].disabled && opts[i].textContent.trim().toLowerCase().startsWith(q)) { this._activate(i); return; }
    }
  }
}

if (!customElements.get("xo-select")) customElements.define("xo-select", XoSelect);
