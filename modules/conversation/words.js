// @ts-check

// A message's words as they read, for every Copy: paragraphs apart, pre text as written, and nothing the app adds around them.

/** @type {Record<string, number>} */
const BLOCK = { P: 2, BLOCKQUOTE: 2, PRE: 2, H1: 2, H2: 2, H3: 2, H4: 2, H5: 2, H6: 2, TABLE: 2, UL: 1, OL: 1, LI: 1, DIV: 1, TR: 1, HR: 1, FIGURE: 1, DETAILS: 1, SUMMARY: 1, DL: 1, DT: 1, DD: 1 };
const NOT_WORDS = ".mx-name, .mx-acts, .mx-swipe, .mx-qc, .md-code-head, button, svg, [aria-hidden='true'], .sr-only";
/** @param {Element} root */
export function wordsOf(root) {
  let out = "", flowing = true, keep = 0;
  const tidy = () => { if (flowing) out = out.replace(/ +$/, ""); };
  /** @param {number} n */
  const brk = (n) => { if (!out) return; tidy(); const have = out.length - out.replace(/\n+$/, "").length; if (have < n) out += "\n".repeat(n - have); };
  /** @param {Element} el @param {boolean} lines @param {boolean} spaces @returns {[boolean, boolean]} */
  const mode = (el, lines, spaces) => { const w = getComputedStyle(el).whiteSpace; return [lines || /^pre|^break-spaces/.test(w), spaces || w === "pre" || w === "pre-wrap" || w === "break-spaces"]; };
  (/** @param {Element} el @param {boolean} lines @param {boolean} spaces */ function walk(el, lines, spaces) {
    for (const c of el.childNodes) {
      if (c.nodeType === 3) {
        let t = c.nodeValue || "";
        if (!spaces) { t = lines ? t.replace(/[^\S\n]+/g, " ") : t.replace(/\s+/g, " "); if (!out || out.endsWith("\n")) t = t.replace(/^ /, ""); }
        if (t) { out += t; flowing = !spaces; keep = spaces ? out.length : out.replace(/ +$/, "").length; }
        continue;
      }
      if (c.nodeType !== 1) continue;
      const e = /** @type {HTMLElement} */ (c);
      if (e.matches(NOT_WORDS)) continue;
      if (e.matches("[data-tex]")) {
        const b = e.classList.contains("is-block");
        if (b) brk(2);
        out += b ? "$$\n" + e.dataset.tex + "\n$$" : "$" + e.dataset.tex + "$";
        flowing = false; keep = out.length;
        if (b) brk(2);
        continue;
      }
      if (e.matches(".md-chart")) { brk(2); out += e.getAttribute("aria-label") || "Chart"; flowing = false; keep = out.length; brk(2); continue; }
      if (e.tagName === "BR") { tidy(); out += "\n"; continue; }
      const b = BLOCK[e.tagName] || 0;
      if (b) brk(b);
      walk(e, ...mode(e, lines, spaces));
      if (b) brk(b); else if (e.tagName === "TD" || e.tagName === "TH") out += " ";
    }
  })(root, ...mode(root, false, false));
  return out.slice(0, keep);
}
