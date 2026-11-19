// @ts-check

export class FakeEl {
  /** @param {string} tag @param {FakeDoc} doc */
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.parent = null;
    this.attrs = new Map(); this.dataset = {}; this.listeners = new Map(); this.hidden = false; this.textContent = ""; this.className = "";
    this.props = new Map();
    this.style = { setProperty: (/** @type {string} */ k, /** @type {string} */ v) => this.props.set(k, v) };
    this.contentWindow = null; this.srcdoc = ""; this.type = ""; this.src = ""; this.alt = ""; this.tabIndex = -1;
  }
  get isConnected() { let n = this; while (n.parent) n = n.parent; return n === this.ownerDocument.body; }
  append(...kids) { for (const k of kids) { if (k.parent) k.remove(); k.parent = this; this.children.push(k); if (k.tagName === "IFRAME" && k.isConnected) k.attach(); } }
  remove() { if (!this.parent) return; this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; if (this.tagName === "IFRAME") this.contentWindow = null; }
  contains(n) { for (let x = n; x; x = x.parent) if (x === this) return true; return false; }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  addEventListener(t, fn) { if (!this.listeners.has(t)) this.listeners.set(t, []); this.listeners.get(t).push(fn); }
  dispatch(t, extra = {}) { for (const fn of this.listeners.get(t) || []) fn({ type: t, target: this, preventDefault() {}, ...extra }); }
  focus() { this.ownerDocument.activeElement = this; }
  querySelector() { return null; }
  find(pred) { for (const c of this.children) { if (pred(c)) return c; const f = c.find(pred); if (f) return f; } return null; }
  attach() { this.contentWindow = { sent: [], postMessage(m, o) { this.sent.push({ m, o }); } }; }
}
export class FakeDoc {
  constructor() {
    this.body = new FakeEl("body", this); this.activeElement = this.body;
    this.documentElement = new FakeEl("html", this); this.documentElement.setAttribute("data-theme", "dark");
    this.defaultView = { getComputedStyle: () => ({ getPropertyValue: (/** @type {string} */ t) => ({ "--surface": "#111", "--ink": "#eee", "--sans": "Geist, sans-serif", "--accent": "red;}</style><script>" })[t] || "" }) };
  }
  createElement(tag) { return new FakeEl(tag, this); }
}

/** A message event as a sandboxed frame sends it. @param {unknown} data @param {unknown} source @param {string} [origin] */
export function message(data, source, origin = "null") {
  const e = new Event("message");
  Object.defineProperties(e, { data: { value: data }, source: { value: source }, origin: { value: origin } });
  return e;
}

/** Timers a test drives by hand. */
export function fakeTimers() {
  let now = 0, seq = 0;
  /** @type {Map<number, { at: number, fn: () => void, every?: number }>} */
  const q = new Map();
  const T = {
    now: () => now,
    setTimeout: (fn, ms) => { q.set(++seq, { at: now + ms, fn }); return seq; },
    clearTimeout: (id) => { q.delete(id); },
    setInterval: (fn, ms) => { q.set(++seq, { at: now + ms, fn, every: ms }); return seq; },
    clearInterval: (id) => { q.delete(id); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...q.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, t] = next;
        now = t.at;
        if (t.every) t.at += t.every; else q.delete(id);
        t.fn();
      }
      now = end;
    },
  };
  return /** @type {any} */ (T);
}
export const tick = () => new Promise((r) => setTimeout(r, 0));
